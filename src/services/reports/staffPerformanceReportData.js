"use strict";

const { prisma } = require("../../lib/prisma");
const { getCairoDayRangeUtc, getCairoDateString } = require("../../lib/cairoDateUtils");
const { MAX_PERIOD_DAYS } = require("./staffPerformanceReportTypes");

/**
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {string[]}
 */
function enumerateDateStrings(startDate, endDate) {
  const dates = [];
  let current = startDate;
  while (current <= endDate) {
    dates.push(current);
    const d = new Date(`${current}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    current = d.toISOString().slice(0, 10);
  }
  return dates;
}

/**
 * @param {string} startDate
 * @param {string} endDate
 */
function validatePeriod(startDate, endDate) {
  const start = startDate || getCairoDateString();
  const end = endDate || start;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    throw new Error("Invalid date; use YYYY-MM-DD");
  }
  if (start > end) throw new Error("startDate must be before or equal to endDate");
  const days = enumerateDateStrings(start, end);
  if (days.length > MAX_PERIOD_DAYS) {
    throw new Error(`Period cannot exceed ${MAX_PERIOD_DAYS} days`);
  }
  return { startDate: start, endDate: end, periodDays: days };
}

/**
 * @param {{ startDate?: string, endDate?: string, teamId?: number|null, userIds?: number[]|null }} filters
 */
async function fetchStaffPerformanceData(filters = {}) {
  const { startDate, endDate, periodDays } = validatePeriod(
    filters.startDate || getCairoDateString(),
    filters.endDate || getCairoDateString()
  );
  const { start: periodStart } = getCairoDayRangeUtc(startDate);
  const { end: periodEnd } = getCairoDayRangeUtc(endDate);

  const userWhere = { isActive: true };
  if (filters.teamId != null && !Number.isNaN(Number(filters.teamId))) {
    userWhere.teamId = Number(filters.teamId);
  }
  if (filters.userIds?.length) {
    userWhere.id = { in: filters.userIds.map(Number).filter((n) => !Number.isNaN(n)) };
  }

  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      username: true,
      email: true,
      teamId: true,
      team: { select: { id: true, name: true } },
    },
    orderBy: { username: "asc" },
  });

  const userIdList = users.map((u) => u.id);
  if (userIdList.length === 0) {
    return {
      users: [],
      tasks: [],
      shifts: [],
      timeLogs: [],
      comments: [],
      mentions: [],
      activities: [],
      periodStart,
      periodEnd,
      startDate,
      endDate,
      periodDays,
    };
  }

  const [tasks, shifts, timeLogs, comments, mentions, activities] = await Promise.all([
    prisma.task.findMany({
      where: { assignees: { some: { id: { in: userIdList } } } },
      select: {
        id: true,
        title: true,
        projectId: true,
        priority: true,
        dueDate: true,
        plannedDate: true,
        startedAt: true,
        completedAt: true,
        rolloverCount: true,
        createdAt: true,
        updatedAt: true,
        taskStatus: { select: { isFinal: true, isBlocking: true, name: true } },
        project: { select: { id: true, name: true } },
        assignees: { select: { id: true } },
      },
    }),
    prisma.workShift.findMany({
      where: {
        userId: { in: userIdList },
        shiftDate: { gte: startDate, lte: endDate },
      },
      select: {
        userId: true,
        shiftDate: true,
        notes: true,
        startAt: true,
        endAt: true,
      },
    }),
    prisma.timeLog.findMany({
      where: {
        userId: { in: userIdList },
        logDate: { gte: periodStart, lte: periodEnd },
      },
      select: {
        userId: true,
        logDate: true,
        hoursLogged: true,
        description: true,
      },
    }),
    prisma.comment.findMany({
      where: {
        userId: { in: userIdList },
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      select: {
        userId: true,
        content: true,
        createdAt: true,
        id: true,
      },
    }),
    prisma.commentMention.findMany({
      where: {
        userId: { in: userIdList },
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      select: { userId: true, createdAt: true },
    }),
    prisma.activityLog.findMany({
      where: {
        performedById: { in: userIdList },
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      select: {
        performedById: true,
        createdAt: true,
        actionSummary: true,
        actionCategory: true,
      },
    }),
  ]);

  return {
    users,
    tasks,
    shifts,
    timeLogs,
    comments,
    mentions,
    activities,
    periodStart,
    periodEnd,
    startDate,
    endDate,
    periodDays,
  };
}

module.exports = {
  enumerateDateStrings,
  validatePeriod,
  fetchStaffPerformanceData,
};
