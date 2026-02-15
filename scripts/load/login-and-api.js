/**
 * k6 load scenario: login (credentials) + project list + task list.
 * Run: k6 run scripts/load/login-and-api.js
 * Optionally: k6 run -e BASE_URL=http://localhost:3000 -e USER=admin -e PASSWORD=admin scripts/load/login-and-api.js
 *
 * Requires a running app and a valid user. For local: create user via register or seed, then set USER and PASSWORD.
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const USER = __ENV.USER || "admin";
const PASSWORD = __ENV.PASSWORD || "admin";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<3000"],
    http_req_failed: ["rate<0.1"],
  },
};

export default function () {
  // 1. Get CSRF token
  const csrfRes = http.get(`${BASE_URL}/api/auth/csrf`);
  if (csrfRes.status !== 200) {
    console.warn("CSRF failed");
    sleep(1);
    return;
  }
  let csrfToken = "";
  try {
    const csrfBody = JSON.parse(csrfRes.body);
    csrfToken = csrfBody.csrfToken || csrfBody.token || "";
  } catch (e) {
    console.warn("CSRF response not JSON");
    sleep(1);
    return;
  }

  // 2. Login via NextAuth signin/credentials (get session cookie)
  const loginRes = http.post(
    `${BASE_URL}/api/auth/signin/credentials`,
    `csrfToken=${encodeURIComponent(csrfToken)}&username=${encodeURIComponent(USER)}&password=${encodeURIComponent(PASSWORD)}&callbackUrl=${encodeURIComponent(BASE_URL + "/dashboard")}&json=true`,
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      redirects: 0,
    }
  );

  const sessionCookie = loginRes.cookies["next-auth.session-token"] || loginRes.cookies["__Secure-next-auth.session-token"];
  if (!sessionCookie || sessionCookie.length === 0) {
    console.warn("Login failed: no session cookie");
    sleep(1);
    return;
  }

  const jar = http.cookieJar();
  jar.set(BASE_URL, "next-auth.session-token", sessionCookie[0].value);

  // 3. Get JWT for API calls
  const tokenRes = http.get(`${BASE_URL}/api/auth/token`, {
    cookies: { "next-auth.session-token": sessionCookie[0].value },
  });
  const hasToken = check(tokenRes, { "token ok": (r) => r.status === 200 });
  if (!hasToken) {
    sleep(1);
    return;
  }
  let token = null;
  try {
    const body = JSON.parse(tokenRes.body);
    token = body.token;
  } catch (e) {
    console.warn("Token response not JSON");
    sleep(1);
    return;
  }
  if (!token) {
    sleep(1);
    return;
  }

  const apiHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // 4. Project list
  const projectsRes = http.get(`${BASE_URL}/api/v1/projects?page=1&limit=10`, { headers: apiHeaders });
  check(projectsRes, { "projects list 200": (r) => r.status === 200 });

  let projectId = null;
  try {
    const projectsBody = JSON.parse(projectsRes.body);
    if (projectsBody.projects && projectsBody.projects.length > 0) {
      projectId = projectsBody.projects[0].id;
    }
  } catch (_) {}

  // 5. Task list
  const tasksRes = http.get(`${BASE_URL}/api/v1/tasks?page=1&limit=10`, { headers: apiHeaders });
  check(tasksRes, { "tasks list 200": (r) => r.status === 200 });

  // 6. Task CRUD (when we have a project)
  if (projectId != null) {
    const createPayload = JSON.stringify({
      projectId,
      title: `k6 load test task ${Date.now()}`,
      priority: "normal",
    });
    const createRes = http.post(`${BASE_URL}/api/v1/tasks`, createPayload, { headers: apiHeaders });
    const createOk = check(createRes, { "task create 200": (r) => r.status === 200 });
    if (createOk) {
      let taskId = null;
      try {
        const createBody = JSON.parse(createRes.body);
        taskId = createBody.id;
      } catch (_) {}
      if (taskId != null) {
        const getRes = http.get(`${BASE_URL}/api/v1/tasks/${taskId}`, { headers: apiHeaders });
        check(getRes, { "task get 200": (r) => r.status === 200 });
        const patchPayload = JSON.stringify({ title: `k6 load test task updated ${Date.now()}` });
        const patchRes = http.patch(`${BASE_URL}/api/v1/tasks/${taskId}`, patchPayload, { headers: apiHeaders });
        check(patchRes, { "task patch 200": (r) => r.status === 200 });
        const delRes = http.del(`${BASE_URL}/api/v1/tasks/${taskId}`, null, { headers: apiHeaders });
        check(delRes, { "task delete 200": (r) => r.status === 200 });
      }
    }
  }

  sleep(0.5 + Math.random());
}
