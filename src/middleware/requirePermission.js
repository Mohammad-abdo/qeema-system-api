"use strict";

const { hasPermissionWithoutRoleBypass, isAdmin } = require("../lib/rbac");
const { sendError, CODES } = require("../lib/errorResponse");
const { prisma } = require("../lib/prisma");

/**
 * Middleware that requires a specific permission. Use after authMiddleware.
 * Admin (RBAC role "admin") is allowed regardless of permission.
 * @param {string} permission - Permission key (e.g. "project.create", "task.delete")
 * @param {("body"|"params"|"query")} [projectIdSource] - Where to read projectId from (body.projectId, params.id, etc.)
 * @param {string} [projectIdKey] - Key name, e.g. "projectId" or "id"
 * @param {string|null} [entityType] - Optional entity type if we need to resolve projectId from another model (e.g., "task", "subtask")
 */
function requirePermission(permission, projectIdSource = "params", projectIdKey = "projectId", entityType = null) {
  return async function (req, res, next) {
    const requestId = req.id || undefined;
    const userId = Number(req.user?.id);
    if (!userId) {
      return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId });
    }
    if (await isAdmin(userId)) {
      return next();
    }
    let resolvedId;
    if (projectIdSource === "body") resolvedId = req.body?.[projectIdKey] ? parseInt(req.body[projectIdKey], 10) : undefined;
    else if (projectIdSource === "params") resolvedId = req.params?.[projectIdKey] ? parseInt(req.params[projectIdKey], 10) : undefined;
    else if (projectIdSource === "query") resolvedId = req.query?.[projectIdKey] ? parseInt(req.query[projectIdKey], 10) : undefined;

    let projectId = undefined;
    if (resolvedId && !Number.isNaN(resolvedId)) {
      if (!entityType) {
        projectId = resolvedId;
      } else if (entityType === "task") {
        try {
          const task = await prisma.task.findUnique({
            where: { id: resolvedId },
            select: { projectId: true },
          });
          projectId = task?.projectId;
        } catch (e) {
          console.error(`[requirePermission] Failed to resolve task:`, e);
        }
      } else if (entityType === "subtask") {
        try {
          const subtask = await prisma.subtask.findUnique({
            where: { id: resolvedId },
            select: { parentTask: { select: { projectId: true } } },
          });
          projectId = subtask?.parentTask?.projectId;
        } catch (e) {
          console.error(`[requirePermission] Failed to resolve subtask:`, e);
        }
      }
    }

    const allowed = await hasPermissionWithoutRoleBypass(userId, permission, projectId);
    if (!allowed) {
      return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId });
    }
    next();
  };
}

module.exports = { requirePermission };

