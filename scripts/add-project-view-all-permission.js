"use strict";

/**
 * One-off script for existing databases: add permission project.viewAll and assign it to admin and project_manager roles.
 * Run from repo root: node qeema-system-api/scripts/add-project-view-all-permission.js
 * Or from qeema-system-api: node scripts/add-project-view-all-permission.js
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const PERMISSION_KEY = "project.viewAll";
const ROLE_NAMES = ["admin", "project_manager", "Admin", "System Admin", "Project Manager"];

async function main() {
  const perm = await prisma.permission.upsert({
    where: { key: PERMISSION_KEY },
    update: {},
    create: {
      key: PERMISSION_KEY,
      name: "View All",
      description: "Permission to view all projects (reports, dashboard, list)",
      module: "project",
      category: null,
    },
  });
  console.log("Permission project.viewAll:", perm.id);

  for (const roleName of ROLE_NAMES) {
    const role = await prisma.role.findFirst({ where: { name: roleName } });
    if (!role) continue;
    const existing = await prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
    });
    if (existing) {
      console.log(`Role "${roleName}" already has project.viewAll`);
      continue;
    }
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: perm.id },
    });
    console.log(`Assigned project.viewAll to role "${roleName}"`);
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
