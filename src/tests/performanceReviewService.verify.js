"use strict";

/**
 * Integration smoke: upsertPerformanceReview idempotency.
 * Run after migrate deploy when DB is available.
 * Usage: node src/tests/performanceReviewService.verify.js
 */

const { prisma } = require("../lib/prisma");
const { upsertPerformanceReview } = require("../services/performance/performanceReviewService");

async function main() {
  const admin = await prisma.user.findFirst({ where: { isActive: true } });
  if (!admin) {
    console.log("SKIP: no active users");
    return;
  }

  const period = await prisma.performancePeriod.create({
    data: {
      title: "Verify calc period",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-15"),
      status: "draft",
      createdById: admin.id,
    },
  });

  const first = await upsertPerformanceReview(period.id, admin.id, {
    qualityScore: 80,
    speedScore: 75,
    communicationScore: 70,
    updateQualityScore: 65,
    complexityScore: 60,
  });

  const second = await upsertPerformanceReview(period.id, admin.id, {
    qualityScore: 85,
  });

  if (first.id !== second.id) {
    throw new Error(`Idempotency failed: ${first.id} vs ${second.id}`);
  }
  if (second.qualityScore !== 85) {
    throw new Error(`Manual score not updated: ${second.qualityScore}`);
  }
  if (second.finalScore <= 0 || second.rating == null) {
    throw new Error("Final score/rating not computed");
  }

  await prisma.performancePeriod.delete({ where: { id: period.id } });

  const orphaned = await prisma.performanceReview.findUnique({ where: { id: second.id } });
  if (orphaned) {
    throw new Error("Review should cascade delete with period");
  }

  console.log("OK upsert idempotent, finalScore=", second.finalScore, "rating=", second.rating);
  console.log("\nPerformance review service verification passed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
