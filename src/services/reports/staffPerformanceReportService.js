"use strict";

const { fetchStaffPerformanceData } = require("./staffPerformanceReportData");
const { scoreAllUsers, buildTeamSummary } = require("./staffPerformanceScoring");
const { STAFF_PERFORMANCE_DEFINITIONS } = require("./staffPerformanceReportTypes");

/**
 * @param {object} filters
 * @param {string} [filters.startDate]
 * @param {string} [filters.endDate]
 * @param {number|null} [filters.teamId]
 * @param {number[]|null} [filters.userIds]
 * @param {number|null} [filters.userId] - single user drill-down
 */
async function buildStaffPerformanceReport(filters = {}) {
  const data = await fetchStaffPerformanceData({
    startDate: filters.startDate,
    endDate: filters.endDate,
    teamId: filters.teamId,
    userIds: filters.userIds,
  });

  let users = scoreAllUsers(data);

  if (filters.userId != null && !Number.isNaN(Number(filters.userId))) {
    const uid = Number(filters.userId);
    users = users.filter((u) => u.userId === uid);
  }

  return {
    success: true,
    period: {
      startDate: data.startDate,
      endDate: data.endDate,
      dayCount: data.periodDays.length,
    },
    teamSummary: buildTeamSummary(users),
    users,
    definitions: STAFF_PERFORMANCE_DEFINITIONS,
  };
}

module.exports = {
  buildStaffPerformanceReport,
};
