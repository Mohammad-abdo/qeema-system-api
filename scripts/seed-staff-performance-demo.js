"use strict";

/**
 * Optional dev-only seed for Staff Performance demo data.
 *
 * Usage:
 *   npm run seed:staff-performance-demo
 *
 * Safe to re-run: upserts demo users/period/reviews without deleting data.
 * Refuses to run when NODE_ENV=production.
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const {
  DEMO_DEV_PASSWORD,
  DEMO_TEAM,
  DEMO_PERIOD,
  DEMO_PROJECTS,
  getEmployeesWithComputedReviews,
} = require("./demo/staffPerformanceDemoData");

const prisma = new PrismaClient();

function periodDate(value) {
  return new Date(`${value}T12:00:00.000Z`);
}

async function findAdminUser() {
  let admin = await prisma.user.findFirst({ where: { username: "admin" } });
  if (!admin) {
    admin = await prisma.user.findFirst({ where: { role: "admin", isActive: true } });
  }
  return admin;
}

async function upsertDemoTeam(adminUser) {
  let team = await prisma.team.findFirst({ where: { name: DEMO_TEAM.name } });
  if (!team) {
    team = await prisma.team.create({
      data: {
        name: DEMO_TEAM.name,
        description: DEMO_TEAM.description,
        status: "active",
        teamLeadId: adminUser.id,
      },
    });
    console.log(`✅ Created team: ${team.name}`);
  } else if (!team.teamLeadId) {
    team = await prisma.team.update({
      where: { id: team.id },
      data: { teamLeadId: adminUser.id },
    });
    console.log(`✅ Set team lead on existing team: ${team.name}`);
  } else {
    console.log(`ℹ️  Team already exists: ${team.name}`);
  }
  return team;
}

async function upsertDemoUser(employee, teamId, passwordHash) {
  const existing = await prisma.user.findUnique({ where: { email: employee.email } });
  if (existing) {
    if (existing.teamId !== teamId) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { teamId },
      });
    }
    console.log(`ℹ️  Demo user already exists: ${employee.username}`);
    return existing;
  }

  const user = await prisma.user.create({
    data: {
      username: employee.username,
      email: employee.email,
      passwordHash,
      role: "developer",
      teamId,
      isActive: true,
    },
  });
  console.log(`✅ Created demo user: ${employee.username}`);
  return user;
}

async function upsertDemoProjects(adminUser) {
  const projectType = await prisma.projectType.findFirst();
  const projectStatus = await prisma.projectStatus.findFirst();
  const projectsByName = new Map();

  for (const spec of DEMO_PROJECTS) {
    let project = await prisma.project.findFirst({ where: { name: spec.name } });
    if (!project) {
      project = await prisma.project.create({
        data: {
          name: spec.name,
          description: spec.description,
          projectTypeId: projectType?.id ?? null,
          projectStatusId: projectStatus?.id ?? null,
          priority: "normal",
          startDate: periodDate(DEMO_PERIOD.startDate),
          endDate: periodDate(DEMO_PERIOD.endDate),
          projectManagerId: adminUser.id,
          createdById: adminUser.id,
        },
      });
      console.log(`✅ Created demo project: ${project.name}`);
    } else {
      console.log(`ℹ️  Demo project already exists: ${project.name}`);
    }
    projectsByName.set(spec.name, project);
  }

  return projectsByName;
}

async function upsertPerformancePeriod(adminUser) {
  const startDate = periodDate(DEMO_PERIOD.startDate);
  const endDate = periodDate(DEMO_PERIOD.endDate);

  let period = await prisma.performancePeriod.findFirst({
    where: {
      title: DEMO_PERIOD.title,
      startDate,
      endDate,
    },
  });

  if (!period) {
    period = await prisma.performancePeriod.create({
      data: {
        title: DEMO_PERIOD.title,
        startDate,
        endDate,
        status: DEMO_PERIOD.status,
        createdById: adminUser.id,
      },
    });
    console.log(`✅ Created performance period: ${period.title}`);
  } else {
    if (period.status !== DEMO_PERIOD.status) {
      period = await prisma.performancePeriod.update({
        where: { id: period.id },
        data: { status: DEMO_PERIOD.status },
      });
    }
    console.log(`ℹ️  Performance period already exists: ${period.title} (id=${period.id})`);
  }

  return period;
}

async function upsertReviewAndFeedback(periodId, userId, reviewData, adminUserId) {
  const review = await prisma.performanceReview.upsert({
    where: {
      periodId_userId: { periodId, userId },
    },
    create: {
      periodId,
      userId,
      roleSnapshot: "developer",
      updatesCount: reviewData.updatesCount,
      projectsCount: reviewData.projectsCount,
      activeDays: reviewData.activeDays,
      expectedWorkingDays: reviewData.expectedWorkingDays,
      regularityScore: reviewData.regularityScore,
      qualityScore: reviewData.qualityScore,
      speedScore: reviewData.speedScore,
      communicationScore: reviewData.communicationScore,
      updateQualityScore: reviewData.updateQualityScore,
      complexityScore: reviewData.complexityScore,
      finalScore: reviewData.finalScore,
      rating: reviewData.rating,
    },
    update: {
      updatesCount: reviewData.updatesCount,
      projectsCount: reviewData.projectsCount,
      activeDays: reviewData.activeDays,
      expectedWorkingDays: reviewData.expectedWorkingDays,
      regularityScore: reviewData.regularityScore,
      qualityScore: reviewData.qualityScore,
      speedScore: reviewData.speedScore,
      communicationScore: reviewData.communicationScore,
      updateQualityScore: reviewData.updateQualityScore,
      complexityScore: reviewData.complexityScore,
      finalScore: reviewData.finalScore,
      rating: reviewData.rating,
    },
  });

  await prisma.performanceFeedback.upsert({
    where: { reviewId: review.id },
    create: {
      reviewId: review.id,
      strengths: reviewData.strengths,
      improvementPoints: reviewData.improvementPoints,
      managerNotes: reviewData.managerNotes ?? null,
      actionPlan: reviewData.actionPlan ?? null,
      createdById: adminUserId,
    },
    update: {
      strengths: reviewData.strengths,
      improvementPoints: reviewData.improvementPoints,
      managerNotes: reviewData.managerNotes ?? null,
      actionPlan: reviewData.actionPlan ?? null,
    },
  });

  return review;
}

async function seedDailyUpdatesIfMissing(userId, dailyUpdates, projectsByName, periodStart, periodEnd) {
  const existingInPeriod = await prisma.dailyUpdate.count({
    where: {
      userId,
      updateDate: { gte: periodStart, lte: periodEnd },
    },
  });

  if (existingInPeriod > 0) {
    console.log(`ℹ️  Daily updates already exist for user ${userId} in period — skipped`);
    return 0;
  }

  let created = 0;
  for (const spec of dailyUpdates) {
    const project = projectsByName.get(spec.projectName);
    if (!project) continue;

    await prisma.dailyUpdate.create({
      data: {
        userId,
        projectId: project.id,
        updateText: spec.updateText,
        status: spec.status,
        blockers: spec.blockers ?? null,
        updateDate: spec.updateDate,
        submittedAt: new Date(`${spec.updateDate}T10:00:00.000Z`),
      },
    });
    created += 1;
  }

  if (created > 0) {
    console.log(`✅ Created ${created} daily update(s) for user ${userId}`);
  }
  return created;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("❌ ABORT: Staff performance demo seed must not run in production.");
    console.error("   Set NODE_ENV to development and run locally only.");
    process.exit(1);
  }

  console.log("🌱 Seeding staff performance demo data...\n");

  const adminUser = await findAdminUser();
  if (!adminUser) {
    console.error("❌ Admin user not found. Run npm run seed:prod:safe or bootstrap admin first.");
    process.exit(1);
  }

  const team = await upsertDemoTeam(adminUser);
  const passwordHash = await bcrypt.hash(DEMO_DEV_PASSWORD, 10);
  const employees = getEmployeesWithComputedReviews();
  const userRecords = [];

  for (const employee of employees) {
    const user = await upsertDemoUser(employee, team.id, passwordHash);
    userRecords.push({ employee, user });
  }

  const projectsByName = await upsertDemoProjects(adminUser);
  const period = await upsertPerformancePeriod(adminUser);

  let reviewCount = 0;
  for (const { employee, user } of userRecords) {
    await upsertReviewAndFeedback(period.id, user.id, employee.review, adminUser.id);
    reviewCount += 1;
    console.log(
      `✅ Review for ${employee.displayName}: score ${employee.review.finalScore} (${employee.review.rating})`
    );
  }

  let dailyUpdateCount = 0;
  for (const { employee, user } of userRecords) {
    const count = await seedDailyUpdatesIfMissing(
      user.id,
      employee.dailyUpdates,
      projectsByName,
      DEMO_PERIOD.startDate,
      DEMO_PERIOD.endDate
    );
    dailyUpdateCount += count;
  }

  console.log("\n✨ Staff performance demo seed completed.\n");
  console.log("📊 Summary:");
  console.log(`   - Period: ${period.title} (id=${period.id})`);
  console.log(`   - Dates: ${DEMO_PERIOD.startDate} → ${DEMO_PERIOD.endDate}`);
  console.log(`   - Team: ${team.name} (id=${team.id})`);
  console.log(`   - Reviews: ${reviewCount}`);
  console.log(`   - Daily updates created this run: ${dailyUpdateCount}`);
  console.log("\n🔐 Demo logins (password on first create only):");
  for (const { employee } of userRecords) {
    console.log(`   - ${employee.username} / ${DEMO_DEV_PASSWORD}`);
  }
}

main()
  .catch((err) => {
    console.error("Staff performance demo seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
