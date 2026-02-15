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

async function summary(req, res) {
  try {
    const userId = Number(req.user.id);
    const isAdmin = req.user.role === "admin";
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
          OR: [
            { taskStatus: { isFinal: false } },
            { status: { not: "completed" }, taskStatusId: null },
          ],
        },
      }),
      prisma.task.count({
        where: {
          ...tasksWhereBase,
          assignees: { some: { id: userId } },
          OR: [
            { taskStatus: { isFinal: true } },
            { status: "completed", taskStatusId: null },
          ],
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
        where: { ...projectsWhere, status: "active", projectStatusId: null },
      }).catch(() => 0),
      prisma.project.count({
        where: { ...projectsWhere, status: "on_hold", projectStatusId: null },
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

    const [blockedTasks, overdueTasks] = await Promise.all([
      prisma.task.count({
        where: {
          ...tasksWhereBase,
          OR: [
            ...(blockingStatusId ? [{ taskStatusId: blockingStatusId }] : []),
            { status: "waiting", taskStatusId: null },
          ],
        },
      }),
      prisma.task.count({
        where: {
          ...tasksWhereBase,
          dueDate: { lt: new Date() },
          OR: [
            ...(finalStatusId ? [{ taskStatusId: { not: finalStatusId } }] : []),
            { status: { not: "completed" }, taskStatusId: null },
          ],
        },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        projectStatuses,
        taskStatuses,
        totalProjects,
        totalTasks,
        myTasks: myTasksCount,
        todaysTasks: todaysTasksCount,
        completedToday: completedTodayCount,
        blockedTasks,
        overdueTasks,
        recentActivities,
        projectStatusCounts,
        taskStatusCounts,
        legacyActive: legacyActiveCount,
        legacyOnHold: legacyOnHoldCount,
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
