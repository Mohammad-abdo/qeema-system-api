/**
 * Validates that the destructive seed aborts in production.
 * Run: node scripts/validate-seed-safety.js
 * Expect: process exits with code 1 and message containing "DESTRUCTIVE" or "production".
 */
const { spawnSync } = require("child_process");
const path = require("path");

const node = process.execPath;
const seedPath = path.join(__dirname, "..", "prisma", "seed.js");
const result = spawnSync(node, [seedPath], {
  env: { ...process.env, NODE_ENV: "production" },
  encoding: "utf8",
  timeout: 15000,
});

if (result.status === 1 && (result.stderr || result.stdout || "").includes("DESTRUCTIVE")) {
  console.log("✅ Seed correctly aborts in production (NODE_ENV=production).");
  process.exit(0);
}
console.error("❌ Expected seed to exit 1 with DESTRUCTIVE message in production. status=%s stderr=%s stdout=%s", result.status, result.stderr, result.stdout);
process.exit(1);
