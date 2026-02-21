"use strict";

const { prisma } = require("../lib/prisma");
const { hasPermissionWithoutRoleBypass } = require("../lib/rbac");
const { sendError, sendSuccess, CODES } = require("../lib/errorResponse");
const { logActivity } = require("../lib/activityLogger");
const { notifyUsers } = require("../lib/notifyUsers");
const { startOfDay, endOfDay } = require("date-fns");

async function canAccessAssignment(userId) {
  if (!userId) return false;
  const role = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { role: true },
  }).then((u) => u?.role);
  if (role === "admin" || role === "team_lead") return true;
  return hasPermissionWithoutRoleBypass(Number(userId), "task.assign");
}

async function getUsers(req, res) {
  try {
    const userId = Number(req.user?.id);
    if (!userId) return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED });
    const allowed = await canAccessAssignment(userId);
    if (!allowed) return sendError(res, 403, "Only admins and team leads can access", { code: CODES.FORBIDDEN });

    const users = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        team: { select: { id: true, name: true } },
        assignedTasks: { select: { projectId: true } },
      },
      orderBy: { username: "asc" },
    });

    const list = users.map((u) => {
      const projectIds = new Set((u.assignedTasks || []).map((t) => t.projectId));
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        avatarUrl: u.avatarUrl,
        team: u.team,
        activeProjectsCount: projectIds.size,
      };
    });

    return res.json({ success: true, users: list });
  } catch (err) {
    console.error("[assignmentController] getUsers:", err);
    sendError(res, 500, err.message || "Failed to fetch users", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function getTaskCounts(req, res) {
  try {
    const userId = Number(req.user?.id);
    if (!userId) return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED });
    const allowed = await canAccessAssignment(userId);
    if (!allowed) return sendError(res, 403, "Forbidden", { code: CODES.FORBIDDEN });

    const dateStr = req.query.date;
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const dateStart = startOfDay(targetDate);
    const dateEnd = endOfDay(targetDate);

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        assignedTasks: {
          select: { id: true, projectId: true, plannedDate: true, status: true },
        },
      },
    });

    const counts = {};
    users.forEach((user) => {
      const todayTasks = user.assignedTasks.filter((t) => {
        if (!t.plannedDate) return false;
        const d = new Date(t.plannedDate);
        return d >= dateStart && d <= dateEnd && t.status !== "completed";
      });
      const totalTasks = user.assignedTasks.filter((t) => t.status !== "completed");
      counts[user.id] = { today: todayTasks.length, total: totalTasks.length };
    });

    return res.json({ success: true, counts });
  } catch (err) {
    console.error("[assignmentController] getTaskCounts:", err);
    sendError(res, 500, err.message || "Failed to fetch counts", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function getProjectsWithTasks(req, res) {
  try {
    const userId = Number(req.user?.id);
    if (!userId) return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED });
    const allowed = await canAccessAssignment(userId);
    if (!allowed) return sendError(res, 403, "Forbidden", { code: CODES.FORBIDDEN });

    const dateStr = req.query.date;
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const dateStart = startOfDay(targetDate);
    const dateEnd = endOfDay(targetDate);

    const projects = await prisma.project.findMany({
      where: {
        tasks: {
          some: {
            assignees: { some: { id: { not: undefined } } },
            status: { not: "completed" },
          },
        },
      },
      include: {
        tasks: {
          where: {
            assignees: { some: { id: { not: undefined } } },
            status: { not: "completed" },
          },
          include: {
            assignees: { select: { id: true, username: true, email: true } },
            dependencies: {
              include: {
                dependsOnTask: { select: { id: true, title: true, status: true } },
              },
            },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    });

    const result = projects.map((project) => {
      const todayTasks = project.tasks.filter((t) => {
        if (!t.plannedDate) return false;
        const d = new Date(t.plannedDate);
        return d >= dateStart && d <= dateEnd;
      });
      const allTasks = project.tasks.map((t) => {
        const blocking = (t.dependencies || []).filter((d) => d.dependsOnTask?.status !== "completed");
        return {
          ...t,
          isBlocked: blocking.length > 0,
          blockingDependencies: blocking.map((d) => ({
            id: d.dependsOnTask.id,
            title: d.dependsOnTask.title,
            status: d.dependsOnTask.status,
          })),
        };
      });
      return {
        id: project.id,
        name: project.name,
        status: project.status,
        todayTasks: todayTasks.map((t) => {
          const full = allTasks.find((a) => a.id === t.id);
          return {
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            assignees: t.assignees,
            isBlocked: full?.isBlocked || false,
            blockingDependencies: full?.blockingDependencies || [],
          };
        }),
        allTasks,
      };
    });

    return res.json({ success: true, projects: result });
  } catch (err) {
    console.error("[assignmentController] getProjectsWithTasks:", err);
    sendError(res, 500, err.message || "Failed to fetch projects", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function getUserProjects(req, res) {
  try {
    const currentUserId = Number(req.user?.id);
    if (!currentUserId) return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED });
    const allowed = await canAccessAssignment(currentUserId);
    if (!allowed) return sendError(res, 403, "Forbidden", { code: CODES.FORBIDDEN });

    const targetUserId = parseInt(req.params.userId, 10);
    if (Number.isNaN(targetUserId)) return sendError(res, 400, "Invalid user ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const projects = await prisma.project.findMany({
      where: {
        tasks: {
          some: { assignees: { some: { id: targetUserId } } },
        },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return res.json({ success: true, projects });
  } catch (err) {
    console.error("[assignmentController] getUserProjects:", err);
    sendError(res, 500, err.message || "Failed to fetch projects", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function getUserProjectTasks(req, res) {
  try {
    const currentUserId = Number(req.user?.id);
    if (!currentUserId) return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED });
    const allowed = await canAccessAssignment(currentUserId);
    if (!allowed) return sendError(res, 403, "Forbidden", { code: CODES.FORBIDDEN });

    const targetUserId = parseInt(req.params.userId, 10);
    const projectId = parseInt(req.params.projectId, 10);
    if (Number.isNaN(targetUserId) || Number.isNaN(projectId)) {
      return sendError(res, 400, "Invalid user or project ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    }

    const dateStr = req.query.date;
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const dateStart = startOfDay(targetDate);
    const dateEnd = endOfDay(targetDate);

    const tasks = await prisma.task.findMany({
      where: {
        projectId,
        assignees: { some: { id: targetUserId } },
        status: { not: "completed" },
      },
      include: {
        project: { select: { id: true, name: true } },
        dependencies: {
          include: {
            dependsOnTask: { select: { id: true, title: true, status: true } },
          },
        },
        assignees: { select: { id: true, username: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const withBlocking = tasks.map((t) => {
      const blocking = (t.dependencies || []).filter((d) => d.dependsOnTask?.status !== "completed");
      return {
        ...t,
        isBlocked: blocking.length > 0,
        blockingDependencies: blocking.map((d) => ({
          id: d.dependsOnTask.id,
          title: d.dependsOnTask.title,
          status: d.dependsOnTask.status,
        })),
      };
    });

    const availableTasks = withBlocking.filter((t) => {
      if (!t.plannedDate) return true;
      const d = new Date(t.plannedDate);
      return !(d >= dateStart && d <= dateEnd);
    });
    const todayTasks = withBlocking.filter((t) => {
      if (!t.plannedDate) return false;
      const d = new Date(t.plannedDate);
      return d >= dateStart && d <= dateEnd;
    });

    return res.json({
      success: true,
      availableTasks,
      todayTasks,
    });
  } catch (err) {
    console.error("[assignmentController] getUserProjectTasks:", err);
    sendError(res, 500, err.message || "Failed to fetch tasks", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function assignToday(req, res) {
  try {
    const currentUserId = Number(req.user?.id);
    if (!currentUserId) return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED });
    const allowed = await canAccessAssignment(currentUserId);
    if (!allowed) return sendError(res, 403, "Forbidden", { code: CODES.FORBIDDEN });

    const { userId, taskId, date } = req.body || {};
    const targetUserId = userId != null ? parseInt(userId, 10) : NaN;
    const tid = taskId != null ? parseInt(taskId, 10) : NaN;
    if (Number.isNaN(targetUserId) || Number.isNaN(tid)) {
      return sendError(res, 400, "userId and taskId required", { code: CODES.BAD_REQUEST, requestId: req.id });
    }

    const task = await prisma.task.findFirst({
      where: { id: tid, assignees: { some: { id: targetUserId } } },
      include: { project: { select: { name: true } } },
    });
    if (!task) {
      return sendError(res, 404, "Task not found or not assigned to this user", { code: CODES.NOT_FOUND, requestId: req.id });
    }

    const targetDate = date ? new Date(date) : new Date();
    await prisma.task.update({
      where: { id: tid },
      data: { plannedDate: targetDate },
    });

    if (targetUserId !== currentUserId) {
      const dateStr = targetDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      const projectName = task.project?.name ?? "Project";
      const projectId = task.projectId ?? 0;
      await prisma.notification.create({
        data: {
          userId: targetUserId,
          title: `Task assigned: ${task.title}`,
          message: `Scheduled for ${dateStr} in ${projectName}.`,
          type: "task_assigned",
          linkUrl: projectId ? `/dashboard/projects/${projectId}/tasks/${tid}` : null,
        },
      });
    }

    await logActivity({
      actionType: "task_assigned_today",
      actionCategory: "today_task",
      entityType: "task",
      entityId: tid,
      projectId: task.projectId ?? null,
      performedById: currentUserId,
      affectedUserId: targetUserId,
      actionSummary: `Task '${task.title}' assigned to today for user #${targetUserId}`,
    }, req);
    return res.json({ success: true });
  } catch (err) {
    console.error("[assignmentController] assignToday:", err);
    sendError(res, 500, err.message || "Failed to assign", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function removeToday(req, res) {
  try {
    const currentUserId = Number(req.user?.id);
    if (!currentUserId) return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED });
    const allowed = await canAccessAssignment(currentUserId);
    if (!allowed) return sendError(res, 403, "Forbidden", { code: CODES.FORBIDDEN });

    const { userId, taskId } = req.body || {};
    const targetUserId = userId != null ? parseInt(userId, 10) : NaN;
    const tid = taskId != null ? parseInt(taskId, 10) : NaN;
    if (Number.isNaN(targetUserId) || Number.isNaN(tid)) {
      return sendError(res, 400, "userId and taskId required", { code: CODES.BAD_REQUEST, requestId: req.id });
    }

    const task = await prisma.task.findFirst({
      where: { id: tid, assignees: { some: { id: targetUserId } } },
      select: { id: true, title: true, projectId: true },
    });
    if (!task) {
      return sendError(res, 404, "Task not found or not assigned to this user", { code: CODES.NOT_FOUND, requestId: req.id });
    }

    await prisma.task.update({
      where: { id: tid },
      data: { plannedDate: null },
    });

    const taskLink = task.projectId ? `/dashboard/projects/${task.projectId}/tasks/${tid}` : null;
    await notifyUsers([
      {
        userId: targetUserId,
        title: "Task removed from your today's focus",
        message: task.title,
        type: "focus_changed",
        linkUrl: taskLink,
      },
    ]);

    await logActivity({
      actionType: "task_removed_today",
      actionCategory: "today_task",
      entityType: "task",
      entityId: tid,
      projectId: task.projectId ?? null,
      performedById: currentUserId,
      affectedUserId: targetUserId,
      actionSummary: `Task '${task.title}' removed from today for user #${targetUserId}`,
    }, req);
    return res.json({ success: true });
  } catch (err) {
    console.error("[assignmentController] removeToday:", err);
    sendError(res, 500, err.message || "Failed to remove", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

module.exports = {
  getUsers,
  getTaskCounts,
  getProjectsWithTasks,
  getUserProjects,
  getUserProjectTasks,
  assignToday,
  removeToday,
};
