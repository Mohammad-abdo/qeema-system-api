"use strict";

const bcrypt = require("bcryptjs");
const { prisma } = require("../lib/prisma");
const { hasPermissionWithoutRoleBypass } = require("../lib/rbac");
const { sendError, CODES } = require("../lib/errorResponse");

async function list(req, res) {
  try {
    const query = req.query || {};
    const where = {};
    if (query.search && String(query.search).trim()) {
      const term = String(query.search).trim();
      where.OR = [
        { username: { contains: term } },
        { email: { contains: term } },
      ];
    }
    if (query.role && String(query.role).trim()) where.role = String(query.role).trim();
    if (query.teamId != null && query.teamId !== "" && query.teamId !== "all") {
      const tid = parseInt(query.teamId, 10);
      if (!Number.isNaN(tid)) where.teamId = tid;
    }
    if (query.isActive === "false" || query.isActive === "0") where.isActive = false;
    else if (query.isActive !== "all" && query.isActive !== "false") where.isActive = true;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        teamId: true,
        team: { select: { id: true, name: true } },
      },
      orderBy: { username: "asc" },
    });
    return res.json(users);
  } catch (err) {
    console.error("[usersController] list:", err);
    sendError(res, 500, err.message || "Failed to fetch users", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function getOne(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid user ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        teamId: true,
        createdAt: true,
        team: { select: { id: true, name: true, description: true } },
        roles: {
          include: {
            role: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) return sendError(res, 404, "User not found", { code: CODES.NOT_FOUND, requestId: req.id });
    return res.json(user);
  } catch (err) {
    console.error("[usersController] getOne:", err);
    sendError(res, 500, err.message || "Failed to fetch user", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function create(req, res) {
  try {
    const userId = Number(req.user.id);
    const allowed = await hasPermissionWithoutRoleBypass(userId, "user.create");
    if (!allowed) {
      return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });
    }
    const body = req.body || {};
    const username = body.username && String(body.username).trim();
    const email = body.email && String(body.email).trim();
    const password = body.password && String(body.password);
    if (!username || username.length < 3) {
      return sendError(res, 400, "Username must be at least 3 characters", { code: CODES.BAD_REQUEST, requestId: req.id });
    }
    if (!email || !email.includes("@")) {
      return sendError(res, 400, "Invalid email", { code: CODES.BAD_REQUEST, requestId: req.id });
    }
    if (!password || password.length < 6) {
      return sendError(res, 400, "Password must be at least 6 characters", { code: CODES.BAD_REQUEST, requestId: req.id });
    }
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      return sendError(res, 409, "User with this email or username already exists", { code: CODES.CONFLICT, requestId: req.id });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const roleName = body.role && String(body.role).trim() || "developer";
    const teamId = body.teamId != null ? (Number(body.teamId) || null) : null;
    const rbacRole = await prisma.role.findUnique({ where: { name: roleName } });
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: roleName,
        teamId: teamId > 0 ? teamId : null,
        isActive: true,
      },
    });
    if (rbacRole) {
      await prisma.userRole.create({
        data: {
          userId: newUser.id,
          roleId: rbacRole.id,
          scopeType: "global",
          scopeId: 0,
        },
      });
    }
    return res.status(201).json({ success: true, user: newUser });
  } catch (err) {
    console.error("[usersController] create:", err);
    sendError(res, 500, err.message || "Failed to create user", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function update(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid user ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const userId = Number(req.user.id);
    const allowed = await hasPermissionWithoutRoleBypass(userId, "user.update");
    if (!allowed) {
      return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });
    }
    const body = req.body || {};
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "User not found", { code: CODES.NOT_FOUND, requestId: req.id });
    const data = {};
    if (body.role != null) data.role = String(body.role);
    if (body.teamId !== undefined) data.teamId = body.teamId > 0 ? Number(body.teamId) : null;
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (Object.keys(data).length) {
      await prisma.user.update({ where: { id }, data });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("[usersController] update:", err);
    sendError(res, 500, err.message || "Failed to update user", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function remove(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid user ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const userId = Number(req.user.id);
    if (userId === id) {
      return sendError(res, 400, "Cannot delete your own account", { code: CODES.BAD_REQUEST, requestId: req.id });
    }
    const allowed = await hasPermissionWithoutRoleBypass(userId, "user.delete");
    if (!allowed) {
      return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });
    }
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        projectsManaged: { where: { NOT: { status: "completed" } }, select: { id: true, name: true } },
        teamsLed: { select: { id: true, name: true } },
      },
    });
    if (!user) return sendError(res, 404, "User not found", { code: CODES.NOT_FOUND, requestId: req.id });
    if (user.projectsManaged.length > 0) {
      return sendError(res, 400, "User is managing active projects; reassign first", { code: CODES.BAD_REQUEST, requestId: req.id });
    }
    if (user.teamsLed.length > 0) {
      return sendError(res, 400, "User is leading teams; reassign first", { code: CODES.BAD_REQUEST, requestId: req.id });
    }
    await prisma.$transaction(async (tx) => {
      await tx.activityLog.updateMany({ where: { performedById: id }, data: { performedById: null } });
      await tx.activityLog.updateMany({ where: { affectedUserId: id }, data: { affectedUserId: null } });
      await tx.activityLog.updateMany({ where: { userId: id }, data: { userId: null } });
      await tx.project.updateMany({ where: { createdById: id }, data: { createdById: null } });
      await tx.project.updateMany({ where: { projectManagerId: id }, data: { projectManagerId: null } });
      await tx.project.updateMany({ where: { urgentMarkedById: id }, data: { urgentMarkedById: null } });
      await tx.task.updateMany({ where: { createdById: id }, data: { createdById: null } });
      await tx.subtask.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } });
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("[usersController] remove:", err);
    sendError(res, 500, err.message || "Failed to delete user", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function getProjects(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid user ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const currentUserId = Number(req.user?.id);
    if (currentUserId !== id) {
      const allowed = await hasPermissionWithoutRoleBypass(currentUserId, "user.update");
      if (!allowed) return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });
    }
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { projectUsers: { some: { userId: id, leftAt: null } } },
          { tasks: { some: { assignees: { some: { id: id } } } } },
        ],
      },
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    });
    return res.json({ success: true, projects });
  } catch (err) {
    console.error("[usersController] getProjects:", err);
    sendError(res, 500, err.message || "Failed to fetch user projects", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function getTasks(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid user ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const currentUserId = Number(req.user?.id);
    if (currentUserId !== id) {
      const allowed = await hasPermissionWithoutRoleBypass(currentUserId, "user.update");
      if (!allowed) return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });
    }
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where: { assignees: { some: { id: id } } },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          projectId: true,
          project: { select: { id: true, name: true } },
          taskStatus: { select: { id: true, name: true, isFinal: true } },
        },
        orderBy: { dueDate: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.task.count({ where: { assignees: { some: { id: id } } } }),
    ]);
    return res.json({ success: true, tasks, total });
  } catch (err) {
    console.error("[usersController] getTasks:", err);
    sendError(res, 500, err.message || "Failed to fetch user tasks", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function getTeams(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid user ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const currentUserId = Number(req.user?.id);
    if (currentUserId !== id) {
      const allowed = await hasPermissionWithoutRoleBypass(currentUserId, "user.update");
      if (!allowed) return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });
    }
    const memberships = await prisma.teamMember.findMany({
      where: { userId: id },
      include: {
        team: { select: { id: true, name: true, status: true, description: true } },
      },
      orderBy: { joinedAt: "desc" },
    });
    const teams = memberships.map((m) => ({ ...m.team, role: m.role, joinedAt: m.joinedAt }));
    const legacyTeam = await prisma.user.findUnique({
      where: { id },
      select: { teamId: true, team: { select: { id: true, name: true, status: true } } },
    });
    if (legacyTeam?.team && !teams.some((t) => t.id === legacyTeam.team.id)) {
      teams.unshift({ ...legacyTeam.team, role: "legacy", joinedAt: null });
    }
    return res.json({ success: true, teams });
  } catch (err) {
    console.error("[usersController] getTeams:", err);
    sendError(res, 500, err.message || "Failed to fetch user teams", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
  getProjects,
  getTasks,
  getTeams,
};
