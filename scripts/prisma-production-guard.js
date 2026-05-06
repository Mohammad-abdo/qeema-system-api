"use strict";

/**
 * Passes arguments to `npx prisma ...` but refuses dangerous subcommands when NODE_ENV=production.
 * Usage: node scripts/prisma-production-guard.js migrate deploy
 *        npm run deploy:db
 */
const { spawnSync } = require("child_process");

const args = process.argv.slice(2);
const joined = args.join(" ");

function isProduction() {
  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

function assertSafeInProduction() {
  if (!isProduction()) return;
  const patterns = [
    /\bmigrate\s+reset\b/i,
    /\bmigrate\s+dev\b/i,
    /\bdb\s+push\b/i,
    /\bdb\s+pull\b/i,
  ];
  for (const re of patterns) {
    if (re.test(joined)) {
      console.error(
        "[prisma-production-guard] BLOCKED: Refusing to run this Prisma command with NODE_ENV=production.\n" +
          `  Command: prisma ${joined}\n` +
          "  Use only: prisma migrate deploy, prisma generate, prisma migrate status, etc.\n" +
          "  See PRODUCTION_DEPLOYMENT_RUNBOOK.md"
      );
      process.exit(1);
    }
  }
}

assertSafeInProduction();

const result = spawnSync("npx", ["prisma", ...args], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status === null ? 1 : result.status);
