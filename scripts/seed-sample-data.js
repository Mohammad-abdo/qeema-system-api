"use strict";

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding sample business data...");

  // Find admin user
  const adminUser = await prisma.user.findFirst({
    where: { username: "admin" },
  });

  if (!adminUser) {
    console.error("Admin user not found. Please run npm run seed first.");
    process.exit(1);
  }

  // 1. Create a Team
  let team = await prisma.team.findFirst({
    where: { name: "Engineering Team" },
  });

  if (!team) {
    team = await prisma.team.create({
      data: {
        name: "Engineering Team",
        description: "The core software engineering group.",
        status: "active",
        teamLeadId: adminUser.id,
      },
    });
    console.log(`✅ Created Team: ${team.name}`);
  }

  // Link admin user to team membership
  const existingMembership = await prisma.teamMember.findFirst({
    where: { teamId: team.id, userId: adminUser.id },
  });
  if (!existingMembership) {
    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: adminUser.id,
        role: "lead",
      },
    });
    console.log(`✅ Added admin to Engineering Team`);
  }

  // 2. Create a Project
  let project = await prisma.project.findFirst({
    where: { name: "Qeema Website Redesign" },
  });

  if (!project) {
    const projectType = await prisma.projectType.findFirst();
    const projectStatus = await prisma.projectStatus.findFirst();

    project = await prisma.project.create({
      data: {
        name: "Qeema Website Redesign",
        type: projectType ? projectType.name : "software_development",
        status: projectStatus ? projectStatus.name : "planned",
        projectType: projectType ? { connect: { id: projectType.id } } : undefined,
        projectStatus: projectStatus ? { connect: { id: projectStatus.id } } : undefined,
        description: "A major overhaul of the corporate website to modern aesthetics.",
        priority: "high",
        scope: "Include branding assets, product showcase, and career application portal.",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
        projectManager: { connect: { id: adminUser.id } },
        createdById: adminUser.id,
      },
    });
    console.log(`✅ Created Project: ${project.name}`);
  }

  // 3. Create Tasks
  const taskStatusPending = await prisma.taskStatus.findFirst({ where: { name: "pending" } }) || await prisma.taskStatus.findFirst();
  const taskStatusProgress = await prisma.taskStatus.findFirst({ where: { name: "in_progress" } }) || await prisma.taskStatus.findFirst();
  const taskStatusCompleted = await prisma.taskStatus.findFirst({ where: { name: "completed" } }) || await prisma.taskStatus.findFirst();

  const tasksData = [
    {
      title: "Design Frontend Wireframes",
      description: "Create interactive mockups and layouts in Figma.",
      status: taskStatusCompleted ? taskStatusCompleted.name : "completed",
      taskStatusId: taskStatusCompleted ? taskStatusCompleted.id : null,
      priority: "normal",
      projectId: project.id,
      createdById: adminUser.id,
      assignees: { connect: { id: adminUser.id } },
    },
    {
      title: "Implement Auth Flow",
      description: "Add JWT authentication, role check, and profile endpoints.",
      status: taskStatusProgress ? taskStatusProgress.name : "in_progress",
      taskStatusId: taskStatusProgress ? taskStatusProgress.id : null,
      priority: "high",
      projectId: project.id,
      createdById: adminUser.id,
      assignees: { connect: { id: adminUser.id } },
    },
    {
      title: "Write QA Test Cases",
      description: "Prepare manual and automated testing runs for validation.",
      status: taskStatusPending ? taskStatusPending.name : "pending",
      taskStatusId: taskStatusPending ? taskStatusPending.id : null,
      priority: "normal",
      projectId: project.id,
      createdById: adminUser.id,
    },
  ];

  for (const t of tasksData) {
    const existing = await prisma.task.findFirst({
      where: { title: t.title, projectId: t.projectId },
    });
    if (!existing) {
      const created = await prisma.task.create({ data: t });
      console.log(`✅ Created Task: ${created.title}`);
    }
  }

  console.log("✨ Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
