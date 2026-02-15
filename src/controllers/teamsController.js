"use strict";

const { prisma } = require("../lib/prisma");
const { hasPermissionWithoutRoleBypass } = require("../lib/rbac");
const { sendError, CODES } = require("../lib/errorResponse");

async function list(req, res) {
  try {
    const teams = await prisma.team.findMany({
      include: {
        _count: {
          select: {
            users: true,
            tasks: true,
            members: true,
            projectTeams: true,
          },
        },
        teamLead: {
          select: { id: true, username: true, email: true, avatarUrl: true },
        },
        users: {
          take: 5,
          select: { id: true, username: true, email: true, avatarUrl: true },
        },
        members: {
          take: 5,
          include: {
            user: {
              select: { id: true, username: true, email: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json(teams);
  } catch (err) {
    console.error("[teamsController] list:", err);
    sendError(res, 500, err.message || "Failed to fetch teams", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function getOne(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid team ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        teamLead: {
          select: { id: true, username: true, email: true, avatarUrl: true, role: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, username: true, email: true, avatarUrl: true, role: true },
            },
          },
          orderBy: { joinedAt: "desc" },
        },
        projectTeams: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                status: true,
                startDate: true,
                endDate: true,
                projectManager: {
                  select: { id: true, username: true, email: true },
                },
              },
            },
          },
          orderBy: { assignedAt: "desc" },
        },
        _count: {
          select: { tasks: true, members: true, projectTeams: true },
        },
      },
    });

    if (!team) return sendError(res, 404, "Team not found", { code: CODES.NOT_FOUND, requestId: req.id });
    return res.json(team);
  } catch (err) {
    console.error("[teamsController] getOne:", err);
    sendError(res, 500, err.message || "Failed to fetch team", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function create(req, res) {
  try {
    const userId = Number(req.user.id);
    const allowed = await hasPermissionWithoutRoleBypass(userId, "team.create");
    if (!allowed) {
      return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });
    }

    const body = req.body || {};
    const name = body.name && String(body.name).trim();
    if (!name) return sendError(res, 400, "Name is required", { code: CODES.BAD_REQUEST, requestId: req.id });

    const team = await prisma.team.create({
      data: {
        name,
        description: body.description || null,
        teamLeadId: body.teamLeadId > 0 ? body.teamLeadId : null,
        status: body.status === "inactive" ? "inactive" : "active",
      },
    });
    return res.status(201).json({ success: true, id: team.id, team });
  } catch (err) {
    console.error("[teamsController] create:", err);
    sendError(res, 500, err.message || "Failed to create team", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function update(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid team ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const userId = Number(req.user.id);

    const existing = await prisma.team.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "Team not found", { code: CODES.NOT_FOUND, requestId: req.id });

    const allowed = await hasPermissionWithoutRoleBypass(userId, "team.update");
    if (!allowed) {
      return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });
    }

    const body = req.body || {};
    await prisma.team.update({
      where: { id },
      data: {
        ...(body.name != null && { name: String(body.name).trim() }),
        ...(body.description !== undefined && { description: body.description || null }),
        ...(body.teamLeadId !== undefined && { teamLeadId: body.teamLeadId > 0 ? body.teamLeadId : null }),
        ...(body.status !== undefined && { status: body.status === "inactive" ? "inactive" : "active" }),
      },
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("[teamsController] update:", err);
    sendError(res, 500, err.message || "Failed to update team", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function remove(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid team ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const userId = Number(req.user.id);

    const existing = await prisma.team.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "Team not found", { code: CODES.NOT_FOUND, requestId: req.id });

    const allowed = await hasPermissionWithoutRoleBypass(userId, "team.delete");
    if (!allowed) {
      return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });
    }

    await prisma.team.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) {
    console.error("[teamsController] remove:", err);
    sendError(res, 500, err.message || "Failed to delete team", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function listMembers(req, res) {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    if (Number.isNaN(teamId)) return sendError(res, 400, "Invalid team ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, email: true, avatarUrl: true, role: true } },
          },
          orderBy: { joinedAt: "desc" },
        },
      },
    });
    if (!team) return sendError(res, 404, "Team not found", { code: CODES.NOT_FOUND, requestId: req.id });
    return res.json({ success: true, members: team.members });
  } catch (err) {
    console.error("[teamsController] listMembers:", err);
    sendError(res, 500, "Failed to list members", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function addMember(req, res) {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    if (Number.isNaN(teamId)) return sendError(res, 400, "Invalid team ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const userId = Number(req.user.id);
    const allowed = await hasPermissionWithoutRoleBypass(userId, "team.update");
    if (!allowed) return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });

    const body = req.body || {};
    const memberUserId = body.userId != null ? parseInt(body.userId, 10) : NaN;
    if (Number.isNaN(memberUserId)) return sendError(res, 400, "userId is required", { code: CODES.BAD_REQUEST, requestId: req.id });
    const role = (body.role && ["member", "lead", "admin"].includes(body.role)) ? body.role : "member";

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return sendError(res, 404, "Team not found", { code: CODES.NOT_FOUND, requestId: req.id });

    await prisma.teamMember.create({
      data: { teamId, userId: memberUserId, role },
    });
    return res.status(201).json({ success: true });
  } catch (err) {
    if (err.code === "P2002") return sendError(res, 409, "User is already a member of this team", { code: CODES.BAD_REQUEST, requestId: req.id });
    console.error("[teamsController] addMember:", err);
    sendError(res, 500, "Failed to add member", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function removeMember(req, res) {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    const memberUserId = parseInt(req.params.userId, 10);
    if (Number.isNaN(teamId) || Number.isNaN(memberUserId)) return sendError(res, 400, "Invalid ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const userId = Number(req.user.id);
    const allowed = await hasPermissionWithoutRoleBypass(userId, "team.update");
    if (!allowed) return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });

    await prisma.teamMember.delete({
      where: {
        teamId_userId: { teamId, userId: memberUserId },
      },
    });
    return res.json({ success: true });
  } catch (err) {
    if (err.code === "P2025") return sendError(res, 404, "Member not found", { code: CODES.NOT_FOUND, requestId: req.id });
    console.error("[teamsController] removeMember:", err);
    sendError(res, 500, "Failed to remove member", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function getTeamTasks(req, res) {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    if (Number.isNaN(teamId)) return sendError(res, 400, "Invalid team ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const memberIds = await prisma.teamMember.findMany({
      where: { teamId },
      select: { userId: true },
    }).then((rows) => rows.map((r) => r.userId));
    if (memberIds.length === 0) return res.json({ success: true, tasks: [], total: 0 });

    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where: {
          assignees: { some: { id: { in: memberIds } } },
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          projectId: true,
          project: { select: { id: true, name: true } },
          assignees: { select: { id: true, username: true, email: true } },
          taskStatus: { select: { id: true, name: true, isFinal: true } },
        },
        orderBy: { dueDate: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.task.count({
        where: {
          assignees: { some: { id: { in: memberIds } } },
        },
      }),
    ]);
    return res.json({ success: true, tasks, total });
  } catch (err) {
    console.error("[teamsController] getTeamTasks:", err);
    sendError(res, 500, "Failed to fetch team tasks", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
  listMembers,
  addMember,
  removeMember,
  getTeamTasks,
};
