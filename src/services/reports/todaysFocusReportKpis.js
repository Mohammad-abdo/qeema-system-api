"use strict";

/**
 * Pure KPI calculation functions for the Today's Focus Analytical Report.
 * All functions are side-effect free and unit-testable with mock data.
 */

// --- Helpers ---

function isSameDay(d, dateStr) {
  if (!d) return false;
  const s = typeof d === "string" ? d : d.toISOString().slice(0, 10);
  return s === dateStr;
}

function toDateStr(d) {
  return typeof d === "string" ? d : d.toISOString().slice(0, 10);
}

/**
 * @param {Array<{ completedAt: Date|null, dueDate: Date|null }>} tasks
 * @param {string} dateStr
 * @returns {{ count: number, onTimeCount: number, withDueCount: number }}
 */
function completedOnDayAndOnTime(tasks, dateStr) {
  let count = 0;
  let onTimeCount = 0;
  let withDueCount = 0;
  for (const t of tasks) {
    if (!t.completedAt || !isSameDay(t.completedAt, dateStr)) continue;
    count++;
    if (t.dueDate) {
      withDueCount++;
      if (t.completedAt <= t.dueDate) onTimeCount++;
    }
  }
  return { count, onTimeCount, withDueCount };
}

/**
 * Sum focus time (hours) for a day from task timeLogs for that day. TimeLogs are already filtered by day in data layer.
 * @param {Array<{ timeLogs: Array<{ hoursLogged: number }> }>} tasks
 * @returns {number} hours
 */
function sumFocusHoursFromTasks(tasks) {
  let h = 0;
  for (const t of tasks) {
    for (const l of t.timeLogs || []) {
      h += l.hoursLogged || 0;
    }
  }
  return h;
}

/**
 * Average completion speed: hours from startedAt to completedAt for tasks completed on dateStr.
 * Lower is better. Returns null if no completions with both startedAt and completedAt.
 * @param {Array<{ startedAt: Date|null, completedAt: Date|null }>} tasks
 * @param {string} dateStr
 * @returns {number|null} average hours to complete
 */
function getAverageCompletionSpeedHours(tasks, dateStr) {
  const completed = tasks.filter(
    (t) => t.completedAt && isSameDay(t.completedAt, dateStr) && t.startedAt
  );
  if (completed.length === 0) return null;
  let totalHours = 0;
  for (const t of completed) {
    totalHours += (t.completedAt - t.startedAt) / (1000 * 60 * 60);
  }
  return totalHours / completed.length;
}

/**
 * Rolling 7-day stats for normalization: mean and std (or fallback if no variance).
 * @param {number[]} values
 * @returns {{ mean: number, std: number }}
 */
function rollingMeanAndStd(values) {
  const arr = values.filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (arr.length === 0) return { mean: 0, std: 1 };
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance =
    arr.length > 1
      ? arr.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (arr.length - 1)
      : 0;
  const std = Math.sqrt(variance) || 1;
  return { mean, std };
}

/**
 * Normalize value to ~0-100 scale using 7-day mean/std. Clamp to [0, 100].
 * Formula: 50 + (value - mean) / std * 15 (so roughly 50 ± a few stds maps to 0-100).
 * @param {number} value
 * @param {{ mean: number, std: number }} stats
 * @returns {number}
 */
function normalizeWithStats(value, stats) {
  const z = stats.std > 0 ? (value - stats.mean) / stats.std : 0;
  const score = 50 + z * 15;
  return Math.max(0, Math.min(100, score));
}

// --- 1) Daily Productivity Score ---

const PRODUCTIVITY_WEIGHTS = {
  completed: 0.35,
  onTime: 0.25,
  speed: 0.2,
  focus: 0.2,
};

/**
 * Compute daily productivity score (0-100) and component sub-scores.
 * Uses rolling 7-day stats for normalization when available.
 *
 * @param {Object} params
 * @param {string} params.dateStr - "YYYY-MM-DD"
 * @param {Array<{ completedAt: Date|null, dueDate: Date|null, startedAt: Date|null, timeLogs: Array<{ hoursLogged: number }> }>} params.tasks - today's focus tasks
 * @param {number[]} params.completedStatusIds - not used for "completed on day" (we use completedAt)
 * @param {Array<{ date: string, tasks: Array<{ completedAt: Date|null, dueDate: Date|null, startedAt: Date|null, timeLogs: Array<{ hoursLogged: number }> }> }>} [params.last7Days] - for normalization
 * @returns {{ score: number, components: { completed: number, onTime: number, speed: number, focus: number }, raw: { tasksCompletedCount: number, onTimeCompletionRatio: number, averageCompletionSpeedHours: number|null, focusTimeMinutes: number } }}
 */
function computeDailyProductivityScore({ dateStr, tasks, completedStatusIds, last7Days = [] }) {
  const completedOnDay = completedOnDayAndOnTime(tasks, dateStr);
  const tasksCompletedCount = completedOnDay.count;
  const onTimeDenom = completedOnDay.withDueCount || 1;
  const onTimeCompletionRatio = completedOnDay.onTimeCount / onTimeDenom;
  const avgSpeedHours = getAverageCompletionSpeedHours(tasks, dateStr);
  const focusHours = sumFocusHoursFromTasks(tasks);
  const focusTimeMinutes = focusHours * 60;

  const last7Completed = last7Days.map((d) =>
    completedOnDayAndOnTime(d.tasks, d.date).count
  );
  const last7OnTimeRatios = last7Days.map((d) => {
    const c = completedOnDayAndOnTime(d.tasks, d.date);
    return c.withDueCount > 0 ? c.onTimeCount / c.withDueCount : 0;
  });
  const last7Speed = last7Days.map((d) => getAverageCompletionSpeedHours(d.tasks, d.date)).filter((v) => v != null);
  const last7Focus = last7Days.map((d) => sumFocusHoursFromTasks(d.tasks) * 60);

  const statsCompleted = rollingMeanAndStd(last7Completed);
  const statsOnTime = rollingMeanAndStd(last7OnTimeRatios);
  const statsSpeed = rollingMeanAndStd(last7Speed);
  const statsFocus = rollingMeanAndStd(last7Focus);

  const raw = {
    tasksCompletedCount,
    onTimeCompletionRatio,
    averageCompletionSpeedHours: avgSpeedHours ?? null,
    focusTimeMinutes,
  };

  const completedNorm = normalizeWithStats(tasksCompletedCount, statsCompleted);
  const onTimeNorm = normalizeWithStats(onTimeCompletionRatio * 100, { mean: statsOnTime.mean * 100, std: statsOnTime.std * 100 || 1 });
  const speedHours = avgSpeedHours != null ? avgSpeedHours : (statsSpeed.mean || 0);
  const speedNorm = 100 - normalizeWithStats(speedHours, statsSpeed);
  const focusNorm = normalizeWithStats(focusTimeMinutes, statsFocus);

  const score =
    completedNorm * PRODUCTIVITY_WEIGHTS.completed +
    onTimeNorm * PRODUCTIVITY_WEIGHTS.onTime +
    Math.max(0, speedNorm) * PRODUCTIVITY_WEIGHTS.speed +
    focusNorm * PRODUCTIVITY_WEIGHTS.focus;
  const clamped = Math.max(0, Math.min(100, score));

  return {
    score: Math.round(clamped * 10) / 10,
    components: {
      completed: Math.round(completedNorm * 10) / 10,
      onTime: Math.round(onTimeNorm * 10) / 10,
      speed: Math.round(Math.max(0, speedNorm) * 10) / 10,
      focus: Math.round(focusNorm * 10) / 10,
    },
    raw,
  };
}

// --- 2) Planned vs Executed ---

/**
 * @param {Object} params
 * @param {string} params.dateStr
 * @param {Array<{ plannedDate: Date|null, createdAt: Date|null, completedAt: Date|null }>} params.tasks
 * @param {number} params.carryOverCount
 * @returns {{ plannedTodayCount: number, executedTodayCount: number, executionRatio: number, unplannedWorkRatio: number, carryOverCount: number, createdTodayCount: number }}
 */
function computePlannedVsExecuted({ dateStr, tasks, carryOverCount }) {
  const { start, end } = (() => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return {
      start: new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)),
      end: new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)),
    };
  })();

  const plannedTodayCount = tasks.filter(
    (t) => t.plannedDate && t.plannedDate >= start && t.plannedDate <= end
  ).length;

  const executedTodayCount = tasks.filter(
    (t) => t.completedAt && t.completedAt >= start && t.completedAt <= end
  ).length;

  const createdTodayCount = tasks.filter(
    (t) => t.createdAt && t.createdAt >= start && t.createdAt <= end
  ).length;

  const executionRatio =
    plannedTodayCount > 0 ? executedTodayCount / plannedTodayCount : 0;
  const totalWorkedToday = executedTodayCount;
  const unplannedWorkRatio =
    totalWorkedToday > 0 ? createdTodayCount / totalWorkedToday : 0;

  return {
    plannedTodayCount,
    executedTodayCount,
    executionRatio: Math.round(executionRatio * 1000) / 1000,
    unplannedWorkRatio: Math.round(unplannedWorkRatio * 1000) / 1000,
    carryOverCount,
    createdTodayCount,
  };
}

// --- 3) Focus Efficiency ---

// TODO: Task.reopenedCount is not in schema. Use 0 until added or derived from ActivityLog (e.g. status change back to non-complete).
// TODO: PAUSE/RESUME cycles require TaskLog with eventType (START, PAUSE, RESUME, COMPLETE). Not in schema; use 0 for interruptionsPerTask until available.

/**
 * Context switching: tasks started today but not completed today / tasks started today.
 * @param {Array<{ startedAt: Date|null, completedAt: Date|null }>} tasks
 * @param {string} dateStr
 */
function contextSwitchingRate(tasks, dateStr) {
  const started = tasks.filter((t) => t.startedAt && isSameDay(t.startedAt, dateStr));
  const startedNotCompleted = started.filter(
    (t) => !t.completedAt || !isSameDay(t.completedAt, dateStr)
  );
  const rate = started.length > 0 ? startedNotCompleted.length / started.length : 0;
  return { rate, tasksStartedTodayCount: started.length, tasksStartedNotCompleted: startedNotCompleted.length };
}

/**
 * Reopened: no reopenedCount on Task; return 0 and document.
 * @param {Array<{ id: number }>} tasks
 * @param {string} dateStr
 * @param {number} completedTodayCount
 */
function reopenedMetrics(tasks, dateStr, completedTodayCount) {
  // TODO: Task.reopenedCount or ActivityLog-based reopen count
  const reopenedTodayCount = 0;
  const reopenedRate = completedTodayCount > 0 ? reopenedTodayCount / completedTodayCount : 0;
  return { reopenedTodayCount, reopenedRate };
}

/**
 * Per user: distinct projects worked on today. Overall: avg projects per user.
 * @param {Array<{ projectId: number, assigneeIds: number[], timeLogs: Array<{ userId: number }> }>} tasks
 * @param {string} dateStr
 */
function multiProjectSwitching(tasks, dateStr) {
  const userProjects = new Map();
  for (const t of tasks) {
    const users = new Set([
      ...(t.assigneeIds || []),
      ...(t.timeLogs || []).map((l) => l.userId),
    ]);
    for (const uid of users) {
      if (!userProjects.has(uid)) userProjects.set(uid, new Set());
      userProjects.get(uid).add(t.projectId);
    }
  }
  const projectsPerUser = [...userProjects.values()].map((s) => s.size);
  const avgProjectsPerUser =
    projectsPerUser.length > 0
      ? projectsPerUser.reduce((a, b) => a + b, 0) / projectsPerUser.length
      : 0;
  return {
    perUser: Object.fromEntries([...userProjects.entries()].map(([k, v]) => [String(k), v.size])),
    avgProjectsPerUser: Math.round(avgProjectsPerUser * 100) / 100,
  };
}

/**
 * Focus efficiency score (0-100): lower context switching, fewer interruptions, fewer reopens = better.
 * Normalize with 7-day stats when provided.
 *
 * @param {Object} params
 * @param {string} params.dateStr
 * @param {Array<{ startedAt: Date|null, completedAt: Date|null, projectId: number, assigneeIds: number[], timeLogs: Array<{ userId: number }> }>} params.tasks
 * @param {number} params.completedTodayCount
 * @param {Array<{ date: string, tasks: Array<{ startedAt: Date|null, completedAt: Date|null }> }>} [params.last7Days]
 * @returns {{ focusEfficiencyScore: number, contextSwitchingRate: number, interruptionsPerTask: number, reopenedTodayCount: number, reopenedRate: number, multiProjectSwitching: { perUser: Record<string, number>, avgProjectsPerUser: number } }}
 */
function computeFocusEfficiency({ dateStr, tasks, completedTodayCount, last7Days = [] }) {
  const ctx = contextSwitchingRate(tasks, dateStr);
  const interruptionsPerTask = 0;
  const reopened = reopenedMetrics(tasks, dateStr, completedTodayCount);
  const multiProject = multiProjectSwitching(tasks, dateStr);

  const last7CtxRates = last7Days.map((d) => {
    const r = contextSwitchingRate(d.tasks, d.date);
    return r.tasksStartedTodayCount > 0 ? r.rate : 0;
  });
  const last7AvgProjects = last7Days.map((d) => multiProjectSwitching(d.tasks, d.date).avgProjectsPerUser);
  const statsCtx = rollingMeanAndStd(last7CtxRates);
  const statsProjects = rollingMeanAndStd(last7AvgProjects);

  const ctxScore = 100 - normalizeWithStats(ctx.rate * 100, { mean: statsCtx.mean * 100, std: statsCtx.std * 100 || 1 });
  const projectScore = 100 - Math.min(100, multiProject.avgProjectsPerUser * 25);
  const focusEfficiencyScore = Math.max(
    0,
    Math.min(100, (ctxScore * 0.6 + projectScore * 0.4))
  );

  return {
    focusEfficiencyScore: Math.round(focusEfficiencyScore * 10) / 10,
    contextSwitchingRate: Math.round(ctx.rate * 1000) / 1000,
    tasksStartedTodayCount: ctx.tasksStartedTodayCount,
    tasksStartedNotCompleted: ctx.tasksStartedNotCompleted,
    interruptionsPerTask,
    reopenedTodayCount: reopened.reopenedTodayCount,
    reopenedRate: Math.round(reopened.reopenedRate * 1000) / 1000,
    multiProjectSwitching: multiProject,
  };
}

// --- 4) Comparisons ---

/**
 * @param {Object} current - summary KPIs for selected date
 * @param {Object} yesterday - summary KPIs for yesterday
 * @param {Object} weekAvg - summary KPIs as 7-day average (same shape as current)
 * @returns {{ yesterday: { productivityScore: { delta: number, percentChange: number }, executionRatio: { delta: number, percentChange: number }, focusEfficiencyScore: { delta: number, percentChange: number } }, weekAvg: { productivityScore: { delta: number, percentChange: number }, executionRatio: { delta: number, percentChange: number }, focusEfficiencyScore: { delta: number, percentChange: number } } }}
 */
function computeComparisons(current, yesterday, weekAvg) {
  function deltaAndPct(now, prev) {
    const delta = typeof now === "number" && typeof prev === "number" ? now - prev : 0;
    const percentChange = prev !== 0 ? (delta / prev) * 100 : (now !== 0 ? 100 : 0);
    return { delta: Math.round(delta * 100) / 100, percentChange: Math.round(percentChange * 100) / 100 };
  }
  return {
    yesterday: {
      productivityScore: deltaAndPct(current.productivityScore, yesterday.productivityScore),
      executionRatio: deltaAndPct(current.executionRatio, yesterday.executionRatio),
      focusEfficiencyScore: deltaAndPct(current.focusEfficiencyScore, yesterday.focusEfficiencyScore),
    },
    weekAvg: {
      productivityScore: deltaAndPct(current.productivityScore, weekAvg.productivityScore),
      executionRatio: deltaAndPct(current.executionRatio, weekAvg.executionRatio),
      focusEfficiencyScore: deltaAndPct(current.focusEfficiencyScore, weekAvg.focusEfficiencyScore),
    },
  };
}

// --- Breakdowns (by user, by project) ---

/**
 * @param {Array<{ projectId: number, assigneeIds: number[], completedAt: Date|null, timeLogs: Array<{ userId: number, hoursLogged: number }> }>} tasks
 * @param {string} dateStr
 * @param {Map<number, string>} projectNames
 * @param {Map<number, string>} userNames
 */
function buildBreakdowns(tasks, dateStr, projectNames, userNames) {
  const { start, end } = (() => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return {
      start: new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)),
      end: new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)),
    };
  })();

  const byProject = new Map();
  const byUser = new Map();

  for (const t of tasks) {
    const projId = t.projectId;
    if (!byProject.has(projId)) {
      byProject.set(projId, {
        projectId: projId,
        projectName: projectNames.get(projId) ?? "",
        plannedCount: 0,
        executedCount: 0,
        focusMinutes: 0,
      });
    }
    const p = byProject.get(projId);
    if (t.plannedDate && t.plannedDate >= start && t.plannedDate <= end) p.plannedCount++;
    if (t.completedAt && t.completedAt >= start && t.completedAt <= end) p.executedCount++;
    const taskFocus = (t.timeLogs || []).reduce((s, l) => s + l.hoursLogged * 60, 0);
    p.focusMinutes += taskFocus;

    const userIds = new Set([...(t.assigneeIds || []), ...(t.timeLogs || []).map((l) => l.userId)]);
    for (const uid of userIds) {
      if (!byUser.has(uid)) {
        byUser.set(uid, {
          userId: uid,
          userName: userNames.get(uid) ?? "",
          plannedCount: 0,
          executedCount: 0,
          focusMinutes: 0,
        });
      }
      const u = byUser.get(uid);
      if (t.plannedDate && t.plannedDate >= start && t.plannedDate <= end) u.plannedCount++;
      if (t.completedAt && t.completedAt >= start && t.completedAt <= end) u.executedCount++;
      const userLogs = (t.timeLogs || []).filter((l) => l.userId === uid);
      u.focusMinutes += userLogs.reduce((s, l) => s + l.hoursLogged * 60, 0);
    }
  }

  return {
    byProject: [...byProject.values()].map((p) => ({
      ...p,
      focusMinutes: Math.round(p.focusMinutes * 10) / 10,
    })),
    byUser: [...byUser.values()].map((u) => ({
      ...u,
      focusMinutes: Math.round(u.focusMinutes * 10) / 10,
    })),
  };
}

module.exports = {
  computeDailyProductivityScore,
  computePlannedVsExecuted,
  computeFocusEfficiency,
  computeComparisons,
  buildBreakdowns,
  completedOnDayAndOnTime,
  sumFocusHoursFromTasks,
  getAverageCompletionSpeedHours,
  rollingMeanAndStd,
  normalizeWithStats,
  contextSwitchingRate,
  reopenedMetrics,
  multiProjectSwitching,
};
