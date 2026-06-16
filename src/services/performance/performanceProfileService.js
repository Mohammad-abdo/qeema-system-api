"use strict";

const { prisma } = require("../../lib/prisma");
const { clampScore } = require("./performanceCalculation");
const { upsertPerformanceReview } = require("./performanceReviewService");
const {
  loadPerformancePeriod,
  fetchAutoMetricsForUser,
} = require("./performanceReviewData");

function assertPeriodNotClosed(ctx) {
  if (ctx.period.status === "closed") {
    const err = new Error("Cannot modify reviews for a closed performance period");
    err.statusCode = 403;
    throw err;
  }
}

const PHASE2_SCORE_LABELS = {
  regularityScore: "Regularity",
  qualityScore: "Work quality",
  speedScore: "Speed",
  communicationScore: "Communication",
  updateQualityScore: "Daily update quality",
  complexityScore: "Workload and complexity",
};

function buildDerivedFeedback(review) {
  if (!review) {
    return { strengths: [], improvementPoints: [] };
  }

  const entries = Object.entries(PHASE2_SCORE_LABELS)
    .map(([key, label]) => ({
      key,
      label,
      value: clampScore(review[key]),
    }))
    .sort((a, b) => b.value - a.value);

  const strengths = entries
    .slice(0, 2)
    .filter((e) => e.value >= 60)
    .map((e) => `Strong ${e.label.toLowerCase()} (${e.value})`);

  const improvementPoints = entries
    .slice(-2)
    .filter((e) => e.value < 75)
    .map((e) => `Improve ${e.label.toLowerCase()} (score ${e.value})`);

  if (strengths.length === 0 && entries[0]) {
    strengths.push(`Top area: ${entries[0].label} (${entries[0].value})`);
  }
  if (improvementPoints.length === 0 && entries[entries.length - 1]) {
    const worst = entries[entries.length - 1];
    if (worst.value < 80) {
      improvementPoints.push(`Focus on ${worst.label.toLowerCase()} (score ${worst.value})`);
    }
  }

  return { strengths, improvementPoints };
}

function textToList(value) {
  if (!value || typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      /* fall through */
    }
  }
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

function formatReview(review) {
  if (!review) return null;
  return {
    id: review.id,
    userId: review.userId,
    periodId: review.periodId,
    roleSnapshot: review.roleSnapshot,
    updatesCount: review.updatesCount,
    projectsCount: review.projectsCount,
    activeDays: review.activeDays,
    expectedWorkingDays: review.expectedWorkingDays,
    regularityScore: review.regularityScore,
    qualityScore: review.qualityScore,
    speedScore: review.speedScore,
    communicationScore: review.communicationScore,
    updateQualityScore: review.updateQualityScore,
    complexityScore: review.complexityScore,
    finalScore: review.finalScore,
    rating: review.rating,
  };
}

function formatFeedback(feedback) {
  if (!feedback) return null;
  return {
    id: feedback.id,
    strengths: feedback.strengths,
    improvementPoints: feedback.improvementPoints,
    managerNotes: feedback.managerNotes,
    actionPlan: feedback.actionPlan,
    strengthsList: textToList(feedback.strengths),
    improvementPointsList: textToList(feedback.improvementPoints),
  };
}

/**
 * @param {number} periodId
 * @param {number} userId
 */
async function buildEmployeePerformanceProfile(periodId, userId) {
  const pid = Number(periodId);
  const uid = Number(userId);

  const ctx = await loadPerformancePeriod(pid);

  const user = await prisma.user.findFirst({
    where: { id: uid, isActive: true },
    select: { id: true, username: true, role: true, teamId: true },
  });
  if (!user) {
    const err = new Error("Active user not found");
    err.statusCode = 404;
    throw err;
  }

  const review = await prisma.performanceReview.findUnique({
    where: { periodId_userId: { periodId: pid, userId: uid } },
    include: { feedback: true },
  });

  const { startDate, endDate, periodStart, periodEnd } = ctx;

  const dailyUpdateRows = await prisma.dailyUpdate.findMany({
    where: {
      userId: uid,
      updateDate: { gte: startDate, lte: endDate },
      submittedAt: { not: null },
    },
    include: {
      project: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
    orderBy: [{ updateDate: "desc" }, { submittedAt: "desc" }],
  });

  const projectUpdateCounts = new Map();
  dailyUpdateRows.forEach((u) => {
    const pidKey = u.projectId;
    projectUpdateCounts.set(pidKey, (projectUpdateCounts.get(pidKey) || 0) + 1);
  });

  const tasks = await prisma.task.findMany({
    where: { assignees: { some: { id: uid } } },
    select: { projectId: true, startedAt: true, completedAt: true },
  });
  tasks.forEach((t) => {
    const inPeriod =
      (t.startedAt && t.startedAt >= periodStart && t.startedAt <= periodEnd) ||
      (t.completedAt && t.completedAt >= periodStart && t.completedAt <= periodEnd);
    if (inPeriod && !projectUpdateCounts.has(t.projectId)) {
      projectUpdateCounts.set(t.projectId, 0);
    }
  });

  const projectIds = [...projectUpdateCounts.keys()];
  const projectsById = new Map();
  if (projectIds.length) {
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true },
    });
    projects.forEach((p) => projectsById.set(p.id, p));
  }

  const mainProjects = projectIds
    .map((id) => ({
      id,
      name: projectsById.get(id)?.name || `Project #${id}`,
      updatesCount: projectUpdateCounts.get(id) || 0,
    }))
    .sort((a, b) => b.updatesCount - a.updatesCount)
    .slice(0, 5);

  const dailyUpdates = dailyUpdateRows.map((u) => ({
    id: u.id,
    updateDate: u.updateDate,
    status: u.status,
    updateText: u.updateText,
    blockers: u.blockers,
    project: u.project ? { id: u.project.id, name: u.project.name } : { id: u.projectId, name: null },
    task: u.task ? { id: u.task.id, title: u.task.title } : null,
  }));

  let activeDays = review?.activeDays ?? null;
  if (activeDays == null) {
    const autoMetrics = await fetchAutoMetricsForUser(pid, uid);
    activeDays = autoMetrics?.activeDays ?? 0;
  }

  const derivedFeedback = buildDerivedFeedback(review);

  return {
    user: { id: user.id, username: user.username, role: user.role },
    period: {
      id: ctx.period.id,
      title: ctx.period.title,
      startDate: ctx.startDate,
      endDate: ctx.endDate,
      status: ctx.period.status,
      expectedWorkingDays: ctx.expectedWorkingDays,
    },
    review: formatReview(review),
    feedback: formatFeedback(review?.feedback),
    derivedFeedback,
    mainProjects,
    dailyUpdates,
    lowDataSample: activeDays < 10,
  };
}

/**
 * @param {number} periodId
 * @param {number} userId
 * @param {object} body
 * @param {number} actorUserId
 */
async function upsertPerformanceFeedback(periodId, userId, body, actorUserId) {
  const pid = Number(periodId);
  const uid = Number(userId);

  const ctx = await loadPerformancePeriod(pid);
  assertPeriodNotClosed(ctx);

  const review = await prisma.performanceReview.findUnique({
    where: { periodId_userId: { periodId: pid, userId: uid } },
    include: { feedback: true },
  });

  if (!review) {
    const err = new Error("Performance review not found. Generate a review first.");
    err.statusCode = 404;
    throw err;
  }

  const data = {};
  if (body.strengths != null) data.strengths = String(body.strengths);
  if (body.improvementPoints != null) data.improvementPoints = String(body.improvementPoints);
  if (body.managerNotes != null) data.managerNotes = body.managerNotes === "" ? null : String(body.managerNotes);
  if (body.actionPlan != null) data.actionPlan = body.actionPlan === "" ? null : String(body.actionPlan);

  let feedback;
  if (review.feedback) {
    feedback = await prisma.performanceFeedback.update({
      where: { id: review.feedback.id },
      data,
    });
  } else {
    const strengths = data.strengths ?? "";
    const improvementPoints = data.improvementPoints ?? "";
    feedback = await prisma.performanceFeedback.create({
      data: {
        reviewId: review.id,
        strengths,
        improvementPoints,
        managerNotes: data.managerNotes ?? null,
        actionPlan: data.actionPlan ?? null,
        createdById: Number(actorUserId),
      },
    });
  }

  return formatFeedback(feedback);
}

/**
 * @param {number} periodId
 * @param {number} userId
 * @param {object} body
 * @param {number} actorUserId
 */
async function saveManagerReview(periodId, userId, body, actorUserId) {
  const manualScores = {};
  const scoreFields = [
    "qualityScore",
    "speedScore",
    "communicationScore",
    "updateQualityScore",
    "complexityScore",
  ];
  for (const key of scoreFields) {
    if (body[key] != null && body[key] !== "") {
      const num = Number(body[key]);
      if (Number.isNaN(num) || num < 0 || num > 100) {
        const err = new Error(`${key} must be a number between 0 and 100`);
        err.statusCode = 400;
        throw err;
      }
      manualScores[key] = clampScore(num);
    }
  }

  const review = await upsertPerformanceReview(periodId, userId, manualScores);
  const feedback = await upsertPerformanceFeedback(
    periodId,
    userId,
    {
      strengths: body.strengths,
      improvementPoints: body.improvementPoints,
      managerNotes: body.managerNotes,
      actionPlan: body.actionPlan,
    },
    actorUserId
  );

  return { review, feedback };
}

module.exports = {
  buildEmployeePerformanceProfile,
  upsertPerformanceFeedback,
  saveManagerReview,
  buildDerivedFeedback,
  textToList,
};
