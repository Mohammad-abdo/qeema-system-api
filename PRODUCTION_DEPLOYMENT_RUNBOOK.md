# Production Deployment Runbook

## Data safety (mandatory)

- **Production data is never wiped during deploy.** The destructive seed (`prisma/seed.js` / `npm run seed:dev:reset`) aborts when `NODE_ENV=production`. Use only **idempotent** operations in production.
- **Schema changes:** Use **Prisma migrations** only. Run `npx prisma migrate deploy` on the production DB. Do **not** run `prisma db push` or `prisma migrate reset` in production.
- **Seed in production:** Use **only** `npm run seed:prod:safe`. It performs upserts only (no `deleteMany`). Optional: set `BOOTSTRAP_ADMIN=true` and the admin env vars for one-time admin creation.

---

## Pre-deploy checklist

- [ ] **Secrets:** `NEXTAUTH_SECRET` is set and strong (no fallback; server exits if missing in non-test).
- [ ] **Database:** `DATABASE_URL` points to the production DB (no accidental dev DB).
- [ ] **Migrations:** All pending migrations are tested locally and applied in order.
- [ ] **RBAC:** Permission matrix and route protection are up to date (see `RBAC_AUDIT_REPORT.md`).
- [ ] **Backup:** Production DB backup is taken before applying migrations (recommended).
- [ ] **Env:** No `.env` or secrets committed; production uses env vars or a secure secret store.

---

## Deploy steps

1. **Build / pull** the application (e.g. clone tag or build artifact).
2. **Install dependencies:** `npm ci` (or `npm install --production` for prod deps only).
3. **Generate Prisma client:** `npx prisma generate --schema=./prisma/schema.prisma`.
4. **Run migrations only:**  
   `npx prisma migrate deploy`  
   Do **not** run `prisma migrate reset` or `prisma db push` in production.
5. **(Optional) Idempotent seed:**  
   `npm run seed:prod:safe`  
   Use only when you need to ensure permissions/roles/metadata exist. For first-time bootstrap with admin user, set:
   - `BOOTSTRAP_ADMIN=true`
   - `ADMIN_BOOTSTRAP_USERNAME`
   - `ADMIN_BOOTSTRAP_EMAIL`
   - `ADMIN_BOOTSTRAP_PASSWORD` (min 12 chars; no weak patterns).  
   Do **not** run `npm run seed` or `npm run seed:dev:reset` in production.
6. **Start the server:** `NODE_ENV=production npm start` (or your process manager command).

---

## Post-deploy verification

- [ ] **Health:** `GET /health` or `GET /` returns 200.
- [ ] **Auth:** Login with a known user and optional change-password flow (see below).
- [ ] **RBAC:** Run `npm run script:check-permissions` and `npm run script:audit-rbac-bypasses` (from repo; audit may report intentional bypasses).
- [ ] **Change-password (optional):** If API is up and you have test credentials:  
  `API_URL=https://your-api/api/v1 npm run test:change-password` (set `CHANGEPASS_USER`, `CHANGEPASS_OLD`, `CHANGEPASS_NEW` if needed).

---

## Rollback plan

1. **Application rollback:** Redeploy the previous application version (same Node version and env). No DB rollback yet.
2. **Database rollback (migrations):** Prisma does not ship a built-in “migrate down.” To revert schema:
   - Restore from a **DB backup** taken before `migrate deploy`, or
   - Manually apply a reverse migration (new migration that undoes the previous one). Plan this before deploying breaking schema changes.
3. **Seed rollback:** `seed:prod:safe` only adds/updates metadata (permissions, roles, types, statuses, labels). It does not delete application data. If you need to undo a bad prod-safe seed, restore from backup or fix data manually; do not run the destructive seed.

---

## Security and access

- **JWT:** No fallback secret; server and auth middleware fail closed if `NEXTAUTH_SECRET` is missing (non-test).
- **Uploads:** Only `/uploads/branding/` is served as static public content. All other upload paths (e.g. task attachments) are served via the API with auth and permission checks (`GET /api/v1/attachments/:id`).
- **RBAC:** See `RBAC_AUDIT_REPORT.md` for permission matrix, route inventory, and bypass logic.

---

## Validation commands (reference)

| Command | Purpose |
|--------|---------|
| `npm run script:validate-seed-safety` | Asserts destructive seed aborts when `NODE_ENV=production`. |
| `npm run script:check-permissions` | Lists permissions in DB (run against target DB). |
| `npm run script:audit-rbac-bypasses` | Scans for role-based bypass patterns (may flag intentional admin bypass). |
| `npm run test:change-password` | E2E change-password (set `API_URL` and optionally `CHANGEPASS_*`). |
| `npm run test:kpis` | KPIs test (requires DB and env). |
