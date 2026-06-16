"use strict";

const { prisma } = require("../../lib/prisma");
const { RATING_BANDS } = require("../reports/staffPerformanceReportTypes");
const {
  loadPerformancePeriod,
  periodDateToString,
} = require("./performanceReviewData");

const RATING_KEYS = RATING_BANDS.map((b) => b.rating);

function emptyRatingCounts() {
  const counts = {};
  RATING_KEYS.forEach((r) => {
    counts[r] = 0;
  });
  return counts;
}

async function listPerformancePeriods() {
  const periods = await prisma.performancePeriod.findMany({
    orderBy: { endDate: "desc" },
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });

  return periods.map((p) => ({
    id: p.id,
    title: p.title,
    startDate: periodDateToString(p.startDate),
    endDate: periodDateToString(p.endDate),
    status: p.status,
  }));
}

/**
 * Users with task activity on a project in the period.
 * @param {number} projectId
 * @param {number[]} userIds
 * @param {Date} periodStart
 * @param {Date} periodEnd
 */
async function getUsersWithProjectTaskActivity(projectId, userIds, periodStart, periodEnd) {
  if (!userIds.length) return new Set();

  const tasks = await prisma.task.findMany({
    where: {
      projectId: Number(projectId),
      assignees: { some: { id: { in: userIds } } },
    },
    select: {
      projectId: true,
      startedAt: true,
      completedAt: true,
      assignees: { select: { id: true } },
    },
  });

  const matched = new Set();
  tasks.forEach((t) => {
    const activeInPeriod =
      (t.startedAt && t.startedAt >= periodStart && t.startedAt <= periodEnd) ||
      (t.completedAt && t.completedAt >= periodStart && t.completedAt <= periodEnd);
    if (!activeInPeriod) return;
    (t.assignees || []).forEach((a) => {
      if (userIds.includes(a.id)) matched.add(a.id);
    });
  });

  const timeLogs = await prisma.timeLog.findMany({
    where: {
      userId: { in: userIds },
      logDate: { gte: periodStart, lte: periodEnd },
      task: { projectId: Number(projectId) },
    },
    select: { userId: true },
  });
  timeLogs.forEach((l) => matched.add(l.userId));

  const activities = await prisma.activityLog.findMany({
    where: {
      performedById: { in: userIds },
      projectId: Number(projectId),
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    select: { performedById: true },
  });
  activities.forEach((a) => {
    if (a.performedById) matched.add(a.performedById);
  });

  return matched;
}

/**
 * @param {number} periodId
 * @param {{ userId?: number|null, role?: string|null, projectId?: number|null, rating?: string|null, allowedUserIds?: number[]|null }} filters
 */
async function buildPerformanceDashboard(periodId, filters = {}) {
  const ctx = await loadPerformancePeriod(periodId);
  const { startDate, endDate, periodStart, periodEnd } = ctx;

  const reviews = await prisma.performanceReview.findMany({
    where: { periodId: Number(periodId) },
    include: {
      user: { select: { id: true, username: true, role: true, teamId: true } },
    },
    orderBy: [{ finalScore: "desc" }, { user: { username: "asc" } }],
  });

  let filteredReviews = reviews;

  if (filters.allowedUserIds?.length) {
    const allowed = new Set(filters.allowedUserIds.map(Number));
    filteredReviews = filteredReviews.filter((r) => allowed.has(r.userId));
  }

  if (filters.userId != null && !Number.isNaN(Number(filters.userId))) {
    const uid = Number(filters.userId);
    filteredReviews = filteredReviews.filter((r) => r.userId === uid);
  }

  if (filters.role) {
    const roleNorm = String(filters.role).trim().toLowerCase();
    filteredReviews = filteredReviews.filter(
      (r) => String(r.roleSnapshot || "").toLowerCase() === roleNorm
    );
  }

  const reviewUserIds = filteredReviews.map((r) => r.userId);

  if (filters.projectId != null && !Number.isNaN(Number(filters.projectId))) {
    const pid = Number(filters.projectId);
    const updatesForProject = await prisma.dailyUpdate.findMany({
      where: {
        projectId: pid,
        updateDate: { gte: startDate, lte: endDate },
        submittedAt: { not: null },
        userId: reviewUserIds.length ? { in: reviewUserIds } : undefined,
      },
      select: { userId: true },
    });
    const usersFromUpdates = new Set(updatesForProject.map((u) => u.userId));
    const usersFromTasks = await getUsersWithProjectTaskActivity(
      pid,
      reviewUserIds,
      periodStart,
      periodEnd
    );
    const allowedUsers = new Set([...usersFromUpdates, ...usersFromTasks]);
    filteredReviews = filteredReviews.filter((r) => allowedUsers.has(r.userId));
  }

  if (filters.rating) {
    const ratingNorm = String(filters.rating).trim().toLowerCase();
    filteredReviews = filteredReviews.filter(
      (r) => String(r.rating || "").toLowerCase() === ratingNorm
    );
  }

  const filteredUserIds = filteredReviews.map((r) => r.userId);

  const dailyUpdateWhere = {
    updateDate: { gte: startDate, lte: endDate },
    submittedAt: { not: null },
  };
  if (filters.userId != null && !Number.isNaN(Number(filters.userId))) {
    dailyUpdateWhere.userId = Number(filters.userId);
  } else if (filteredUserIds.length) {
    dailyUpdateWhere.userId = { in: filteredUserIds };
  } else if (filters.projectId != null) {
    dailyUpdateWhere.userId = { in: [] };
  }
  if (filters.projectId != null && !Number.isNaN(Number(filters.projectId))) {
    dailyUpdateWhere.projectId = Number(filters.projectId);
  }

  const dailyUpdates = await prisma.dailyUpdate.findMany({
    where: dailyUpdateWhere,
    select: { id: true, userId: true, projectId: true, updateDate: true },
  });

  const totalUpdates = dailyUpdates.length;
  const projectIdSet = new Set(dailyUpdates.map((u) => u.projectId));

  if (filteredUserIds.length && !filters.projectId) {
    const tasks = await prisma.task.findMany({
      where: { assignees: { some: { id: { in: filteredUserIds } } } },
      select: { projectId: true, startedAt: true, completedAt: true, assignees: { select: { id: true } } },
    });
    tasks.forEach((t) => {
      const inPeriod =
        (t.startedAt && t.startedAt >= periodStart && t.startedAt <= periodEnd) ||
        (t.completedAt && t.completedAt >= periodStart && t.completedAt <= periodEnd);
      if (inPeriod && filteredUserIds.some((uid) => (t.assignees || []).some((a) => a.id === uid))) {
        projectIdSet.add(t.projectId);
      }
    });
  } else if (filters.projectId != null) {
    projectIdSet.add(Number(filters.projectId));
  }

  const totalProjects = projectIdSet.size;
  const totalEmployees = filteredReviews.length;

  let averageTeamScore = 0;
  if (totalEmployees > 0) {
    const sum = filteredReviews.reduce((s, r) => s + (r.finalScore || 0), 0);
    averageTeamScore = Math.round(sum / totalEmployees);
  }

  const ratingCounts = emptyRatingCounts();
  filteredReviews.forEach((r) => {
    if (ratingCounts[r.rating] != null) ratingCounts[r.rating] += 1;
  });

  let highestPerformer = null;
  let lowestPerformer = null;
  if (filteredReviews.length > 0) {
    const sorted = [...filteredReviews].sort((a, b) => b.finalScore - a.finalScore);
    const high = sorted[0];
    const low = sorted[sorted.length - 1];
    highestPerformer = {
      userId: high.userId,
      username: high.user?.username,
      finalScore: high.finalScore,
      rating: high.rating,
    };
    lowestPerformer = {
      userId: low.userId,
      username: low.user?.username,
      finalScore: low.finalScore,
      rating: low.rating,
    };
  }

  return {
    period: {
      id: ctx.period.id,
      title: ctx.period.title,
      startDate,
      endDate,
      status: ctx.period.status,
    },
    summary: {
      totalEmployees,
      totalUpdates,
      totalProjects,
      averageTeamScore,
      highestPerformer,
      lowestPerformer,
      ratingCounts,
    },
    reviews: filteredReviews.map((r) => ({
      id: r.id,
      userId: r.userId,
      username: r.user?.username,
      roleSnapshot: r.roleSnapshot,
      updatesCount: r.updatesCount,
      projectsCount: r.projectsCount,
      activeDays: r.activeDays,
      finalScore: r.finalScore,
      rating: r.rating,
      regularityScore: r.regularityScore,
      qualityScore: r.qualityScore,
      speedScore: r.speedScore,
      communicationScore: r.communicationScore,
      updateQualityScore: r.updateQualityScore,
      complexityScore: r.complexityScore,
    })),
    filtersApplied: {
      userId: filters.userId != null ? Number(filters.userId) : null,
      role: filters.role || null,
      projectId: filters.projectId != null ? Number(filters.projectId) : null,
      rating: filters.rating || null,
    },
  };
}

module.exports = {
  listPerformancePeriods,
  buildPerformanceDashboard,
};
