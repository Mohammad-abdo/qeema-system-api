"use strict";

/**
 * Verification script for PostgreSQL migration: outputs row counts for critical tables.
 * Run after prisma migrate deploy or db push to verify data.
 *
 * Usage (from repo root, with DATABASE_URL and DIRECT_URL set):
 *   node scripts/verify-db-counts.js
 *
 * See docs/migration/postgres-migration-checklist.md
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const CRITICAL_TABLES = [
  { model: "user", count: () => prisma.user.count() },
  { model: "project", count: () => prisma.project.count() },
  { model: "task", count: () => prisma.task.count() },
  { model: "team", count: () => prisma.team.count() },
  { model: "activityLog", count: () => prisma.activityLog.count() },
];

async function main() {
  console.log("Verifying database table counts...\n");
  const results = [];
  for (const { model, count } of CRITICAL_TABLES) {
    try {
      const n = await count();
      results.push({ model, count: n });
      console.log(`${model}: ${n}`);
    } catch (err) {
      console.error(`${model}: ERROR`, err.message);
      results.push({ model, error: err.message });
    }
  }
  console.log("\nDone. Use these counts for before/after comparison (see docs/migration/postgres-migration-checklist.md).");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
