"use strict";

const assert = require("assert");
const {
  clampScore,
  ratingFromScore,
  scoreUserPerformance,
  computeWeightedFinalScore,
  buildTeamSummary,
} = require("../services/reports/staffPerformanceScoring");

function run() {
  let failed = 0;

  try {
    assert.strictEqual(clampScore(150), 100);
    assert.strictEqual(clampScore(-5), 0);
    assert.strictEqual(ratingFromScore(92), "Excellent");
    assert.strictEqual(ratingFromScore(85), "Very Good");
    assert.strictEqual(ratingFromScore(75), "Good");
    assert.strictEqual(ratingFromScore(65), "Acceptable");
    assert.strictEqual(ratingFromScore(40), "Weak");
    console.log("OK rating and clamp");
  } catch (e) {
    failed += 1;
    console.error("FAIL rating/clamp", e.message);
  }

  try {
    const metrics = {
      taskDelivery: 80,
      speed: 70,
      activeDays: 90,
      dailyUpdates: 75,
      workloadComplexity: 65,
      workQuality: 85,
      communication: 60,
      updateQuality: 70,
      focusConsistency: 80,
    };
    const score = computeWeightedFinalScore(metrics);
    assert.ok(score >= 70 && score <= 85, `expected mid-high score, got ${score}`);
    console.log("OK weighted final score:", score);
  } catch (e) {
    failed += 1;
    console.error("FAIL weighted score", e.message);
  }

  try {
    const periodStart = new Date("2026-06-01T00:00:00Z");
    const periodEnd = new Date("2026-06-15T23:59:59Z");
    const periodDays = ["2026-06-01", "2026-06-02", "2026-06-03"];
    const result = scoreUserPerformance(
      {
        user: { id: 1, username: "dev1", email: "d@test.com", team: { id: 1, name: "Team A" } },
        tasks: [
          {
            id: 1,
            projectId: 10,
            priority: "high",
            dueDate: new Date("2026-06-10T00:00:00Z"),
            plannedDate: new Date("2026-06-02T00:00:00Z"),
            startedAt: new Date("2026-06-02T08:00:00Z"),
            completedAt: new Date("2026-06-02T16:00:00Z"),
            rolloverCount: 0,
            taskStatus: { isFinal: true, isBlocking: false, name: "Done" },
            project: { id: 10, name: "Proj" },
            assignees: [{ id: 1 }],
          },
          {
            id: 2,
            projectId: 10,
            priority: "normal",
            dueDate: null,
            plannedDate: null,
            startedAt: null,
            completedAt: null,
            rolloverCount: 0,
            taskStatus: { isFinal: false, isBlocking: false, name: "Open" },
            project: { id: 10, name: "Proj" },
            assignees: [{ id: 1 }],
          },
        ],
        shifts: [{ userId: 1, shiftDate: "2026-06-02", notes: "Good progress today on tasks" }],
        timeLogs: [{ userId: 1, logDate: new Date("2026-06-02T12:00:00Z"), hoursLogged: 4 }],
        comments: [{ userId: 1, content: "Updated the team on blockers", createdAt: new Date("2026-06-02T10:00:00Z") }],
        mentions: [],
        activities: [{ performedById: 1, createdAt: new Date("2026-06-02T09:00:00Z"), actionSummary: "Task completed" }],
        periodStart,
        periodEnd,
        periodDays,
      },
      { speedMedians: { 1: 8 }, maxCommunication: 5 }
    );
    assert.ok(result.finalScore >= 0 && result.finalScore <= 100);
    assert.ok(result.rating);
    assert.ok(result.strengths.length >= 1);
    assert.strictEqual(result.breakdown.tasksCompleted, 1);
    console.log("OK scoreUserPerformance:", result.finalScore, result.rating);
  } catch (e) {
    failed += 1;
    console.error("FAIL scoreUserPerformance", e.message);
  }

  try {
    const summary = buildTeamSummary([
      { finalScore: 80, rating: "Very Good" },
      { finalScore: 90, rating: "Excellent" },
    ]);
    assert.strictEqual(summary.averageScore, 85);
    assert.strictEqual(summary.userCount, 2);
    console.log("OK buildTeamSummary");
  } catch (e) {
    failed += 1;
    console.error("FAIL buildTeamSummary", e.message);
  }

  if (failed > 0) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll staff performance scoring tests passed");
}

run();
