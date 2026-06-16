"use strict";

const { sendError, CODES } = require("../lib/errorResponse");
const {
  canManagePerformanceReviews,
  applyViewScope,
  assertCanViewProfile,
  getPerformanceActorContext,
} = require("../services/performance/performanceReviewAuth");
const {
  upsertPerformanceReview,
  generatePerformanceReviewsForPeriod,
  listPerformanceReviews,
} = require("../services/performance/performanceReviewService");
const {
  listPerformancePeriods,
  buildPerformanceDashboard,
} = require("../services/performance/performanceDashboardService");
const {
  buildEmployeePerformanceProfile,
  upsertPerformanceFeedback,
  saveManagerReview,
} = require("../services/performance/performanceProfileService");
const {
  createDailyUpdate,
  updateDailyUpdate,
  deleteDailyUpdate,
} = require("../services/performance/dailyUpdateService");

function parseUserIdsParam(value) {
  if (!value) return null;
  return value
    .split(",")
    .map((id) => parseInt(id, 10))
    .filter((n) => !Number.isNaN(n));
}

async function getAccess(req, res) {
  try {
    const actorUserId = Number(req.user?.id);
    if (!actorUserId) {
      return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
    }

    const ctx = await getPerformanceActorContext(actorUserId);
    return res.status(200).json({
      success: true,
      canViewModule: ctx.canViewModule,
      canViewOrgWide: ctx.canViewOrgWide,
      canManage: ctx.canManage,
      canExport: ctx.canExport,
      teamMemberIds: ctx.teamMemberIds,
      isAdmin: ctx.isAdmin,
      isTeamLead: ctx.isTeamLead,
    });
  } catch (err) {
    console.error("[performanceReviewController] getAccess:", err);
    return sendError(res, 500, err.message || "Failed to load performance access", {
      code: CODES.INTERNAL_ERROR,
      requestId: req.id,
    });
  }
}

async function generateReviews(req, res) {
  try {
    const actorUserId = Number(req.user?.id);
    if (!actorUserId) {
      return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
    }

    const canManage = await canManagePerformanceReviews(actorUserId);
    if (!canManage) {
      return sendError(res, 403, "Permission denied: report.generate or team lead required", {
        code: CODES.FORBIDDEN,
        requestId: req.id,
      });
    }

    const periodId = parseInt(req.params.periodId, 10);
    if (Number.isNaN(periodId)) {
      return sendError(res, 400, "Invalid period id", { code: CODES.BAD_REQUEST, requestId: req.id });
    }

    const teamIdParam = req.body?.teamId ?? req.query?.teamId;
    const userIds = parseUserIdsParam(req.body?.userIds ?? req.query?.userIds);

    const result = await generatePerformanceReviewsForPeriod(
      periodId,
      {
        teamId: teamIdParam != null && teamIdParam !== "" ? parseInt(teamIdParam, 10) : null,
        userIds,
      },
      req.body?.manualByUserId || {},
      { actorUserId }
    );

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("[performanceReviewController] generateReviews:", err);
    const status = err.statusCode || 500;
    return sendError(res, status, err.message || "Failed to generate performance reviews", {
      code: status === 400 ? CODES.BAD_REQUEST : status === 404 ? CODES.NOT_FOUND : CODES.INTERNAL_ERROR,
      requestId: req.id,
    });
  }
}

async function updateReview(req, res) {
  try {
    const actorUserId = Number(req.user?.id);
    if (!actorUserId) {
      return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
    }

    const periodId = parseInt(req.params.periodId, 10);
    const userId = parseInt(req.params.userId, 10);
    if (Number.isNaN(periodId) || Number.isNaN(userId)) {
      return sendError(res, 400, "Invalid period or user id", {
        code: CODES.BAD_REQUEST,
        requestId: req.id,
      });
    }

    const canManage = await canManagePerformanceReviews(actorUserId, userId);
    if (!canManage) {
      return sendError(res, 403, "Permission denied: cannot manage this user's review", {
        code: CODES.FORBIDDEN,
        requestId: req.id,
      });
    }

    const review = await upsertPerformanceReview(periodId, userId, req.body || {});

    return res.status(200).json({ success: true, review });
  } catch (err) {
    console.error("[performanceReviewController] updateReview:", err);
    const status = err.statusCode || 500;
    return sendError(res, status, err.message || "Failed to update performance review", {
      code: status === 400 ? CODES.BAD_REQUEST : status === 404 ? CODES.NOT_FOUND : CODES.INTERNAL_ERROR,
      requestId: req.id,
    });
  }
}

async function getReviews(req, res) {
  try {
    const actorUserId = Number(req.user?.id);
    if (!actorUserId) {
      return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
    }

    const canManage = await canManagePerformanceReviews(actorUserId);
    if (!canManage) {
      return sendError(res, 403, "Permission denied: report.generate or team lead required", {
        code: CODES.FORBIDDEN,
        requestId: req.id,
      });
    }

    const periodId = parseInt(req.params.periodId, 10);
    if (Number.isNaN(periodId)) {
      return sendError(res, 400, "Invalid period id", { code: CODES.BAD_REQUEST, requestId: req.id });
    }

    const result = await listPerformanceReviews(periodId);
    const scoped = await applyViewScope(actorUserId, {});
    if (scoped.allowedUserIds?.length) {
      const allowed = new Set(scoped.allowedUserIds);
      result.reviews = (result.reviews || []).filter((r) => allowed.has(Number(r.userId)));
    }

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("[performanceReviewController] getReviews:", err);
    const status = err.statusCode || 500;
    return sendError(res, status, err.message || "Failed to list performance reviews", {
      code: status === 403 ? CODES.FORBIDDEN : status === 404 ? CODES.NOT_FOUND : CODES.INTERNAL_ERROR,
      requestId: req.id,
    });
  }
}

async function getPeriods(req, res) {
  try {
    const actorUserId = Number(req.user?.id);
    if (!actorUserId) {
      return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
    }

    const periods = await listPerformancePeriods();
    return res.status(200).json({ success: true, periods });
  } catch (err) {
    console.error("[performanceReviewController] getPeriods:", err);
    return sendError(res, 500, err.message || "Failed to list performance periods", {
      code: CODES.INTERNAL_ERROR,
      requestId: req.id,
    });
  }
}

async function getDashboard(req, res) {
  try {
    const actorUserId = Number(req.user?.id);
    if (!actorUserId) {
      return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
    }

    const periodId = parseInt(req.query.periodId, 10);
    if (Number.isNaN(periodId)) {
      return sendError(res, 400, "periodId query parameter is required", {
        code: CODES.BAD_REQUEST,
        requestId: req.id,
      });
    }

    const userIdParam = req.query.userId;
    const projectIdParam = req.query.projectId;
    const roleParam = req.query.role;
    const ratingParam = req.query.rating;

    const scoped = await applyViewScope(actorUserId, {
      userId: userIdParam != null && userIdParam !== "" ? parseInt(userIdParam, 10) : null,
      role: roleParam && roleParam !== "" ? String(roleParam) : null,
      projectId: projectIdParam != null && projectIdParam !== "" ? parseInt(projectIdParam, 10) : null,
      rating: ratingParam && ratingParam !== "" ? String(ratingParam) : null,
    });

    const dashboard = await buildPerformanceDashboard(periodId, scoped);

    return res.status(200).json({ success: true, ...dashboard });
  } catch (err) {
    console.error("[performanceReviewController] getDashboard:", err);
    const status = err.statusCode || 500;
    return sendError(res, status, err.message || "Failed to build performance dashboard", {
      code: status === 403 ? CODES.FORBIDDEN : status === 404 ? CODES.NOT_FOUND : CODES.INTERNAL_ERROR,
      requestId: req.id,
    });
  }
}

async function getProfile(req, res) {
  try {
    const actorUserId = Number(req.user?.id);
    if (!actorUserId) {
      return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
    }

    const periodId = parseInt(req.params.periodId, 10);
    const userId = parseInt(req.params.userId, 10);
    if (Number.isNaN(periodId) || Number.isNaN(userId)) {
      return sendError(res, 400, "Invalid period or user id", {
        code: CODES.BAD_REQUEST,
        requestId: req.id,
      });
    }

    await assertCanViewProfile(actorUserId, userId);

    const profile = await buildEmployeePerformanceProfile(periodId, userId);
    return res.status(200).json({ success: true, profile });
  } catch (err) {
    console.error("[performanceReviewController] getProfile:", err);
    const status = err.statusCode || 500;
    return sendError(res, status, err.message || "Failed to load employee performance profile", {
      code: status === 403 ? CODES.FORBIDDEN : status === 404 ? CODES.NOT_FOUND : CODES.INTERNAL_ERROR,
      requestId: req.id,
    });
  }
}

async function updateFeedback(req, res) {
  try {
    const actorUserId = Number(req.user?.id);
    if (!actorUserId) {
      return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
    }

    const periodId = parseInt(req.params.periodId, 10);
    const userId = parseInt(req.params.userId, 10);
    if (Number.isNaN(periodId) || Number.isNaN(userId)) {
      return sendError(res, 400, "Invalid period or user id", {
        code: CODES.BAD_REQUEST,
        requestId: req.id,
      });
    }

    const canManage = await canManagePerformanceReviews(actorUserId, userId);
    if (!canManage) {
      return sendError(res, 403, "Permission denied: cannot manage this user's feedback", {
        code: CODES.FORBIDDEN,
        requestId: req.id,
      });
    }

    const feedback = await upsertPerformanceFeedback(
      periodId,
      userId,
      req.body || {},
      actorUserId
    );

    return res.status(200).json({ success: true, feedback });
  } catch (err) {
    console.error("[performanceReviewController] updateFeedback:", err);
    const status = err.statusCode || 500;
    return sendError(res, status, err.message || "Failed to update performance feedback", {
      code: status === 400 ? CODES.BAD_REQUEST : status === 404 ? CODES.NOT_FOUND : CODES.INTERNAL_ERROR,
      requestId: req.id,
    });
  }
}

async function saveManagerReviewHandler(req, res) {
  try {
    const actorUserId = Number(req.user?.id);
    if (!actorUserId) {
      return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
    }

    const periodId = parseInt(req.params.periodId, 10);
    const userId = parseInt(req.params.userId, 10);
    if (Number.isNaN(periodId) || Number.isNaN(userId)) {
      return sendError(res, 400, "Invalid period or user id", {
        code: CODES.BAD_REQUEST,
        requestId: req.id,
      });
    }

    const canManage = await canManagePerformanceReviews(actorUserId, userId);
    if (!canManage) {
      return sendError(res, 403, "Permission denied: cannot manage this user's review", {
        code: CODES.FORBIDDEN,
        requestId: req.id,
      });
    }

    const result = await saveManagerReview(periodId, userId, req.body || {}, actorUserId);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("[performanceReviewController] saveManagerReview:", err);
    const status = err.statusCode || 500;
    return sendError(res, status, err.message || "Failed to save manager review", {
      code: status === 400 ? CODES.BAD_REQUEST : status === 404 ? CODES.NOT_FOUND : CODES.INTERNAL_ERROR,
      requestId: req.id,
    });
  }
}

async function createDailyUpdateHandler(req, res) {
  try {
    const actorUserId = Number(req.user?.id);
    if (!actorUserId) {
      return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
    }

    const update = await createDailyUpdate(req.body || {}, actorUserId);
    return res.status(201).json({ success: true, update });
  } catch (err) {
    console.error("[performanceReviewController] createDailyUpdate:", err);
    const status = err.statusCode || 500;
    return sendError(res, status, err.message || "Failed to create daily update", {
      code: status === 400 ? CODES.BAD_REQUEST : status === 403 ? CODES.FORBIDDEN : status === 404 ? CODES.NOT_FOUND : CODES.INTERNAL_ERROR,
      requestId: req.id,
    });
  }
}

async function updateDailyUpdateHandler(req, res) {
  try {
    const actorUserId = Number(req.user?.id);
    if (!actorUserId) {
      return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
    }

    const updateId = parseInt(req.params.id, 10);
    if (Number.isNaN(updateId)) {
      return sendError(res, 400, "Invalid daily update id", { code: CODES.BAD_REQUEST, requestId: req.id });
    }

    const update = await updateDailyUpdate(updateId, req.body || {}, actorUserId);
    return res.status(200).json({ success: true, update });
  } catch (err) {
    console.error("[performanceReviewController] updateDailyUpdate:", err);
    const status = err.statusCode || 500;
    return sendError(res, status, err.message || "Failed to update daily update", {
      code: status === 400 ? CODES.BAD_REQUEST : status === 403 ? CODES.FORBIDDEN : status === 404 ? CODES.NOT_FOUND : CODES.INTERNAL_ERROR,
      requestId: req.id,
    });
  }
}

async function deleteDailyUpdateHandler(req, res) {
  try {
    const actorUserId = Number(req.user?.id);
    if (!actorUserId) {
      return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
    }

    const updateId = parseInt(req.params.id, 10);
    if (Number.isNaN(updateId)) {
      return sendError(res, 400, "Invalid daily update id", { code: CODES.BAD_REQUEST, requestId: req.id });
    }

    const result = await deleteDailyUpdate(updateId, actorUserId);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("[performanceReviewController] deleteDailyUpdate:", err);
    const status = err.statusCode || 500;
    return sendError(res, status, err.message || "Failed to delete daily update", {
      code: status === 403 ? CODES.FORBIDDEN : status === 404 ? CODES.NOT_FOUND : CODES.INTERNAL_ERROR,
      requestId: req.id,
    });
  }
}

module.exports = {
  getAccess,
  generateReviews,
  updateReview,
  getReviews,
  getPeriods,
  getDashboard,
  getProfile,
  updateFeedback,
  saveManagerReview: saveManagerReviewHandler,
  createDailyUpdate: createDailyUpdateHandler,
  updateDailyUpdate: updateDailyUpdateHandler,
  deleteDailyUpdate: deleteDailyUpdateHandler,
};
