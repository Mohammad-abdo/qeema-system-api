"use strict";

const crypto = require("crypto");

/**
 * Attach a request ID to each request (generate or use X-Request-ID / x-request-id).
 * Sets req.id and sends Res-X-Request-ID in response.
 */
function requestIdMiddleware(req, res, next) {
  const incoming = req.headers["x-request-id"] || req.headers["X-Request-ID"];
  req.id = typeof incoming === "string" && incoming.length > 0
    ? incoming
    : crypto.randomUUID();
  res.setHeader("X-Request-ID", req.id);
  next();
}

module.exports = { requestIdMiddleware };
