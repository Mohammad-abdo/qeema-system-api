"use strict";

/**
 * Standardized API error shape: { error, code?, requestId? }.
 * Use in route handlers and global error handler so clients get consistent responses.
 *
 * @param {import("express").Response} res
 * @param {number} statusCode - HTTP status (4xx, 5xx)
 * @param {string} message - Human-readable error message
 * @param {{ code?: string, requestId?: string }} [opts]
 */
function sendError(res, statusCode, message, opts = {}) {
  const body = { error: message };
  if (opts.code) body.code = opts.code;
  if (opts.requestId) body.requestId = opts.requestId;
  res.status(statusCode).json(body);
}

/**
 * Send success response (200) with optional payload.
 * @param {import("express").Response} res
 * @param {object} data - Response body (e.g. { message, user, token })
 */
function sendSuccess(res, data) {
  res.status(200).json(data);
}

/** Common error codes for API responses */
const CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVER_ERROR: "SERVER_ERROR",
};

module.exports = { sendError, sendSuccess, CODES };
