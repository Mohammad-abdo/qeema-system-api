"use strict";

const { prisma } = require("../../lib/prisma");
const { MANUAL_SCORE_FIELDS } = require("./performanceCalculationTypes");
const {
  clampScore,
  ratingFromScore,
  computeFinalScore,
} = require("./performanceCalculation");
const {
  loadPerformancePeriod,
  resolveTargetUsers,
  fetchAutoMetricsForUser,
  fetchAutoMetricsForUsers,
} = require("./performanceReviewData");
const { applyTeamLeadScope } = require("./performanceReviewAuth");

function pickManualScores(source = {}) {
  /** @type {Record<string, number|undefined>} */
  const out = {};
  for (const key of MANUAL_SCORE_FIELDS) {
    if (source[key] != null && source[key] !== "") {
      out[key] = clampScore(source[key]);
    }
  }
  return out;
}

function mergeManualScores(existing, incoming) {
  const merged = {};
  for (const key of MANUAL_SCORE_FIELDS) {
    if (incoming[key] != null) {
      merged[key] = incoming[key];
    } else if (existing?.[key] != null) {
      merged[key] = clampScore(existing[key]);
    } else {
      // Neutral baseline until manager completes manual review (avoid 0 → "Weak" on first generate)
      merged[key] = 70;
    }
  }
  return merged;
}

function buildReviewPayload(user, autoMetrics, manualScores, existingReview) {
  const manual = mergeManualScores(existingReview, manualScores);

  const scores = {
    regularityScore: autoMetrics.regularityScore,
    qualityScore: manual.qualityScore,
    speedScore: manual.speedScore,
    communicationScore: manual.communicationScore,
    updateQualityScore: manual.updateQualityScore,
    complexityScore: manual.complexityScore,
  };

  const finalScore = computeFinalScore(scores);
  const rating = ratingFromScore(finalScore);

  return {
    periodId: autoMetrics.periodContext.period.id,
    userId: user.id,
    roleSnapshot: user.role || "developer",
    updatesCount: autoMetrics.updatesCount,
    projectsCount: autoMetrics.projectsCount,
    activeDays: autoMetrics.activeDays,
    expectedWorkingDays: autoMetrics.expectedWorkingDays,
    regularityScore: scores.regularityScore,
    qualityScore: scores.qualityScore,
    speedScore: scores.speedScore,
    communicationScore: scores.communicationScore,
    updateQualityScore: scores.updateQualityScore,
    complexityScore: scores.complexityScore,
    finalScore,
    rating,
  };
}

function formatReviewResponse(review, user, meta = {}) {
  return {
    ...review,
    user: user
      ? { id: user.id, username: user.username, role: user.role, teamId: user.teamId }
      : undefined,
    meta,
  };
}

/**
 * @param {number} periodId
 * @param {number} userId
 * @param {object} [manualScores]
 * @param {{ skipClosedCheck?: boolean }} [options]
 */
async function upsertPerformanceReview(periodId, userId, manualScores = {}, options = {}) {
  const ctx = await loadPerformancePeriod(periodId);
  if (!options.skipClosedCheck && ctx.period.status === "closed") {
    const err = new Error("Cannot modify reviews for a closed performance period");
    err.statusCode = 400;
    throw err;
  }

  const user = await prisma.user.findFirst({
    where: { id: Number(userId), isActive: true },
    select: { id: true, username: true, role: true, teamId: true },
  });
  if (!user) {
    const err = new Error("Active user not found");
    err.statusCode = 404;
    throw err;
  }

  const autoMetrics = await fetchAutoMetricsForUser(periodId, user.id);
  if (!autoMetrics) {
    const err = new Error("Failed to compute auto metrics");
    err.statusCode = 500;
    throw err;
  }

  const existingReview = await prisma.performanceReview.findUnique({
    where: {
      periodId_userId: {
        periodId: Number(periodId),
        userId: user.id,
      },
    },
  });

  const manual = pickManualScores(manualScores);
  const payload = buildReviewPayload(user, autoMetrics, manual, existingReview);

  const review = await prisma.performanceReview.upsert({
    where: {
      periodId_userId: {
        periodId: Number(periodId),
        userId: user.id,
      },
    },
    create: payload,
    update: payload,
    include: {
      user: { select: { id: true, username: true, role: true, teamId: true } },
    },
  });

  return formatReviewResponse(review, review.user, {
    autoFields: [
      "updatesCount",
      "projectsCount",
      "activeDays",
      "expectedWorkingDays",
      "regularityScore",
      "roleSnapshot",
    ],
    manualFields: MANUAL_SCORE_FIELDS,
  });
}

/**
 * @param {number} periodId
 * @param {{ teamId?: number|null, userIds?: number[]|null }} [filters]
 * @param {Record<number, object>} [manualByUserId]
 * @param {{ actorUserId?: number }} [options]
 */
async function generatePerformanceReviewsForPeriod(
  periodId,
  filters = {},
  manualByUserId = {},
  options = {}
) {
  const ctx = await loadPerformancePeriod(periodId);
  if (ctx.period.status === "closed") {
    const err = new Error("Cannot generate reviews for a closed performance period");
    err.statusCode = 400;
    throw err;
  }

  let scopedFilters = { ...filters };
  if (options.actorUserId) {
    scopedFilters = await applyTeamLeadScope(options.actorUserId, scopedFilters);
  }

  const users = await resolveTargetUsers(scopedFilters);
  if (users.length === 0) {
    return { periodId: Number(periodId), reviews: [], count: 0 };
  }

  const userIds = users.map((u) => u.id);
  const autoMap = await fetchAutoMetricsForUsers(periodId, userIds);

  const existingReviews = await prisma.performanceReview.findMany({
    where: { periodId: Number(periodId), userId: { in: userIds } },
  });
  const existingByUser = new Map(existingReviews.map((r) => [r.userId, r]));

  const reviews = [];

  for (const user of users) {
    const autoMetrics = autoMap.get(user.id);
    if (!autoMetrics) continue;

    const existingReview = existingByUser.get(user.id) || null;
    const manual = pickManualScores(manualByUserId[user.id] || {});
    const payload = buildReviewPayload(user, autoMetrics, manual, existingReview);

    const review = await prisma.performanceReview.upsert({
      where: {
        periodId_userId: {
          periodId: Number(periodId),
          userId: user.id,
        },
      },
      create: payload,
      update: payload,
      include: {
        user: { select: { id: true, username: true, role: true, teamId: true } },
      },
    });

    reviews.push(
      formatReviewResponse(review, review.user, {
        autoFields: [
          "updatesCount",
          "projectsCount",
          "activeDays",
          "expectedWorkingDays",
          "regularityScore",
          "roleSnapshot",
        ],
        manualFields: MANUAL_SCORE_FIELDS,
      })
    );
  }

  return {
    periodId: Number(periodId),
    reviews,
    count: reviews.length,
  };
}

/**
 * @param {number} periodId
 */
async function listPerformanceReviews(periodId) {
  const ctx = await loadPerformancePeriod(periodId);

  const reviews = await prisma.performanceReview.findMany({
    where: { periodId: Number(periodId) },
    include: {
      user: { select: { id: true, username: true, role: true, teamId: true } },
      feedback: true,
    },
    orderBy: [{ finalScore: "desc" }, { user: { username: "asc" } }],
  });

  return {
    period: {
      id: ctx.period.id,
      title: ctx.period.title,
      startDate: ctx.startDate,
      endDate: ctx.endDate,
      status: ctx.period.status,
      expectedWorkingDays: ctx.expectedWorkingDays,
    },
    reviews,
    count: reviews.length,
  };
}

module.exports = {
  upsertPerformanceReview,
  generatePerformanceReviewsForPeriod,
  listPerformanceReviews,
};
