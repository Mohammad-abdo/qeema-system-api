"use strict";

const rateLimit = require("express-rate-limit");

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_GLOBAL = Number(process.env.RATE_LIMIT_MAX_GLOBAL) || 2000;
const MAX_API = Number(process.env.RATE_LIMIT_MAX_API) || 500;

/**
 * Global rate limit: per IP, applies to all routes after this middleware.
 */
const globalLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_GLOBAL,
  message: { error: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter limit for /api/v1 (projects, tasks). Per IP.
 */
const apiV1Limiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_API,
  message: { error: "Too many requests", code: "RATE_LIMITED" },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { globalLimiter, apiV1Limiter };
