"use strict";

const { hasPermissionWithoutRoleBypass } = require("../lib/rbac");
const { sendError, CODES } = require("../lib/errorResponse");

/**
 * Middleware that requires a specific permission. Use after authMiddleware.
 * @param {string} permission - Permission key (e.g. "project.create", "task.delete")
 * @param {("body"|"params"|"query")} [projectIdSource] - Where to read projectId from (body.projectId, params.id, etc.)
 * @param {string} [projectIdKey] - Key name, e.g. "projectId" or "id"
 */
function requirePermission(permission, projectIdSource = "params", projectIdKey = "projectId") {
  return async function (req, res, next) {
    const requestId = req.id || undefined;
    const userId = Number(req.user?.id);
    if (!userId) {
      return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId });
    }
    let projectId;
    if (projectIdSource === "body") projectId = req.body?.[projectIdKey] ? parseInt(req.body[projectIdKey], 10) : undefined;
    else if (projectIdSource === "params") projectId = req.params?.[projectIdKey] ? parseInt(req.params[projectIdKey], 10) : undefined;
    else if (projectIdSource === "query") projectId = req.query?.[projectIdKey] ? parseInt(req.query[projectIdKey], 10) : undefined;

    const allowed = await hasPermissionWithoutRoleBypass(userId, permission, projectId);
    if (!allowed) {
      return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId });
    }
    next();
  };
}

module.exports = { requirePermission };
