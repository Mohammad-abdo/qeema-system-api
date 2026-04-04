# Production-Safe Rollout — Summary

## 1. Summary

Production data is protected by: (1) **destructive seed never runs in production** (hard guard on `NODE_ENV=production`); (2) **production deploy uses only `prisma migrate deploy`** and optional **idempotent seed** (`npm run seed:prod:safe`); (3) **admin bootstrap** is env-driven with validation and no plaintext logging; (4) **JWT and upload access** are fail-closed; (5) **change-password** flow is unchanged and covered by an e2e script.

---

## 2. Changes by Phase

### Phase 1 — Data safety

- **`prisma/seed.js`:** At start of `main()`, if `NODE_ENV === 'production'` the script exits with code 1 and a clear message; no `deleteMany` runs in production.
- **`prisma/seed-prod-safe.js`:** New idempotent seed: upserts permissions, roles, role-permission links, project types/statuses, task statuses, labels; optional admin bootstrap when `BOOTSTRAP_ADMIN=true`; **no `deleteMany`**.
- **`prisma/seed-shared.js`:** Shared permission definitions used by both seed scripts.
- **`package.json`:** Added `seed:dev:reset` (runs `prisma/seed.js`), `seed:prod:safe` (runs `seed-prod-safe.js`), `script:validate-seed-safety` (asserts destructive seed aborts in production).
- **Merge conflict in seed.js:** Resolved; only env-driven bootstrap retained (no hardcoded credentials).

### Phase 2 — Admin bootstrap

- Bootstrap remains env-driven: `BOOTSTRAP_ADMIN`, `ADMIN_BOOTSTRAP_USERNAME`, `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD`.
- In **production**, when `BOOTSTRAP_ADMIN=true`, `seed-prod-safe.js` requires all three admin env vars or exits.
- Password strength checks (length, no username/email, no weak patterns); bcrypt hash; **credentials are never logged**.
- Bootstrap is idempotent (upsert user, ensure UserRole link).

### Phase 3 — Auth and upload hardening

- **JWT:** No fallback secret. Server already exits at startup if `NEXTAUTH_SECRET` is missing (non-test). Auth middleware and login route now return 503 if `JWT_SECRET` is missing (defense in depth).
- **Uploads:** Unchanged. Only `/uploads/branding/` is served as static; other paths return 403 and clients use `GET /api/v1/attachments/:id`.

### Phase 4 — RBAC

- No code changes. Runbook and RBAC report reference each other. Use `npm run script:check-permissions` and `npm run script:audit-rbac-bypasses` in verification.

### Phase 5 — Change-password

- No logic change. **E2E:** `scripts/test-change-password.js` supports env `API_URL`, `CHANGEPASS_USER`, `CHANGEPASS_OLD`, `CHANGEPASS_NEW`. Added npm script `test:change-password`.

---

## 3. Data Safety Guarantees

- **Production DB:** Never run `prisma migrate reset`, `prisma db push` (for schema), or `npm run seed` / `npm run seed:dev:reset` in production.
- **Deploy path:** `prisma migrate deploy` only. Optional: `npm run seed:prod:safe` (idempotent; no deletes).
- **Guard:** Running `node prisma/seed.js` with `NODE_ENV=production` exits immediately with status 1.

---

## 4. Security Impact

- **Secrets:** No hardcoded secrets; production requires env (e.g. `NEXTAUTH_SECRET`).
- **Bootstrap:** Explicit `BOOTSTRAP_ADMIN=true` and validated env; no plaintext password in logs.
- **Access control:** JWT and upload behavior remain fail-closed; RBAC unchanged.

---

## 5. Compatibility Notes

- **Local dev:** Use `npm run seed:dev:reset` (or `npm run prisma:seed`) for full reset; ensure `NODE_ENV` is not `production`.
- **Existing deploys:** If you already run a custom “prod seed,” switch to `npm run seed:prod:safe` and remove any destructive steps.
- **First production deploy:** Run migrations, then optionally `BOOTSTRAP_ADMIN=true` + admin env vars + `npm run seed:prod:safe` to create the first admin.

---

## 6. Testing (command-by-command)

| Command | Result |
|--------|--------|
| `npm run script:validate-seed-safety` | ✅ pass — Seed aborts when `NODE_ENV=production`. |
| `npm run script:check-permissions` | ✅ pass — Lists 60 permissions by module. |
| `npm run script:audit-rbac-bypasses` | ✅ pass — No critical issues; 1 medium (intentional admin/viewAll check). |
| `npm run test:kpis` | ✅ pass — KPI tests pass. |
| `npm run test:change-password` | ⚠️ warning — Requires API running and valid admin credentials (or set `CHANGEPASS_*` env). Run manually after deploy. |

---

## 7. Rollback Plan

- **App:** Redeploy previous version; keep same Node and env.
- **DB:** No built-in “migrate down.” Revert schema via DB backup restore or a new migration that reverses the change.
- **Seed:** `seed:prod:safe` does not delete application data; to undo bad metadata, restore from backup or fix manually. Never run the destructive seed in production.

See **PRODUCTION_DEPLOYMENT_RUNBOOK.md** for full checklist, steps, and rollback details.
