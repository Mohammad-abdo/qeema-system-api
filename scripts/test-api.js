#!/usr/bin/env node
"use strict";

/**
 * Backend API smoke test. Run with: node scripts/test-api.js
 * Requires: Backend running on PORT (default 4000), optional BACKEND_TEST_TOKEN for auth routes.
 */

const http = require("http");

const PORT = Number(process.env.PORT) || 4000;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = process.env.BACKEND_TEST_TOKEN || "";

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (TOKEN) opts.headers["Authorization"] = `Bearer ${TOKEN}`;

    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (ch) => (data += ch));
      res.on("end", () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  const results = [];
  let failed = 0;

  function ok(name, cond, detail) {
    const pass = !!cond;
    if (!pass) failed++;
    results.push({ name, pass, detail: detail || (pass ? "OK" : "FAIL") });
  }

  console.log("Backend API smoke test");
  console.log("Base URL:", BASE);
  console.log("Token:", TOKEN ? "set" : "not set (auth routes will 401)");
  console.log("---");

  // 1. Health (no auth)
  try {
    const health = await request("GET", "/health");
    ok("GET /health returns 200", health.status === 200, `status=${health.status}`);
  } catch (e) {
    ok("GET /health", false, e.message);
  }

  // 2. Metrics (no auth)
  try {
    const metrics = await request("GET", "/metrics");
    ok("GET /metrics returns 200", metrics.status === 200, `status=${metrics.status}`);
  } catch (e) {
    ok("GET /metrics", false, e.message);
  }

  // 3. API without token -> 401
  try {
    const noAuth = await request("GET", "/api/v1/projects");
    ok("GET /api/v1/projects without token -> 401", noAuth.status === 401, `status=${noAuth.status}`);
  } catch (e) {
    ok("GET /api/v1/projects (no auth)", false, e.message);
  }
  try {
    const noAuthNotifications = await request("GET", "/api/v1/notifications");
    ok("GET /api/v1/notifications without token -> 401", noAuthNotifications.status === 401, `status=${noAuthNotifications.status}`);
  } catch (e) {
    ok("GET /api/v1/notifications (no auth)", false, e.message);
  }
  try {
    const noAuthTypes = await request("GET", "/api/v1/project-types");
    ok("GET /api/v1/project-types without token -> 401", noAuthTypes.status === 401, `status=${noAuthTypes.status}`);
  } catch (e) {
    ok("GET /api/v1/project-types (no auth)", false, e.message);
  }

  // 4. With token (if provided)
  if (TOKEN) {
    try {
      const projects = await request("GET", "/api/v1/projects");
      ok("GET /api/v1/projects with token", projects.status === 200, `status=${projects.status}`);
    } catch (e) {
      ok("GET /api/v1/projects (with token)", false, e.message);
    }
    try {
      const users = await request("GET", "/api/v1/users");
      ok("GET /api/v1/users with token", users.status === 200, `status=${users.status}`);
    } catch (e) {
      ok("GET /api/v1/users (with token)", false, e.message);
    }
    try {
      const teams = await request("GET", "/api/v1/teams");
      ok("GET /api/v1/teams with token", teams.status === 200, `status=${teams.status}`);
    } catch (e) {
      ok("GET /api/v1/teams (with token)", false, e.message);
    }
    try {
      const summary = await request("GET", "/api/v1/dashboard/summary");
      ok("GET /api/v1/dashboard/summary with token", summary.status === 200 && summary.data?.success, `status=${summary.status}`);
    } catch (e) {
      ok("GET /api/v1/dashboard/summary (with token)", false, e.message);
    }
    try {
      const stats = await request("GET", "/api/v1/stats/projects");
      ok("GET /api/v1/stats/projects with token", stats.status === 200 && stats.data?.success, `status=${stats.status}`);
    } catch (e) {
      ok("GET /api/v1/stats/projects (with token)", false, e.message);
    }
    try {
      const statuses = await request("GET", "/api/v1/project-statuses");
      ok("GET /api/v1/project-statuses with token", statuses.status === 200, `status=${statuses.status}`);
    } catch (e) {
      ok("GET /api/v1/project-statuses (with token)", false, e.message);
    }
    try {
      const taskStatuses = await request("GET", "/api/v1/task-statuses");
      ok("GET /api/v1/task-statuses with token", taskStatuses.status === 200, `status=${taskStatuses.status}`);
    } catch (e) {
      ok("GET /api/v1/task-statuses (with token)", false, e.message);
    }
    try {
      const projectTypes = await request("GET", "/api/v1/project-types");
      ok("GET /api/v1/project-types with token", projectTypes.status === 200, `status=${projectTypes.status}`);
    } catch (e) {
      ok("GET /api/v1/project-types (with token)", false, e.message);
    }
    try {
      const notifications = await request("GET", "/api/v1/notifications");
      ok("GET /api/v1/notifications with token", notifications.status === 200 && notifications.data?.success, `status=${notifications.status}`);
    } catch (e) {
      ok("GET /api/v1/notifications (with token)", false, e.message);
    }
    try {
      const unreadCount = await request("GET", "/api/v1/notifications/unread-count");
      ok("GET /api/v1/notifications/unread-count with token", unreadCount.status === 200 && unreadCount.data?.success, `status=${unreadCount.status}`);
    } catch (e) {
      ok("GET /api/v1/notifications/unread-count (with token)", false, e.message);
    }
  }

  // Summary
  console.log("");
  for (const r of results) {
    console.log(r.pass ? "  [PASS]" : "  [FAIL]", r.name, r.pass ? "" : "- " + r.detail);
  }
  console.log("");
  console.log("Total:", results.length, "| Passed:", results.length - failed, "| Failed:", failed);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("Test run error:", e);
  process.exit(1);
});
