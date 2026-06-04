#!/usr/bin/env node
"use strict";

/**
 * Run `prisma generate` after freeing the Prisma query engine on Windows.
 * The API dev server locks query_engine-windows.dll.node → EPERM on generate.
 *
 * Usage: node scripts/prisma-generate-safe.js
 */

const { execSync, spawnSync } = require("child_process");
const http = require("http");

const PORT = Number(process.env.PORT) || 4000;
const ROOT = require("path").join(__dirname, "..");

function getPidsOnPort(port) {
  if (process.platform === "win32") {
    try {
      const out = execSync(`netstat -ano | findstr ":${port}"`, { encoding: "utf8" });
      const pids = new Set();
      for (const line of out.split("\n")) {
        if (!line.includes("LISTENING")) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[parts.length - 1], 10);
        if (!Number.isNaN(pid) && pid > 0) pids.add(pid);
      }
      return [...pids];
    } catch {
      return [];
    }
  }
  try {
    const out = execSync(`lsof -ti :${port}`, { encoding: "utf8" });
    return out
      .split("\n")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));
  } catch {
    return [];
  }
}

function killPids(pids) {
  for (const pid of pids) {
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      } else {
        process.kill(pid, "SIGTERM");
      }
      console.log(`Stopped process ${pid} (was listening on port ${PORT})`);
    } catch {
      /* already gone */
    }
  }
}

function waitForPortFree(port, attempts = 10) {
  return new Promise((resolve) => {
    let n = 0;
    const tick = () => {
      const pids = getPidsOnPort(port);
      if (pids.length === 0 || n >= attempts) return resolve(pids.length === 0);
      n += 1;
      setTimeout(tick, 400);
    };
    tick();
  });
}

async function main() {
  const pids = getPidsOnPort(PORT);
  if (pids.length) {
    console.log(`Port ${PORT} in use by PID(s): ${pids.join(", ")} — stopping before prisma generate...`);
    killPids(pids);
    const free = await waitForPortFree(PORT);
    if (!free) {
      console.error(`Port ${PORT} still in use. Stop the API manually, then run: npx prisma generate`);
      process.exit(1);
    }
  }

  const result = spawnSync("npx", ["prisma", "generate", "--schema=./prisma/schema.prisma"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
  });
  process.exit(result.status ?? 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
