"use strict";

const { hasPermissionWithoutRoleBypass, getPermissionsList, isAdmin } = require("../lib/rbac");
const { prisma } = require("../lib/prisma");
const { sendError, CODES } = require("../lib/errorResponse");

async function check(req, res) {
  try {
    const userId = parseInt(req.query.userId || req.body?.userId, 10);
    const permission = req.query.permission || req.body?.permission;
    const projectId = req.query.projectId != null || req.body?.projectId != null
      ? parseInt(req.query.projectId || req.body?.projectId, 10)
      : undefined;
    if (Number.isNaN(userId) || !permission) {
      return sendError(res, 400, "userId and permission are required", { code: CODES.BAD_REQUEST, requestId: req.id });
    }
    const allowed = await hasPermissionWithoutRoleBypass(userId, String(permission), projectId);
    return res.json({ allowed: !!allowed });
  } catch (err) {
    console.error("[rbacController] check:", err);
    sendError(res, 500, err.message || "Permission check failed", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function permissions(req, res) {
  try {
    const userId = parseInt(req.query.userId, 10);
    const projectId = req.query.projectId != null ? parseInt(req.query.projectId, 10) : undefined;
    if (Number.isNaN(userId)) {
      return sendError(res, 400, "userId is required", { code: CODES.BAD_REQUEST, requestId: req.id });
    }
    const list = await getPermissionsList(userId, projectId);
    return res.json({ permissions: list });
  } catch (err) {
    console.error("[rbacController] permissions:", err);
    sendError(res, 500, err.message || "Failed to get permissions", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function isAdminUser(req, res) {
  try {
    const userId = parseInt(req.query.userId, 10);
    if (Number.isNaN(userId)) {
      return sendError(res, 400, "userId is required", { code: CODES.BAD_REQUEST, requestId: req.id });
    }
    const admin = await isAdmin(userId);
    return res.json({ admin: !!admin });
  } catch (err) {
    console.error("[rbacController] isAdminUser:", err);
    sendError(res, 500, err.message || "Failed to check admin", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function listRoles(req, res) {
  const requestId = req.id;
  const userId = Number(req.user?.id);
  if (!userId) return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId });
  const can = await hasPermissionWithoutRoleBypass(userId, "role.read");
  if (!can && !(await isAdmin(userId))) {
    return sendError(res, 403, "Forbidden", { code: CODES.FORBIDDEN, requestId });
  }
  try {
    const roles = await prisma.role.findMany({
      orderBy: { name: "asc" },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { userRoles: true } },
      },
    });
    const list = roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystemRole: r.isSystemRole,
      permissionsCount: r.permissions.length,
      usersCount: r._count.userRoles,
    }));
    return res.json({ roles: list });
  } catch (err) {
    console.error("[rbacController] listRoles:", err);
    sendError(res, 500, err.message || "Failed to list roles", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function listAllPermissions(req, res) {
  const requestId = req.id;
  const userId = Number(req.user?.id);
  if (!userId) return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId });
  const can = await hasPermissionWithoutRoleBypass(userId, "role.read");
  if (!can && !(await isAdmin(userId))) {
    return sendError(res, 403, "Forbidden", { code: CODES.FORBIDDEN, requestId });
  }
  try {
    const perms = await prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { key: "asc" }],
    });
    return res.json({ permissions: perms });
  } catch (err) {
    console.error("[rbacController] listAllPermissions:", err);
    sendError(res, 500, err.message || "Failed to list permissions", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function createRole(req, res) {
  const requestId = req.id;
  const userId = Number(req.user?.id);
  if (!userId) return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId });
  const can = await hasPermissionWithoutRoleBypass(userId, "role.create");
  if (!can && !(await isAdmin(userId))) {
    return sendError(res, 403, "Forbidden", { code: CODES.FORBIDDEN, requestId });
  }
  try {
    const { name, description } = req.body || {};
    if (!name || !String(name).trim()) {
      return sendError(res, 400, "name is required", { code: CODES.BAD_REQUEST, requestId });
    }
    const existing = await prisma.role.findUnique({ where: { name: String(name).trim() } });
    if (existing) {
      return sendError(res, 400, "Role name already exists", { code: CODES.BAD_REQUEST, requestId });
    }
    const role = await prisma.role.create({
      data: { name: String(name).trim(), description: description ? String(description).trim() : null },
    });
    return res.status(201).json(role);
  } catch (err) {
    console.error("[rbacController] createRole:", err);
    sendError(res, 500, err.message || "Failed to create role", { code: CODES.INTERNAL_ERROR, requestId });
  }
}

async function updateRole(req, res) {
  const requestId = req.id;
  const userId = Number(req.user?.id);
  if (!userId) return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId });
  const can = await hasPermissionWithoutRoleBypass(userId, "role.update");
  if (!can && !(await isAdmin(userId))) {
    return sendError(res, 403, "Forbidden", { code: CODES.FORBIDDEN, requestId });
  }
  const roleId = parseInt(req.params.id, 10);
  if (Number.isNaN(roleId)) return sendError(res, 400, "Invalid role id", { code: CODES.BAD_REQUEST, requestId });
  try {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) return sendError(res, 404, "Role not found", { code: CODES.NOT_FOUND, requestId });
    const { name, description } = req.body || {};
    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (description !== undefined) data.description = description ? String(description).trim() : null;
    const updated = await prisma.role.update({ where: { id: roleId }, data });
    return res.json(updated);
  } catch (err) {
    console.error("[rbacController] updateRole:", err);
    sendError(res, 500, err.message || "Failed to update role", { code: CODES.INTERNAL_ERROR, requestId });
  }
}

async function getRolePermissions(req, res) {
  const requestId = req.id;
  const roleId = parseInt(req.params.id, 10);
  if (Number.isNaN(roleId)) return sendError(res, 400, "Invalid role id", { code: CODES.BAD_REQUEST, requestId });
  try {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) return sendError(res, 404, "Role not found", { code: CODES.NOT_FOUND, requestId });
    const permissions = role.permissions.map((rp) => rp.permission);
    return res.json({ role: { id: role.id, name: role.name, description: role.description }, permissions });
  } catch (err) {
    console.error("[rbacController] getRolePermissions:", err);
    sendError(res, 500, err.message || "Failed to get role permissions", { code: CODES.INTERNAL_ERROR, requestId });
  }
}

async function setRolePermissions(req, res) {
  const requestId = req.id;
  const userId = Number(req.user?.id);
  if (!userId) return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId });
  const can = await hasPermissionWithoutRoleBypass(userId, "role.manage_permissions");
  if (!can && !(await isAdmin(userId))) {
    return sendError(res, 403, "Forbidden", { code: CODES.FORBIDDEN, requestId });
  }
  const roleId = parseInt(req.params.id, 10);
  if (Number.isNaN(roleId)) return sendError(res, 400, "Invalid role id", { code: CODES.BAD_REQUEST, requestId });
  const permissionIds = req.body?.permissionIds ?? req.body?.permissions ?? [];
  const ids = Array.isArray(permissionIds) ? permissionIds.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n)) : [];
  try {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) return sendError(res, 404, "Role not found", { code: CODES.NOT_FOUND, requestId });
    await prisma.rolePermission.deleteMany({ where: { roleId } });
    if (ids.length > 0) {
      await prisma.rolePermission.createMany({
        data: ids.map((permissionId) => ({ roleId, permissionId })),
        skipDuplicates: true,
      });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("[rbacController] setRolePermissions:", err);
    sendError(res, 500, err.message || "Failed to set permissions", { code: CODES.INTERNAL_ERROR, requestId });
  }
}

async function deleteRole(req, res) {
  const requestId = req.id;
  const userId = Number(req.user?.id);
  if (!userId) return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId });
  const can = await hasPermissionWithoutRoleBypass(userId, "role.delete");
  if (!can && !(await isAdmin(userId))) {
    return sendError(res, 403, "Forbidden", { code: CODES.FORBIDDEN, requestId });
  }
  const roleId = parseInt(req.params.id, 10);
  if (Number.isNaN(roleId)) return sendError(res, 400, "Invalid role id", { code: CODES.BAD_REQUEST, requestId });
  try {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) return sendError(res, 404, "Role not found", { code: CODES.NOT_FOUND, requestId });
    if (role.isSystemRole) {
      return sendError(res, 400, "Cannot delete system role", { code: CODES.BAD_REQUEST, requestId });
    }
    await prisma.role.delete({ where: { id: roleId } });
    return res.json({ success: true });
  } catch (err) {
    console.error("[rbacController] deleteRole:", err);
    sendError(res, 500, err.message || "Failed to delete role", { code: CODES.INTERNAL_ERROR, requestId });
  }
}

module.exports = {
  check,
  permissions,
  isAdminUser,
  listRoles,
  listAllPermissions,
  createRole,
  updateRole,
  getRolePermissions,
  setRolePermissions,
  deleteRole,
};
