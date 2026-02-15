"use strict";

const { prisma } = require("../lib/prisma");
const { hasPermissionWithoutRoleBypass } = require("../lib/rbac");
const { sendError, CODES } = require("../lib/errorResponse");

function buildListWhere(query, userId) {
  const where = {};
  const userIdNum = Number(userId);

  if (query.search) {
    where.OR = [
      { title: { contains: query.search } },
      { project: { name: { contains: query.search } } },
      { assignees: { some: { username: { contains: query.search } } } },
    ];
  }
  if (query.projectId && query.projectId.length) {
    where.projectId = { in: query.projectId.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n)) };
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
    if (statusIds.length) conditions.push({ taskStatusId: { in: statusIds } });
    if (statusNames.length) conditions.push({ status: { in: statusNames }, taskStatusId: null });
    if (conditions.length) {
      where.AND = where.AND || [];
      where.AND.push({ OR: conditions });
    }
  }
  if (query.priority && query.priority.length) {
    where.priority = { in: query.priority };
  }
  if (query.assigneeId) {
    if (query.assigneeId === "me") {
      where.assignees = { some: { id: userIdNum } };
    } else {
      const id = parseInt(query.assigneeId, 10);
      if (!Number.isNaN(id)) where.assignees = { some: { id } };
    }
  }
  if (query.startDate || query.endDate) {
    const dateField = query.dateFilterType === "plannedDate"
      ? "plannedDate"
      : query.dateFilterType === "createdDate"
        ? "createdAt"
        : "dueDate";
    where.AND = where.AND || [];
    if (query.startDate) where.AND.push({ [dateField]: { gte: new Date(query.startDate) } });
    if (query.endDate) where.AND.push({ [dateField]: { lte: new Date(query.endDate) } });
  }

  return where;
}

const taskListSelect = {
  id: true,
  title: true,
  description: true,
  priority: true,
  status: true,
  dueDate: true,
  plannedDate: true,
  projectId: true,
  createdAt: true,
  createdById: true,
  assignees: {
    select: { id: true, username: true, email: true, avatarUrl: true },
  },
  project: {
    select: { id: true, name: true },
  },
  _count: {
    select: { dependencies: true, dependents: true },
  },
};

const taskGetOneSelect = {
  id: true,
  title: true,
  description: true,
  priority: true,
  status: true,
  dueDate: true,
  projectId: true,
  createdAt: true,
  createdById: true,
  startedAt: true,
  completedAt: true,
  taskStatusId: true,
  teamId: true,
  assignees: { select: { id: true, username: true, email: true, avatarUrl: true } },
  project: { select: { id: true, name: true } },
  taskStatus: { select: { id: true, name: true, color: true, isFinal: true } },
  team: { select: { id: true, name: true } },
  creator: { select: { id: true, username: true, email: true, avatarUrl: true } },
  attachments: { select: { id: true, fileName: true, fileUrl: true, fileSize: true, uploadedAt: true } },
  comments: {
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: { select: { id: true, username: true, email: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  },
  subtasks: {
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      assignedTo: { select: { id: true, username: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "asc" },
  },
  dependencies: {
    select: {
      dependsOnTaskId: true,
      dependsOnTask: {
        select: {
          id: true,
          title: true,
          status: true,
          assignees: { select: { id: true, username: true, avatarUrl: true } },
        },
      },
    },
  },
  dependents: {
    select: {
      taskId: true,
      task: {
        select: {
          id: true,
          title: true,
          status: true,
          assignees: { select: { id: true, username: true, avatarUrl: true } },
        },
      },
    },
  },
  _count: { select: { subtasks: true, dependencies: true, dependents: true, comments: true } },
};

async function list(req, res) {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const where = buildListWhere(req.query, userId);
    if (req.user.role !== "admin") {
      const userConditions = [
        { assignees: { some: { id: Number(userId) } } },
        { createdById: Number(userId) },
      ];
      if (where.OR) {
        where.AND = where.AND || [];
        where.AND.push({ OR: [...where.OR, ...userConditions] });
        delete where.OR;
      } else {
        where.OR = userConditions;
      }
    }
    const skip = (page - 1) * limit;
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: taskListSelect,
      }),
      prisma.task.count({ where }),
    ]);
    return res.json({ success: true, tasks, total, page, limit });
  } catch (err) {
    console.error("[tasksController] list:", err);
    sendError(res, 500, err.message || "Failed to fetch tasks", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function getOne(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid task ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const userId = Number(req.user.id);
    const task = await prisma.task.findUnique({
      where: { id },
      select: taskGetOneSelect,
    });
    if (!task) return sendError(res, 404, "Task not found", { code: CODES.NOT_FOUND, requestId: req.id });
    if (req.user.role !== "admin") {
      const isAssignee = task.assignees.some((a) => a.id === userId);
      const isCreator = task.createdById === userId;
      if (!isAssignee && !isCreator) return sendError(res, 404, "Task not found", { code: CODES.NOT_FOUND, requestId: req.id });
    }
    return res.json(task);
  } catch (err) {
    console.error("[tasksController] getOne:", err);
    sendError(res, 500, err.message || "Failed to fetch task", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function create(req, res) {
  try {
    const userId = Number(req.user.id);
    const body = req.body || {};
    const projectId = body.projectId != null ? parseInt(body.projectId, 10) : null;
    if (!projectId || Number.isNaN(projectId)) {
      return sendError(res, 400, "projectId is required", { code: CODES.BAD_REQUEST, requestId: req.id });
    }
    const allowed = await hasPermissionWithoutRoleBypass(userId, "task.create", projectId);
    if (!allowed) {
      return sendError(res, 403, "Permission denied: You don't have permission to create tasks", { code: CODES.FORBIDDEN, requestId: req.id });
    }
    const title = body.title && String(body.title).trim();
    if (!title) return sendError(res, 400, "title is required", { code: CODES.BAD_REQUEST, requestId: req.id });
    const assigneeIds = Array.isArray(body.assigneeIds) ? body.assigneeIds.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n)) : [];
    const task = await prisma.task.create({
      data: {
        title: title,
        description: body.description || null,
        priority: body.priority || "normal",
        projectId,
        createdById: userId,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        ...(assigneeIds.length > 0 && {
          assignees: { connect: assigneeIds.map((id) => ({ id })) },
        }),
      },
      include: { assignees: true, project: true },
    });
    return res.status(200).json({ success: true, id: task.id });
  } catch (err) {
    console.error("[tasksController] create:", err);
    sendError(res, 500, err.message || "Failed to create task", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function update(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid task ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const userId = Number(req.user.id);
    const existing = await prisma.task.findUnique({
      where: { id },
      select: { id: true, createdById: true, projectId: true, assignees: { select: { id: true } } },
    });
    if (!existing) return sendError(res, 404, "Task not found", { code: CODES.NOT_FOUND, requestId: req.id });
    const allowed = await hasPermissionWithoutRoleBypass(userId, "task.update", existing.projectId);
    const isCreator = existing.createdById === userId;
    const isAssignee = existing.assignees.some((a) => a.id === userId);
    if (!allowed && !isCreator && !isAssignee) {
      return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });
    }
    const body = req.body || {};
    const updateData = {};
    if (body.title != null) updateData.title = String(body.title).trim();
    if (body.description != null) updateData.description = body.description;
    if (body.priority != null) updateData.priority = body.priority;
    if (body.status != null) updateData.status = body.status;
    if (body.taskStatusId != null) updateData.taskStatusId = body.taskStatusId ? parseInt(body.taskStatusId, 10) : null;
    if (body.dueDate != null) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.plannedDate !== undefined) updateData.plannedDate = body.plannedDate ? new Date(body.plannedDate) : null;
    if (body.assigneeIds && Array.isArray(body.assigneeIds)) {
      updateData.assignees = { set: body.assigneeIds.map((id) => ({ id: parseInt(id, 10) })).filter((o) => !Number.isNaN(o.id)) };
    }
    if (Object.keys(updateData).length === 0) return res.json({ success: true });
    await prisma.task.update({
      where: { id },
      data: updateData,
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("[tasksController] update:", err);
    sendError(res, 500, err.message || "Failed to update task", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function remove(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid task ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const userId = Number(req.user.id);
    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true, createdById: true, projectId: true },
    });
    if (!task) return sendError(res, 404, "Task not found", { code: CODES.NOT_FOUND, requestId: req.id });
    const allowed = await hasPermissionWithoutRoleBypass(userId, "task.delete", task.projectId);
    const isCreator = task.createdById === userId;
    if (!allowed && !isCreator) {
      return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });
    }
    await prisma.task.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) {
    console.error("[tasksController] remove:", err);
    sendError(res, 500, err.message || "Failed to delete task", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
};
