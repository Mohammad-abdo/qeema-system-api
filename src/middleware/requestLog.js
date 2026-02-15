"use strict";

const logger = require("../lib/logger");

/**
 * Log each request after completion: requestId, route, method, statusCode, durationMs, userId (if set by auth).
 */
function requestLogMiddleware(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const meta = {
      requestId: req.id,
      route: req.originalUrl || req.url,
      method: req.method,
      statusCode: res.statusCode,
      durationMs,
    };
    if (req.user && req.user.id) {
      meta.userId = req.user.id;
    }
    logger.info("request", meta);
  });
  next();
}

module.exports = { requestLogMiddleware };
