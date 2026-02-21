"use strict";

const { prisma } = require("../lib/prisma");
const { sendError, CODES } = require("../lib/errorResponse");
const { logActivity } = require("../lib/activityLogger");

async function list(req, res) {
  try {
    const userId = Number(req.user.id);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return res.json({ success: true, notifications });
  } catch (err) {
    console.error("[notificationsController] list:", err);
    sendError(res, 500, "Failed to fetch notifications", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function getUnreadCount(req, res) {
  try {
    const userId = Number(req.user.id);

    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    return res.json({ success: true, count });
  } catch (err) {
    console.error("[notificationsController] getUnreadCount:", err);
    sendError(res, 500, "Failed to fetch unread count", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function markAsRead(req, res) {
  try {
    const userId = Number(req.user.id);
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid notification ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      return sendError(res, 404, "Notification not found", { code: CODES.NOT_FOUND, requestId: req.id });
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    await logActivity({
      actionType: "notification_marked_read",
      actionCategory: "notification",
      entityType: "notification",
      entityId: id,
      performedById: userId,
      actionSummary: `Notification #${id} marked as read`,
    }, req);
    return res.json({ success: true });
  } catch (err) {
    console.error("[notificationsController] markAsRead:", err);
    sendError(res, 500, "Failed to mark as read", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function markAllAsRead(req, res) {
  try {
    const userId = Number(req.user.id);

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    await logActivity({
      actionType: "notifications_marked_all_read",
      actionCategory: "notification",
      performedById: userId,
      actionSummary: "All notifications marked as read",
    }, req);
    return res.json({ success: true });
  } catch (err) {
    console.error("[notificationsController] markAllAsRead:", err);
    sendError(res, 500, "Failed to mark all as read", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function remove(req, res) {
  try {
    const userId = Number(req.user.id);
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid notification ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      return sendError(res, 404, "Notification not found", { code: CODES.NOT_FOUND, requestId: req.id });
    }

    await logActivity({
      actionType: "notification_deleted",
      actionCategory: "notification",
      entityType: "notification",
      entityId: id,
      performedById: userId,
      actionSummary: `Notification #${id} deleted`,
    }, req);
    await prisma.notification.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) {
    console.error("[notificationsController] remove:", err);
    sendError(res, 500, "Failed to delete notification", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

module.exports = {
  list,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  remove,
};
