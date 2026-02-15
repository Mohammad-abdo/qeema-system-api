"use strict";

const jwt = require("jsonwebtoken");
const { sendError, CODES } = require("../lib/errorResponse");

// Must match auth route (JWT_SECRET = NEXTAUTH_SECRET || "your-secret-key")
const JWT_SECRET = process.env.NEXTAUTH_SECRET || "your-secret-key";

function authMiddleware(req, res, next) {
  const requestId = req.id || undefined;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: String(payload.id ?? payload.sub), role: payload.role };
    next();
  } catch (err) {
    return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId });
  }
}

module.exports = { authMiddleware };
