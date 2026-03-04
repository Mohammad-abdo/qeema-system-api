"use strict";

const {
  fetchTodaysFocusTasksForDate,
  fetchTodaysFocusTasksForYesterday,
  fetchLast7DaysData,
  computeCarryOverCount,
  fetchProjectNames,
  fetchUserNames,
} = require("./todaysFocusReportData");
const { getYesterday } = require("./dateUtils");
const {
  computeDailyProductivityScore,
  computePlannedVsExecuted,
  computeFocusEfficiency,
  computeComparisons,
  buildBreakdowns,
} = require("./todaysFocusReportKpis");
const { TODAYS_FOCUS_DEFINITION } = require("./todaysFocusReportTypes");

/**
 * Build full Analytical Today's Focus Report for a given date.
 * @param {number} userId - for project visibility
 * @param {string} dateStr - "YYYY-MM-DD"
 * @returns {Promise<{ date: string, summary: Object, comparisons: Object, breakdowns: Object, definitions: Object }>}
 */
async function buildTodaysFocusAnalyticalReport(userId, dateStr) {
  const [todayData, yesterdayData, last7Days] = await Promise.all([
    fetchTodaysFocusTasksForDate(userId, dateStr),
    fetchTodaysFocusTasksForYesterday(userId, dateStr),
    fetchLast7DaysData(userId, dateStr),
  ]);

  const carryOverCount = computeCarryOverCount(dateStr, todayData, yesterdayData);

  const productivity = computeDailyProductivityScore({
    dateStr,
    tasks: todayData.tasks,
    completedStatusIds: todayData.completedStatusIds,
    last7Days,
  });

  const plannedVsExecuted = computePlannedVsExecuted({
    dateStr,
    tasks: todayData.tasks,
    carryOverCount,
  });

  const completedTodayCount = plannedVsExecuted.executedTodayCount;
  const focusEfficiency = computeFocusEfficiency({
    dateStr,
    tasks: todayData.tasks,
    completedTodayCount,
    last7Days,
  });

  function completedOnDayCount(tasks, dStr) {
    const [y, m, d] = dStr.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
    return tasks.filter((t) => t.completedAt && t.completedAt >= start && t.completedAt <= end).length;
  }

  const yesterdayProductivity = computeDailyProductivityScore({
    dateStr: getYesterday(dateStr),
    tasks: yesterdayData.tasks,
    completedStatusIds: yesterdayData.completedStatusIds,
    last7Days: [],
  });
  const yesterdayPlanned = computePlannedVsExecuted({
    dateStr: getYesterday(dateStr),
    tasks: yesterdayData.tasks,
    carryOverCount: 0,
  });
  const yesterdayFocus = computeFocusEfficiency({
    dateStr: getYesterday(dateStr),
    tasks: yesterdayData.tasks,
    completedTodayCount: yesterdayPlanned.executedTodayCount,
    last7Days: [],
  });

  const weekProductivityScores = last7Days.map((d) =>
    computeDailyProductivityScore({
      dateStr: d.date,
      tasks: d.tasks,
      completedStatusIds: d.completedStatusIds,
      last7Days: [],
    })
  );
  const weekExecutionRatios = last7Days.map((d) =>
    computePlannedVsExecuted({
      dateStr: d.date,
      tasks: d.tasks,
      carryOverCount: 0,
    }).executionRatio
  );
  const weekFocusScores = last7Days.map((d) =>
    computeFocusEfficiency({
      dateStr: d.date,
      tasks: d.tasks,
      completedTodayCount: completedOnDayCount(d.tasks, d.date),
      last7Days: [],
    }).focusEfficiencyScore
  );

  const weekAvgProductivity =
    weekProductivityScores.length > 0
      ? weekProductivityScores.reduce((a, b) => a + b.score, 0) / weekProductivityScores.length
      : 0;
  const weekAvgExecution =
    weekExecutionRatios.length > 0
      ? weekExecutionRatios.reduce((a, b) => a + b, 0) / weekExecutionRatios.length
      : 0;
  const weekAvgFocus =
    weekFocusScores.length > 0
      ? weekFocusScores.reduce((a, b) => a + b, 0) / weekFocusScores.length
      : 0;

  const currentSummary = {
    productivityScore: productivity.score,
    executionRatio: plannedVsExecuted.executionRatio,
    focusEfficiencyScore: focusEfficiency.focusEfficiencyScore,
  };
  const yesterdaySummary = {
    productivityScore: yesterdayProductivity.score,
    executionRatio: yesterdayPlanned.executionRatio,
    focusEfficiencyScore: yesterdayFocus.focusEfficiencyScore,
  };
  const weekAvgSummary = {
    productivityScore: weekAvgProductivity,
    executionRatio: weekAvgExecution,
    focusEfficiencyScore: weekAvgFocus,
  };

  const comparisons = computeComparisons(currentSummary, yesterdaySummary, weekAvgSummary);

  const projectIds = [...new Set(todayData.tasks.map((t) => t.projectId))];
  const userIds = new Set();
  todayData.tasks.forEach((t) => {
    (t.assigneeIds || []).forEach((id) => userIds.add(id));
    (t.timeLogs || []).forEach((l) => userIds.add(l.userId));
  });
  const [projectNames, userNames] = await Promise.all([
    fetchProjectNames(projectIds),
    fetchUserNames([...userIds]),
  ]);

  const breakdowns = buildBreakdowns(
    todayData.tasks,
    dateStr,
    projectNames,
    userNames
  );

  const summary = {
    dailyProductivity: {
      score: productivity.score,
      components: productivity.components,
      raw: productivity.raw,
    },
    plannedVsExecuted: plannedVsExecuted,
    focusEfficiency: {
      focusEfficiencyScore: focusEfficiency.focusEfficiencyScore,
      contextSwitchingRate: focusEfficiency.contextSwitchingRate,
      tasksStartedTodayCount: focusEfficiency.tasksStartedTodayCount,
      tasksStartedNotCompleted: focusEfficiency.tasksStartedNotCompleted,
      interruptionsPerTask: focusEfficiency.interruptionsPerTask,
      reopenedTodayCount: focusEfficiency.reopenedTodayCount,
      reopenedRate: focusEfficiency.reopenedRate,
      multiProjectSwitching: focusEfficiency.multiProjectSwitching,
    },
  };

  const definitions = {
    todaysFocusTasks: TODAYS_FOCUS_DEFINITION,
    onTime: "Completed on or before due date; only tasks with a due date are included in on-time ratio.",
    focusTime: "Sum of time log entries (hours) for the selected date, converted to minutes.",
    carryOver: "Tasks that were planned for the previous day but not completed by end of that day and still appear in today's focus.",
    executionRatio: "Executed today count / planned today count. Executed = tasks completed on the selected date.",
    unplannedWorkRatio: "Tasks created on the selected date / executed today count.",
    contextSwitchingRate: "Tasks started on the selected date but not completed that day, divided by tasks started that day.",
    focusEfficiencyScore: "0-100 score where lower context switching and fewer project switches indicate better focus.",
  };

  // UI hints: KPI cards (summary.dailyProductivity.score, summary.plannedVsExecuted.executionRatio,
  // summary.focusEfficiency.focusEfficiencyScore); trend sparkline using last 7 days (compare
  // summary to weekAvg); tables: breakdowns.byUser, breakdowns.byProject; tooltips from definitions.
  return {
    date: dateStr,
    summary,
    comparisons,
    breakdowns,
    definitions,
  };
}

module.exports = {
  buildTodaysFocusAnalyticalReport,
};
