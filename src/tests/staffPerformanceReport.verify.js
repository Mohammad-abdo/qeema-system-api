"use strict";

const { buildStaffPerformanceReport } = require("../services/reports/staffPerformanceReportService");

async function main() {
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const report = await buildStaffPerformanceReport({ startDate: start, endDate: end });

  console.log("Period:", report.period);
  console.log("Team summary:", report.teamSummary);
  console.log("User count:", report.users.length);
  report.users.slice(0, 8).forEach((u) => {
    console.log(
      `  ${u.username}: score=${u.finalScore} rating=${u.rating} activeDays=${u.activeDays} completed=${u.breakdown?.tasksCompleted ?? 0}`
    );
  });
  console.log("Definitions:", Object.keys(report.definitions || {}).join(", "));

  const hasValidScores = report.users.every(
    (u) => u.finalScore >= 0 && u.finalScore <= 100 && u.metrics && u.rating
  );
  if (!hasValidScores && report.users.length > 0) {
    throw new Error("Invalid score data in report");
  }
  console.log("\nVerification passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
