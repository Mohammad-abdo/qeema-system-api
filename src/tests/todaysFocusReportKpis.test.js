"use strict";

const assert = require("assert");
const {
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
  multiProjectSwitching,
} = require("../services/reports/todaysFocusReportKpis");

const DATE = "2026-02-23";
const start = new Date(DATE + "T10:00:00Z");
const end = new Date(DATE + "T18:00:00Z");

const mockTasks = [
  {
    id: 1,
    projectId: 10,
    plannedDate: start,
    dueDate: end,
    createdAt: new Date(DATE + "T08:00:00Z"),
    startedAt: new Date(DATE + "T09:00:00Z"),
    completedAt: new Date(DATE + "T17:00:00Z"),
    assigneeIds: [100],
    timeLogs: [{ userId: 100, hoursLogged: 2 }],
  },
  {
    id: 2,
    projectId: 10,
    plannedDate: start,
    dueDate: new Date(DATE + "T12:00:00Z"),
    createdAt: new Date(DATE + "T07:00:00Z"),
    startedAt: new Date(DATE + "T11:00:00Z"),
    completedAt: new Date(DATE + "T14:00:00Z"),
    assigneeIds: [100],
    timeLogs: [{ userId: 100, hoursLogged: 1.5 }],
  },
  {
    id: 3,
    projectId: 20,
    plannedDate: null,
    dueDate: null,
    createdAt: new Date(DATE + "T09:00:00Z"),
    startedAt: new Date(DATE + "T13:00:00Z"),
    completedAt: null,
    assigneeIds: [101],
    timeLogs: [{ userId: 101, hoursLogged: 0.5 }],
  },
];

function run() {
  let failed = 0;

  const completed = completedOnDayAndOnTime(mockTasks, DATE);
  assert.strictEqual(completed.count, 2, "completed on day count");
  assert.strictEqual(completed.withDueCount, 2, "with due count");
  assert.strictEqual(completed.onTimeCount, 1, "on time count (task 2 completed after dueDate)");
  console.log("  completedOnDayAndOnTime: ok");

  const focusHours = sumFocusHoursFromTasks(mockTasks);
  assert.ok(Math.abs(focusHours - 4) < 0.01, "sum focus hours");
  console.log("  sumFocusHoursFromTasks: ok");

  const avgSpeed = getAverageCompletionSpeedHours(mockTasks, DATE);
  assert.ok(avgSpeed !== null && avgSpeed > 0, "average completion speed");
  console.log("  getAverageCompletionSpeedHours: ok");

  const stats = rollingMeanAndStd([1, 2, 3, 4, 5]);
  assert.ok(stats.mean === 3 && stats.std > 0, "rolling mean and std");
  console.log("  rollingMeanAndStd: ok");

  const norm = normalizeWithStats(3, stats);
  assert.ok(norm >= 0 && norm <= 100, "normalizeWithStats in range");
  console.log("  normalizeWithStats: ok");

  const productivity = computeDailyProductivityScore({
    dateStr: DATE,
    tasks: mockTasks,
    completedStatusIds: [5],
    last7Days: [],
  });
  assert.ok(typeof productivity.score === "number" && productivity.score >= 0 && productivity.score <= 100, "productivity score in range");
  assert.ok(productivity.raw.tasksCompletedCount === 2, "productivity raw completed count");
  console.log("  computeDailyProductivityScore: ok");

  const pve = computePlannedVsExecuted({
    dateStr: DATE,
    tasks: mockTasks,
    carryOverCount: 1,
  });
  assert.strictEqual(pve.plannedTodayCount, 2, "planned today count");
  assert.strictEqual(pve.executedTodayCount, 2, "executed today count");
  assert.strictEqual(pve.carryOverCount, 1, "carry over count");
  assert.ok(pve.executionRatio >= 0 && pve.executionRatio <= 2, "execution ratio");
  console.log("  computePlannedVsExecuted: ok");

  const focus = computeFocusEfficiency({
    dateStr: DATE,
    tasks: mockTasks,
    completedTodayCount: 2,
    last7Days: [],
  });
  assert.ok(typeof focus.focusEfficiencyScore === "number", "focus efficiency score");
  assert.ok(typeof focus.contextSwitchingRate === "number", "context switching rate");
  assert.ok(focus.multiProjectSwitching.avgProjectsPerUser >= 0, "multi project switching");
  console.log("  computeFocusEfficiency: ok");

  const comparisons = computeComparisons(
    { productivityScore: 70, executionRatio: 0.8, focusEfficiencyScore: 65 },
    { productivityScore: 60, executionRatio: 0.6, focusEfficiencyScore: 60 },
    { productivityScore: 65, executionRatio: 0.7, focusEfficiencyScore: 62 }
  );
  assert.ok(comparisons.yesterday.productivityScore.delta === 10, "yesterday productivity delta");
  assert.ok(comparisons.weekAvg.productivityScore.delta === 5, "week avg productivity delta");
  console.log("  computeComparisons: ok");

  const projectNames = new Map([[10, "P1"], [20, "P2"]]);
  const userNames = new Map([[100, "U1"], [101, "U2"]]);
  const breakdowns = buildBreakdowns(mockTasks, DATE, projectNames, userNames);
  assert.ok(Array.isArray(breakdowns.byProject) && breakdowns.byProject.length >= 1, "breakdowns byProject");
  assert.ok(Array.isArray(breakdowns.byUser) && breakdowns.byUser.length >= 1, "breakdowns byUser");
  console.log("  buildBreakdowns: ok");

  const ctx = contextSwitchingRate(mockTasks, DATE);
  assert.ok(ctx.tasksStartedTodayCount >= 0 && ctx.rate >= 0 && ctx.rate <= 1, "contextSwitchingRate");
  console.log("  contextSwitchingRate: ok");

  const mproj = multiProjectSwitching(mockTasks, DATE);
  assert.ok(typeof mproj.avgProjectsPerUser === "number", "multiProjectSwitching avg");
  console.log("  multiProjectSwitching: ok");

  console.log("\nAll KPI tests passed.");
}

run();
