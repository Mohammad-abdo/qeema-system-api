"use strict";

const { prisma } = require("../lib/prisma");
const { sendError, CODES } = require("../lib/errorResponse");

async function list(req, res) {
  try {
    if (req.user.role !== "admin") {
      return sendError(res, 403, "Access denied. Admin only.", { code: CODES.FORBIDDEN, requestId: req.id });
    }

    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const userId = req.query.userId ? parseInt(req.query.userId, 10) : null;
    const projectId = req.query.projectId ? parseInt(req.query.projectId, 10) : null;
    const category = req.query.category || null;
    const entityType = req.query.entityType || null;
    const search = req.query.search && String(req.query.search).trim() || null;

    const where = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }
    if (userId && !Number.isNaN(userId)) where.performedById = userId;
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
