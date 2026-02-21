"use strict";

const { prisma } = require("../lib/prisma");
const { sendError, CODES } = require("../lib/errorResponse");
const { hasPermissionWithoutRoleBypass } = require("../lib/rbac");
const { logActivity } = require("../lib/activityLogger");

async function ensureProjectAccess(req, projectId) {
  const userId = Number(req.user?.id);
  const pid = parseInt(projectId, 10);
  if (Number.isNaN(pid)) return { error: "Invalid project ID", status: 400 };

  const projectUser = await prisma.projectUser.findFirst({
    where: { projectId: pid, userId, leftAt: null },
  });
  if (projectUser) return { projectId: pid, userId };

  const project = await prisma.project.findUnique({
    where: { id: pid },
    select: { projectManagerId: true, createdById: true },
  });
  if (!project) return { error: "Project not found", status: 404 };
  if (project.projectManagerId === userId || project.createdById === userId) return { projectId: pid, userId };

  const canViewAll = await hasPermissionWithoutRoleBypass(userId, "project.viewAll");
  if (canViewAll) return { projectId: pid, userId };

  return { error: "Access denied to this project", status: 403 };
}

async function list(req, res) {
  try {
    const access = await ensureProjectAccess(req, req.params.projectId);
    if (access.error) return sendError(res, access.status, access.error, { code: access.status === 404 ? CODES.NOT_FOUND : access.status === 403 ? CODES.FORBIDDEN : CODES.BAD_REQUEST, requestId: req.id });

    const { projectId, userId } = access;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const type = req.query.type && req.query.type !== "all" ? String(req.query.type) : undefined;
    const isReadParam = req.query.isRead;
    let isRead = undefined;
    if (isReadParam === "read") isRead = true;
    else if (isReadParam === "unread") isRead = false;

    const where = { projectId, userId };
    if (type) where.type = type;
    if (isRead !== undefined) where.isRead = isRead;

    const [notifications, total] = await Promise.all([
      prisma.projectNotification.findMany({
        where,
        orderBy: [
          { isUrgent: "desc" },
          { requiresAcknowledgment: "desc" },
          { createdAt: "desc" },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.projectNotification.count({ where }),
    ]);

    return res.json({ success: true, notifications, total });
  } catch (err) {
    console.error("[projectNotificationsController] list:", err);
    sendError(res, 500, "Failed to fetch project notifications", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function markAsRead(req, res) {
  try {
    const access = await ensureProjectAccess(req, req.params.projectId);
    if (access.error) return sendError(res, access.status, access.error, { code: access.status === 404 ? CODES.NOT_FOUND : access.status === 403 ? CODES.FORBIDDEN : CODES.BAD_REQUEST, requestId: req.id });

    const notificationId = parseInt(req.params.notificationId, 10);
    if (Number.isNaN(notificationId)) return sendError(res, 400, "Invalid notification ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const notification = await prisma.projectNotification.findFirst({
      where: {
        id: notificationId,
        projectId: access.projectId,
        userId: access.userId,
      },
    });

    if (!notification) return sendError(res, 404, "Notification not found", { code: CODES.NOT_FOUND, requestId: req.id });

    if (notification.isUrgent && notification.requiresAcknowledgment && !notification.acknowledgedAt) {
      return sendError(res, 400, "Urgent notifications must be acknowledged before marking as read", { code: CODES.BAD_REQUEST, requestId: req.id });
    }

    await prisma.projectNotification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
    await logActivity({
      actionType: "project_notification_marked_read",
      actionCategory: "notification",
      entityType: "notification",
      entityId: notificationId,
      projectId: access.projectId,
      performedById: access.userId,
      actionSummary: `Project notification #${notificationId} marked as read`,
    }, req);
    return res.json({ success: true });
  } catch (err) {
    console.error("[projectNotificationsController] markAsRead:", err);
    sendError(res, 500, "Failed to mark notification as read", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function markAllAsRead(req, res) {
  try {
    const access = await ensureProjectAccess(req, req.params.projectId);
    if (access.error) return sendError(res, access.status, access.error, { code: access.status === 404 ? CODES.NOT_FOUND : access.status === 403 ? CODES.FORBIDDEN : CODES.BAD_REQUEST, requestId: req.id });

    await prisma.projectNotification.updateMany({
      where: {
        projectId: access.projectId,
        userId: access.userId,
        isRead: false,
        OR: [
          { isUrgent: false },
          { requiresAcknowledgment: false },
          { acknowledgedAt: { not: null } },
        ],
      },
      data: { isRead: true },
    });
    await logActivity({
      actionType: "project_notifications_marked_all_read",
      actionCategory: "notification",
      projectId: access.projectId,
      performedById: access.userId,
      actionSummary: `All project notifications marked as read for project #${access.projectId}`,
    }, req);
    return res.json({ success: true });
  } catch (err) {
    console.error("[projectNotificationsController] markAllAsRead:", err);
    sendError(res, 500, "Failed to mark all as read", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

module.exports = {
  list,
  markAsRead,
  markAllAsRead,
};
