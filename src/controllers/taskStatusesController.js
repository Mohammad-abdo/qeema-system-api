"use strict";

const { prisma } = require("../lib/prisma");
const { sendError, CODES } = require("../lib/errorResponse");

async function list(req, res) {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const where = includeInactive ? {} : { isActive: true };

    const taskStatuses = await prisma.taskStatus.findMany({
      where,
      orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
    });

    return res.json({ success: true, taskStatuses });
  } catch (err) {
    console.error("[taskStatusesController] list:", err);
    sendError(res, 500, "Failed to fetch task statuses", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function getOne(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const taskStatus = await prisma.taskStatus.findUnique({
      where: { id },
    });

    if (!taskStatus) return sendError(res, 404, "Task status not found", { code: CODES.NOT_FOUND, requestId: req.id });
    return res.json(taskStatus);
  } catch (err) {
    console.error("[taskStatusesController] getOne:", err);
    sendError(res, 500, "Failed to fetch task status", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function create(req, res) {
  try {
    const {
      name,
      color = "#6b7280",
      isDefault = false,
      isFinal = false,
      isBlocking = false,
      orderIndex = 0,
      isActive = true,
    } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return sendError(res, 400, "Name is required", { code: CODES.BAD_REQUEST, requestId: req.id });
    }

    if (isDefault) {
      await prisma.taskStatus.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const taskStatus = await prisma.taskStatus.create({
      data: {
        name: name.trim(),
        color: typeof color === "string" ? color : "#6b7280",
        isDefault: Boolean(isDefault),
        isFinal: Boolean(isFinal),
        isBlocking: Boolean(isBlocking),
        orderIndex: Number(orderIndex) || 0,
        isActive: Boolean(isActive),
      },
    });

    return res.status(201).json({ success: true, taskStatus });
  } catch (err) {
    if (err.code === "P2002") return sendError(res, 409, "A task status with this name already exists", { code: "CONFLICT", requestId: req.id });
    console.error("[taskStatusesController] create:", err);
    sendError(res, 500, "Failed to create task status", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function update(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const existing = await prisma.taskStatus.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "Task status not found", { code: CODES.NOT_FOUND, requestId: req.id });

    const { name, color, isDefault, isFinal, isBlocking, orderIndex, isActive } = req.body || {};
    if (isDefault && !existing.isDefault) {
      await prisma.taskStatus.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const taskStatus = await prisma.taskStatus.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(color !== undefined && { color: String(color) }),
        ...(isDefault !== undefined && { isDefault: Boolean(isDefault) }),
        ...(isFinal !== undefined && { isFinal: Boolean(isFinal) }),
        ...(isBlocking !== undefined && { isBlocking: Boolean(isBlocking) }),
        ...(orderIndex !== undefined && { orderIndex: Number(orderIndex) || 0 }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    return res.json({ success: true, taskStatus });
  } catch (err) {
    if (err.code === "P2002") return sendError(res, 409, "A task status with this name already exists", { code: "CONFLICT", requestId: req.id });
    console.error("[taskStatusesController] update:", err);
    sendError(res, 500, "Failed to update task status", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function remove(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const status = await prisma.taskStatus.findUnique({
      where: { id },
      include: { tasks: { take: 1 } },
    });

    if (!status) return sendError(res, 404, "Task status not found", { code: CODES.NOT_FOUND, requestId: req.id });
    if (status.tasks.length > 0) {
      return sendError(res, 400, "Cannot delete: status is assigned to existing tasks. Deactivate it instead.", { code: CODES.BAD_REQUEST, requestId: req.id });
    }

    await prisma.taskStatus.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) {
    console.error("[taskStatusesController] remove:", err);
    sendError(res, 500, "Failed to delete task status", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function toggle(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const current = await prisma.taskStatus.findUnique({ where: { id }, select: { isActive: true, name: true } });
    if (!current) return sendError(res, 404, "Task status not found", { code: CODES.NOT_FOUND, requestId: req.id });

    const taskStatus = await prisma.taskStatus.update({
      where: { id },
      data: { isActive: !current.isActive },
    });

    return res.json({ success: true, taskStatus });
  } catch (err) {
    console.error("[taskStatusesController] toggle:", err);
    sendError(res, 500, "Failed to toggle task status", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function reorder(req, res) {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return sendError(res, 400, "ids array is required", { code: CODES.BAD_REQUEST, requestId: req.id });

    await Promise.all(
      ids.map((id, index) =>
        prisma.taskStatus.update({
          where: { id: Number(id) },
          data: { orderIndex: index },
        })
      )
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("[taskStatusesController] reorder:", err);
    sendError(res, 500, "Failed to reorder task statuses", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
  toggle,
  reorder,
};
