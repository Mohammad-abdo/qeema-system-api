const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const REPORT_PERMISSIONS = [
  {
    key: "report.view",
    name: "View",
    description: "Permission to view reports",
    module: "report",
    category: null,
  },
  {
    key: "report.export",
    name: "Export",
    description: "Permission to export reports",
    module: "report",
    category: null,
  },
  {
    key: "report.generate",
    name: "Generate",
    description: "Permission to generate reports",
    module: "report",
    category: null,
  },
];

/**
 * Role mapping for staff performance RBAC (enforced in performanceReviewAuth.js):
 * - admin: all permissions (via admin role in seed)
 * - team_lead: report.view + report.export (team-scoped in API)
 * - developer: no report.* permissions (self-view via role exception in API)
 */
const TEAM_LEAD_REPORT_KEYS = ["report.view", "report.export"];

async function main() {
  console.log("Ensuring report permissions...");

  for (const permission of REPORT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        name: permission.name,
        description: permission.description,
        module: permission.module,
        category: permission.category,
      },
      create: permission,
    });
  }

  const current = await prisma.permission.findMany({
    where: { module: "report" },
    orderBy: { key: "asc" },
    select: { id: true, key: true, name: true },
  });

  const permByKey = new Map(current.map((p) => [p.key, p.id]));
  const teamLeadRole = await prisma.role.findFirst({ where: { name: "team_lead" } });
  if (teamLeadRole) {
    for (const key of TEAM_LEAD_REPORT_KEYS) {
      const permId = permByKey.get(key);
      if (!permId) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: teamLeadRole.id, permissionId: permId },
        },
        update: {},
        create: { roleId: teamLeadRole.id, permissionId: permId },
      });
    }
    console.log("Ensured team_lead role has report.view + report.export");
  }

  console.log(`Done. Report permissions in DB: ${current.length}`);
  for (const perm of current) {
    console.log(`- ${perm.key} (${perm.name})`);
  }
}

main()
  .catch((error) => {
    console.error("Failed to ensure report permissions:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
