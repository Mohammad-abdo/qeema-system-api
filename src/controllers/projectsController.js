"use strict";

const { prisma } = require("../lib/prisma");
const { hasPermissionWithoutRoleBypass } = require("../lib/rbac");
const { sendError, CODES } = require("../lib/errorResponse");

function buildListWhere(query, userId) {
  const where = {};
  const userIdNum = Number(userId);

  if (query.search) {
    where.name = { contains: query.search };
  }
  if (query.category && query.category.length) {
    where.type = { in: query.category };
  }
  if (query.status && query.status.length) {
    const statusIds = [];
    const statusNames = [];
    for (const s of query.status) {
      const id = parseInt(s, 10);
      if (!Number.isNaN(id)) statusIds.push(id);
      else statusNames.push(s);
    }
    const conditions = [];
    if (statusIds.length) conditions.push({ projectStatusId: { in: statusIds } });
    const legacyNames = statusNames.filter((n) => n !== "active" && n !== "completed");
    if (legacyNames.length) {
      conditions.push({ status: { in: legacyNames }, projectStatusId: null });
    }
    if (statusNames.includes("active")) {
      conditions.push({ status: "active" });
      conditions.push({ projectStatus: { isActive: true } });
    }
    if (statusNames.includes("completed")) {
      conditions.push({ status: "completed" });
      conditions.push({ projectStatus: { isFinal: true } });
    }
    if (conditions.length) {
      where.OR = conditions;
      if (query.priority && query.priority.length) {
        where.priority = { in: query.priority };
      }
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
  status: true,
  type: true,
  projectStatusId: true,
  projectTypeId: true,
  projectManagerId: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  createdById: true,
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

    const [project, tasks, teams] = await Promise.all([
      prisma.project.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          type: true,
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
          status: true,
          taskStatusId: true,
          priority: true,
          dueDate: true,
          createdAt: true,
          assignees: {
            select: { id: true, username: true, email: true, avatarUrl: true },
          },
          attachments: {
            select: { id: true, fileName: true, fileUrl: true, fileType: true, fileSize: true },
          },
          dependencies: {
            select: {
              dependencyType: true,
              dependsOnTaskId: true,
              dependsOnTask: {
                select: { id: true, title: true, status: true, taskStatusId: true },
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
    ]);

    if (!project) return sendError(res, 404, "Project not found", { code: CODES.NOT_FOUND, requestId: req.id });
    return res.json({ ...project, tasks, projectTeams: teams });
  } catch (err) {
    console.error("[projectsController] getOne:", err);
    sendError(res, 500, err.message || "Failed to fetch project", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function create(req, res) {
  try {
    const userId = Number(req.user.id);
    const allowed = await hasPermissionWithoutRoleBypass(userId, "project.create");
    if (!allowed) {
      return sendError(res, 403, "Permission denied: You don't have permission to create projects", { code: CODES.FORBIDDEN, requestId: req.id });
    }
    const body = req.body || {};
    const name = body.name;
    if (!name || typeof name !== "string" || !name.trim()) {
      return sendError(res, 400, "Name is required", { code: CODES.BAD_REQUEST, requestId: req.id });
    }
    const projectTypeId = body.projectTypeId != null ? parseInt(body.projectTypeId, 10) : null;
    let typeName = body.type || "";
    if (projectTypeId) {
      const pt = await prisma.projectType.findUnique({
        where: { id: projectTypeId },
        select: { name: true },
      });
      if (pt) typeName = pt.name;
    }
    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        type: typeName,
        projectTypeId: projectTypeId || undefined,
        projectStatusId: body.projectStatusId != null ? parseInt(body.projectStatusId, 10) : undefined,
        description: body.description || null,
        scope: body.scope || null,
        status: "planned",
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        projectManagerId: body.projectManagerId > 0 ? body.projectManagerId : null,
        createdById: userId,
      },
    });
    return res.status(200).json({ success: true, id: project.id });
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
      select: { id: true, createdById: true },
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
    let typeName = body.type;
    let statusName = body.status;
    if (projectTypeId) {
      const pt = await prisma.projectType.findUnique({ where: { id: projectTypeId }, select: { name: true } });
      if (pt) typeName = pt.name;
    }
    if (projectStatusId && prisma.projectStatus) {
      const ps = await prisma.projectStatus.findUnique({ where: { id: projectStatusId }, select: { name: true } });
      if (ps) statusName = ps.name;
    }

    await prisma.project.update({
      where: { id },
      data: {
        name: body.name != null ? String(body.name) : undefined,
        type: typeName,
        projectTypeId,
        projectStatusId,
        description: body.description != null ? body.description : undefined,
        scope: body.scope != null ? body.scope : undefined,
        status: statusName,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        projectManagerId: body.projectManagerId != null && body.projectManagerId > 0 ? body.projectManagerId : null,
      },
    });
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
      select: { id: true, createdById: true },
    });
    if (!existing) return sendError(res, 404, "Project not found", { code: CODES.NOT_FOUND, requestId: req.id });

    const allowed = await hasPermissionWithoutRoleBypass(userId, "project.delete", id);
    const isCreator = existing.createdById === userId;
    if (!allowed && !isCreator) {
      return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });
    }

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
