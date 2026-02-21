"use strict";

const { prisma } = require("./prisma");

/**
 * Create notifications for multiple users.
 * @param {Array<{ userId: number, title: string, message: string, type?: string, linkUrl?: string }>} notifications
 * @returns {Promise<number>} Count of created notifications
 */
async function notifyUsers(notifications) {
  if (!Array.isArray(notifications) || notifications.length === 0) return 0;
  const data = notifications
    .filter((n) => n && Number.isInteger(n.userId))
    .map((n) => ({
      userId: n.userId,
      title: String(n.title ?? ""),
      message: String(n.message ?? ""),
      type: String(n.type ?? "info"),
      linkUrl: n.linkUrl != null ? String(n.linkUrl) : null,
    }));
  if (data.length === 0) return 0;
  const result = await prisma.notification.createMany({ data });
  return result.count;
}

module.exports = { notifyUsers };
