"use strict";

const { formatInTimeZone } = require("date-fns-tz");
const { prisma } = require("../../lib/prisma");
const { getCairoDayRangeUtc } = require("../../lib/cairoDateUtils");
const { computeRegularityScore } = require("./performanceCalculation");

const CAIRO_TIMEZONE = "Africa/Cairo";
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateDateRangeStrings(startDate, endDate) {
  const start = String(startDate || "").slice(0, 10);
  const end = String(endDate || "").slice(0, 10);
  if (!DATE_REGEX.test(start) || !DATE_REGEX.test(end)) {
    const err = new Error("startDate and endDate must be YYYY-MM-DD");
    err.statusCode = 400;
    throw err;
  }
  if (start > end) {
    const err = new Error("startDate must be on or before endDate");
    err.statusCode = 400;
    throw err;
  }
  return { start, end };
}

function overlapDayCount(queryStart, queryEnd, periodStart, periodEnd) {
  const start = queryStart > periodStart ? queryStart : periodStart;
  const end = queryEnd < periodEnd ? queryEnd : periodEnd;
  if (start > end) return 0;
  return enumerateDateStrings(start, end).length;
}

/**
 * @param {Date|string} value
 * @returns {string}
 */
function toCairoDateString(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return formatInTimeZone(d, CAIRO_TIMEZONE, "yyyy-MM-dd");
}

/**
 * @param {Date} date - @db.Date field
 * @returns {string}
 */
function periodDateToString(date) {
  if (!date) return "";
  if (date instanceof Date) {
    return date.toISOString().slice(0, 10);
  }
  return String(date).slice(0, 10);
}

/**
 * @param {string} startDate
 * @param {string} endDate
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
 * @param {number} periodId
 */
async function loadPerformancePeriod(periodId) {
  const period = await prisma.performancePeriod.findUnique({
    where: { id: Number(periodId) },
  });
  if (!period) {
    const err = new Error("Performance period not found");
    err.statusCode = 404;
    throw err;
  }
  const startDate = periodDateToString(period.startDate);
  const endDate = periodDateToString(period.endDate);
  const periodDays = enumerateDateStrings(startDate, endDate);
  const { start: periodStart } = getCairoDayRangeUtc(startDate);
  const { end: periodEnd } = getCairoDayRangeUtc(endDate);

  return {
    period,
    startDate,
    endDate,
    periodDays,
    periodStart,
    periodEnd,
    expectedWorkingDays: periodDays.length,
  };
}

/**
 * Resolve a performance period id from a requested date range.
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Promise<number>}
 */
async function findPerformancePeriodByDateRange(startDate, endDate) {
  const { start, end } = validateDateRangeStrings(startDate, endDate);

  const periods = await prisma.performancePeriod.findMany({
    orderBy: { endDate: "desc" },
  });

  if (!periods.length) {
    const err = new Error("No performance period found for this date range");
    err.statusCode = 404;
    throw err;
  }

  const mapped = periods.map((p) => ({
    id: p.id,
    startDate: periodDateToString(p.startDate),
    endDate: periodDateToString(p.endDate),
  }));

  const exact = mapped.find((p) => p.startDate === start && p.endDate === end);
  if (exact) return exact.id;

  const contains = mapped.filter((p) => p.startDate <= start && p.endDate >= end);
  if (contains.length) return contains[0].id;

  let bestId = null;
  let bestOverlap = 0;
  for (const p of mapped) {
    const days = overlapDayCount(start, end, p.startDate, p.endDate);
    if (days > bestOverlap) {
      bestOverlap = days;
      bestId = p.id;
    }
  }

  if (bestId == null || bestOverlap === 0) {
    const err = new Error("No performance period found for this date range");
    err.statusCode = 404;
    throw err;
  }

  return bestId;
}

/**
 * @param {{ teamId?: number|null, userIds?: number[]|null }} filters
 */
async function resolveTargetUsers(filters = {}) {
  const where = { isActive: true };
  if (filters.teamId != null && !Number.isNaN(Number(filters.teamId))) {
    where.teamId = Number(filters.teamId);
  }
  if (filters.userIds?.length) {
    where.id = { in: filters.userIds.map(Number).filter((n) => !Number.isNaN(n)) };
  }

  return prisma.user.findMany({
    where,
    select: { id: true, username: true, role: true, teamId: true },
    orderBy: { username: "asc" },
  });
}

/**
 * Fetch auto metrics for multiple users in one period.
 * @param {number} periodId
 * @param {number[]} userIds
 */
async function fetchAutoMetricsForUsers(periodId, userIds) {
  if (!userIds.length) return new Map();

  const ctx = await loadPerformancePeriod(periodId);
  const { startDate, endDate, periodStart, periodEnd, expectedWorkingDays } = ctx;

  const [dailyUpdates, tasks, timeLogs, activities] = await Promise.all([
    prisma.dailyUpdate.findMany({
      where: {
        userId: { in: userIds },
        updateDate: { gte: startDate, lte: endDate },
        submittedAt: { not: null },
      },
      select: {
        userId: true,
        projectId: true,
        updateDate: true,
      },
    }),
    prisma.task.findMany({
      where: { assignees: { some: { id: { in: userIds } } } },
      select: {
        projectId: true,
        startedAt: true,
        completedAt: true,
        assignees: { select: { id: true } },
      },
    }),
    prisma.timeLog.findMany({
      where: {
        userId: { in: userIds },
        logDate: { gte: periodStart, lte: periodEnd },
      },
      select: { userId: true, logDate: true },
    }),
    prisma.activityLog.findMany({
      where: {
        performedById: { in: userIds },
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      select: { performedById: true, createdAt: true },
    }),
  ]);

  const updatesByUser = new Map();
  userIds.forEach((id) => updatesByUser.set(id, []));

  dailyUpdates.forEach((u) => {
    if (updatesByUser.has(u.userId)) updatesByUser.get(u.userId).push(u);
  });

  const tasksByUser = new Map();
  userIds.forEach((id) => tasksByUser.set(id, []));
  tasks.forEach((t) => {
    (t.assignees || []).forEach((a) => {
      if (tasksByUser.has(a.id)) tasksByUser.get(a.id).push(t);
    });
  });

  const timeLogsByUser = new Map();
  userIds.forEach((id) => timeLogsByUser.set(id, []));
  timeLogs.forEach((l) => {
    if (timeLogsByUser.has(l.userId)) timeLogsByUser.get(l.userId).push(l);
  });

  const activitiesByUser = new Map();
  userIds.forEach((id) => activitiesByUser.set(id, []));
  activities.forEach((a) => {
    if (a.performedById && activitiesByUser.has(a.performedById)) {
      activitiesByUser.get(a.performedById).push(a);
    }
  });

  const result = new Map();

  for (const userId of userIds) {
    const userUpdates = updatesByUser.get(userId) || [];
    const userTasks = tasksByUser.get(userId) || [];
    const userTimeLogs = timeLogsByUser.get(userId) || [];
    const userActivities = activitiesByUser.get(userId) || [];

    const updatesCount = userUpdates.length;

    const projectIds = new Set(userUpdates.map((u) => u.projectId));

    const activeDaySet = new Set();
    userUpdates.forEach((u) => {
      if (u.updateDate) activeDaySet.add(u.updateDate);
    });

    userTasks.forEach((t) => {
      if (t.startedAt && t.startedAt >= periodStart && t.startedAt <= periodEnd) {
        const ds = toCairoDateString(t.startedAt);
        if (ds) activeDaySet.add(ds);
        projectIds.add(t.projectId);
      }
      if (t.completedAt && t.completedAt >= periodStart && t.completedAt <= periodEnd) {
        const ds = toCairoDateString(t.completedAt);
        if (ds) activeDaySet.add(ds);
        projectIds.add(t.projectId);
      }
    });

    userTimeLogs.forEach((l) => {
      const ds = toCairoDateString(l.logDate);
      if (ds) activeDaySet.add(ds);
    });

    userActivities.forEach((a) => {
      const ds = toCairoDateString(a.createdAt);
      if (ds) activeDaySet.add(ds);
    });

    const activeDays = activeDaySet.size;
    const projectsCount = projectIds.size;
    const regularityScore = computeRegularityScore(activeDays, expectedWorkingDays);

    result.set(userId, {
      updatesCount,
      projectsCount,
      activeDays,
      expectedWorkingDays,
      regularityScore,
      periodContext: ctx,
    });
  }

  return result;
}

/**
 * @param {number} periodId
 * @param {number} userId
 */
async function fetchAutoMetricsForUser(periodId, userId) {
  const map = await fetchAutoMetricsForUsers(periodId, [userId]);
  return map.get(userId) || null;
}

module.exports = {
  loadPerformancePeriod,
  findPerformancePeriodByDateRange,
  resolveTargetUsers,
  fetchAutoMetricsForUser,
  fetchAutoMetricsForUsers,
  toCairoDateString,
  enumerateDateStrings,
  periodDateToString,
};
