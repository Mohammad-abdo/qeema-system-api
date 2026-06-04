"use strict";

const { prisma } = require("../lib/prisma");
const { hasPermissionWithoutRoleBypass } = require("../lib/rbac");
const { sendError, CODES } = require("../lib/errorResponse");
const { logActivity } = require("../lib/activityLogger");
const { notifyUsers } = require("../lib/notifyUsers");

function buildListWhere(query, userId) {
  const where = {};
  const userIdNum = Number(userId);

  if (query.search) {
    where.name = { contains: query.search };
  }
  if (query.category && query.category.length) {
    const typeIds = query.category.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n));
    if (typeIds.length) where.projectTypeId = { in: typeIds };
  }
  if (query.status && query.status.length) {
    const statusIds = [];
    for (const s of query.status) {
      const id = parseInt(s, 10);
      if (!Number.isNaN(id)) statusIds.push(id);
    }
    if (statusIds.length) {
      where.projectStatusId = { in: statusIds };
    }
  }
  if (query.startDate || query.endDate) {
    where.AND = where.AND || [];
    if (query.startDate) {
      where.AND.push({ startDate: { gte: new Date(query.startDate) } });
    }
    if (query.endDate) {
      where.AND.push({ endDate: { lte: new Date(query.endDate) } });
    }
  }
  if (query.projectManager) {
    where.projectManagerId = parseInt(query.projectManager, 10);
  }

  return hasPermissionWithoutRoleBypass(userIdNum, "project.viewAll").then((canViewAll) => {
    if (!canViewAll) {
      const userConditions = [
        { projectManagerId: userIdNum },
        { createdById: userIdNum },
      ];
      if (where.OR) {
        where.AND = where.AND || [];
        where.AND.push({ OR: [...where.OR, ...userConditions] });
        delete where.OR;
      } else {
        where.OR = userConditions;
      }
    }
    return where;
  });
}

const projectListSelect = {
  id: true,
  name: true,
  description: true,
  projectStatusId: true,
  projectTypeId: true,
  projectManagerId: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  createdById: true,
  projectStatus: { select: { id: true, name: true } },
  projectType: { select: { id: true, name: true } },
  projectManager: {
    select: { id: true, username: true, email: true, avatarUrl: true },
  },
  _count: {
    select: { tasks: true, projectUsers: true, notifications: true },
  },
};

async function list(req, res) {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const where = await buildListWhere(req.query, userId);
    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: projectListSelect,
      }),
      prisma.project.count({ where }),
    ]);

    return res.json({ success: true, projects, total, page, limit });
  } catch (err) {
    console.error("[projectsController] list:", err);
    sendError(res, 500, err.message || "Failed to fetch projects", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function getOne(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid project ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const [project, tasks, teams, deliverables, phases, projectUserRows] = await Promise.all([
      prisma.project.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          description: true,
          priority: true,
          projectStatusId: true,
          projectTypeId: true,
          projectManagerId: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          createdById: true,
          urgentMarkedAt: true,
          urgentMarkedById: true,
          projectType: { select: { id: true, name: true } },
          projectStatus: { select: { id: true, name: true } },
          projectManager: {
            select: { id: true, username: true, email: true, avatarUrl: true },
          },
          urgentMarkedBy: { select: { id: true, username: true } },
          _count: { select: { tasks: true, projectUsers: true, projectTeams: true } },
        },
      }),
      prisma.task.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          taskStatusId: true,
          taskStatus: {
            select: { id: true, name: true, isFinal: true, isBlocking: true },
          },
          priority: true,
          dueDate: true,
          plannedDate: true,
          createdAt: true,
          assignees: {
            where: { isActive: true },
            select: { id: true, username: true, email: true, avatarUrl: true },
          },
          attachments: {
            select: {
              id: true,
              fileName: true,
              fileUrl: true,
              fileType: true,
              fileSize: true,
              uploadedAt: true,
            },
          },
          dependencies: {
            select: {
              dependencyType: true,
              dependsOnTaskId: true,
              dependsOnTask: {
                select: {
                  id: true,
                  title: true,
                  taskStatusId: true,
                  taskStatus: { select: { id: true, name: true, isFinal: true } },
                },
              },
            },
          },
        },
      }),
      prisma.projectTeam.findMany({
        where: { projectId: id },
        select: {
          id: true,
          teamId: true,
          team: {
            select: {
              id: true,
              name: true,
              description: true,
              teamLead: {
                select: { id: true, username: true, email: true, avatarUrl: true },
              },
              members: {
                select: {
                  id: true,
                  userId: true,
                  user: {
                    select: { id: true, username: true, email: true, avatarUrl: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.deliverable.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "asc" },
      }),
      prisma.projectPhase.findMany({
        where: { projectId: id },
        orderBy: { sequenceOrder: "asc" },
      }),
      prisma.projectUser.findMany({
        where: { projectId: id, leftAt: null },
        select: {
          id: true,
          userId: true,
          role: true,
          allocationPercentage: true,
          joinedAt: true,
        },
      }),
    ]);

    if (!project) return sendError(res, 404, "Project not found", { code: CODES.NOT_FOUND, requestId: req.id });

    const memberUserIds = [...new Set(projectUserRows.map((pu) => pu.userId).filter(Boolean))];
    const memberUsers =
      memberUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: memberUserIds }, isActive: true },
            select: { id: true, username: true, email: true, avatarUrl: true },
          })
        : [];
    const userById = Object.fromEntries(memberUsers.map((u) => [u.id, u]));
    const projectMembers = projectUserRows.map((pu) => ({
      ...pu,
      user: userById[pu.userId] ?? null,
    }));

    return res.json({
      ...project,
      tasks,
      projectTeams: teams,
      deliverables,
      phases,
      projectMembers,
    });
  } catch (err) {
    console.error("[projectsController] getOne:", err);
    sendError(res, 500, err.message || "Failed to fetch project", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function create(req, res) {
  try {
    const userId = Number(req.user.id);
    const body = req.body || {};
    const name = body.name;
    if (!name || typeof name !== "string" || !name.trim()) {
      return sendError(res, 400, "Name is required", { code: CODES.BAD_REQUEST, requestId: req.id });
    }

    let projectStatusId = body.projectStatusId != null ? parseInt(body.projectStatusId, 10) : null;
    if (!projectStatusId) {
      const defaultStatus = await prisma.projectStatus.findFirst({
        where: { isDefault: true, isActive: true },
        select: { id: true },
      });
      projectStatusId = defaultStatus?.id ?? null;
    }

    const projectTypeId = body.projectTypeId != null ? parseInt(body.projectTypeId, 10) : null;

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        projectTypeId: projectTypeId || undefined,
        projectStatusId: projectStatusId || undefined,
        description: body.description || null,
        scope: body.scope || null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        projectManagerId: body.projectManagerId > 0 ? body.projectManagerId : null,
        createdById: userId,
      },
    });
    await logActivity({
      actionType: "project_created",
      actionCategory: "project",
      entityType: "project",
      entityId: project.id,
      projectId: project.id,
      performedById: userId,
      actionSummary: `Project '${project.name}' created`,
    }, req);
    return res.status(201).json({ success: true, id: project.id, project });
  } catch (err) {
    console.error("[projectsController] create:", err);
    sendError(res, 500, err.message || "Failed to create project", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function update(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid project ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const userId = Number(req.user.id);

    const existing = await prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true, createdById: true, projectStatusId: true, projectManagerId: true },
    });
    if (!existing) return sendError(res, 404, "Project not found", { code: CODES.NOT_FOUND, requestId: req.id });

    const allowed = await hasPermissionWithoutRoleBypass(userId, "project.update", id);
    const isCreator = existing.createdById === userId;
    if (!allowed && !isCreator) {
      return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });
    }

    const body = req.body || {};
    const projectTypeId = body.projectTypeId != null ? parseInt(body.projectTypeId, 10) : undefined;
    const projectStatusId = body.projectStatusId != null ? parseInt(body.projectStatusId, 10) : undefined;

    await prisma.project.update({
      where: { id },
      data: {
        name: body.name != null ? String(body.name) : undefined,
        projectTypeId,
        projectStatusId,
        description: body.description != null ? body.description : undefined,
        scope: body.scope != null ? body.scope : undefined,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        projectManagerId: body.projectManagerId != null && body.projectManagerId > 0 ? body.projectManagerId : null,
      },
    });

    const statusChanged = projectStatusId != null && projectStatusId !== existing.projectStatusId;
    if (statusChanged) {
      const assignees = await prisma.task.findMany({
        where: { projectId: id },
        select: { assignees: { select: { id: true } } },
      });
      const assigneeIds = [...new Set(assignees.flatMap((t) => (t.assignees || []).map((a) => a.id)))];
      const memberIds = new Set(assigneeIds);
      if (existing.projectManagerId) memberIds.add(existing.projectManagerId);
      memberIds.delete(userId);
      const toNotify = [...memberIds];
      if (toNotify.length > 0) {
        const ps = projectStatusId
          ? await prisma.projectStatus.findUnique({ where: { id: projectStatusId }, select: { name: true } })
          : null;
        const displayStatus = ps?.name || "updated";
        await notifyUsers(
          toNotify.map((uid) => ({
            userId: uid,
            title: "Project updated",
            message: `Project '${existing.name}' status: ${displayStatus}`,
            type: "project_updated",
            linkUrl: `/dashboard/projects/${id}`,
          }))
        );
      }
    }

    await logActivity({
      actionType: "project_updated",
      actionCategory: "project",
      entityType: "project",
      entityId: id,
      projectId: id,
      performedById: userId,
      actionSummary: `Project '${existing.name}' updated`,
    }, req);
    return res.json({ success: true });
  } catch (err) {
    console.error("[projectsController] update:", err);
    sendError(res, 500, err.message || "Failed to update project", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function remove(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid project ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const userId = Number(req.user.id);

    const existing = await prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true, createdById: true },
    });
    if (!existing) return sendError(res, 404, "Project not found", { code: CODES.NOT_FOUND, requestId: req.id });

    const allowed = await hasPermissionWithoutRoleBypass(userId, "project.delete", id);
    const isCreator = existing.createdById === userId;
    if (!allowed && !isCreator) {
      return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });
    }

    await logActivity({
      actionType: "project_deleted",
      actionCategory: "project",
      entityType: "project",
      entityId: id,
      projectId: id,
      performedById: userId,
      actionSummary: `Project '${existing.name}' deleted`,
    }, req);
    await prisma.project.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) {
    console.error("[projectsController] remove:", err);
    sendError(res, 500, err.message || "Failed to delete project", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
};
