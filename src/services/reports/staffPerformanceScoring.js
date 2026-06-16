"use strict";

const { getCairoDayRangeUtc } = require("../../lib/cairoDateUtils");
const {
  DIMENSION_WEIGHTS,
  DIMENSION_LABELS,
  RATING_BANDS,
  OPEN_OVERLOAD_THRESHOLD,
} = require("./staffPerformanceReportTypes");

function clampScore(n) {
  if (n == null || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toDateStr(d) {
  if (!d) return null;
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
}

function isInPeriod(d, periodStart, periodEnd) {
  if (!d) return false;
  const dt = new Date(d);
  return dt >= periodStart && dt <= periodEnd;
}

function isCompleted(task) {
  return task.taskStatus?.isFinal === true || task.completedAt != null;
}

function isBlocked(task) {
  return (
    task.taskStatus?.isBlocking === true ||
    (task.taskStatus?.name || "").toLowerCase().includes("block")
  );
}

function priorityWeight(priority) {
  const p = String(priority || "normal").toLowerCase();
  if (p === "urgent") return 3;
  if (p === "high") return 2;
  return 1;
}

function ratingFromScore(score) {
  const band = RATING_BANDS.find((b) => score >= b.min);
  return band ? band.rating : "Weak";
}

function buildStrengthsAndImprovements(metrics) {
  const entries = Object.entries(metrics)
    .filter(([key]) => DIMENSION_WEIGHTS[key] != null)
    .map(([key, value]) => ({ key, label: DIMENSION_LABELS[key], value: clampScore(value) }))
    .sort((a, b) => b.value - a.value);

  const strengths = entries
    .slice(0, 2)
    .filter((e) => e.value >= 60)
    .map((e) => `Strong ${e.label.toLowerCase()} (${e.value})`);

  const improvements = entries
    .slice(-2)
    .filter((e) => e.value < 75)
    .map((e) => `Improve ${e.label.toLowerCase()} (score ${e.value})`);

  if (strengths.length === 0 && entries[0]) {
    strengths.push(`Top area: ${entries[0].label} (${entries[0].value})`);
  }
  if (improvements.length === 0 && entries[entries.length - 1]) {
    const worst = entries[entries.length - 1];
    if (worst.value < 80) {
      improvements.push(`Focus on ${worst.label.toLowerCase()} (score ${worst.value})`);
    }
  }

  return { strengths, improvementPoints: improvements };
}

function computeWeightedFinalScore(metrics) {
  let total = 0;
  for (const [key, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    total += (clampScore(metrics[key]) * weight) / 100;
  }
  return clampScore(total);
}

/**
 * @param {object} raw - grouped user data from prepareUserRawData
 * @param {object} teamContext - { speedMedians, maxCommunication }
 */
function scoreUserPerformance(raw, teamContext) {
  const {
    user,
    tasks,
    shifts,
    timeLogs,
    comments,
    mentions,
    activities,
    periodStart,
    periodEnd,
    periodDays,
  } = raw;

  const periodDayCount = Math.max(1, periodDays.length);
  const completedInPeriod = tasks.filter(
    (t) => t.completedAt && isInPeriod(t.completedAt, periodStart, periodEnd)
  );
  const openTasks = tasks.filter((t) => !isCompleted(t));
  const completedTotal = completedInPeriod.length;
  const openTotal = openTasks.length;
  const overdueOpen = openTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < periodEnd
  ).length;

  const withDue = completedInPeriod.filter((t) => t.dueDate);
  const onTimeCount = withDue.filter(
    (t) => t.completedAt && new Date(t.completedAt) <= new Date(t.dueDate)
  ).length;
  const completionRate = completedTotal + openTotal > 0
    ? completedTotal / (completedTotal + openTotal)
    : 0;
  const onTimeRate = withDue.length > 0 ? onTimeCount / withDue.length : completionRate;
  const taskDelivery = clampScore(completionRate * 60 + onTimeRate * 40);

  const speedSamples = completedInPeriod
    .filter((t) => t.startedAt && t.completedAt)
    .map((t) => (new Date(t.completedAt) - new Date(t.startedAt)) / (1000 * 60 * 60));
  const avgSpeed = speedSamples.length
    ? speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length
    : null;
  const teamMedian = teamContext.speedMedians[user.id];
  let speed = 50;
  if (avgSpeed != null && teamMedian != null && teamMedian > 0) {
    const ratio = teamMedian / Math.max(avgSpeed, 0.25);
    speed = clampScore(Math.min(100, ratio * 50 + 25));
  } else if (avgSpeed != null) {
    speed = clampScore(100 - Math.min(avgSpeed * 5, 80));
  }

  const activeDaySet = new Set();
  shifts.forEach((s) => activeDaySet.add(s.shiftDate));
  timeLogs.forEach((l) => {
    const ds = toDateStr(l.logDate);
    if (ds) activeDaySet.add(ds);
  });
  completedInPeriod.forEach((t) => {
    const ds = toDateStr(t.completedAt);
    if (ds) activeDaySet.add(ds);
  });
  tasks.forEach((t) => {
    if (t.plannedDate && isInPeriod(t.plannedDate, periodStart, periodEnd)) {
      for (const day of periodDays) {
        const { start, end } = getCairoDayRangeUtc(day);
        if (t.plannedDate >= start && t.plannedDate <= end) activeDaySet.add(day);
      }
    }
  });
  const activeDays = activeDaySet.size;
  const activeDaysScore = clampScore((activeDays / periodDayCount) * 100);

  const updateDaySet = new Set(activeDaySet);
  comments.forEach((c) => {
    const ds = toDateStr(c.createdAt);
    if (ds) updateDaySet.add(ds);
  });
  shifts.filter((s) => s.notes && String(s.notes).trim()).forEach((s) => updateDaySet.add(s.shiftDate));
  const dailyUpdates = clampScore((updateDaySet.size / periodDayCount) * 100);

  const projectMap = new Map();
  tasks.forEach((t) => {
    if (!t.projectId) return;
    const prev = projectMap.get(t.projectId) || {
      id: t.projectId,
      name: t.project?.name || `Project ${t.projectId}`,
      taskCount: 0,
    };
    prev.taskCount += 1;
    projectMap.set(t.projectId, prev);
  });
  const projectsWorked = [...projectMap.values()].sort((a, b) => b.taskCount - a.taskCount);
  const distinctProjects = projectsWorked.length;
  const urgentHigh = tasks.filter((t) =>
    ["urgent", "high"].includes(String(t.priority || "").toLowerCase())
  ).length;
  let workloadComplexity = clampScore(
    Math.min(distinctProjects * 12, 40) +
      Math.min(urgentHigh * 8, 40) +
      Math.min(completedTotal * 2, 20)
  );
  if (openTotal > OPEN_OVERLOAD_THRESHOLD) {
    workloadComplexity = clampScore(workloadComplexity - (openTotal - OPEN_OVERLOAD_THRESHOLD) * 2);
  }

  const blockedCount = tasks.filter(isBlocked).length;
  const avgRollover =
    tasks.length > 0
      ? tasks.reduce((s, t) => s + (t.rolloverCount || 0), 0) / tasks.length
      : 0;
  const slaRate = withDue.length > 0 ? onTimeCount / withDue.length : 1;
  const blockRate = tasks.length > 0 ? blockedCount / tasks.length : 0;
  const workQuality = clampScore(
    slaRate * 50 + (1 - Math.min(blockRate, 1)) * 30 + (1 - Math.min(avgRollover / 5, 1)) * 20
  );

  const commCount = comments.length + mentions.length + activities.length;
  const maxComm = Math.max(teamContext.maxCommunication, 1);
  const communication = clampScore((commCount / maxComm) * 100);

  const noteQuality = shifts.filter((s) => s.notes && String(s.notes).trim().length >= 20).length;
  const avgCommentLen =
    comments.length > 0
      ? comments.reduce((s, c) => s + String(c.content || "").length, 0) / comments.length
      : 0;
  const activityQuality = activities.filter((a) => (a.actionSummary || "").length >= 10).length;
  const updateQuality = clampScore(
    Math.min(noteQuality * 15, 45) +
      Math.min(avgCommentLen / 2, 35) +
      Math.min(activityQuality * 5, 20)
  );

  let plannedDays = 0;
  let executedOnPlannedDays = 0;
  for (const day of periodDays) {
    const { start, end } = getCairoDayRangeUtc(day);
    const plannedThatDay = tasks.filter(
      (t) => t.plannedDate && t.plannedDate >= start && t.plannedDate <= end
    );
    if (plannedThatDay.length === 0) continue;
    plannedDays += 1;
    const executed = plannedThatDay.filter(
      (t) =>
        t.completedAt &&
        t.completedAt >= start &&
        t.completedAt <= end &&
        isCompleted(t)
    ).length;
    if (executed > 0) executedOnPlannedDays += 1;
  }
  const focusConsistency =
    plannedDays > 0 ? clampScore((executedOnPlannedDays / plannedDays) * 100) : clampScore(completionRate * 100);

  const metrics = {
    taskDelivery,
    speed,
    activeDays: activeDaysScore,
    dailyUpdates,
    workloadComplexity,
    workQuality,
    communication,
    updateQuality,
    focusConsistency,
  };

  const finalScore = computeWeightedFinalScore(metrics);
  const rating = ratingFromScore(finalScore);
  const { strengths, improvementPoints } = buildStrengthsAndImprovements(metrics);

  return {
    userId: user.id,
    username: user.username,
    email: user.email,
    team: user.team ? { id: user.team.id, name: user.team.name } : null,
    projectsWorked,
    activeDays,
    metrics,
    finalScore,
    rating,
    strengths,
    improvementPoints,
    breakdown: {
      tasksCompleted: completedTotal,
      tasksOpen: openTotal,
      tasksOverdue: overdueOpen,
      commentsCount: comments.length,
      mentionsCount: mentions.length,
      activitiesCount: activities.length,
      shiftsCount: shifts.length,
      timeLogHours: Math.round(timeLogs.reduce((s, l) => s + (l.hoursLogged || 0), 0) * 10) / 10,
      distinctProjects,
      avgCompletionSpeedHours: avgSpeed != null ? Math.round(avgSpeed * 10) / 10 : null,
    },
  };
}

/**
 * @param {import('./staffPerformanceReportData').fetchStaffPerformanceData extends Function ? Awaited<ReturnType<typeof fetchStaffPerformanceData>> : never} data
 */
function scoreAllUsers(data) {
  const { users, tasks, shifts, timeLogs, comments, mentions, activities, periodStart, periodEnd, periodDays } = data;

  const tasksByUser = new Map();
  users.forEach((u) => tasksByUser.set(u.id, []));
  tasks.forEach((t) => {
    (t.assignees || []).forEach((a) => {
      if (tasksByUser.has(a.id)) tasksByUser.get(a.id).push(t);
    });
  });

  const speedMedians = {};
  const speedByUser = {};
  users.forEach((u) => {
    const userTasks = tasksByUser.get(u.id) || [];
    const samples = userTasks
      .filter((t) => t.completedAt && t.startedAt && isInPeriod(t.completedAt, periodStart, periodEnd))
      .map((t) => (new Date(t.completedAt) - new Date(t.startedAt)) / (1000 * 60 * 60));
    speedByUser[u.id] = samples;
    if (samples.length > 0) {
      const sorted = [...samples].sort((a, b) => a - b);
      speedMedians[u.id] = sorted[Math.floor(sorted.length / 2)];
    }
  });

  const allSpeeds = Object.values(speedByUser).flat();
  const globalMedian =
    allSpeeds.length > 0
      ? [...allSpeeds].sort((a, b) => a - b)[Math.floor(allSpeeds.length / 2)]
      : null;
  users.forEach((u) => {
    if (speedMedians[u.id] == null && globalMedian != null) speedMedians[u.id] = globalMedian;
  });

  let maxCommunication = 0;
  users.forEach((u) => {
    const c =
      comments.filter((x) => x.userId === u.id).length +
      mentions.filter((x) => x.userId === u.id).length +
      activities.filter((x) => x.performedById === u.id).length;
    maxCommunication = Math.max(maxCommunication, c);
  });

  const teamContext = { speedMedians, maxCommunication };

  const results = users.map((user) =>
    scoreUserPerformance(
      {
        user,
        tasks: tasksByUser.get(user.id) || [],
        shifts: shifts.filter((s) => s.userId === user.id),
        timeLogs: timeLogs.filter((l) => l.userId === user.id),
        comments: comments.filter((c) => c.userId === user.id),
        mentions: mentions.filter((m) => m.userId === user.id),
        activities: activities.filter((a) => a.performedById === user.id),
        periodStart,
        periodEnd,
        periodDays,
      },
      teamContext
    )
  );

  return results.sort((a, b) => b.finalScore - a.finalScore);
}

function buildTeamSummary(users) {
  if (users.length === 0) {
    return { averageScore: 0, ratingCounts: {}, userCount: 0 };
  }
  const ratingCounts = {};
  RATING_BANDS.forEach((b) => {
    ratingCounts[b.rating] = 0;
  });
  let sum = 0;
  users.forEach((u) => {
    sum += u.finalScore;
    ratingCounts[u.rating] = (ratingCounts[u.rating] || 0) + 1;
  });
  return {
    averageScore: Math.round(sum / users.length),
    ratingCounts,
    userCount: users.length,
  };
}

module.exports = {
  clampScore,
  ratingFromScore,
  scoreUserPerformance,
  scoreAllUsers,
  buildTeamSummary,
  computeWeightedFinalScore,
};
