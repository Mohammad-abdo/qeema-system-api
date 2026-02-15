"use strict";

const { prisma } = require("./prisma");

const SENSITIVE_KEYS = [
  "password",
  "passwordHash",
  "password_hash",
  "token",
  "secret",
  "apiKey",
  "api_key",
  "accessToken",
  "refreshToken",
];

function sanitizeActionDetails(details) {
  if (!details || typeof details !== "object") return {};
  const sanitized = { ...details };
  for (const key of SENSITIVE_KEYS) {
    if (key in sanitized) sanitized[key] = "[REDACTED]";
  }
  for (const key in sanitized) {
    if (typeof sanitized[key] === "object" && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
      sanitized[key] = sanitizeActionDetails(sanitized[key]);
    }
  }
  return sanitized;
}

/**
 * Log activity to activity_logs. Never throws - logs errors to console.
 * @param {Object} params
 * @param {string} params.actionType - e.g. "task_created", "project_updated"
 * @param {string} params.actionCategory - "auth" | "project" | "task" | "settings" | etc.
 * @param {string} params.actionSummary - Short description
 * @param {Record<string,any>} [params.actionDetails] - Optional details (will be sanitized)
 * @param {number} params.performedById - User ID who performed the action
 * @param {number} [params.affectedUserId]
 * @param {number} [params.projectId]
 * @param {string} [params.entityType]
 * @param {number} [params.entityId]
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 * @param {import("express").Request} [params.req] - If provided, ipAddress/userAgent taken from req
 */
async function logActivity(params, req) {
  const request = req || null;
  const ipAddress = params.ipAddress || (request && (request.headers["x-forwarded-for"] || "").split(",")[0]?.trim()) || request?.headers["x-real-ip"] || null;
  const userAgent = params.userAgent || (request && request.headers["user-agent"]) || null;

  try {
    if (!prisma.activityLog) return;
    const sanitized = sanitizeActionDetails(params.actionDetails || {});
    await prisma.activityLog.create({
      data: {
        actionType: params.actionType,
        actionCategory: params.actionCategory,
        actionSummary: params.actionSummary,
        actionDetails: Object.keys(sanitized).length > 0 ? JSON.stringify(sanitized) : null,
        performedById: params.performedById,
        affectedUserId: params.affectedUserId ?? null,
        projectId: params.projectId ?? null,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        action: params.actionType,
        description: params.actionSummary,
        userId: params.performedById,
      },
    });
  } catch (err) {
    console.error("[activityLogger] Failed to log activity:", err.message);
  }
}

module.exports = { logActivity, sanitizeActionDetails };
