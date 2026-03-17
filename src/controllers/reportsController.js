"use strict";

const { prisma } = require("../lib/prisma");
const { hasPermissionWithoutRoleBypass } = require("../lib/rbac");
const { sendError, CODES } = require("../lib/errorResponse");
const { formatInTimeZone } = require("date-fns-tz");
const { subDays } = require("date-fns");

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

/**
 * GET /dashboard/reports/projects
 * Query: startDate, endDate, projectIds (comma), teamIds (comma), statusIds (comma)
 * Returns portfolio KPIs, project list with health/completion, team productivity, task stats, velocity, bottlenecks.
 */
async function projectsReport(req, res) {
  try {
    const userId = Number(req.user?.id);
    if (!userId) return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED });
    const canViewReport = await hasPermissionWithoutRoleBypass(userId, "report.view");
    if (!canViewReport) return sendError(res, 403, "Permission denied: report.view required", { code: CODES.FORBIDDEN, requestId: req.id });

    const canViewAll = await hasPermissionWithoutRoleBypass(userId, "project.viewAll");
    const projectsWhereBase = canViewAll ? {} : {
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

    const projectIdsParam = req.query.projectIds;
    const teamIdsParam = req.query.teamIds;
    const statusIdsParam = req.query.statusIds;
    const startDateParam = req.query.startDate;
    const endDateParam = req.query.endDate;

    const projectIds = projectIdsParam ? projectIdsParam.split(",").map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n)) : null;
    const teamIds = teamIdsParam ? teamIdsParam.split(",").map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n)) : null;
    const statusIds = statusIdsParam ? statusIdsParam.split(",").map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n)) : null;

    let projectsWhere = { ...projectsWhereBase };
    if (projectIds?.length) projectsWhere.id = { in: projectIds };
    if (teamIds?.length) {
      projectsWhere.AND = projectsWhere.AND || [];
      projectsWhere.AND.push({
        OR: [
          { projectTeams: { some: { teamId: { in: teamIds } } } },
          { projectManagerId: { not: null }, projectManager: { teamId: { in: teamIds } } },
        ],
      });
    }
    if (statusIds?.length) projectsWhere.projectStatusId = { in: statusIds };

    const today = new Date();
    const periodStart = startDateParam ? startOfDay(new Date(startDateParam)) : startOfDay(today);
    const periodEnd = endDateParam ? endOfDay(new Date(endDateParam)) : endOfDay(today);

    const [projectStatuses, taskStatuses, projects, phases, tasksFlat] = await Promise.all([
      prisma.projectStatus.findMany({
        where: { isActive: true },
        orderBy: { orderIndex: "asc" },
        select: { id: true, name: true, color: true, isFinal: true },
      }).catch(() => []),
      prisma.taskStatus.findMany({
        where: { isActive: true },
        orderBy: { orderIndex: "asc" },
        select: { id: true, name: true, isFinal: true, isBlocking: true },
      }).catch(() => []),
      prisma.project.findMany({
        where: projectsWhere,
        select: {
          id: true,
          name: true,
          projectStatusId: true,
          status: true,
          priority: true,
          startDate: true,
          endDate: true,
          projectStatus: { select: { id: true, name: true, isFinal: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.projectPhase.findMany({
        where: { project: projectsWhere, status: { not: "completed" } },
        select: { projectId: true, name: true, endDate: true, status: true },
        orderBy: { endDate: "asc" },
      }),
      prisma.task.findMany({
        where: {
          ...tasksWhereBase,
          ...(projectIds?.length ? { projectId: { in: projectIds } } : {}),
        },
        select: {
          projectId: true,
          taskStatusId: true,
          dueDate: true,
          completedAt: true,
          assignees: { where: { isActive: true }, select: { id: true } },
        },
      }),
    ]);

    const statusById = Object.fromEntries((projectStatuses || []).map((s) => [s.id, s]));
    const projectIdsList = projects.map((p) => p.id);

    const tasksWhereForProjects = { ...tasksWhereBase, projectId: { in: projectIdsList } };
    const [overdueCounts, blockedCounts, blockedByProjectRows, completedCounts, assigneeCounts, velocityWeeks, dependencyCounts] = await Promise.all([
      prisma.task.groupBy({
        by: ["projectId"],
        where: {
          ...tasksWhereForProjects,
          dueDate: { lt: today },
          OR: [
            { taskStatusId: { not: null }, taskStatus: { isFinal: false } },
            { status: { not: "completed" }, taskStatusId: null },
          ],
        },
        _count: { id: true },
      }).catch(() => []),
      prisma.task.count({
        where: {
          ...tasksWhereForProjects,
          OR: [
            { taskStatus: { isBlocking: true } },
            { status: "waiting", taskStatusId: null },
          ],
        },
      }).then((c) => ({ total: c })).catch(() => ({ total: 0 })),
      prisma.task.groupBy({
        by: ["projectId"],
        where: {
          ...tasksWhereForProjects,
          OR: [
            { taskStatus: { isBlocking: true } },
            { status: "waiting", taskStatusId: null },
          ],
        },
        _count: { id: true },
      }).catch(() => []),
      prisma.task.groupBy({
        by: ["projectId"],
        where: {
          ...tasksWhereForProjects,
          OR: [
            { taskStatus: { isFinal: true } },
            { completedAt: { not: null } },
            { status: "completed", taskStatusId: null },
          ],
        },
        _count: { id: true },
      }).catch(() => []),
      prisma.task.findMany({
        where: {
          ...tasksWhereForProjects,
          assignees: { some: {} },
        },
        select: {
          projectId: true,
          taskStatusId: true,
          completedAt: true,
          assignees: { where: { isActive: true }, select: { id: true } },
        },
      }),
      (async () => {
        const weeks = [];
        for (let i = 3; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i * 7);
          const weekStart = startOfDay(d);
          const weekEndDate = new Date(weekStart);
          weekEndDate.setDate(weekEndDate.getDate() + 6);
          const weekEnd = endOfDay(weekEndDate);
          const completed = await prisma.task.count({
            where: {
              ...tasksWhereForProjects,
              completedAt: { gte: weekStart, lte: weekEnd },
            },
          }).catch(() => 0);
          weeks.push({ weekStart: weekStart.toISOString().slice(0, 10), completed });
        }
        return weeks;
      })(),
      prisma.task.findMany({
        where: {
          ...tasksWhereForProjects,
          dependents: { some: {} },
        },
        select: {
          id: true,
          title: true,
          projectId: true,
          taskStatusId: true,
          _count: { select: { dependents: true } },
        },
      }).catch(() => []),
    ]);

    const overdueByProject = Object.fromEntries((overdueCounts || []).map((r) => [r.projectId, r._count.id]));
    const completedByProject = Object.fromEntries((completedCounts || []).map((r) => [r.projectId, r._count.id]));
    const totalByProject = {};
    tasksFlat.forEach((t) => {
      totalByProject[t.projectId] = (totalByProject[t.projectId] || 0) + 1;
    });
    const blockedByProject = Object.fromEntries((blockedByProjectRows || []).map((r) => [r.projectId, r._count.id]));

    const nextMilestoneByProject = {};
    (phases || []).forEach((ph) => {
      if (!nextMilestoneByProject[ph.projectId]) {
        nextMilestoneByProject[ph.projectId] = {
          name: ph.name,
          endDate: ph.endDate,
        };
      }
    });

    const projectList = projects.map((p) => {
      const total = totalByProject[p.id] || 0;
      const completed = completedByProject[p.id] || 0;
      const overdue = overdueByProject[p.id] || 0;
      const blocked = blockedByProject[p.projectId] || 0;
      const pending = Math.max(0, total - completed);
      const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
      const statusFinal = p.projectStatus ? statusById[p.projectStatus.id]?.isFinal : false;
      const isDelayed = p.endDate && new Date(p.endDate) < today && !statusFinal;
      const riskFlags = [];
      if (p.endDate && new Date(p.endDate) < today && !statusFinal) riskFlags.push("past_end_date");
      if (blocked > 0) riskFlags.push("blocked_tasks");
      let health = "green";
      if (isDelayed || overdue > 2 || blocked > 2) health = "red";
      else if (overdue > 0 || blocked > 0 || completionPercent < 50) health = "yellow";

      return {
        id: p.id,
        name: p.name,
        status: p.projectStatus?.name ?? p.status ?? "—",
        statusId: p.projectStatusId,
        priority: p.priority,
        endDate: p.endDate,
        health,
        riskFlags,
        nextMilestone: nextMilestoneByProject[p.id] || null,
        completionPercent,
        tasksTotal: total,
        tasksCompleted: completed,
        tasksPending: pending,
        tasksOverdue: overdue,
        tasksBlocked: blocked,
      };
    });

    const activeCount = projects.filter((p) => {
      const s = p.projectStatus ? statusById[p.projectStatus.id] : null;
      return !s?.isFinal;
    }).length;
    const completedCount = projects.filter((p) => {
      const s = p.projectStatus ? statusById[p.projectStatus.id] : null;
      return s?.isFinal === true;
    }).length;
    const delayedCount = projectList.filter((p) => p.riskFlags.includes("past_end_date")).length;
    const onHoldCount = projects.filter((p) => {
      const name = (p.projectStatus?.name ?? p.status ?? "").toLowerCase();
      return name.includes("hold") || name.includes("on hold") || p.status === "on_hold";
    }).length;

    const priorityDistribution = { normal: 0, high: 0, urgent: 0 };
    projects.forEach((p) => {
      const pr = (p.priority || "normal").toLowerCase();
      if (pr in priorityDistribution) priorityDistribution[pr]++;
    });

    const userCompletedInPeriod = {};
    const userAssigned = {};
    (assigneeCounts || []).forEach((t) => {
      const completedInPeriod = t.completedAt && t.completedAt >= periodStart && t.completedAt <= periodEnd;
      t.assignees.forEach((a) => {
        userAssigned[a.id] = (userAssigned[a.id] || 0) + 1;
        if (completedInPeriod) userCompletedInPeriod[a.id] = (userCompletedInPeriod[a.id] || 0) + 1;
      });
    });
    const userIds = [...new Set([...Object.keys(userAssigned), ...Object.keys(userCompletedInPeriod)])].map(Number);
    const users = userIds.length ? await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    }).catch(() => []) : [];
    const OVERLOAD_THRESHOLD = 10;
    const teamProductivity = users.map((u) => {
      const assigned = userAssigned[u.id] || 0;
      const completedInPeriod = userCompletedInPeriod[u.id] || 0;
      const rate = assigned > 0 ? Math.round((completedInPeriod / assigned) * 100) : 0;
      return {
        userId: u.id,
        username: u.username,
        assigned,
        completedInPeriod,
        completionRatePercent: rate,
        overloaded: assigned > OVERLOAD_THRESHOLD,
      };
    }).sort((a, b) => b.assigned - a.assigned);

    const totalTasks = tasksFlat.length;
    const totalCompleted = Object.values(completedByProject).reduce((a, b) => a + b, 0);
    const totalOverdue = Object.values(overdueByProject).reduce((a, b) => a + b, 0);
    const totalBlocked = (blockedCounts && blockedCounts.total) || 0;
    const totalPending = Math.max(0, totalTasks - totalCompleted);

    const atRiskProjects = projectList.filter((p) => p.health === "red" || p.health === "yellow");
    const bottlenecks = (dependencyCounts || [])
      .filter((t) => t._count?.dependents > 1)
      .map((t) => ({ taskId: t.id, title: t.title, projectId: t.projectId, dependentsCount: t._count?.dependents || 0 }))
      .sort((a, b) => b.dependentsCount - a.dependentsCount)
      .slice(0, 20);

    const projectStatusCounts = {};
    projectStatuses.forEach((s) => {
      projectStatusCounts[s.id] = projects.filter((p) => p.projectStatusId === s.id).length;
    });

    return res.json({
      success: true,
      data: {
        portfolio: {
          totalProjects: projects.length,
          active: activeCount,
          completed: completedCount,
          delayed: delayedCount,
          onHold: onHoldCount,
          priorityDistribution,
        },
        projectStatuses: projectStatuses.map((s) => ({ id: s.id, name: s.name, color: s.color, isFinal: s.isFinal })),
        projectStatusCounts,
        projectList,
        taskStats: {
          total: totalTasks,
          completed: totalCompleted,
          pending: totalPending,
          overdue: totalOverdue,
          blocked: totalBlocked,
        },
        teamProductivity,
        velocity: velocityWeeks,
        atRiskProjects,
        bottlenecks,
      },
    });
  } catch (err) {
    console.error("[reportsController] projectsReport:", err);
    sendError(res, 500, err.message || "Failed to load projects report", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

/**
 * GET /dashboard/reports/focus
 * Returns analytics for today's focus based on the report design.
 */
async function todaysFocusReport(req, res) {
  try {
    const userId = Number(req.user?.id);
    if (!userId) return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED });
    const canViewReport = await hasPermissionWithoutRoleBypass(userId, "report.view");
    if (!canViewReport) return sendError(res, 403, "Permission denied: report.view required", { code: CODES.FORBIDDEN, requestId: req.id });

    const CAIRO_TIMEZONE = "Africa/Cairo";
    const { fromZonedTime, getTimezoneOffset } = require("date-fns-tz");
    
    function getCairoDateString(date = new Date()) {
        return formatInTimeZone(date, CAIRO_TIMEZONE, "yyyy-MM-dd");
    }
    
    function getCairoDayRangeUtc(dateStr) {
        if (fromZonedTime) {
            const start = fromZonedTime(`${dateStr}T00:00:00`, CAIRO_TIMEZONE);
            const end = fromZonedTime(`${dateStr}T23:59:59.999`, CAIRO_TIMEZONE);
            return { start, end };
        }
        const [y, m, d] = dateStr.split("-").map(Number);
        const approxMidnightUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
        const offsetMs = getTimezoneOffset(CAIRO_TIMEZONE, approxMidnightUtc);
        const offsetHours = offsetMs / (1000 * 60 * 60);

        const start = new Date(Date.UTC(y, m - 1, d, -offsetHours, 0, 0, 0));
        const end = new Date(Date.UTC(y, m - 1, d, 24 - offsetHours - 1, 59, 59, 999));
        return { start, end };
    }

    const todayTargetStr = req.query.date || getCairoDateString();
    const todayTargetDate = new Date(todayTargetStr + "T00:00:00Z"); // approximate for subDays
    
    const { start: todayStart, end: todayEnd } = getCairoDayRangeUtc(todayTargetStr);
    
    const yesterdayDateStr = getCairoDateString(subDays(todayTargetDate, 1));
    const { start: yestStart, end: yestEnd } = getCairoDayRangeUtc(yesterdayDateStr);

    const weekStartStr = getCairoDateString(subDays(todayTargetDate, 7));
    const { start: weekStartUTC } = getCairoDayRangeUtc(weekStartStr);

    const canViewAll = await hasPermissionWithoutRoleBypass(userId, "project.viewAll");
    
    const projectFilter = canViewAll ? {} : {
        project: {
          OR: [
            { projectManagerId: userId },
            { createdById: userId },
            { projectUsers: { some: { userId } } },
          ],
        },
    };

    const taskWhereBase = { ...projectFilter };

    const taskStatuses = await prisma.taskStatus.findMany({ select: { id: true, name: true, isFinal: true, isBlocking: true } });
    const completedStatusIds = taskStatuses.filter(s => s.isFinal).map(s => s.id);
    const blockingStatusIds = taskStatuses.filter(s => s.isBlocking).map(s => s.id);

    const scheduledTasks = await prisma.task.findMany({
        where: {
            ...taskWhereBase,
            plannedDate: { gte: todayStart, lte: todayEnd }
        },
        include: {
            assignees: { where: { isActive: true }, select: { id: true, username: true, avatarUrl: true } },
            project: { select: { id: true, name: true } },
            timeLogs: { where: { logDate: { gte: todayStart, lte: todayEnd } } }
        }
    });

    const activeTasksOther = await prisma.task.findMany({
        where: {
            ...taskWhereBase,
            OR: [
                { completedAt: { gte: todayStart, lte: todayEnd } },
                { startedAt: { gte: todayStart, lte: todayEnd } },
                { timeLogs: { some: { logDate: { gte: todayStart, lte: todayEnd } } } }
            ],
            NOT: {
                 plannedDate: { gte: todayStart, lte: todayEnd }
            }
        },
        include: {
            assignees: { select: { id: true, username: true, avatarUrl: true } },
            project: { select: { id: true, name: true } },
            timeLogs: { where: { logDate: { gte: todayStart, lte: todayEnd } } }
        }
    });

    const allTodayTasks = [...scheduledTasks, ...activeTasksOther];

    const isCompleted = (t) => completedStatusIds.includes(t.taskStatusId) || t.status === "completed" || t.completedAt != null;
    const isBlocked = (t) => blockingStatusIds.includes(t.taskStatusId) || t.status === "blocked";
    const isInProgress = (t) => t.startedAt != null && !isCompleted(t) && !isBlocked(t);

    let T_sch = scheduledTasks.length;
    let T_comp = allTodayTasks.filter(t => t.completedAt >= todayStart && t.completedAt <= todayEnd).length;
    let T_prog = allTodayTasks.filter(t => isInProgress(t) || t.timeLogs.length > 0).length;
    let T_over = scheduledTasks.filter(t => t.dueDate && t.dueDate < todayStart && !isCompleted(t)).length;
    let T_blk = allTodayTasks.filter(t => isBlocked(t)).length;

    const createdToday = await prisma.task.count({
        where: {
            ...taskWhereBase,
            createdAt: { gte: todayStart, lte: todayEnd }
        }
    });
    
    const userMap = new Map();
    
    allTodayTasks.forEach(t => {
        t.assignees.forEach(u => {
            if (!userMap.has(u.id)) {
                userMap.set(u.id, { 
                  id: u.id, 
                  name: u.username, 
                  avatarUrl: u.avatarUrl,
                  completed: 0, 
                  inProgress: 0, 
                  scheduled: 0, 
                  activeTime: 0 
                });
            }
            const uData = userMap.get(u.id);
            if (scheduledTasks.find(st => st.id === t.id)) uData.scheduled++;
            if (t.completedAt >= todayStart && t.completedAt <= todayEnd) uData.completed++;
            else if (isInProgress(t) || t.timeLogs.length > 0) uData.inProgress++;
            
            t.timeLogs.filter(log => log.userId === u.id).forEach(log => {
                uData.activeTime += log.hoursLogged;
            });
        });
    });

    const activeUsers = Array.from(userMap.values()).filter(u => u.completed > 0 || u.inProgress > 0 || u.activeTime > 0);
    const idleUsersArray = Array.from(userMap.values()).filter(u => u.scheduled > 0 && u.completed === 0 && u.inProgress === 0 && u.activeTime === 0);

    const projectMap = new Map();
    allTodayTasks.forEach(t => {
        const pId = t.project.id;
        if (!projectMap.has(pId)) {
            projectMap.set(pId, { id: pId, name: t.project.name, scheduled: 0, completed: 0, blocked: 0 });
        }
        const pData = projectMap.get(pId);
        if (scheduledTasks.find(st => st.id === t.id)) pData.scheduled++;
        if (t.completedAt >= todayStart && t.completedAt <= todayEnd) pData.completed++;
        if (isBlocked(t)) pData.blocked++;
    });

    const projectsActive = Array.from(projectMap.values()).map(p => ({
        ...p,
        health: p.blocked > p.completed ? "At Risk" : "Good",
        delayIndex: p.scheduled > 0 ? p.blocked / p.scheduled : 0
    })).sort((a,b) => b.completed - a.completed);

    const yestTasks = await prisma.task.count({
        where: {
            ...taskWhereBase,
            completedAt: { gte: yestStart, lte: yestEnd }
        }
    });
    const T_comp_yest = yestTasks;

    const weeklyTasksCount = await prisma.task.count({
        where: {
           ...taskWhereBase,
           completedAt: { gte: weekStartUTC, lte: todayEnd }
        }
    });

    const avgDailyCompleted = Math.round(weeklyTasksCount / 7);

    const insights = [];
    
    const topBlockedProject = projectsActive.sort((a,b) => b.blocked - a.blocked)[0];
    if (topBlockedProject && topBlockedProject.blocked > T_blk * 0.5 && T_blk > 0) {
        insights.push({ 
            type: "warning", 
            message: `Attention: ${topBlockedProject.name} accounts for ${Math.round((topBlockedProject.blocked / T_blk) * 100)}% of all blocked tasks today.` 
        });
    }

    if (idleUsersArray.length > 0) {
        const names = idleUsersArray.slice(0, 2).map(u => u.name).join(' and ');
        const others = idleUsersArray.length > 2 ? ` and ${idleUsersArray.length - 2} others` : "";
        insights.push({
            type: "info",
            message: `${names}${others} have assigned tasks scheduled today but have registered no activity.`
        });
    }

    if (T_comp > avgDailyCompleted * 1.2 && avgDailyCompleted > 0) {
        insights.push({
            type: "success",
            message: `Great pace! The team is completing tasks faster today than the weekly average.`
        });
    }

    // Task status grouping for the donut chart
    const statusDistribution = {};
    allTodayTasks.forEach(t => {
      const s = t.taskStatus ? t.taskStatus.name : t.status;
      statusDistribution[s] = (statusDistribution[s] || 0) + 1;
    });

    res.json({
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          overview: {
            totalScheduled: T_sch,
            completed: T_comp,
            inProgress: T_prog,
            overdue: T_over,
            blocked: T_blk,
            createdToday,
            completionPercentage: T_sch > 0 ? Math.round((T_comp / T_sch) * 100) : 0,
            executionRatio: T_sch > 0 ? Number(((T_comp + T_prog) / T_sch).toFixed(2)) : 0
          },
          comparisons: {
            yesterday: {
              completedDiff: T_comp - T_comp_yest,
              velocityTrend: T_comp_yest > 0 ? Math.round(((T_comp - T_comp_yest) / T_comp_yest) * 100) : 0,
            },
            weekly: {
              avgDailyCompleted: avgDailyCompleted
            }
          },
          statusDistribution,
          users: Array.from(userMap.values()),
          projects: projectsActive,
          insights: insights,
          taskTable: allTodayTasks.map(t => ({
             id: t.id,
             title: t.title,
             project: t.project.name,
             assignees: t.assignees,
             status: t.status,
             taskStatusId: t.taskStatusId,
             hoursActive: t.timeLogs.reduce((acc, log) => acc + log.hoursLogged, 0),
             isBlocked: isBlocked(t)
          }))
        }
    });

  } catch (err) {
    console.error("[reportsController] todaysFocusReport:", err);
    sendError(res, 500, err.message || "Failed to load focus report", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

/**
 * GET /dashboard/reports/progress
 * Query: startDate, endDate, projectIds (comma), userIds (comma, assignees), taskStatusIds (comma), priority
 * Returns task progress across all projects: global KPIs, by project, by date trend, by user, bottlenecks, at-risk, task list.
 */
async function progressReport(req, res) {
  try {
    const userId = Number(req.user?.id);
    if (!userId) return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED });
    const canViewReport = await hasPermissionWithoutRoleBypass(userId, "report.view");
    if (!canViewReport) return sendError(res, 403, "Permission denied: report.view required", { code: CODES.FORBIDDEN, requestId: req.id });

    const canViewAll = await hasPermissionWithoutRoleBypass(userId, "project.viewAll");
    const tasksWhereBase = canViewAll ? {} : {
      project: {
        OR: [
          { projectManagerId: userId },
          { createdById: userId },
          { projectUsers: { some: { userId } } },
        ],
      },
    };

    const projectIdsParam = req.query.projectIds;
    const userIdsParam = req.query.userIds;
    const taskStatusIdsParam = req.query.taskStatusIds;
    const priorityParam = req.query.priority;
    const startDateParam = req.query.startDate;
    const endDateParam = req.query.endDate;

    const projectIds = projectIdsParam ? projectIdsParam.split(",").map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n)) : null;
    const userIds = userIdsParam ? userIdsParam.split(",").map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n)) : null;
    const taskStatusIds = taskStatusIdsParam ? taskStatusIdsParam.split(",").map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n)) : null;

    const today = new Date();
    const periodStart = startDateParam ? startOfDay(new Date(startDateParam)) : startOfDay(subDays(today, 30));
    const periodEnd = endDateParam ? endOfDay(new Date(endDateParam)) : endOfDay(today);

    let tasksWhere = { ...tasksWhereBase };
    if (projectIds?.length) tasksWhere.projectId = { in: projectIds };
    if (taskStatusIds?.length) tasksWhere.taskStatusId = { in: taskStatusIds };
    if (priorityParam && ["normal", "high", "urgent"].includes(String(priorityParam).toLowerCase())) {
      tasksWhere.priority = String(priorityParam).toLowerCase();
    }
    if (userIds?.length) tasksWhere.assignees = { some: { id: { in: userIds } } };

    const [taskStatuses, tasksFlat, overdueCounts, blockedCounts, completedCounts, dependencyCounts] = await Promise.all([
      prisma.taskStatus.findMany({
        where: { isActive: true },
        select: { id: true, name: true, isFinal: true, isBlocking: true },
      }).catch(() => []),
      prisma.task.findMany({
        where: tasksWhere,
        select: {
          id: true,
          title: true,
          projectId: true,
          taskStatusId: true,
          status: true,
          priority: true,
          dueDate: true,
          completedAt: true,
          createdAt: true,
          startedAt: true,
          assignees: { where: { isActive: true }, select: { id: true, username: true } },
          project: { select: { id: true, name: true, endDate: true } },
        },
      }),
      prisma.task.groupBy({
        by: ["projectId"],
        where: {
          ...tasksWhere,
          dueDate: { lt: today, not: null },
          OR: [
            { taskStatus: { isFinal: false } },
            { taskStatusId: null, status: { not: "completed" } },
          ],
          completedAt: null,
        },
        _count: { id: true },
      }).catch(() => []),
      prisma.task.groupBy({
        by: ["projectId"],
        where: {
          ...tasksWhere,
          OR: [
            { taskStatus: { isBlocking: true } },
            { status: "waiting", taskStatusId: null },
          ],
        },
        _count: { id: true },
      }).catch(() => []),
      prisma.task.groupBy({
        by: ["projectId"],
        where: {
          ...tasksWhere,
          OR: [
            { taskStatus: { isFinal: true } },
            { completedAt: { not: null } },
            { status: "completed", taskStatusId: null },
          ],
        },
        _count: { id: true },
      }).catch(() => []),
      prisma.task.findMany({
        where: { ...tasksWhere, dependents: { some: {} } },
        select: {
          id: true,
          title: true,
          projectId: true,
          _count: { select: { dependents: true } },
        },
      }).catch(() => []),
    ]);
    const projectIdsFromTasks = [...new Set(tasksFlat.map((t) => t.projectId))];
    const projectsInScope = projectIdsFromTasks.length
      ? await prisma.project.findMany({
          where: { id: { in: projectIdsFromTasks } },
          select: { id: true, name: true, endDate: true },
        }).catch(() => [])
      : [];

    const statusById = Object.fromEntries((taskStatuses || []).map((s) => [s.id, s]));
    const isCompleted = (t) => (t.taskStatusId != null && statusById[t.taskStatusId]?.isFinal) || t.status === "completed" || t.completedAt != null;
    const isBlocked = (t) => (t.taskStatusId != null && statusById[t.taskStatusId]?.isBlocking) || t.status === "waiting";
    const isOverdue = (t) => t.dueDate && new Date(t.dueDate) < today && !isCompleted(t);

    const totalTasks = tasksFlat.length;
    const completed = tasksFlat.filter(isCompleted).length;
    const blocked = tasksFlat.filter(isBlocked).length;
    const overdue = tasksFlat.filter(isOverdue).length;
    const inProgress = tasksFlat.filter((t) => !isCompleted(t) && !isBlocked(t)).length;
    const pending = tasksFlat.filter((t) => {
      if (isCompleted(t) || isBlocked(t)) return false;
      const st = t.taskStatusId != null ? statusById[t.taskStatusId] : null;
      const name = (st?.name ?? t.status ?? "").toLowerCase();
      return name.includes("pending") || name.includes("to do") || name.includes("todo") || t.status === "pending";
    }).length;
    const completionRatio = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

    const overdueByProject = Object.fromEntries((overdueCounts || []).map((r) => [r.projectId, r._count.id]));
    const blockedByProject = Object.fromEntries((blockedCounts || []).map((r) => [r.projectId, r._count.id]));
    const completedByProject = Object.fromEntries((completedCounts || []).map((r) => [r.projectId, r._count.id]));
    const totalByProject = {};
    tasksFlat.forEach((t) => { totalByProject[t.projectId] = (totalByProject[t.projectId] || 0) + 1; });

    const projectIdSet = new Set(tasksFlat.map((t) => t.projectId));
    const byProject = (projectsInScope || [])
      .filter((p) => !projectIds?.length || projectIds.includes(p.id))
      .map((p) => {
        const total = totalByProject[p.id] || 0;
        const completedP = completedByProject[p.id] || 0;
        const overdueP = overdueByProject[p.id] || 0;
        const blockedP = blockedByProject[p.id] || 0;
        const completionPercent = total > 0 ? Math.round((completedP / total) * 100) : 0;
        const isPastEnd = p.endDate && new Date(p.endDate) < today;
        const atRisk = blockedP > 0 || overdueP > 0 || completionPercent < 50 || (isPastEnd && total > completedP);
        return {
          projectId: p.id,
          name: p.name,
          total,
          completed: completedP,
          overdue: overdueP,
          blocked: blockedP,
          completionPercent,
          atRisk,
        };
      })
      .filter((p) => projectIdSet.has(p.projectId) || totalByProject[p.id] > 0)
      .sort((a, b) => (b.total || 0) - (a.total || 0));

    const trendDays = [];
    for (let d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
      const dayStart = startOfDay(new Date(d));
      const dayEnd = endOfDay(new Date(d));
      const dateStr = d.toISOString().slice(0, 10);
      trendDays.push({ date: dateStr, dayStart, dayEnd });
    }
    const trend = await Promise.all(
      trendDays.slice(0, 90).map(async ({ date, dayStart, dayEnd }) => {
        const [created, completedThatDay] = await Promise.all([
          prisma.task.count({
            where: { ...tasksWhere, createdAt: { gte: dayStart, lte: dayEnd } },
          }),
          prisma.task.count({
            where: { ...tasksWhere, completedAt: { gte: dayStart, lte: dayEnd } },
          }),
        ]);
        return { date, created, completed: completedThatDay };
      })
    );

    const userCompleted = {};
    const userInProgress = {};
    const userOverdue = {};
    tasksFlat.forEach((t) => {
      t.assignees.forEach((u) => {
        if (isCompleted(t)) userCompleted[u.id] = (userCompleted[u.id] || 0) + 1;
        else if (!isBlocked(t)) userInProgress[u.id] = (userInProgress[u.id] || 0) + 1;
        if (isOverdue(t)) userOverdue[u.id] = (userOverdue[u.id] || 0) + 1;
      });
    });
    const allUserIds = [...new Set([...Object.keys(userCompleted), ...Object.keys(userInProgress), ...Object.keys(userOverdue)])].map(Number);
    const OVERLOAD_THRESHOLD = 15;
    const users = allUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: allUserIds } },
          select: { id: true, username: true },
        }).catch(() => [])
      : [];
    const byUser = users.map((u) => {
      const completedU = userCompleted[u.id] || 0;
      const inProgressU = userInProgress[u.id] || 0;
      const overdueU = userOverdue[u.id] || 0;
      const openU = inProgressU + overdueU;
      const productivityScore = completedU + openU > 0 ? Math.round((completedU / (completedU + openU)) * 100) : 0;
      return {
        userId: u.id,
        username: u.username,
        completed: completedU,
        inProgress: inProgressU,
        overdue: overdueU,
        productivityScore,
        overloaded: openU > OVERLOAD_THRESHOLD,
      };
    }).sort((a, b) => b.completed - a.completed);

    const bottlenecks = (dependencyCounts || [])
      .map((t) => ({ taskId: t.id, title: t.title, projectId: t.projectId, dependentsCount: t._count?.dependents || 0 }))
      .filter((t) => t.dependentsCount > 0)
      .sort((a, b) => b.dependentsCount - a.dependentsCount)
      .slice(0, 30);

    const atRiskProjects = byProject.filter((p) => p.atRisk);

    const completedWithDue = tasksFlat.filter((t) => isCompleted(t) && t.dueDate);
    const delayRatioCount = completedWithDue.filter((t) => t.completedAt && new Date(t.completedAt) > new Date(t.dueDate)).length;
    const delayRatio = completedWithDue.length > 0 ? Math.round((delayRatioCount / completedWithDue.length) * 100) : 0;
    const completedInPeriod = tasksFlat.filter((t) => t.completedAt && t.completedAt >= periodStart && t.completedAt <= periodEnd).length;
    const durations = tasksFlat.filter((t) => t.completedAt && t.createdAt).map((t) => (new Date(t.completedAt) - new Date(t.createdAt)) / (1000 * 60 * 60 * 24));
    const avgTaskDurationDays = durations.length > 0 ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : null;
    const slaCompliance = completedWithDue.length > 0
      ? Math.round((completedWithDue.filter((t) => t.completedAt && new Date(t.completedAt) <= new Date(t.dueDate)).length / completedWithDue.length) * 100)
      : null;

    const taskList = tasksFlat
      .slice(0, 200)
      .map((t) => ({
        id: t.id,
        title: t.title,
        projectId: t.projectId,
        projectName: t.project?.name,
        status: t.status,
        taskStatusId: t.taskStatusId,
        priority: t.priority,
        dueDate: t.dueDate,
        completedAt: t.completedAt,
        assignees: t.assignees,
        isOverdue: isOverdue(t),
        isBlocked: isBlocked(t),
      }));

    const statusDistribution = {};
    tasksFlat.forEach((t) => {
      const label = t.taskStatusId != null ? (statusById[t.taskStatusId]?.name ?? t.status) : t.status;
      statusDistribution[label] = (statusDistribution[label] || 0) + 1;
    });

    return res.json({
      success: true,
      data: {
        global: {
          total: totalTasks,
          completed,
          inProgress,
          pending,
          overdue,
          blocked,
          completionRatio,
          statusDistribution,
        },
        byProject,
        trend,
        byUser,
        bottlenecks,
        atRiskProjects,
        timeAndPerformance: {
          avgTaskDurationDays,
          delayRatio,
          completedInPeriod,
          slaCompliance,
        },
        taskList,
        taskStatuses: taskStatuses.map((s) => ({ id: s.id, name: s.name, isFinal: s.isFinal, isBlocking: s.isBlocking })),
      },
    });
  } catch (err) {
    console.error("[reportsController] progressReport:", err);
    sendError(res, 500, err.message || "Failed to load progress report", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

/**
 * GET /reports/todays-focus (Analytical)
 * Query: date=YYYY-MM-DD (default: today in server date)
 * Returns: date, summary (daily productivity, planned vs executed, focus efficiency),
 * comparisons (yesterday + rolling 7-day), breakdowns (byUser, byProject), definitions.
 */
async function todaysFocusAnalyticalReport(req, res) {
  try {
    const userId = Number(req.user?.id);
    if (!userId) return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED });
    const canViewReport = await hasPermissionWithoutRoleBypass(userId, "report.view");
    if (!canViewReport) return sendError(res, 403, "Permission denied: report.view required", { code: CODES.FORBIDDEN, requestId: req.id });

    const { buildTodaysFocusAnalyticalReport } = require("../services/reports/todaysFocusReportService");
    const todayStr = new Date().toISOString().slice(0, 10);
    const dateStr = (req.query.date && String(req.query.date).trim()) || todayStr;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return sendError(res, 400, "Invalid date; use YYYY-MM-DD", { code: CODES.INVALID_INPUT });
    }

    const report = await buildTodaysFocusAnalyticalReport(userId, dateStr);
    return res.status(200).json(report);
  } catch (err) {
    console.error("[reportsController] todaysFocusAnalyticalReport:", err);
    const message = process.env.NODE_ENV !== "production" && err?.message
      ? `Today's Focus report: ${err.message}`
      : "Failed to build Today's Focus analytical report";
    return sendError(res, 500, message, {
      code: CODES.INTERNAL_ERROR,
    });
  }
}

module.exports = {
  projectsReport,
  todaysFocusReport,
  progressReport,
  todaysFocusAnalyticalReport,
};
