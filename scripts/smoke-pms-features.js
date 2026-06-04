#!/usr/bin/env node
"use strict";

/**
 * Authenticated smoke test for PMS feature endpoints.
 * Usage: node scripts/smoke-pms-features.js
 * Env: SMOKE_USERNAME, SMOKE_PASSWORD (or ADMIN_BOOTSTRAP_* from .env)
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const http = require("http");

const PORT = Number(process.env.PORT) || 4000;
const BASE = `http://127.0.0.1:${PORT}`;
const USERNAME = process.env.SMOKE_USERNAME || process.env.ADMIN_BOOTSTRAP_USERNAME || "admin";
const PASSWORD =
  process.env.SMOKE_PASSWORD ||
  process.env.ADMIN_BOOTSTRAP_PASSWORD ||
  process.env.TEST_PASSWORD ||
  "";

let token = process.env.BACKEND_TEST_TOKEN || "";

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (token) opts.headers.Authorization = `Bearer ${token}`;
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (ch) => (data += ch));
      res.on("end", () => {
        let json = data;
        try {
          json = data ? JSON.parse(data) : {};
        } catch {
          /* keep raw */
        }
        resolve({ status: res.statusCode, data: json });
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login() {
  if (token) return true;
  if (!PASSWORD) {
    console.warn("No SMOKE_PASSWORD / BACKEND_TEST_TOKEN — skipping authenticated tests.");
    return false;
  }
  const res = await request("POST", "/api/v1/auth/login", { username: USERNAME, password: PASSWORD });
  token = res.data?.data?.token || res.data?.token;
  return res.status === 200 && !!token;
}

async function run() {
  const results = [];
  let failed = 0;
  const ok = (name, cond, detail) => {
    const pass = !!cond;
    if (!pass) failed++;
    results.push({ name, pass, detail: detail || (pass ? "OK" : "FAIL") });
  };

  console.log("PMS feature smoke test");
  console.log("Base:", BASE);
  console.log("---");

  const authed = await login();
  ok("login", authed, authed ? "token acquired" : "set SMOKE_PASSWORD or BACKEND_TEST_TOKEN");
  if (!authed) {
    printResults(results, failed);
    process.exit(1);
  }

  let projectId;
  let taskId;
  let taskStatusId;
  let deliverableId;
  let phaseId;
  let timeLogId;

  try {
    const dash = await request("GET", "/api/v1/dashboard/summary");
    ok("dashboard summary", dash.status === 200 && (dash.data?.success !== false), `status=${dash.status}`);
  } catch (e) {
    ok("dashboard summary", false, e.message);
  }

  try {
    const projects = await request("GET", "/api/v1/projects?limit=5");
    const list = projects.data?.projects ?? projects.data ?? [];
    projectId = Array.isArray(list) && list[0]?.id;
    ok("list projects", projects.status === 200 && projectId, `projectId=${projectId}`);
  } catch (e) {
    ok("list projects", false, e.message);
  }

  if (projectId) {
    try {
      const proj = await request("GET", `/api/v1/projects/${projectId}`);
      const hasDeliverables = Array.isArray(proj.data?.deliverables);
      const hasPhases = Array.isArray(proj.data?.phases);
      const tasks = proj.data?.tasks ?? [];
      taskId = tasks[0]?.id;
      ok("project getOne deliverables/phases", proj.status === 200 && hasDeliverables && hasPhases, `tasks=${tasks.length}`);
    } catch (e) {
      ok("project getOne", false, e.message);
    }

    try {
      const d = await request("POST", `/api/v1/projects/${projectId}/deliverables`, {
        name: `Smoke deliverable ${Date.now()}`,
      });
      deliverableId = d.data?.deliverable?.id;
      ok("create deliverable", d.status === 201 && deliverableId, `id=${deliverableId}`);
    } catch (e) {
      ok("create deliverable", false, e.message);
    }

    try {
      const p = await request("POST", `/api/v1/projects/${projectId}/phases`, {
        name: `Smoke phase ${Date.now()}`,
      });
      phaseId = p.data?.phase?.id;
      ok("create phase", p.status === 201 && phaseId, `id=${phaseId}`);
    } catch (e) {
      ok("create phase", false, e.message);
    }

    if (deliverableId) {
      try {
        const u = await request("PATCH", `/api/v1/projects/${projectId}/deliverables/${deliverableId}`, {
          status: "in_progress",
        });
        ok("update deliverable", u.status === 200, `status=${u.status}`);
        await request("DELETE", `/api/v1/projects/${projectId}/deliverables/${deliverableId}`);
      } catch (e) {
        ok("update deliverable", false, e.message);
      }
    }

    if (phaseId) {
      try {
        await request("DELETE", `/api/v1/projects/${projectId}/phases/${phaseId}`);
        ok("delete phase", true, "OK");
      } catch (e) {
        ok("delete phase", false, e.message);
      }
    }
  }

  try {
    const ts = await request("GET", "/api/v1/task-statuses");
    const statuses = ts.data?.taskStatuses ?? ts.data ?? [];
    taskStatusId = Array.isArray(statuses) && statuses[0]?.id;
    ok("task statuses", ts.status === 200 && taskStatusId, `count=${statuses.length}`);
  } catch (e) {
    ok("task statuses", false, e.message);
  }

  if (taskId) {
    try {
      const task = await request("GET", `/api/v1/tasks/${taskId}`);
      const hasTimeLogs = Array.isArray(task.data?.timeLogs);
      ok("task getOne timeLogs", task.status === 200 && hasTimeLogs, `status=${task.status}`);
    } catch (e) {
      ok("task getOne", false, e.message);
    }

    try {
      const log = await request("POST", `/api/v1/tasks/${taskId}/time-logs`, {
        hoursLogged: 0.5,
        description: "smoke test",
      });
      timeLogId = log.data?.timeLog?.id;
      ok("create time log", log.status === 201 && timeLogId, `id=${timeLogId}`);
    } catch (e) {
      ok("create time log", false, e.message);
    }

    if (timeLogId) {
      try {
        const del = await request("DELETE", `/api/v1/tasks/${taskId}/time-logs/${timeLogId}`);
        ok("delete time log", del.status === 200, `status=${del.status}`);
      } catch (e) {
        ok("delete time log", false, e.message);
      }
    }

    if (taskStatusId) {
      try {
        const patch = await request("PATCH", `/api/v1/tasks/${taskId}`, { taskStatusId });
        ok("patch task status (kanban)", patch.status === 200, `status=${patch.status}`);
      } catch (e) {
        ok("patch task status", false, e.message);
      }
    }
  } else {
    ok("task flows", false, "no task in project");
  }

  printResults(results, failed);
  process.exit(failed > 0 ? 1 : 0);
}

function printResults(results, failed) {
  console.log("");
  for (const r of results) {
    console.log(r.pass ? "  [PASS]" : "  [FAIL]", r.name, r.pass ? "" : "- " + r.detail);
  }
  console.log("");
  console.log("Total:", results.length, "| Passed:", results.length - failed, "| Failed:", failed);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
