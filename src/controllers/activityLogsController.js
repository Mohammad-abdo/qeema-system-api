"use strict";

const { prisma } = require("../lib/prisma");
const { hasPermissionWithoutRoleBypass, isAdmin } = require("../lib/rbac");
const { sendError, CODES } = require("../lib/errorResponse");

async function list(req, res) {
  try {
    const userId = Number(req.user?.id);
    if (!userId) return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
    const allowed = await hasPermissionWithoutRoleBypass(userId, "log.view") || (await isAdmin(userId));
    if (!allowed) {
      return sendError(res, 403, "Access denied. Requires log.view permission or admin.", { code: CODES.FORBIDDEN, requestId: req.id });
    }

    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    // startDate: start of day (00:00:00); endDate: end of day (23:59:59.999) so the full end date is included
    let startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    let endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    if (startDate) {
      startDate.setHours(0, 0, 0, 0);
    }
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }
    const filterUserId = req.query.userId ? parseInt(req.query.userId, 10) : null;
    const projectId = req.query.projectId ? parseInt(req.query.projectId, 10) : null;
    const category = req.query.category && String(req.query.category).trim() ? String(req.query.category).trim() : null;
    const entityType = req.query.entityType && String(req.query.entityType).trim() ? String(req.query.entityType).trim() : null;
    const search = req.query.search && String(req.query.search).trim() || null;

    const where = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }
    if (filterUserId && !Number.isNaN(filterUserId)) where.performedById = filterUserId;
    if (projectId && !Number.isNaN(projectId)) where.projectId = projectId;
    if (category) where.actionCategory = category;
    if (entityType) where.entityType = entityType;
    if (search) {
      where.OR = [
        { actionSummary: { contains: search } },
        { actionDetails: { contains: search } },
        { actionType: { contains: search } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          performedBy: {
            select: { id: true, username: true, email: true, role: true },
          },
          affectedUser: {
            select: { id: true, username: true, email: true },
          },
          project: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return res.json({ success: true, logs, total, limit, offset });
  } catch (err) {
    console.error("[activityLogsController] list:", err);
    sendError(res, 500, err.message || "Failed to fetch activity logs", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

module.exports = {
  list,
};
