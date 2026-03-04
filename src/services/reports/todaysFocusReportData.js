"use strict";

const { prisma } = require("../../lib/prisma");
const { hasPermissionWithoutRoleBypass } = require("../../lib/rbac");
const { getDayRange, getYesterday, getLast7Days } = require("./dateUtils");

/**
 * Build base task filter by project visibility for a user.
 * @param {number} userId
 * @returns {Promise<Record<string, unknown>>}
 */
async function getTaskWhereBase(userId) {
  const canViewAll = await hasPermissionWithoutRoleBypass(userId, "project.viewAll");
  if (canViewAll) return {};
  return {
    project: {
      OR: [
        { projectManagerId: userId },
        { createdById: userId },
        { projectUsers: { some: { userId } } },
      ],
    },
  };
}

/**
 * Get start/end of day in UTC for date string "YYYY-MM-DD".
 * @param {string} dateStr
 * @returns {{ start: Date, end: Date }}
 */
function dayBounds(dateStr) {
  return getDayRange(dateStr);
}

/**
 * Today's Focus tasks for a given date (single calendar day in UTC).
 * Definition: plannedDate in day OR completedAt in day OR startedAt in day OR has timeLog on day OR (active and dueDate in day).
 */
function buildTodaysFocusWhere(dateStr, taskWhereBase) {
  const { start, end } = dayBounds(dateStr);
  return {
    ...taskWhereBase,
    OR: [
      { plannedDate: { gte: start, lte: end } },
      { completedAt: { gte: start, lte: end } },
      { startedAt: { gte: start, lte: end } },
      { timeLogs: { some: { logDate: { gte: start, lte: end } } } },
      {
        dueDate: { gte: start, lte: end },
        completedAt: null,
        taskStatus: { isFinal: false },
      },
    ],
  };
}

/**
 * Fetch tasks for "Today's Focus" for selectedDate, with timeLogs for that day and assignees.
 * Returns minimal shape for KPI layer.
 * @param {number} userId - for project visibility
 * @param {string} dateStr - "YYYY-MM-DD"
 * @returns {Promise<{ tasks: Array<{ id: number, projectId: number, plannedDate: Date|null, dueDate: Date|null, createdAt: Date|null, startedAt: Date|null, completedAt: Date|null, assigneeIds: number[], timeLogs: Array<{ userId: number, hoursLogged: number }> }>, completedStatusIds: number[] }>}
 */
async function fetchTodaysFocusTasksForDate(userId, dateStr) {
  const taskWhereBase = await getTaskWhereBase(userId);
  const { start, end } = dayBounds(dateStr);

  const taskStatuses = await prisma.taskStatus.findMany({
    select: { id: true, isFinal: true },
  });
  const completedStatusIds = taskStatuses.filter((s) => s.isFinal).map((s) => s.id);

  const tasks = await prisma.task.findMany({
    where: buildTodaysFocusWhere(dateStr, taskWhereBase),
    select: {
      id: true,
      projectId: true,
      plannedDate: true,
      dueDate: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
      assignees: { select: { id: true } },
      timeLogs: {
        where: { logDate: { gte: start, lte: end } },
        select: { userId: true, hoursLogged: true },
      },
    },
  });

  const normalized = tasks.map((t) => ({
    id: t.id,
    projectId: t.projectId,
    plannedDate: t.plannedDate,
    dueDate: t.dueDate,
    createdAt: t.createdAt,
    startedAt: t.startedAt,
    completedAt: t.completedAt,
    assigneeIds: t.assignees.map((a) => a.id),
    timeLogs: t.timeLogs.map((l) => ({ userId: l.userId, hoursLogged: l.hoursLogged })),
  }));

  return { tasks: normalized, completedStatusIds };
}

/**
 * Fetch same shape for yesterday (for carry-over and comparison).
 */
async function fetchTodaysFocusTasksForYesterday(userId, selectedDateStr) {
  const yesterdayStr = getYesterday(selectedDateStr);
  return fetchTodaysFocusTasksForDate(userId, yesterdayStr);
}

/**
 * Fetch aggregated data for last 7 days (for rolling normalization).
 * Returns per-day: task list + completedStatusIds for that day's tasks.
 * @param {number} userId
 * @param {string} selectedDateStr - "YYYY-MM-DD" (last day of window)
 * @returns {Promise<Array<{ date: string, tasks: Array<{ id: number, projectId: number, plannedDate: Date|null, dueDate: Date|null, createdAt: Date|null, startedAt: Date|null, completedAt: Date|null, assigneeIds: number[], timeLogs: Array<{ userId: number, hoursLogged: number }> }>, completedStatusIds: number[] }>>}
 */
async function fetchLast7DaysData(userId, selectedDateStr) {
  const days = getLast7Days(selectedDateStr);
  const result = [];
  for (const d of days) {
    const { tasks, completedStatusIds } = await fetchTodaysFocusTasksForDate(userId, d);
    result.push({ date: d, tasks, completedStatusIds });
  }
  return result;
}

/**
 * Carry-over: tasks planned for previous day that were not completed by end of previous day, still present "today".
 * @param {string} selectedDateStr
 * @param {ReturnType<typeof fetchTodaysFocusTasksForDate> extends Promise<infer T> ? T : never} todayData
 * @param {ReturnType<typeof fetchTodaysFocusTasksForDate> extends Promise<infer T> ? T : never} yesterdayData
 * @returns {number} count of carry-over tasks
 */
function computeCarryOverCount(selectedDateStr, todayData, yesterdayData) {
  const { start: yestStart, end: yestEnd } = dayBounds(getYesterday(selectedDateStr));
  const completedYesterday = new Set(
    yesterdayData.tasks
      .filter((t) => t.completedAt && t.completedAt >= yestStart && t.completedAt <= yestEnd)
      .map((t) => t.id)
  );
  const plannedYesterday = new Set(
    yesterdayData.tasks.filter(
      (t) => t.plannedDate && t.plannedDate >= yestStart && t.plannedDate <= yestEnd
    ).map((t) => t.id)
  );
  const carried = plannedYesterday.size - [...plannedYesterday].filter((id) => completedYesterday.has(id)).length;
  const todayIds = new Set(todayData.tasks.map((t) => t.id));
  let count = 0;
  for (const id of plannedYesterday) {
    if (!completedYesterday.has(id) && todayIds.has(id)) count++;
  }
  return count;
}

/**
 * Fetch project names for projectId list (for breakdowns).
 * @param {number[]} projectIds
 * @returns {Promise<Map<number, string>>}
 */
async function fetchProjectNames(projectIds) {
  if (projectIds.length === 0) return new Map();
  const list = await prisma.project.findMany({
    where: { id: { in: [...new Set(projectIds)] } },
    select: { id: true, name: true },
  });
  return new Map(list.map((p) => [p.id, p.name]));
}

/**
 * Fetch user names for userId list (for breakdowns).
 * @param {number[]} userIds
 * @returns {Promise<Map<number, string>>}
 */
async function fetchUserNames(userIds) {
  if (userIds.length === 0) return new Map();
  const list = await prisma.user.findMany({
    where: { id: { in: [...new Set(userIds)] } },
    select: { id: true, username: true },
  });
  return new Map(list.map((u) => [u.id, u.username]));
}

module.exports = {
  getTaskWhereBase,
  dayBounds,
  buildTodaysFocusWhere,
  fetchTodaysFocusTasksForDate,
  fetchTodaysFocusTasksForYesterday,
  fetchLast7DaysData,
  computeCarryOverCount,
  fetchProjectNames,
  fetchUserNames,
};
