"use strict";

const { RATING_BANDS } = require("../reports/staffPerformanceReportTypes");
const { REVIEW_SCORE_WEIGHTS } = require("./performanceCalculationTypes");

function clampScore(n) {
  if (n == null || Number.isNaN(Number(n))) return 0;
  return Math.max(0, Math.min(100, Math.round(Number(n))));
}

function ratingFromScore(score) {
  const band = RATING_BANDS.find((b) => score >= b.min);
  return band ? band.rating : "Weak";
}

function computeRegularityScore(activeDays, expectedWorkingDays) {
  if (!expectedWorkingDays || expectedWorkingDays <= 0) return 0;
  return clampScore((activeDays / expectedWorkingDays) * 100);
}

/**
 * @param {object} scores
 * @param {number} scores.regularityScore
 * @param {number} scores.qualityScore
 * @param {number} scores.speedScore
 * @param {number} scores.communicationScore
 * @param {number} scores.updateQualityScore
 * @param {number} scores.complexityScore
 */
function computeFinalScore(scores) {
  let total = 0;
  for (const [key, weight] of Object.entries(REVIEW_SCORE_WEIGHTS)) {
    total += clampScore(scores[key]) * weight;
  }
  return clampScore(total);
}

module.exports = {
  clampScore,
  ratingFromScore,
  computeRegularityScore,
  computeFinalScore,
};
