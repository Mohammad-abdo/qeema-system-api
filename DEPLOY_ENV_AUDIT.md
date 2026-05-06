# Deployment environment audit (fill and keep updated)

Use this template to record **exactly** what runs on your live server. Wrong `DATABASE_URL` or missing `NODE_ENV=production` commonly causes empty data or accidental destructive seeds.

**Team / last reviewed:** _______________ **Date:** _______________

## 1. Hosting and deploy mechanism

- **Where the API runs:** (e.g. VPS, Plesk, Docker, PM2, systemd, cloud panel)  
  _______________________________________________

- **How code is updated:** (e.g. `git pull`, FTP upload, CI/CD pipeline name)  
  _______________________________________________

- **Exact commands executed on each deploy** (copy from your script or panel; attach file if needed):

```
(paste here)
```

## 2. Environment variables (production)

| Variable | Verified? | Notes (never paste real passwords in git) |
|----------|-----------|---------------------------------------------|
| `NODE_ENV` | [ ] | Must be `production` so destructive seed (`prisma/seed.js`) aborts. |
| `DATABASE_URL` | [ ] | Must point at the **production MySQL** database (host, database name, user). |
| `NEXTAUTH_SECRET` | [ ] | Required for JWT. |

## 3. Database

- **MySQL host / database name** (identifiers only): _______________

- **Confirmed `DATABASE_URL` matches that instance:** [ ] yes

- **Backups enabled:** (provider snapshots / cron `mysqldump`) _______________

## 4. Commands that must NOT run on production

- [ ] `npm run seed` / `npm run prisma:seed` / `npm run seed:dev:reset` (destructive)
- [ ] `npx prisma migrate reset`
- [ ] `npx prisma db push` (use migrations instead)
- [ ] `npx prisma migrate dev`

## 5. Safe commands for schema updates

- `npx prisma generate --schema=./prisma/schema.prisma`
- `npm run deploy:db` (wrapper: `prisma migrate deploy` with production guard)
- Optional metadata only: `npm run seed:prod:safe`

## 6. Post-deploy smoke test

- [ ] API health responds
- [ ] Login works
- [ ] Known project or task count matches expectation (or run `npm run script:verify-db` if configured)

---

Store secrets outside this file. Keep the filled audit in a **private** ops wiki or encrypted store if it contains sensitive hostnames.
