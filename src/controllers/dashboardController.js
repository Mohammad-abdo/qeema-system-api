"use strict";

const { prisma } = require("../lib/prisma");
const { hasPermissionWithoutRoleBypass } = require("../lib/rbac");
const { sendError, CODES } = require("../lib/errorResponse");

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Tasks that are not in a final (completed) status. */
function taskNotFinalWhere() {
  return {
    OR: [
      { taskStatus: { isFinal: false } },
      { taskStatusId: null },
    ],
  };
}

/** Tasks in a final (completed) status. */
function taskFinalWhere() {
  return {
    OR: [
      { taskStatus: { isFinal: true } },
      { completedAt: { not: null } },
    ],
  };
}

/** Tasks considered blocked (blocking status or no status with blocking flag). */
function taskBlockedWhere(blockingStatusId) {
  const parts = [{ taskStatus: { isBlocking: true } }];
  if (blockingStatusId) parts.push({ taskStatusId: blockingStatusId });
  return { OR: parts };
}

async function summary(req, res) {
  try {
    const userId = Number(req.user.id);
    const canViewAll = await hasPermissionWithoutRoleBypass(userId, "project.viewAll");

    const projectsWhere = canViewAll ? {} : {
      OR: [
        { projectManagerId: userId },
        { createdById: userId },
        { projectUsers: { some: { userId } } },
      ],
    };

    const tasksWhereBase = canViewAll ? {} : {
      project: {
        OR: [
          { projectManagerId: userId },
          { createdById: userId },
          { projectUsers: { some: { userId } } },
        ],
      },
    };

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const [
      projectStatuses,
      taskStatuses,
      totalProjects,
      totalTasks,
      myTasksCount,
      todaysTasksCount,
      todaysTasksTotalCount,
      completedTodayCount,
      recentActivities,
      projectStatusCountsRows,
      taskStatusCountsRows,
      legacyActiveCount,
      legacyOnHoldCount,
    ] = await Promise.all([
      prisma.projectStatus.findMany({
        where: { isActive: true },
        orderBy: { orderIndex: "asc" },
        select: { id: true, name: true, color: true },
      }).catch(() => []),
      prisma.taskStatus.findMany({
        where: { isActive: true },
        orderBy: { orderIndex: "asc" },
        select: { id: true, name: true, color: true, isBlocking: true, isFinal: true },
      }).catch(() => []),
      prisma.project.count({ where: projectsWhere }),
      prisma.task.count({ where: tasksWhereBase }),
      prisma.task.count({
        where: {
          assignees: { some: { id: userId } },
        },
      }),
      prisma.task.count({
        where: {
          ...tasksWhereBase,
          dueDate: { gte: todayStart, lte: todayEnd },
          ...taskNotFinalWhere(),
        },
      }),
      prisma.task.count({
        where: {
          ...tasksWhereBase,
          OR: [
            { dueDate: { gte: todayStart, lte: todayEnd } },
            { plannedDate: { gte: todayStart, lte: todayEnd } },
          ],
        },
      }),
      prisma.task.count({
        where: {
          ...tasksWhereBase,
          assignees: { some: { id: userId } },
          ...taskFinalWhere(),
          updatedAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.activityLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          actionType: true,
          actionSummary: true,
          actionCategory: true,
          createdAt: true,
          performedById: true,
          projectId: true,
          performedBy: { select: { id: true, username: true, avatarUrl: true } },
          project: { select: { id: true, name: true } },
        },
      }).catch(() => []),
      prisma.project.groupBy({
        by: ["projectStatusId"],
        where: { ...projectsWhere, projectStatusId: { not: null } },
        _count: { id: true },
      }).catch(() => []),
      prisma.task.groupBy({
        by: ["taskStatusId"],
        where: { ...tasksWhereBase, taskStatusId: { not: null } },
        _count: { id: true },
      }).catch(() => []),
      prisma.project.count({
        where: {
          ...projectsWhere,
          projectStatus: { name: { in: ["active", "Active", "planned", "Planned"] } },
        },
      }).catch(() => 0),
      prisma.project.count({
        where: {
          ...projectsWhere,
          projectStatus: { name: { contains: "hold" } },
        },
      }).catch(() => 0),
    ]);

    const projectStatusCounts = {};
    for (const row of projectStatusCountsRows) {
      if (row.projectStatusId) projectStatusCounts[row.projectStatusId] = row._count.id;
    }
    const taskStatusCounts = {};
    for (const row of taskStatusCountsRows) {
      if (row.taskStatusId) taskStatusCounts[row.taskStatusId] = row._count.id;
    }

    const blockingStatusId = taskStatuses.find((s) => s.isBlocking)?.id;
    const finalStatusId = taskStatuses.find((s) => s.isFinal)?.id;

    const notFinalOverdue = finalStatusId
      ? {
          OR: [
            { taskStatusId: { not: finalStatusId } },
            { taskStatusId: null },
          ],
        }
      : taskNotFinalWhere();

    const [blockedTasks, overdueTasks] = await Promise.all([
      prisma.task.count({
        where: {
          ...tasksWhereBase,
          ...taskBlockedWhere(blockingStatusId),
        },
      }),
      prisma.task.count({
        where: {
          ...tasksWhereBase,
          dueDate: { lt: new Date() },
          ...notFinalOverdue,
        },
      }),
    ]);

    const weeklyTaskTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = startOfDay(d);
      const dayEnd = endOfDay(d);
      const dateStr = d.toISOString().slice(0, 10);
      const [created, completed] = await Promise.all([
        prisma.task.count({
          where: {
            ...tasksWhereBase,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        }),
        prisma.task.count({
          where: {
            ...tasksWhereBase,
            completedAt: { not: null, gte: dayStart, lte: dayEnd },
          },
        }),
      ]);
      weeklyTaskTrend.push({ date: dateStr, created, completed });
    }

    return res.json({
      success: true,
      data: {
        projectStatuses,
        taskStatuses,
        totalProjects,
        totalTasks,
        myTasks: myTasksCount,
        todaysTasks: todaysTasksCount,
        todaysTasksTotal: todaysTasksTotalCount,
        completedToday: completedTodayCount,
        blockedTasks,
        overdueTasks,
        recentActivities,
        projectStatusCounts,
        taskStatusCounts,
        legacyActive: legacyActiveCount,
        legacyOnHold: legacyOnHoldCount,
        weeklyTaskTrend,
      },
    });
  } catch (err) {
    console.error("[dashboardController] summary:", err);
    sendError(res, 500, err.message || "Failed to fetch dashboard summary", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

module.exports = {
  summary,
};
