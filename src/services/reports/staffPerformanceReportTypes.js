"use strict";

/** @typedef {"Excellent"|"Very Good"|"Good"|"Acceptable"|"Weak"} PerformanceRating */

const DIMENSION_WEIGHTS = {
  taskDelivery: 20,
  speed: 15,
  activeDays: 10,
  dailyUpdates: 10,
  workloadComplexity: 10,
  workQuality: 10,
  communication: 10,
  updateQuality: 10,
  focusConsistency: 5,
};

const DIMENSION_LABELS = {
  taskDelivery: "Task delivery",
  speed: "Speed",
  activeDays: "Active days",
  dailyUpdates: "Daily updates",
  workloadComplexity: "Workload & complexity",
  workQuality: "Work quality",
  communication: "Communication",
  updateQuality: "Update quality",
  focusConsistency: "Focus consistency",
};

const RATING_BANDS = [
  { min: 90, rating: "Excellent" },
  { min: 80, rating: "Very Good" },
  { min: 70, rating: "Good" },
  { min: 60, rating: "Acceptable" },
  { min: 0, rating: "Weak" },
];

const STAFF_PERFORMANCE_DEFINITIONS = {
  taskDelivery: "Completion rate and on-time delivery for assigned tasks in the period.",
  speed: "Average task completion speed compared to team median (startedAt to completedAt).",
  activeDays: "Days with a work shift, time log, or meaningful task activity vs days in period.",
  dailyUpdates:
    "Proxy v1: days with shift notes, comments, time logs, or focus/planned task activity (no dedicated Daily Update form yet).",
  workloadComplexity: "Open load, priority mix (urgent/high), and distinct projects worked.",
  workQuality: "On-time SLA compliance, low rollover count, and low blocked-task ratio.",
  communication: "Comments, @mentions, and activity log entries vs team peers.",
  updateQuality:
    "Proxy v1: quality of shift notes, comment depth, and activity summaries (no manager review yet).",
  focusConsistency: "Ratio of planned focus tasks executed across the period.",
  finalScore: "Weighted sum of dimension scores (0–100).",
  rating: "Excellent (90+), Very Good (80–89), Good (70–79), Acceptable (60–69), Weak (0–59).",
};

const MAX_PERIOD_DAYS = 90;
const OPEN_OVERLOAD_THRESHOLD = 15;

module.exports = {
  DIMENSION_WEIGHTS,
  DIMENSION_LABELS,
  RATING_BANDS,
  STAFF_PERFORMANCE_DEFINITIONS,
  MAX_PERIOD_DAYS,
  OPEN_OVERLOAD_THRESHOLD,
};
