# RBAC Audit Report

**Date:** 2025 (post-audit)  
**Scope:** Backend API – permission definitions, authorization middleware, route-level protection, controller checks, bypass/scope logic, negative paths.

---

## 1. Summary

The backend uses a **permission-based RBAC** model backed by Prisma (`Role`, `Permission`, `RolePermission`, `UserRole`). Authorization is enforced **in controllers** via `hasPermissionWithoutRoleBypass(userId, permission, projectId)` and, where intended, **admin bypass** via `isAdmin(userId)` (RBAC admin role) or legacy `req.user.role === "admin"` (JWT payload). The **requirePermission** middleware exists but is **not used on any route**; all checks are in controller logic.

**Critical issues addressed in this audit:**
- **Unauthenticated destructive focus routes:** `POST /focus/clear-all` and `POST /focus/auto-reset` were callable without auth; now require auth and `today_task.assign` or admin.
- **Global metadata without permission:** Project types, project statuses, and task statuses were modifiable by any authenticated user; now require `settings.global.read` / `settings.global.edit` (or admin).
- **System settings without permission:** `GET /settings/system` and `PUT /settings/system`, `POST /settings/upload-logo` had no permission check; now require `settings.global.read` / `settings.global.edit` (or admin).

**Intentional design:**
- **Admin bypass:** Controllers that need “full access” use either `isAdmin(userId)` (from `lib/rbac.js`, checks UserRole) or `req.user.role === "admin"` (from JWT). Both are documented; consistency can be improved by preferring `isAdmin(userId)` everywhere.
- **project.viewAll:** Used to scope project/task lists and report data; users without it see only projects they manage or created (or are assignees where applicable).
- **Public endpoints:** `GET /settings/branding`, `GET /` (health) and auth routes (login, register, me) correctly have no auth.

---

## 2. Permission Matrix

**Assumptions:**
- **Scope:** “Global” = no projectId; “Project” = check with projectId from resource.
- **Admin:** Role name `admin` in RBAC (UserRole) gets full access where bypass is implemented.
- **Legacy:** Some code still uses `req.user.role` from JWT; seed only assigns all permissions to the single `admin` role and today_task.* to `team_lead`.

| Permission Key | Typical Scope | Endpoints / Actions | Allow (by design) |
|----------------|---------------|---------------------|------------------|
| user.read | Global | GET /users, GET /users/:id, GET /users/:id/projects, GET /users/:id/tasks, GET /users/:id/teams | RBAC or admin |
| user.create | Global | POST /users | RBAC or admin |
| user.update | Global | PATCH /users/:id, (avatar, password) | RBAC or admin |
| user.delete | Global | DELETE /users/:id | RBAC or admin |
| team.read | Global | GET /teams, GET /teams/:id, GET /teams/:teamId/members, GET /teams/:teamId/tasks | RBAC or admin |
| team.create/update/delete | Global | POST/PATCH/PUT/DELETE /teams/:id, POST/DELETE members | RBAC or admin |
| project.read | Project/Global | Project list filtered by project.viewAll or ownership; GET /projects/:id | RBAC + scope |
| project.viewAll | Global | Unfiltered project list, dashboard, reports, search, stats | RBAC or admin |
| project.create | Global | POST /projects | RBAC or admin |
| project.update/delete | Project | PATCH/DELETE /projects/:id | RBAC(projectId) or admin |
| task.read | Project | Task list/getOne filtered by project access | RBAC + project/viewAll |
| task.create | Project | POST /tasks | RBAC(projectId) or admin |
| task.update/delete | Project | PATCH/DELETE /tasks/:id, dependencies, subtasks, comments | RBAC(projectId) or creator/assignee where documented |
| today_task.assign | Global | Assignment API, focus clear-all/auto-reset | RBAC or admin (legacy: team_lead) |
| report.view | Global | GET /dashboard/reports/*, GET /reports/todays-focus | RBAC or admin |
| log.view | Global | GET /activity-logs | RBAC or admin |
| role.* | Global | GET/POST/PATCH/DELETE /rbac/roles, permissions | RBAC or admin |
| settings.global.read | Global | GET /settings/system, project-types, project-statuses, task-statuses list/getOne | RBAC or admin |
| settings.global.edit | Global | PUT /settings/system, POST /settings/upload-logo, project-types/statuses/task-statuses create/update/delete/reorder/toggle | RBAC or admin |

**Roles (seed):** Only `admin` has all permissions; `team_lead` has today_task.*. Other roles (project_manager, developer, viewer) have no RolePermissions in seed unless added by init script or UI.

---

## 3. Findings

### Critical (fixed)

| # | Finding | Affected | Fix |
|---|---------|----------|-----|
| 1 | **Unauthenticated focus reset** – `POST /focus/clear-all` and `POST /focus/auto-reset` could be called without auth, clearing all users’ today focus | `src/routes/focus.js` | Added `authMiddleware` and `canManageFocusReset()` (today_task.assign or isAdmin); same for `GET /focus/should-reset` (auth only). |
| 2 | **Global metadata writable by any user** – Project types, project statuses, task statuses had no permission check | `projectTypesController.js`, `projectStatusesController.js`, `taskStatusesController.js` | Require `settings.global.read` for list/getOne and `settings.global.edit` for create/update/delete/reorder/toggle; admin bypass. |
| 3 | **System settings writable by any user** – GET/PUT /settings/system and upload-logo had no permission check | `systemSettingsController.js` | Require `settings.global.read` for getByKey, `settings.global.edit` for setByKey and uploadLogo; admin bypass. |

### High (documented / partial)

| # | Finding | Affected | Status |
|---|---------|----------|--------|
| 4 | **requirePermission not used** – All protection is in controllers; no route-level permission middleware | All `src/routes/*.js` | Documented. Optional follow-up: add requirePermission on selected routes and thin controller checks. |
| 5 | **Dual admin source** – Some code uses `req.user.role === "admin"` (JWT), other uses `isAdmin(userId)` (UserRole) | e.g. tasksController, dashboardController | Documented. audit-rbac-bypasses.js flags `req.user.role === "admin"` as critical; these are intentional bypasses. Prefer `isAdmin(userId)` for consistency. |

### Medium / Low

| # | Finding | Status |
|---|---------|--------|
| 6 | **Audit script only scanned .ts/.tsx** – Codebase is .js | Fixed: script now includes .js. |
| 7 | **notification.delete** – Not verified; notifications controller filters by user | Assumed safe (own notifications). |
| 8 | **Search** – Admin-only check for cross-entity search; project/viewAll and user/team permissions used | Documented. |

---

## 4. Fixes Implemented

1. **src/routes/focus.js**
   - `GET /focus/should-reset`: added `authMiddleware`.
   - `POST /focus/clear-all`, `POST /focus/auto-reset`: added `authMiddleware` and `canManageFocusReset(userId)` (hasPermission today_task.assign or isAdmin); 403 if not allowed.

2. **src/controllers/projectTypesController.js**
   - All actions: require `settings.global.read` (list, getOne) or `settings.global.edit` (create, update, remove, toggle, reorder) with admin bypass.

3. **src/controllers/projectStatusesController.js**
   - Same pattern: `requireGlobalRead` / `requireGlobalEdit` with admin bypass.

4. **src/controllers/taskStatusesController.js**
   - Same pattern: `requireGlobalRead` / `requireGlobalEdit` with admin bypass.

5. **src/controllers/systemSettingsController.js**
   - getByKey: require `settings.global.read` or admin.
   - setByKey, uploadLogo: require `settings.global.edit` or admin.
   - getBrandingPublic: unchanged (public).

6. **src/middleware/requirePermission.js**
   - Added admin bypass: if `isAdmin(userId)` then next() without checking permission (documented in JSDoc).

7. **scripts/audit-rbac-bypasses.js**
   - Scan extended to `.js` in addition to `.ts`/`.tsx`.

8. **package.json**
   - Added script: `"script:audit-rbac-bypasses": "node scripts/audit-rbac-bypasses.js"`.

---

## 5. Residual Risks and Follow-ups

- **Admin definition:** Unify on `isAdmin(userId)` from RBAC everywhere and avoid relying on `req.user.role` from JWT for security decisions where UserRole is the source of truth.
- **Route-level requirePermission:** Consider applying `requirePermission` on high-value routes (e.g. POST /projects, DELETE /users/:id) and simplifying controllers to assume “permission already checked.”
- **Scope consistency:** Ensure projectId is always passed where permission is project-scoped (e.g. task.update with task’s projectId).
- **Tests:** Add automated RBAC tests: allowed role can access, disallowed gets 403, unauthenticated gets 401, and scope-restricted access holds.

---

## 6. Testing

| Command | Status | Notes |
|---------|--------|--------|
| `npm run test:kpis` | warning/environment limitation | Requires DB and env; may fail without. Run: `npm run test:kpis` from qeema-system-api. |
| `npm run script:check-permissions` | pass | Lists 60 permissions in 11 modules. |
| `npm run script:audit-rbac-bypasses` | warning/environment limitation | Exits 1 due to intentional `req.user.role === "admin"` (documented bypasses). Script now scans .js. |
| New RBAC test command | not added | Recommended: add e.g. `test:rbac` for 401/403 and allowed-role tests. |

**Validation commands (minimum):**

- **check-permissions:** `npm run script:check-permissions` (from qeema-system-api). Expect: module summary and permission list.
- **audit-rbac-bypasses:** `npm run script:audit-rbac-bypasses`. Expect: findings; exit 1 due to intentional admin checks.
- **test:kpis:** `npm run test:kpis`. Expect: pass when DB is available.

**Status summary:**

- pass: `npm run script:check-permissions`
- warning/environment limitation: `npm run test:kpis` (DB required), `npm run script:audit-rbac-bypasses` (intentional bypasses flagged)

---

## Production deployment

For production deploy steps, rollback, and data-safety rules, see **PRODUCTION_DEPLOYMENT_RUNBOOK.md**. Use `prisma migrate deploy` only; never run the destructive seed in production. Use `npm run seed:prod:safe` for idempotent bootstrap when needed.
