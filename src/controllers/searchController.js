"use strict";

const { prisma } = require("../lib/prisma");
const { hasPermissionWithoutRoleBypass } = require("../lib/rbac");
const { sendError, CODES } = require("../lib/errorResponse");

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

async function search(req, res) {
  try {
    const userId = Number(req.user?.id);
    if (!userId || !Number.isFinite(userId)) {
      return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
    }

    const q = req.query.q != null ? String(req.query.q).trim() : "";
    if (!q) {
      return res.status(200).json({ projects: [], tasks: [], users: [], teams: [] });
    }

    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));

    const [canViewAllProjects, canReadUsers, canReadTeams] = await Promise.all([
      hasPermissionWithoutRoleBypass(userId, "project.viewAll"),
      hasPermissionWithoutRoleBypass(userId, "user.read"),
      hasPermissionWithoutRoleBypass(userId, "team.read"),
    ]);

    const projectWhere = { name: { contains: q } };
    if (!canViewAllProjects) {
      projectWhere.OR = [
        { projectManagerId: userId },
        { createdById: userId },
      ];
    }

    const taskWhere = {
      OR: [
        { title: { contains: q } },
        { project: { name: { contains: q } } },
        { assignees: { some: { username: { contains: q } } } },
      ],
    };
    if (req.user.role !== "admin") {
      taskWhere.AND = [
        {
          OR: [
            { assignees: { some: { id: userId } } },
            { createdById: userId },
          ],
        },
      ];
    }

    const userWhere = canReadUsers
      ? { isActive: true, OR: [{ username: { contains: q } }, { email: { contains: q } }] }
      : { id: -1 };

    const teamWhere = canReadTeams
      ? { name: { contains: q } }
      : { id: -1 };

    const [projects, tasks, users, teams] = await Promise.all([
      prisma.project.findMany({
        where: projectWhere,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          description: true,
          projectStatusId: true,
          _count: { select: { tasks: true } },
        },
      }),
      prisma.task.findMany({
        where: taskWhere,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          projectId: true,
          project: { select: { id: true, name: true } },
          assignees: { where: { isActive: true }, select: { id: true, username: true, avatarUrl: true } },
        },
      }),
      canReadUsers
        ? prisma.user.findMany({
            where: userWhere,
            take: limit,
            orderBy: { username: "asc" },
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
              avatarUrl: true,
              team: { select: { id: true, name: true } },
            },
          })
        : Promise.resolve([]),
      canReadTeams
        ? prisma.team.findMany({
            where: teamWhere,
            take: limit,
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              description: true,
              _count: { select: { users: true, members: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    return res.status(200).json({ projects, tasks, users, teams });
  } catch (err) {
    console.error("[searchController] search:", err);
    return sendError(res, 500, err.message || "Search failed", {
      code: CODES.INTERNAL_ERROR,
      requestId: req.id,
    });
  }
}

module.exports = { search };
