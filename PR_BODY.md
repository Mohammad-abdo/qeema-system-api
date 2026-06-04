## Summary
- `requirePermission` on project/task mutating routes
- Transactional DB import/restore with pre-restore backup
- Migration removes legacy `projects.status/type` and `tasks.status`
- Controllers use `projectStatus` / `taskStatus` relations
- Deliverables, phases, and task time-log REST endpoints

## Merge order
**Merge and deploy this PR before the frontend PR.**

```bash
# Stop API on Windows if prisma generate hits EPERM
npx prisma migrate deploy
npx prisma generate
npm run dev
```

## Test plan
- [ ] `npm run test:api` — 5/5 pass
- [ ] `npm run test:smoke` — 13/13 pass (set `SMOKE_PASSWORD` or `ADMIN_BOOTSTRAP_PASSWORD` in `.env`)
- [ ] Dashboard `/api/v1/dashboard/summary` returns 200 (no Prisma `status` errors)
- [ ] `GET /projects/:id` includes `deliverables` and `phases`
- [ ] Deliverables/phases CRUD under project routes
- [ ] `POST/DELETE /tasks/:id/time-logs` works
- [ ] `PATCH /tasks/:id` with `taskStatusId` works (kanban)
- [ ] RBAC: user without permission gets 403 on guarded routes
