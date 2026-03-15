"use strict";

const path = require("path");
const fs = require("fs");
const { prisma } = require("../lib/prisma");
const { hasPermissionWithoutRoleBypass } = require("../lib/rbac");
const { sendError, CODES } = require("../lib/errorResponse");

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB

async function checkTaskProjectAccess(userId, taskId) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true },
  });
  if (!task || !task.projectId) return null;
  const canViewAll = await hasPermissionWithoutRoleBypass(userId, "project.viewAll");
  if (canViewAll) return task.projectId;
  const project = await prisma.project.findFirst({
    where: {
      id: task.projectId,
      OR: [
        { createdById: userId },
        { projectManagerId: userId },
        { projectUsers: { some: { userId } } },
      ],
    },
    select: { id: true },
  });
  return project ? task.projectId : null;
}

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

/**
 * POST /api/v1/tasks/:id/attachments
 * Upload a file for a task. Expects multipart field "file". Requires task and project access.
 */
async function uploadForTask(req, res) {
  const requestId = req.id;
  const taskId = parseInt(req.params.id, 10);
  const userId = parseInt(req.user?.id, 10);

  if (Number.isNaN(taskId)) {
    return sendError(res, 400, "Invalid task ID", { code: CODES.BAD_REQUEST, requestId });
  }
  if (!userId) {
    return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId });
  }

  const file = req.file;
  if (!file) {
    return sendError(res, 400, "No file uploaded; use field name 'file'", { code: CODES.BAD_REQUEST, requestId });
  }
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return sendError(res, 400, "File too large; max 10MB", { code: CODES.BAD_REQUEST, requestId });
  }

  try {
    const hasAccess = await checkTaskProjectAccess(userId, taskId);
    if (!hasAccess) {
      return sendError(res, 403, "You don't have access to this task's project", {
        code: CODES.FORBIDDEN,
        requestId,
      });
    }

    const baseDir = path.join(process.cwd(), "public", "uploads", "tasks", String(taskId));
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    const rawName = (file.originalname || "file").replace(/^.*[\\/]/, "").slice(0, 200);
    const ext = path.extname(rawName) || "";
    const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
    const uniqueName = `${Date.now()}-${safeName}`;
    const relativeUrl = path.join("uploads", "tasks", String(taskId), uniqueName).split(path.sep).join("/");
    const destPath = path.join(process.cwd(), "public", relativeUrl);

    fs.writeFileSync(destPath, file.buffer);

    const attachment = await prisma.attachment.create({
      data: {
        fileName: file.originalname || uniqueName,
        fileUrl: relativeUrl,
        fileType: file.mimetype || null,
        fileSize: file.size,
        taskId,
        uploadedById: userId,
      },
      select: { id: true, fileName: true, fileUrl: true, fileType: true, fileSize: true, uploadedAt: true },
    });

    return res.status(201).json({ success: true, attachment });
  } catch (err) {
    console.error("[attachments] uploadForTask error:", err);
    if (!res.headersSent) {
      sendError(res, 500, err.message || "Failed to upload attachment", {
        code: CODES.INTERNAL_ERROR,
        requestId,
      });
    }
  }
}

/**
 * DELETE /api/v1/attachments/:id
 * Delete attachment and file. Requires project access.
 */
async function remove(req, res) {
  const requestId = req.id;
  const attachmentId = parseInt(req.params.id, 10);
  const userId = parseInt(req.user?.id, 10);

  if (Number.isNaN(attachmentId)) {
    return sendError(res, 400, "Invalid attachment ID", { code: CODES.BAD_REQUEST, requestId });
  }
  if (!userId) {
    return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId });
  }

  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { task: { select: { projectId: true } } },
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

    const hasAccess = await checkTaskProjectAccess(userId, attachment.taskId);
    if (!hasAccess) {
      return sendError(res, 403, "You don't have access to this project", {
        code: CODES.FORBIDDEN,
        requestId,
      });
    }

    const filePath = path.join(process.cwd(), "public", attachment.fileUrl);
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (path.resolve(filePath).startsWith(path.resolve(uploadsDir)) && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    await prisma.attachment.delete({ where: { id: attachmentId } });
    return res.json({ success: true });
  } catch (err) {
    console.error("[attachments] remove error:", err);
    if (!res.headersSent) {
      sendError(res, 500, err.message || "Failed to delete attachment", {
        code: CODES.INTERNAL_ERROR,
        requestId,
      });
    }
  }
}

module.exports = { download, uploadForTask, remove };
