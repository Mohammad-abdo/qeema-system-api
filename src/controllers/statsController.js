"use strict";

const { prisma } = require("../lib/prisma");
const { hasPermissionWithoutRoleBypass } = require("../lib/rbac");
const { sendError, CODES } = require("../lib/errorResponse");

async function getAllProjectsStats(req, res) {
  try {
    const userId = Number(req.user.id);
    const canViewAll = await hasPermissionWithoutRoleBypass(userId, "project.viewAll");

    const where = canViewAll ? {} : {
      OR: [
        { projectManagerId: userId },
        { createdById: userId },
        { projectUsers: { some: { userId } } },
      ],
    };

    const [total, urgent] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.count({
        where: { ...where, priority: "urgent" },
      }),
    ]);

    const statusCounts = await prisma.project.groupBy({
      by: ["status", "projectStatusId"],
      where,
      _count: { id: true },
    });

    let active = 0;
    let completed = 0;
    for (const g of statusCounts) {
      if (g.status === "active" || g.status === null) active += g._count.id;
      if (g.status === "completed") completed += g._count.id;
    }

    return res.json({
      success: true,
      data: { total, active, completed, urgent },
    });
  } catch (err) {
    console.error("[statsController] getAllProjectsStats:", err);
    sendError(res, 500, err.message || "Failed to fetch projects stats", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function getProjectStats(req, res) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (Number.isNaN(projectId)) return sendError(res, 400, "Invalid project ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const [taskStats, completedTasks, blockedTasks, overdueTasks, urgentTasks] = await Promise.all([
      prisma.task.aggregate({
        where: { projectId },
        _count: { id: true },
      }),
      prisma.task.count({
        where: {
          projectId,
          OR: [
            { taskStatus: { isFinal: true } },
            { status: "completed", taskStatusId: null },
          ],
        },
      }),
      prisma.task.count({
        where: {
          projectId,
          OR: [
            { taskStatus: { isBlocking: true } },
            { status: "waiting", taskStatusId: null },
          ],
        },
      }),
      prisma.task.count({
        where: {
          projectId,
          dueDate: { lt: new Date() },
          OR: [
            { taskStatus: { isFinal: false } },
            { status: { not: "completed" }, taskStatusId: null },
          ],
        },
      }),
      prisma.task.count({
        where: {
          projectId,
          priority: { in: ["high", "urgent"] },
          OR: [
            { taskStatus: { isFinal: false } },
            { status: { not: "completed" }, taskStatusId: null },
          ],
        },
      }),
    ]);

    const totalTasks = taskStats._count.id;
    const inProgressTasks = Math.max(0, totalTasks - completedTasks - blockedTasks);

    return res.json({
      success: true,
      data: {
        totalTasks,
        completedTasks,
        inProgressTasks,
        blockedTasks,
        overdueTasks,
        urgentTasks,
      },
    });
  } catch (err) {
    console.error("[statsController] getProjectStats:", err);
    sendError(res, 500, err.message || "Failed to fetch project stats", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

module.exports = {
  getAllProjectsStats,
  getProjectStats,
};
