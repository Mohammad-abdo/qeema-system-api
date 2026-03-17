"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../../.env") });
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { requestIdMiddleware } = require("./middleware/requestId");
const { requestLogMiddleware } = require("./middleware/requestLog");
const { metricsMiddleware } = require("./middleware/metrics");
const { globalLimiter, apiV1Limiter } = require("./middleware/rateLimit");
const logger = require("./lib/logger");
const { sendError, CODES } = require("./lib/errorResponse");
const healthRouter = require("./routes/health");
const projectsRouter = require("./routes/projects");
const tasksRouter = require("./routes/tasks");
const projectStatusesRouter = require("./routes/project-statuses");
const projectTypesRouter = require("./routes/project-types");
const taskStatusesRouter = require("./routes/task-statuses");
const usersRouter = require("./routes/users");
const teamsRouter = require("./routes/teams");
const dashboardRouter = require("./routes/dashboard");
const statsRouter = require("./routes/stats");
const activityLogsRouter = require("./routes/activity-logs");
const notificationsRouter = require("./routes/notifications");
const focusRouter = require("./routes/focus");
const assignmentRouter = require("./routes/assignment");
const authRouter = require("./routes/auth");
const systemSettingsRouter = require("./routes/system-settings");
const rbacRouter = require("./routes/rbac");
const attachmentsRouter = require("./routes/attachments");
const searchRouter = require("./routes/search");
const reportsRouter = require("./routes/reports");

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const BODY_LIMIT = process.env.BODY_LIMIT || "512kb";
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS) || 30000;

// CORS: allowlist from CORS_ORIGINS (comma-separated) or single CORS_ORIGIN.
// Default allows common dev origins (Next.js 3000, Vite 5173) so React frontend gets data.
const defaultOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : process.env.CORS_ORIGIN
    ? [process.env.CORS_ORIGIN]
    : defaultOrigins;
const corsOptions = {
  origin: corsOrigins.length === 1 ? corsOrigins[0] : (origin, cb) => {
    if (!origin || corsOrigins.includes(origin)) cb(null, true);
    else cb(null, false);
  },
  credentials: true,
};

// Optional Sentry (init only when SENTRY_DSN is set; requires npm install @sentry/node)
let Sentry;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require("@sentry/node");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || "development",
      tracesSampleRate: 0.1,
    });
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
  } catch (e) {
    logger.warn("Sentry not installed; run npm install @sentry/node to enable", {});
  }
}

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));
// Ensure essential secrets are provided
if (process.env.NODE_ENV !== "test" && !process.env.NEXTAUTH_SECRET) {
  logger.error("FATAL: NEXTAUTH_SECRET is not set. Terminating startup.");
  process.exit(1);
}

// Serve uploaded files (e.g. branding logo)
// Only serve safe public content directly. Block tasks/sensitive attachments.
app.use("/uploads", (req, res, next) => {
  // Allow branding or other genuinely public folders
  if (req.path.startsWith("/branding/")) {
    return next();
  }
  // Otherwise forbid direct access (clients should use GET /api/v1/attachments/:id)
  return res.status(403).json({ success: false, error: "Direct access forbidden. Use /api/v1/attachments endpoint." });
}, express.static(path.join(process.cwd(), "public", "uploads")));
app.use(requestIdMiddleware);
app.use(requestLogMiddleware);
app.use(cors(corsOptions));
app.use(express.json({ limit: BODY_LIMIT }));
app.use(globalLimiter);

app.use("/health", healthRouter);
app.use(metricsMiddleware);
app.use("/api/v1", apiV1Limiter);
// Auth routes first (no Bearer required for login/register)
app.use("/api/v1", authRouter);
app.use("/api/v1", projectsRouter);
app.use("/api/v1", tasksRouter);
app.use("/api/v1", projectStatusesRouter);
app.use("/api/v1", projectTypesRouter);
app.use("/api/v1", taskStatusesRouter);
app.use("/api/v1", usersRouter);
app.use("/api/v1", teamsRouter);
app.use("/api/v1", dashboardRouter);
app.use("/api/v1", statsRouter);
app.use("/api/v1", activityLogsRouter);
app.use("/api/v1", notificationsRouter);
app.use("/api/v1", focusRouter);
app.use("/api/v1", assignmentRouter);
app.use("/api/v1", systemSettingsRouter);
app.use("/api/v1", rbacRouter);
app.use("/api/v1", attachmentsRouter);
app.use("/api/v1", searchRouter);
app.use("/api/v1/reports", reportsRouter);

if (process.env.SENTRY_DSN && Sentry) {
  app.use(Sentry.Handlers.errorHandler());
}

app.use((err, req, res, next) => {
  const requestId = req.id || "unknown";
  logger.error("Unhandled error", {
    requestId,
    error: err.message,
    stack: err.stack,
    route: req.originalUrl,
    method: req.method,
  });
  sendError(res, 500, "Internal server error", { code: CODES.INTERNAL_ERROR, requestId });
});

const server = app.listen(PORT, () => {
  logger.info("Backend listening", { port: PORT });
  // Optional: daily at 00:00 (server local time) notify users with unfinished yesterday focus tasks
  try {
    const cron = require("node-cron");
    const { runUnfinishedYesterdayNotifications } = require("./jobs/focusRolloverReminder");
    cron.schedule("0 0 * * *", async () => {
      try {
        const count = await runUnfinishedYesterdayNotifications();
        if (count > 0) logger.info("Focus rollover reminders sent", { count });
      } catch (e) {
        logger.error("Focus rollover reminder job failed", { error: e.message });
      }
    });
  } catch (e) {
    logger.warn("Focus rollover reminder cron not started", { error: e.message });
  }
});
server.timeout = REQUEST_TIMEOUT_MS;
server.keepAliveTimeout = REQUEST_TIMEOUT_MS + 1000;
server.headersTimeout = REQUEST_TIMEOUT_MS + 2000;

function shutdown() {
  server.close(() => {
    console.log("[backend] Shutdown complete");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
