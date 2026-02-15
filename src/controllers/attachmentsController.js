"use strict";

const path = require("path");
const fs = require("fs");
const { prisma } = require("../lib/prisma");
const { hasPermissionWithoutRoleBypass } = require("../lib/rbac");
const { sendError, CODES } = require("../lib/errorResponse");

/**
 * GET /api/v1/attachments/:id
 * Stream attachment file. Requires auth and project access.
 */
async function download(req, res) {
  const requestId = req.id;
  const attachmentId = parseInt(req.params.id, 10);
  const userId = parseInt(req.user?.id, 10);

  if (Number.isNaN(attachmentId)) {
    return sendError(res, 400, "Invalid attachment ID", { code: CODES.BAD_REQUEST, requestId });
  }

  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        task: {
          select: { projectId: true },
        },
      },
    });

    if (!attachment) {
      return sendError(res, 404, "Attachment not found", { code: CODES.NOT_FOUND, requestId });
    }

    const projectId = attachment.task?.projectId;
    if (!projectId) {
      return sendError(res, 400, "Invalid attachment - no associated project", {
        code: CODES.BAD_REQUEST,
        requestId,
      });
    }

    const canViewAll = await hasPermissionWithoutRoleBypass(userId, "project.viewAll");
    if (!canViewAll) {
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { createdById: userId },
            { projectManagerId: userId },
            { projectUsers: { some: { userId } } },
          ],
        },
        select: { id: true },
      });
      if (!project) {
        return sendError(res, 403, "You don't have access to this project", {
          code: CODES.FORBIDDEN,
          requestId,
        });
      }
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    const filePath = path.join(process.cwd(), "public", attachment.fileUrl);
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadsDir = path.resolve(uploadsDir);

    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
      return sendError(res, 403, "Invalid file path", { code: CODES.FORBIDDEN, requestId });
    }

    if (!fs.existsSync(resolvedPath)) {
      return sendError(res, 404, "File not found on disk", { code: CODES.NOT_FOUND, requestId });
    }

    const stat = fs.statSync(resolvedPath);
    const stream = fs.createReadStream(resolvedPath);

    res.set({
      "Content-Type": attachment.fileType || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Frame-Options": "DENY",
      "Content-Disposition": attachment.fileType?.startsWith("image/")
        ? `inline; filename="${attachment.fileName}"`
        : `attachment; filename="${attachment.fileName}"`,
      "Content-Length": String(stat.size),
    });

    stream.pipe(res);
    stream.on("error", (err) => {
      console.error("[attachments] stream error:", err);
      if (!res.headersSent) sendError(res, 500, "Stream error", { requestId });
    });
  } catch (err) {
    console.error("[attachments] download error:", err);
    if (!res.headersSent) {
      sendError(res, 500, "Internal server error", {
        code: CODES.INTERNAL_ERROR,
        requestId,
      });
    }
  }
}

module.exports = { download };
