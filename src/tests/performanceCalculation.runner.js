"use strict";

const assert = require("assert");
const {
  clampScore,
  ratingFromScore,
  computeRegularityScore,
  computeFinalScore,
} = require("../services/performance/performanceCalculation");

function run() {
  let failed = 0;

  try {
    assert.strictEqual(clampScore(150), 100);
    assert.strictEqual(clampScore(-5), 0);
    assert.strictEqual(ratingFromScore(90), "Excellent");
    assert.strictEqual(ratingFromScore(89), "Very Good");
    assert.strictEqual(ratingFromScore(60), "Acceptable");
    assert.strictEqual(ratingFromScore(59), "Weak");
    console.log("OK rating and clamp");
  } catch (e) {
    failed += 1;
    console.error("FAIL rating/clamp", e.message);
  }

  try {
    assert.strictEqual(computeRegularityScore(10, 20), 50);
    assert.strictEqual(computeRegularityScore(25, 20), 100);
    assert.strictEqual(computeRegularityScore(5, 0), 0);
    console.log("OK regularity score");
  } catch (e) {
    failed += 1;
    console.error("FAIL regularity", e.message);
  }

  try {
    const scores = {
      regularityScore: 80,
      qualityScore: 90,
      speedScore: 70,
      communicationScore: 60,
      updateQualityScore: 75,
      complexityScore: 65,
    };
    const expected =
      80 * 0.2 + 90 * 0.25 + 70 * 0.2 + 60 * 0.15 + 75 * 0.1 + 65 * 0.1;
    assert.strictEqual(computeFinalScore(scores), clampScore(expected));
    console.log("OK weighted final score:", computeFinalScore(scores));
  } catch (e) {
    failed += 1;
    console.error("FAIL final score", e.message);
  }

  try {
    const all80 = {
      regularityScore: 80,
      qualityScore: 80,
      speedScore: 80,
      communicationScore: 80,
      updateQualityScore: 80,
      complexityScore: 80,
    };
    assert.strictEqual(computeFinalScore(all80), 80);
    assert.strictEqual(ratingFromScore(80), "Very Good");
    console.log("OK uniform score");
  } catch (e) {
    failed += 1;
    console.error("FAIL uniform score", e.message);
  }

  if (failed > 0) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll performance calculation tests passed");
}

run();
