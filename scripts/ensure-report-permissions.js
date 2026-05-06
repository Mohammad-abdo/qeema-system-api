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
    select: { key: true, name: true },
  });

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
