"use strict";

/**
 * Read-only export of projects and tasks (JSON) for offline backup / audit.
 * Does not include file blobs (attachments). Run on a machine with DATABASE_URL set.
 *
 *   cd qeema-system-api && node scripts/export-business-data.js
 *   npm run script:export-data
 *
 * Output: exports/business-export-<timestamp>.json (gitignored)
 */
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const outDir = path.join(__dirname, "..", "exports");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(outDir, `business-export-${stamp}.json`);

  const projects = await prisma.project.findMany({
    orderBy: { id: "asc" },
    include: {
      projectType: { select: { id: true, name: true } },
      projectStatus: { select: { id: true, name: true } },
      projectManager: { select: { id: true, username: true, email: true } },
      projectUsers: {
        include: {
          user: { select: { id: true, username: true, email: true } },
        },
      },
      tasks: {
        orderBy: { id: "asc" },
        include: {
          taskStatus: { select: { id: true, name: true, isFinal: true } },
          assignees: { select: { id: true, username: true, email: true } },
          creator: { select: { id: true, username: true } },
        },
      },
    },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    note: "Read-only snapshot. Not a full DB dump. Attachments and binary files are not included.",
    projectCount: projects.length,
    taskCount: projects.reduce((n, p) => n + (p.tasks?.length || 0), 0),
    projects,
  };

  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), "utf8");
  console.log("Wrote:", outFile);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
