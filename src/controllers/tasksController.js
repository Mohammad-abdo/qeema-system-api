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
  taskStatusId: true,
  taskStatus: { select: { id: true, name: true, color: true, isFinal: true } },
  assignees: {
    select: { id: true, username: true, email: true, avatarUrl: true },
  },
  project: {
    select: { id: true, name: true },
  },
  creator: { select: { id: true, username: true, email: true } },
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
      mentions: { select: { userId: true, user: { select: { id: true, username: true } } } },
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
          projectId: true,
          project: { select: { id: true, name: true } },
          taskStatus: { select: { id: true, name: true, isFinal: true } },
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
    await logActivity({
      actionType: "task_created",
      actionCategory: "task",
      entityType: "task",
      entityId: task.id,
      projectId,
      performedById: userId,
      actionSummary: `Task '${task.title}' created`,
    }, req);

    if (task.assignees && task.assignees.length > 0) {
      const performer = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      const byName = performer?.username || "Someone";
      const projectName = task.project?.name ? ` in ${task.project.name}` : "";
      await notifyUsers(
        task.assignees.map((a) => ({
          userId: a.id,
          title: "You were assigned to a task",
          message: `${byName} assigned you: ${task.title}${projectName}`,
          type: "task_assigned",
          linkUrl: `/dashboard/projects/${projectId}/tasks/${task.id}`,
        }))
      );
    }

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
      select: { id: true, title: true, createdById: true, projectId: true, plannedDate: true, assignees: { select: { id: true } } },
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

    let nowCompleted = false;
    let statusName = null;
    if (updateData.status === "completed") nowCompleted = true;
    if (updateData.taskStatusId != null) {
      const ts = await prisma.taskStatus.findUnique({
        where: { id: updateData.taskStatusId },
        select: { isFinal: true, name: true },
      });
      if (ts) {
        statusName = ts.name;
        if (ts.isFinal) nowCompleted = true;
      }
    }
    if (nowCompleted) await unblockDependentsIfResolved(id);

    const updatedTask = await prisma.task.findUnique({
      where: { id },
      select: { assignees: { select: { id: true } } },
    });
    const assigneeIds = (updatedTask?.assignees ?? []).map((a) => a.id);
    const existingAssigneeIds = existing.assignees.map((a) => a.id);

    if (updateData.assignees && body.assigneeIds && Array.isArray(body.assigneeIds)) {
      const newIds = body.assigneeIds
        .map((id) => parseInt(id, 10))
        .filter((n) => !Number.isNaN(n) && !existingAssigneeIds.includes(n));
      if (newIds.length > 0) {
        const performer = await prisma.user.findUnique({
          where: { id: userId },
          select: { username: true },
        });
        const byName = performer?.username || "Someone";
        const projectName = existing.projectId ? (await prisma.project.findUnique({ where: { id: existing.projectId }, select: { name: true } }))?.name : null;
        const projectSuffix = projectName ? ` in ${projectName}` : "";
        await notifyUsers(
          newIds.map((uid) => ({
            userId: uid,
            title: "You were assigned to a task",
            message: `${byName} assigned you: ${existing.title}${projectSuffix}`,
            type: "task_assigned",
            linkUrl: `/dashboard/projects/${existing.projectId}/tasks/${id}`,
          }))
        );
      }
    }

    if ((updateData.taskStatusId != null || updateData.status != null) && assigneeIds.length > 0) {
      const name = statusName || updateData.status || "updated";
      const toNotify = assigneeIds.filter((aid) => aid !== userId);
      if (toNotify.length > 0) {
        await notifyUsers(
          toNotify.map((uid) => ({
            userId: uid,
            title: "Task status updated",
            message: `${existing.title} is now ${name}`,
            type: "task_status_changed",
            linkUrl: `/dashboard/projects/${existing.projectId}/tasks/${id}`,
          }))
        );
      }
    }

    if (updateData.plannedDate !== undefined && assigneeIds.length > 0) {
      const toNotify = assigneeIds.filter((aid) => aid !== userId);
      if (toNotify.length > 0) {
        const newDate = updateData.plannedDate;
        const titleMsg = newDate == null
          ? "Task removed from your schedule"
          : "Task scheduled";
        const msg = newDate == null
          ? `${existing.title}`
          : `${existing.title} — ${new Date(newDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}`;
        await notifyUsers(
          toNotify.map((uid) => ({
            userId: uid,
            title: titleMsg,
            message: msg,
            type: "focus_changed",
            linkUrl: `/dashboard/projects/${existing.projectId}/tasks/${id}`,
          }))
        );
      }
    }

    await logActivity({
      actionType: "task_updated",
      actionCategory: "task",
      entityType: "task",
      entityId: id,
      projectId: existing.projectId,
      performedById: userId,
      actionSummary: `Task '${existing.title}' updated`,
    }, req);
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
      select: { id: true, title: true, createdById: true, projectId: true },
    });
    if (!task) return sendError(res, 404, "Task not found", { code: CODES.NOT_FOUND, requestId: req.id });
    const allowed = await hasPermissionWithoutRoleBypass(userId, "task.delete", task.projectId);
    const isCreator = task.createdById === userId;
    if (!allowed && !isCreator) {
      return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });
    }
    await logActivity({
      actionType: "task_deleted",
      actionCategory: "task",
      entityType: "task",
      entityId: id,
      projectId: task.projectId,
      performedById: userId,
      actionSummary: `Task '${task.title}' deleted`,
    }, req);
    await prisma.task.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) {
    console.error("[tasksController] remove:", err);
    sendError(res, 500, err.message || "Failed to delete task", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function ensureCanUpdateTask(userId, taskId) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, title: true, projectId: true, createdById: true, assignees: { select: { id: true } } },
  });
  if (!task) return { error: "Task not found", status: 404 };
  const allowed = await hasPermissionWithoutRoleBypass(userId, "task.update", task.projectId);
  const isCreator = task.createdById === userId;
  const isAssignee = task.assignees.some((a) => a.id === userId);
  if (!allowed && !isCreator && !isAssignee) return { error: "Permission denied", status: 403 };
  return { task };
}

async function getBlockingTaskStatusId() {
  const s = await prisma.taskStatus.findFirst({
    where: { isBlocking: true, isActive: true },
    select: { id: true },
  });
  return s?.id ?? null;
}

async function setTaskBlockedStatus(taskId) {
  const blockingId = await getBlockingTaskStatusId();
  await prisma.task.update({
    where: { id: taskId },
    data: blockingId
      ? { taskStatusId: blockingId, status: "waiting" }
      : { taskStatusId: null, status: "waiting" },
  });
}

async function setTaskUnblockedStatus(taskId) {
  await prisma.task.update({
    where: { id: taskId },
    data: { taskStatusId: null, status: "pending" },
  });
}

async function hasUnresolvedDependencies(taskId) {
  const deps = await prisma.taskDependency.findMany({
    where: { taskId },
    select: {
      dependsOnTask: {
        select: {
          status: true,
          taskStatus: { select: { isFinal: true } },
        },
      },
    },
  });
  return deps.some(
    (d) =>
      d.dependsOnTask?.taskStatus?.isFinal !== true &&
      d.dependsOnTask?.status !== "completed"
  );
}

async function unblockDependentsIfResolved(dependsOnTaskId) {
  const dependents = await prisma.taskDependency.findMany({
    where: { dependsOnTaskId },
    select: { taskId: true },
  });
  for (const { taskId } of dependents) {
    const stillBlocked = await hasUnresolvedDependencies(taskId);
    if (!stillBlocked) await setTaskUnblockedStatus(taskId);
  }
}

async function addDependency(req, res) {
  try {
    const taskId = parseInt(req.params.id, 10);
    const dependsOnTaskId = req.body?.dependsOnTaskId != null ? parseInt(req.body.dependsOnTaskId, 10) : NaN;
    if (Number.isNaN(taskId) || Number.isNaN(dependsOnTaskId)) {
      return sendError(res, 400, "taskId and dependsOnTaskId required", { code: CODES.BAD_REQUEST, requestId: req.id });
    }
    const userId = Number(req.user.id);

    const access = await ensureCanUpdateTask(userId, taskId);
    if (access.error) return sendError(res, access.status, access.error, { code: access.status === 404 ? CODES.NOT_FOUND : CODES.FORBIDDEN, requestId: req.id });

    if (taskId === dependsOnTaskId) {
      return sendError(res, 400, "A task cannot depend on itself", { code: CODES.BAD_REQUEST, requestId: req.id });
    }

    const dependsOnTask = await prisma.task.findUnique({
      where: { id: dependsOnTaskId },
      select: { id: true, projectId: true, createdById: true, assignees: { select: { id: true } } },
    });
    if (!dependsOnTask) return sendError(res, 404, "Dependency task not found", { code: CODES.NOT_FOUND, requestId: req.id });
    if (req.user.role !== "admin") {
      const isDepAssignee = dependsOnTask.assignees.some((a) => a.id === userId);
      const isDepCreator = dependsOnTask.createdById === userId;
      if (!isDepAssignee && !isDepCreator) {
        return sendError(res, 403, "You can only add tasks you have access to as dependencies", { code: CODES.FORBIDDEN, requestId: req.id });
      }
    }

    const existing = await prisma.taskDependency.findUnique({
      where: { taskId_dependsOnTaskId: { taskId, dependsOnTaskId } },
    });
    if (existing) return sendError(res, 400, "This dependency already exists", { code: CODES.BAD_REQUEST, requestId: req.id });

    const wouldCreateCycle = await prisma.taskDependency.findUnique({
      where: { taskId_dependsOnTaskId: { taskId: dependsOnTaskId, dependsOnTaskId: taskId } },
    });
    if (wouldCreateCycle) {
      return sendError(res, 400, "Adding this dependency would create a cycle", { code: CODES.BAD_REQUEST, requestId: req.id });
    }

    await prisma.taskDependency.create({
      data: {
        taskId,
        dependsOnTaskId,
        createdById: userId,
      },
    });

    const depTask = await prisma.task.findUnique({
      where: { id: dependsOnTaskId },
      select: {
        status: true,
        taskStatus: { select: { isFinal: true } },
      },
    });
    const depCompleted =
      depTask?.taskStatus?.isFinal === true || depTask?.status === "completed";
    if (!depCompleted) await setTaskBlockedStatus(taskId);

    await logActivity({
      actionType: "dependency_added",
      actionCategory: "task",
      entityType: "task",
      entityId: taskId,
      projectId: access.task.projectId,
      performedById: userId,
      actionSummary: `Dependency added to task #${taskId} (depends on #${dependsOnTaskId})`,
    }, req);
    return res.status(201).json({ success: true });
  } catch (err) {
    console.error("[tasksController] addDependency:", err);
    sendError(res, 500, err.message || "Failed to add dependency", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function removeDependency(req, res) {
  try {
    const taskId = parseInt(req.params.id, 10);
    const dependsOnTaskId = parseInt(req.params.dependsOnTaskId, 10);
    if (Number.isNaN(taskId) || Number.isNaN(dependsOnTaskId)) {
      return sendError(res, 400, "Invalid task or dependency task ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    }
    const userId = Number(req.user.id);

    const access = await ensureCanUpdateTask(userId, taskId);
    if (access.error) return sendError(res, access.status, access.error, { code: access.status === 404 ? CODES.NOT_FOUND : CODES.FORBIDDEN, requestId: req.id });

    await prisma.taskDependency.deleteMany({
      where: { taskId, dependsOnTaskId },
    });

    const stillBlocked = await hasUnresolvedDependencies(taskId);
    if (!stillBlocked) await setTaskUnblockedStatus(taskId);

    await logActivity({
      actionType: "dependency_removed",
      actionCategory: "task",
      entityType: "task",
      entityId: taskId,
      projectId: access.task.projectId,
      performedById: userId,
      actionSummary: `Dependency removed from task #${taskId} (was depending on #${dependsOnTaskId})`,
    }, req);
    return res.json({ success: true });
  } catch (err) {
    console.error("[tasksController] removeDependency:", err);
    sendError(res, 500, err.message || "Failed to remove dependency", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function getDependencyCandidates(req, res) {
  try {
    const taskId = parseInt(req.params.id, 10);
    if (Number.isNaN(taskId)) return sendError(res, 400, "Invalid task ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const userId = Number(req.user.id);
    const search = (req.query.search && String(req.query.search).trim()) || "";
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const access = await ensureCanUpdateTask(userId, taskId);
    if (access.error) return sendError(res, access.status, access.error, { code: access.status === 404 ? CODES.NOT_FOUND : CODES.FORBIDDEN, requestId: req.id });

    const currentDeps = await prisma.taskDependency.findMany({
      where: { taskId },
      select: { dependsOnTaskId: true },
    });
    const excludeIds = [taskId, ...currentDeps.map((d) => d.dependsOnTaskId)];

    const cycleCandidates = await prisma.taskDependency.findMany({
      where: { dependsOnTaskId: taskId },
      select: { taskId: true },
    });
    excludeIds.push(...cycleCandidates.map((c) => c.taskId));

    const where = { id: { notIn: excludeIds } };
    const andParts = [];
    if (search) {
      andParts.push({
        OR: [
          { title: { contains: search } },
          { project: { name: { contains: search } } },
        ],
      });
    }
    if (req.user.role !== "admin") {
      andParts.push({
        OR: [
          { assignees: { some: { id: userId } } },
          { createdById: userId },
        ],
      });
    }
    if (andParts.length) where.AND = andParts;

    const tasks = await prisma.task.findMany({
      where,
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        projectId: true,
        project: { select: { id: true, name: true } },
        taskStatus: { select: { id: true, name: true, isFinal: true } },
      },
    });
    return res.json({ success: true, tasks });
  } catch (err) {
    console.error("[tasksController] getDependencyCandidates:", err);
    sendError(res, 500, err.message || "Failed to fetch dependency candidates", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function createSubtask(req, res) {
  try {
    const taskId = parseInt(req.params.id, 10);
    if (Number.isNaN(taskId)) return sendError(res, 400, "Invalid task ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const userId = Number(req.user.id);
    const title = req.body?.title != null ? String(req.body.title).trim() : "";
    if (!title) return sendError(res, 400, "title is required", { code: CODES.BAD_REQUEST, requestId: req.id });

    const access = await ensureCanUpdateTask(userId, taskId);
    if (access.error) return sendError(res, access.status, access.error, { code: access.status === 404 ? CODES.NOT_FOUND : CODES.FORBIDDEN, requestId: req.id });

    const subtask = await prisma.subtask.create({
      data: {
        parentTaskId: taskId,
        title,
        createdById: userId,
      },
    });
    await logActivity({
      actionType: "subtask_created",
      actionCategory: "task",
      entityType: "task",
      entityId: taskId,
      projectId: access.task.projectId,
      performedById: userId,
      actionSummary: `Subtask '${title}' added to task #${taskId}`,
    }, req);
    return res.status(201).json({ success: true, subtask });
  } catch (err) {
    console.error("[tasksController] createSubtask:", err);
    sendError(res, 500, err.message || "Failed to create subtask", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function updateSubtask(req, res) {
  try {
    const taskId = parseInt(req.params.id, 10);
    const subtaskId = parseInt(req.params.subtaskId, 10);
    if (Number.isNaN(taskId) || Number.isNaN(subtaskId)) {
      return sendError(res, 400, "Invalid task or subtask ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    }
    const userId = Number(req.user.id);
    const body = req.body || {};

    const access = await ensureCanUpdateTask(userId, taskId);
    if (access.error) return sendError(res, access.status, access.error, { code: access.status === 404 ? CODES.NOT_FOUND : CODES.FORBIDDEN, requestId: req.id });

    const existing = await prisma.subtask.findFirst({
      where: { id: subtaskId, parentTaskId: taskId },
    });
    if (!existing) return sendError(res, 404, "Subtask not found", { code: CODES.NOT_FOUND, requestId: req.id });

    const updateData = {};
    if (body.status != null) updateData.status = String(body.status);
    if (body.title != null) updateData.title = String(body.title).trim();
    if (Object.keys(updateData).length === 0) return res.json({ success: true });

    await prisma.subtask.update({
      where: { id: subtaskId },
      data: updateData,
    });
    await logActivity({
      actionType: "subtask_updated",
      actionCategory: "task",
      entityType: "task",
      entityId: taskId,
      projectId: access.task.projectId,
      performedById: userId,
      actionSummary: `Subtask #${subtaskId} updated on task #${taskId}`,
    }, req);
    return res.json({ success: true });
  } catch (err) {
    console.error("[tasksController] updateSubtask:", err);
    sendError(res, 500, err.message || "Failed to update subtask", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function removeSubtask(req, res) {
  try {
    const taskId = parseInt(req.params.id, 10);
    const subtaskId = parseInt(req.params.subtaskId, 10);
    if (Number.isNaN(taskId) || Number.isNaN(subtaskId)) {
      return sendError(res, 400, "Invalid task or subtask ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    }
    const userId = Number(req.user.id);

    const access = await ensureCanUpdateTask(userId, taskId);
    if (access.error) return sendError(res, access.status, access.error, { code: access.status === 404 ? CODES.NOT_FOUND : CODES.FORBIDDEN, requestId: req.id });

    const existing = await prisma.subtask.findFirst({
      where: { id: subtaskId, parentTaskId: taskId },
    });
    if (!existing) return sendError(res, 404, "Subtask not found", { code: CODES.NOT_FOUND, requestId: req.id });

    await logActivity({
      actionType: "subtask_removed",
      actionCategory: "task",
      entityType: "task",
      entityId: taskId,
      projectId: access.task.projectId,
      performedById: userId,
      actionSummary: `Subtask '${existing.title}' removed from task #${taskId}`,
    }, req);
    await prisma.subtask.delete({ where: { id: subtaskId } });
    return res.json({ success: true });
  } catch (err) {
    console.error("[tasksController] removeSubtask:", err);
    sendError(res, 500, err.message || "Failed to remove subtask", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

function extractMentionUsernames(content) {
  if (!content || typeof content !== "string") return [];
  const mentionRegex = /@(\w+)/g;
  const matches = content.match(mentionRegex);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.substring(1)))];
}

async function createComment(req, res) {
  try {
    const taskId = parseInt(req.params.id, 10);
    if (Number.isNaN(taskId)) return sendError(res, 400, "Invalid task ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const userId = Number(req.user.id);
    const content = req.body?.content != null ? String(req.body.content).trim() : "";
    if (!content) return sendError(res, 400, "content is required", { code: CODES.BAD_REQUEST, requestId: req.id });

    const access = await ensureCanUpdateTask(userId, taskId);
    if (access.error) return sendError(res, access.status, access.error, { code: access.status === 404 ? CODES.NOT_FOUND : CODES.FORBIDDEN, requestId: req.id });

    const usernames = extractMentionUsernames(content);
    const mentionedUsers = usernames.length
      ? await prisma.user.findMany({
          where: { username: { in: usernames } },
          select: { id: true },
        })
      : [];

    const comment = await prisma.$transaction(async (tx) => {
      const c = await tx.comment.create({
        data: { taskId, content, userId },
      });
      if (mentionedUsers.length > 0) {
        await tx.commentMention.createMany({
          data: mentionedUsers.map((u) => ({ commentId: c.id, userId: u.id })),
          skipDuplicates: true,
        });
      }
      return tx.comment.findUnique({
        where: { id: c.id },
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: { select: { id: true, username: true, email: true, avatarUrl: true } },
          mentions: { select: { userId: true, user: { select: { id: true, username: true } } } },
        },
      });
    });

    await logActivity({
      actionType: "comment_created",
      actionCategory: "task",
      entityType: "task",
      entityId: taskId,
      projectId: access.task.projectId,
      performedById: userId,
      actionSummary: `Comment added to task #${taskId}`,
    }, req);

    const authorName = comment.author?.username || comment.author?.email || "Someone";
    const taskTitle = access.task?.title || `Task #${taskId}`;
    const mentionedIds = mentionedUsers.map((u) => u.id).filter((id) => id !== userId);
    if (mentionedIds.length > 0) {
      const taskProjectId = access.task?.projectId;
      const linkUrl = taskProjectId ? `/dashboard/projects/${taskProjectId}/tasks/${taskId}` : null;
      await prisma.notification.createMany({
        data: mentionedIds.map((mentionedUserId) => ({
          userId: mentionedUserId,
          title: "You were mentioned in a comment",
          message: `${authorName} mentioned you in task: ${taskTitle}`,
          type: "comment_mention",
          linkUrl,
        })),
      });
    }

    return res.status(201).json(comment);
  } catch (err) {
    console.error("[tasksController] createComment:", err);
    sendError(res, 500, err.message || "Failed to create comment", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function deleteComment(req, res) {
  try {
    const taskId = parseInt(req.params.id, 10);
    const commentId = parseInt(req.params.commentId, 10);
    if (Number.isNaN(taskId) || Number.isNaN(commentId)) {
      return sendError(res, 400, "Invalid task or comment ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    }
    const userId = Number(req.user.id);

    const access = await ensureCanUpdateTask(userId, taskId);
    if (access.error) return sendError(res, access.status, access.error, { code: access.status === 404 ? CODES.NOT_FOUND : CODES.FORBIDDEN, requestId: req.id });

    const comment = await prisma.comment.findFirst({
      where: { id: commentId, taskId },
      select: { id: true, userId: true },
    });
    if (!comment) return sendError(res, 404, "Comment not found", { code: CODES.NOT_FOUND, requestId: req.id });

    const isAuthor = comment.userId === userId;
    const isAdmin = req.user.role === "admin";
    if (!isAuthor && !isAdmin) {
      return sendError(res, 403, "Only the comment author or admin can delete this comment", { code: CODES.FORBIDDEN, requestId: req.id });
    }

    await logActivity({
      actionType: "comment_deleted",
      actionCategory: "task",
      entityType: "task",
      entityId: taskId,
      projectId: access.task.projectId,
      performedById: userId,
      actionSummary: `Comment #${commentId} deleted on task #${taskId}`,
    }, req);
    await prisma.comment.delete({ where: { id: commentId } });
    return res.json({ success: true });
  } catch (err) {
    console.error("[tasksController] deleteComment:", err);
    sendError(res, 500, err.message || "Failed to delete comment", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
  addDependency,
  removeDependency,
  getDependencyCandidates,
  createSubtask,
  updateSubtask,
  removeSubtask,
  createComment,
  deleteComment,
};
