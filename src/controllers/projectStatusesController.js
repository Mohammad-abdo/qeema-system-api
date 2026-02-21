"use strict";

const { prisma } = require("../lib/prisma");
const { sendError, CODES } = require("../lib/errorResponse");
const { logActivity } = require("../lib/activityLogger");

async function list(req, res) {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const where = includeInactive ? {} : { isActive: true };

    const projectStatuses = await prisma.projectStatus.findMany({
      where,
      orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
    });

    return res.json({ success: true, projectStatuses });
  } catch (err) {
    console.error("[projectStatusesController] list:", err);
    sendError(res, 500, "Failed to fetch project statuses", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function getOne(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const projectStatus = await prisma.projectStatus.findUnique({
      where: { id },
    });

    if (!projectStatus) return sendError(res, 404, "Project status not found", { code: CODES.NOT_FOUND, requestId: req.id });
    return res.json(projectStatus);
  } catch (err) {
    console.error("[projectStatusesController] getOne:", err);
    sendError(res, 500, "Failed to fetch project status", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function create(req, res) {
  try {
    const { name, color = "#6b7280", isDefault = false, isFinal = false, isUrgent = false, orderIndex = 0, isActive = true } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return sendError(res, 400, "Name is required", { code: CODES.BAD_REQUEST, requestId: req.id });
    }

    if (isDefault) {
      await prisma.projectStatus.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const projectStatus = await prisma.projectStatus.create({
      data: {
        name: name.trim(),
        color: typeof color === "string" ? color : "#6b7280",
        isDefault: Boolean(isDefault),
        isFinal: Boolean(isFinal),
        isUrgent: Boolean(isUrgent),
        orderIndex: Number(orderIndex) || 0,
        isActive: Boolean(isActive),
      },
    });
    const userId = Number(req.user?.id);
    if (userId) {
      await logActivity({
        actionType: "project_status_created",
        actionCategory: "settings",
        entityType: "project_status",
        entityId: projectStatus.id,
        performedById: userId,
        actionSummary: `Project status '${projectStatus.name}' created`,
      }, req);
    }
    return res.status(201).json({ success: true, projectStatus });
  } catch (err) {
    if (err.code === "P2002") return sendError(res, 409, "A project status with this name already exists", { code: "CONFLICT", requestId: req.id });
    console.error("[projectStatusesController] create:", err);
    sendError(res, 500, "Failed to create project status", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function update(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const existing = await prisma.projectStatus.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "Project status not found", { code: CODES.NOT_FOUND, requestId: req.id });

    const { name, color, isDefault, isFinal, isUrgent, orderIndex, isActive } = req.body || {};
    if (isDefault && !existing.isDefault) {
      await prisma.projectStatus.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const projectStatus = await prisma.projectStatus.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(color !== undefined && { color: String(color) }),
        ...(isDefault !== undefined && { isDefault: Boolean(isDefault) }),
        ...(isFinal !== undefined && { isFinal: Boolean(isFinal) }),
        ...(isUrgent !== undefined && { isUrgent: Boolean(isUrgent) }),
        ...(orderIndex !== undefined && { orderIndex: Number(orderIndex) || 0 }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });
    const userId = Number(req.user?.id);
    if (userId) {
      await logActivity({
        actionType: "project_status_updated",
        actionCategory: "settings",
        entityType: "project_status",
        entityId: id,
        performedById: userId,
        actionSummary: `Project status '${existing.name}' updated`,
      }, req);
    }
    return res.json({ success: true, projectStatus });
  } catch (err) {
    if (err.code === "P2002") return sendError(res, 409, "A project status with this name already exists", { code: "CONFLICT", requestId: req.id });
    console.error("[projectStatusesController] update:", err);
    sendError(res, 500, "Failed to update project status", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function remove(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const count = await prisma.project.count({ where: { projectStatusId: id } });
    if (count > 0) {
      return sendError(res, 400, `Cannot delete: ${count} project(s) are using this status. Deactivate it instead.`, { code: CODES.BAD_REQUEST, requestId: req.id });
    }

    const status = await prisma.projectStatus.findUnique({ where: { id } });
    if (!status) return sendError(res, 404, "Project status not found", { code: CODES.NOT_FOUND, requestId: req.id });
    const userId = Number(req.user?.id);
    if (userId) {
      await logActivity({
        actionType: "project_status_deleted",
        actionCategory: "settings",
        entityType: "project_status",
        entityId: id,
        performedById: userId,
        actionSummary: `Project status '${status.name}' deleted`,
      }, req);
    }
    await prisma.projectStatus.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) {
    console.error("[projectStatusesController] remove:", err);
    sendError(res, 500, "Failed to delete project status", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function toggle(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const current = await prisma.projectStatus.findUnique({ where: { id }, select: { isActive: true, name: true } });
    if (!current) return sendError(res, 404, "Project status not found", { code: CODES.NOT_FOUND, requestId: req.id });

    const projectStatus = await prisma.projectStatus.update({
      where: { id },
      data: { isActive: !current.isActive },
    });

    return res.json({ success: true, projectStatus });
  } catch (err) {
    console.error("[projectStatusesController] toggle:", err);
    sendError(res, 500, "Failed to toggle project status", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function reorder(req, res) {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return sendError(res, 400, "ids array is required", { code: CODES.BAD_REQUEST, requestId: req.id });

    await Promise.all(
      ids.map((id, index) =>
        prisma.projectStatus.update({
          where: { id: Number(id) },
          data: { orderIndex: index },
        })
      )
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("[projectStatusesController] reorder:", err);
    sendError(res, 500, "Failed to reorder project statuses", { code: CODES.INTERNAL_ERROR, requestId: req.id });
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
