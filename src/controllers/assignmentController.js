"use strict";

const { prisma } = require("../lib/prisma");
const { hasPermissionWithoutRoleBypass } = require("../lib/rbac");
const { sendError, sendSuccess, CODES } = require("../lib/errorResponse");
const { logActivity } = require("../lib/activityLogger");
const { notifyUsers } = require("../lib/notifyUsers");
const {
  getCairoDateString,
  getCairoDayRangeUtc,
  parseAssignmentDate,
} = require("../lib/cairoDateUtils");

function getAssignmentDayRange(dateStr) {
  const cairoDate = parseAssignmentDate(dateStr);
  return getCairoDayRangeUtc(cairoDate);
}

const USER_TASK_INCLUDE = {
  taskStatus: { select: { id: true, name: true, isFinal: true, isBlocking: true } },
  project: { select: { id: true, name: true } },
  dependencies: {
    include: {
      dependsOnTask: {
        select: {
          id: true,
          title: true,
          taskStatus: { select: { id: true, name: true, isFinal: true } },
        },
      },
    },
  },
  assignees: { where: { isActive: true }, select: { id: true, username: true } },
};

function enrichTasksWithBlocking(tasks) {
  return tasks.map((t) => {
    const blocking = (t.dependencies || []).filter(
      (d) => d.dependsOnTask?.taskStatus?.isFinal !== true
    );
    return {
      ...t,
      isBlocked: blocking.length > 0,
      blockingDependencies: blocking.map((d) => ({
        id: d.dependsOnTask.id,
        title: d.dependsOnTask.title,
        status: d.dependsOnTask.taskStatus?.name ?? null,
      })),
    };
  });
}

function splitTasksByPlannedDate(tasks, dateStart, dateEnd) {
  const availableTasks = tasks.filter((t) => {
    if (!t.plannedDate) return true;
    const d = new Date(t.plannedDate);
    return !(d >= dateStart && d <= dateEnd);
  });
  const todayTasks = tasks.filter((t) => {
    if (!t.plannedDate) return false;
    const d = new Date(t.plannedDate);
    return d >= dateStart && d <= dateEnd;
  });
  return { availableTasks, todayTasks };
}

async function fetchUserOpenTasks(targetUserId, projectId = null) {
  const where = {
    assignees: { some: { id: targetUserId } },
    OR: [{ taskStatus: { isFinal: false } }, { taskStatusId: null }],
  };
  if (projectId != null) where.projectId = projectId;
  return prisma.task.findMany({
    where,
    include: USER_TASK_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });
}

function projectsFromTasks(tasks) {
  const map = new Map();
  tasks.forEach((t) => {
    if (t.project?.id) map.set(t.project.id, { id: t.project.id, name: t.project.name });
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function canAccessAssignment(userId) {
  if (!userId) return false;
  const hasPermission = await hasPermissionWithoutRoleBypass(Number(userId), "today_task.assign");
  if (hasPermission) return true;
  const role = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { role: true },
  }).then((u) => u?.role);
  return role === "admin" || role === "team_lead";
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
    const { start: dateStart, end: dateEnd } = getAssignmentDayRange(dateStr);
    const { start: cairoTodayStart } = getCairoDayRangeUtc(getCairoDateString());

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        assignedTasks: {
          select: {
            id: true,
            projectId: true,
            plannedDate: true,
            dueDate: true,
            priority: true,
            taskStatusId: true,
            completedAt: true,
            taskStatus: { select: { isFinal: true, isBlocking: true, name: true } },
          },
        },
      },
    });

    const isOpenTask = (t) => !t.taskStatus?.isFinal && !t.completedAt;
    const isBlockedTask = (t) => {
      if (!isOpenTask(t)) return false;
      const statusName = (t.taskStatus?.name || "").toLowerCase();
      return (
        t.taskStatus?.isBlocking === true ||
        statusName.includes("block") ||
        statusName.includes("wait")
      );
    };
    const isInProgressTask = (t) => {
      if (!isOpenTask(t) || isBlockedTask(t)) return false;
      const statusName = (t.taskStatus?.name || "").toLowerCase();
      return (
        statusName.includes("progress") ||
        statusName.includes("review") ||
        statusName.includes("active") ||
        statusName.includes("working")
      );
    };
    const isOverdueTask = (t) =>
      isOpenTask(t) && t.dueDate != null && new Date(t.dueDate) < cairoTodayStart;
    const isUrgentHighTask = (t) =>
      isOpenTask(t) && ["urgent", "high"].includes(String(t.priority || "").toLowerCase());

    const counts = {};
    users.forEach((user) => {
      const openTasks = user.assignedTasks.filter(isOpenTask);
      const todayTasks = openTasks.filter((t) => {
        if (!t.plannedDate) return false;
        const d = new Date(t.plannedDate);
        return d >= dateStart && d <= dateEnd;
      });
      counts[user.id] = {
        today: todayTasks.length,
        total: openTasks.length,
        overdue: openTasks.filter(isOverdueTask).length,
        blocked: openTasks.filter(isBlockedTask).length,
        urgentHigh: openTasks.filter(isUrgentHighTask).length,
        inProgress: openTasks.filter(isInProgressTask).length,
      };
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
    const { start: dateStart, end: dateEnd } = getAssignmentDayRange(dateStr);

    const projects = await prisma.project.findMany({
      where: {
        tasks: {
          some: {
            assignees: { some: { id: { not: undefined } } },
            OR: [{ taskStatus: { isFinal: false } }, { taskStatusId: null }],
          },
        },
      },
      include: {
        projectStatus: { select: { id: true, name: true } },
        tasks: {
          where: {
            assignees: { some: { id: { not: undefined } } },
            OR: [{ taskStatus: { isFinal: false } }, { taskStatusId: null }],
          },
          include: {
            taskStatus: { select: { id: true, name: true, isFinal: true, isBlocking: true } },
            assignees: { where: { isActive: true }, select: { id: true, username: true, email: true } },
            dependencies: {
              include: {
                dependsOnTask: {
                  select: {
                    id: true,
                    title: true,
                    taskStatus: { select: { id: true, name: true, isFinal: true } },
                  },
                },
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
        const blocking = (t.dependencies || []).filter(
          (d) => d.dependsOnTask?.taskStatus?.isFinal !== true
        );
        return {
          ...t,
          isBlocked: blocking.length > 0,
          blockingDependencies: blocking.map((d) => ({
            id: d.dependsOnTask.id,
            title: d.dependsOnTask.title,
            status: d.dependsOnTask.taskStatus?.name ?? null,
          })),
        };
      });
      return {
        id: project.id,
        name: project.name,
        status: project.projectStatus?.name ?? null,
        todayTasks: todayTasks.map((t) => {
          const full = allTasks.find((a) => a.id === t.id);
          return {
            id: t.id,
            title: t.title,
            status: t.taskStatus?.name ?? null,
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

async function getUserTasks(req, res) {
  try {
    const currentUserId = Number(req.user?.id);
    if (!currentUserId) return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED });
    const allowed = await canAccessAssignment(currentUserId);
    if (!allowed) return sendError(res, 403, "Forbidden", { code: CODES.FORBIDDEN });

    const targetUserId = parseInt(req.params.userId, 10);
    if (Number.isNaN(targetUserId)) {
      return sendError(res, 400, "Invalid user ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    }

    const dateStr = req.query.date;
    const { start: dateStart, end: dateEnd } = getAssignmentDayRange(dateStr);

    const tasks = await fetchUserOpenTasks(targetUserId);
    const withBlocking = enrichTasksWithBlocking(tasks);
    const { availableTasks, todayTasks } = splitTasksByPlannedDate(withBlocking, dateStart, dateEnd);

    return res.json({
      success: true,
      projects: projectsFromTasks(withBlocking),
      todayTasks,
      availableTasks,
    });
  } catch (err) {
    console.error("[assignmentController] getUserTasks:", err);
    sendError(res, 500, err.message || "Failed to fetch tasks", { code: CODES.INTERNAL_ERROR, requestId: req.id });
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
    const { start: dateStart, end: dateEnd } = getAssignmentDayRange(dateStr);

    const tasks = await fetchUserOpenTasks(targetUserId, projectId);
    const withBlocking = enrichTasksWithBlocking(tasks);
    const { availableTasks, todayTasks } = splitTasksByPlannedDate(withBlocking, dateStart, dateEnd);

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

    const { start: targetDate } = getCairoDayRangeUtc(parseAssignmentDate(date));
    await prisma.task.update({
      where: { id: tid },
      data: { plannedDate: targetDate },
    });

    if (targetUserId !== currentUserId) {
      const dateStr = parseAssignmentDate(date);
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
  getUserTasks,
  getUserProjectTasks,
  assignToday,
  removeToday,
};
