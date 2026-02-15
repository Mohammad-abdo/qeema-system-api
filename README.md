# PMS Backend (Phase 2)

Standalone Node.js API service (JavaScript only). هيكل الباك اند: **Controllers** تحتوي على كل منطق الأعمال، **Routes** تستدعي الـ Controllers فقط، **Middleware** للمصادقة والصلاحيات.

## هيكل المشروع (Backend structure)

```
backend/src/
├── controllers/          # كل منطق الأعمال (منقول من الفرونت)
│   ├── projectsController.js
│   ├── tasksController.js
│   ├── projectStatusesController.js
│   ├── projectTypesController.js
│   ├── taskStatusesController.js
│   ├── usersController.js
│   ├── teamsController.js
│   ├── dashboardController.js
│   ├── statsController.js
│   ├── activityLogsController.js
│   └── notificationsController.js
├── middleware/           # المصادقة والصلاحيات والطلب
│   ├── auth.js           # JWT تحقق
│   ├── requirePermission.js  # تحقق صلاحية (اختياري)
│   ├── rateLimit.js
│   ├── requestId.js
│   ├── requestLog.js
│   └── metrics.js
├── routes/               # ربط المسارات بالـ Controllers فقط
│   ├── health.js
│   ├── projects.js
│   ├── tasks.js
│   ├── project-statuses.js
│   ├── project-types.js
│   ├── task-statuses.js
│   ├── users.js
│   ├── teams.js
│   ├── dashboard.js
│   ├── stats.js
│   ├── activity-logs.js
│   └── notifications.js
├── lib/                  # مساعدات مشتركة
│   ├── prisma.js
│   ├── rbac.js           # الصلاحيات (منقول من الفرونت)
│   ├── activityLogger.js # تسجيل النشاط (منقول من الفرونت)
│   ├── errorResponse.js
│   └── logger.js
└── server.js
```

## Setup

1. Copy root `.env` (or symlink) so `DATABASE_URL` and `NEXTAUTH_SECRET` are set.
2. From repo root: `npm run backend` (or `cd apps/backend && npm install && npm run prisma:generate && npm start`).
3. Backend listens on `PORT` (default 4000). Set `CORS_ORIGIN=http://localhost:3000` to allow the frontend.

## Auth

Requests must include `Authorization: Bearer <jwt>`. The JWT is the same as NextAuth session token. Frontend obtains it via `GET /api/auth/token` (same-origin) and sends it to the backend.

## Feature flag (ربط الفرونت بالباك اند)

في مجلد الفرونت، أضف في `.env` أو `.env.local`:

- `NEXT_PUBLIC_USE_PROJECTS_API=true`
- `NEXT_PUBLIC_PROJECTS_BACKEND_URL=http://localhost:4000`

بعدها ستستدعي الصفحات تلقائياً: المشاريع، المهام، المستخدمين، الفرق، الداشبورد، الإحصائيات، سجل النشاط، الإشعارات من الباك اند بدل Prisma المحلي.

## اختبار الـ API (Test)

شغّل الباك اند ثم من مجلد الباك اند:

```bash
npm run test:api
```

بدون توكن يتحقق من: `/health`، `/metrics`، و 401 لـ `/api/v1/projects` و `/api/v1/notifications` و `/api/v1/project-types`.  
مع توكن (مثلاً JWT من NextAuth): `BACKEND_TEST_TOKEN=<jwt> npm run test:api` لاختبار المسارات المحمية (مشاريع، مستخدمين، فرق، داشبورد، إحصائيات، إشعارات، أنواع مشاريع، حالات مهام).

**كيف تتأكد أن الربط شغال:** شغّل الباك اند (`npm run dev`) والفرونت، فعّل في الفرونت `NEXT_PUBLIC_USE_PROJECTS_API=true` و `NEXT_PUBLIC_PROJECTS_BACKEND_URL=http://localhost:4000`، ثم افتح الداشبورد وصفحة المشاريع والمستخدمين والفرق — إذا ظهرت البيانات بدون أخطاء فالربط يعمل.

## Rate limiting

- **Global:** 200 requests per 15 minutes per IP (configurable via `RATE_LIMIT_MAX_GLOBAL`).
- **API v1:** 100 requests per 15 minutes per IP for `/api/v1/*` (configurable via `RATE_LIMIT_MAX_API`).
- When exceeded, responses are 429 with body `{ error: "Too many requests", code: "RATE_LIMITED" }`. Headers `RateLimit-*` are set per standard.

## Observability

- **Request ID:** Every response includes `X-Request-ID`. Send `X-Request-ID` on the request to preserve it.
- **Structured logs:** JSON lines to stdout (request log with `requestId`, `route`, `method`, `statusCode`, `durationMs`, `userId` when authenticated). Errors go to stderr with `requestId` and stack.
- **Prometheus metrics:** `GET /metrics` exposes request count, duration histogram, and response size (no auth). Configure your scraper to hit this endpoint.
- **Sentry (optional):** Set `SENTRY_DSN` and install `@sentry/node` to report errors to Sentry. If unset or package not installed, the server runs without Sentry.

## Additional env (optional)

- `BODY_LIMIT` — JSON body size limit (default `512kb`).
- `REQUEST_TIMEOUT_MS` — Server request timeout in ms (default `30000`).
- `SENTRY_DSN` — Sentry DSN for error tracking; requires `npm install @sentry/node`.

## API error shape

Errors return JSON: `{ error: string, code?: string, requestId?: string }`. Use `requestId` for support and log correlation.

## Endpoints

- `GET /health`
- `GET /metrics` — Prometheus metrics (no auth)
- **Projects:** `GET/POST /api/v1/projects`, `GET/PATCH/DELETE /api/v1/projects/:id`
- **Tasks:** `GET/POST /api/v1/tasks`, `GET/PATCH/DELETE /api/v1/tasks/:id`
- **Project statuses (moved from frontend):** `GET/POST /api/v1/project-statuses`, `GET/PUT/DELETE /api/v1/project-statuses/:id`, `PATCH .../toggle`, `POST .../reorder`
- **Project types (moved from frontend):** `GET/POST /api/v1/project-types`, `GET/PUT/DELETE /api/v1/project-types/:id`, `PATCH .../toggle`, `POST .../reorder`
- **Task statuses (moved from frontend):** `GET/POST /api/v1/task-statuses`, `GET/PUT/DELETE /api/v1/task-statuses/:id`, `PATCH .../toggle`, `POST .../reorder`
- **Users:** `GET /api/v1/users`, `GET /api/v1/users/:id`
- **Teams:** `GET/POST /api/v1/teams`, `GET/PATCH|PUT/DELETE /api/v1/teams/:id`
- **Dashboard:** `GET /api/v1/dashboard/summary`
- **Stats:** `GET /api/v1/stats/projects`, `GET /api/v1/stats/projects/:projectId`
- **Activity logs (Admin only):** `GET /api/v1/activity-logs` (query: limit, offset, startDate, endDate, userId, projectId, category, entityType, search)
- **Notifications:** `GET /api/v1/notifications` (query: limit), `GET /api/v1/notifications/unread-count`, `PATCH /api/v1/notifications/:id/read`, `POST /api/v1/notifications/mark-all-read`, `DELETE /api/v1/notifications/:id`

All `/api/v1/*` routes require `Authorization: Bearer <jwt>`.

## ما نُقل من الفرونت إند (Backend moved from frontend)

تم نقل **كل** المنطق الخاص بالباك اند من الفرونت إلى هنا (JavaScript فقط، بدون TypeScript):

| كان في الفرونت | الآن في الباك اند |
|----------------|-------------------|
| `app/actions/projects.ts` + API routes | `controllers/projectsController.js` + `routes/projects.js` |
| `app/actions/tasks.ts` + API routes | `controllers/tasksController.js` + `routes/tasks.js` |
| `app/actions/project-statuses.ts` | `controllers/projectStatusesController.js` + `routes/project-statuses.js` |
| `app/actions/project-types.ts` | `controllers/projectTypesController.js` + `routes/project-types.js` |
| `app/actions/task-statuses.ts` | `controllers/taskStatusesController.js` + `routes/task-statuses.js` |
| `app/actions/users.ts` | `controllers/usersController.js` + `routes/users.js` |
| `app/actions/teams.ts` | `controllers/teamsController.js` + `routes/teams.js` |
| `app/actions/dashboard.ts` | `controllers/dashboardController.js` + `routes/dashboard.js` |
| `app/actions/stats.ts` | `controllers/statsController.js` + `routes/stats.js` |
| `app/actions/activity-logs.ts` | `controllers/activityLogsController.js` + `routes/activity-logs.js` |
| `app/actions/notifications.ts` | `controllers/notificationsController.js` + `routes/notifications.js` |
| `lib/rbac.ts` / `lib/rbac-helpers.ts` | `lib/rbac.js` + `middleware/requirePermission.js` |
| `lib/activity-logger.ts` | `lib/activityLogger.js` |

- **Controllers:** تحتوي على كل منطق القائمة، الإنشاء، التحديث، الحذف، والصلاحيات (RBAC).
- **Routes:** تستدعي الـ controller فقط (مثلاً `router.get("/projects", projectsController.list)`).
- **Middleware:** `auth.js` يتحقق من JWT، `requirePermission.js` لربط صلاحية بمسار معين عند الحاجة.

عند تشغيل الفرونت مع `NEXT_PUBLIC_USE_PROJECTS_API=true` و `NEXT_PUBLIC_PROJECTS_BACKEND_URL=http://localhost:4000` يتم استخدام الباك اند للمشاريع والمهام وحالات المشاريع/المهام.
#   q e e m a - s y s t e m - a p i  
 