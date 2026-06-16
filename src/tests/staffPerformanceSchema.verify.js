"use strict";

/**
 * Smoke-test staff performance schema FK chain.
 * Run after: npx prisma migrate deploy
 * Usage: node src/tests/staffPerformanceSchema.verify.js
 */

const { prisma } = require("../lib/prisma");

async function main() {
  const admin = await prisma.user.findFirst({ where: { isActive: true } });
  if (!admin) {
    console.log("SKIP: no active users in database");
    return;
  }

  const project = await prisma.project.findFirst();
  if (!project) {
    console.log("SKIP: no projects in database");
    return;
  }

  const task = await prisma.task.findFirst({ where: { projectId: project.id } });

  const period = await prisma.performancePeriod.create({
    data: {
      title: "Schema verify period",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-15"),
      status: "draft",
      createdById: admin.id,
    },
  });

  const dailyUpdate = await prisma.dailyUpdate.create({
    data: {
      userId: admin.id,
      projectId: project.id,
      taskId: task?.id ?? null,
      updateText: "Verification update text",
      status: "in_progress",
      updateDate: "2026-06-10",
      submittedAt: new Date(),
    },
  });

  const review = await prisma.performanceReview.create({
    data: {
      periodId: period.id,
      userId: admin.id,
      roleSnapshot: admin.role,
      updatesCount: 1,
      projectsCount: 1,
      activeDays: 10,
      expectedWorkingDays: 15,
      regularityScore: 75,
      qualityScore: 80,
      speedScore: 70,
      communicationScore: 65,
      updateQualityScore: 72,
      complexityScore: 68,
      finalScore: 74,
      rating: "Good",
    },
  });

  const feedback = await prisma.performanceFeedback.create({
    data: {
      reviewId: review.id,
      strengths: "Strong delivery",
      improvementPoints: "Improve daily updates",
      createdById: admin.id,
    },
  });

  console.log("OK created period", period.id);
  console.log("OK created dailyUpdate", dailyUpdate.id);
  console.log("OK created review", review.id);
  console.log("OK created feedback", feedback.id);

  await prisma.performancePeriod.delete({ where: { id: period.id } });

  const orphanedReview = await prisma.performanceReview.findUnique({ where: { id: review.id } });
  const orphanedFeedback = await prisma.performanceFeedback.findUnique({ where: { id: feedback.id } });
  const dailyStillExists = await prisma.dailyUpdate.findUnique({ where: { id: dailyUpdate.id } });

  if (orphanedReview || orphanedFeedback) {
    throw new Error("Cascade delete failed: review or feedback still exists after period delete");
  }
  if (!dailyStillExists) {
    throw new Error("dailyUpdate should survive period delete");
  }

  await prisma.dailyUpdate.delete({ where: { id: dailyUpdate.id } });
  console.log("OK cascade delete period -> review -> feedback");
  console.log("\nStaff performance schema verification passed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
