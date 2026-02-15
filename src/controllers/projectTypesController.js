"use strict";

const { prisma } = require("../lib/prisma");
const { sendError, CODES } = require("../lib/errorResponse");

async function list(req, res) {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const includeUsageCount = req.query.includeUsageCount === "true";
    const where = includeInactive ? {} : { isActive: true };

    const projectTypes = await prisma.projectType.findMany({
      where,
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      include: includeUsageCount ? { _count: { select: { projects: true } } } : undefined,
    });

    const formatted = includeUsageCount
      ? projectTypes.map((t) => ({ ...t, usageCount: (t._count && t._count.projects) || 0 }))
      : projectTypes;

    return res.json({ success: true, projectTypes: formatted });
  } catch (err) {
    console.error("[projectTypesController] list:", err);
    sendError(res, 500, "Failed to fetch project types", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function getOne(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const projectType = await prisma.projectType.findUnique({
      where: { id },
    });

    if (!projectType) return sendError(res, 404, "Project type not found", { code: CODES.NOT_FOUND, requestId: req.id });
    return res.json(projectType);
  } catch (err) {
    console.error("[projectTypesController] getOne:", err);
    sendError(res, 500, "Failed to fetch project type", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function create(req, res) {
  try {
    const { name, description, isActive = true, displayOrder = 0, color, icon } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return sendError(res, 400, "Name is required", { code: CODES.BAD_REQUEST, requestId: req.id });
    }

    const projectType = await prisma.projectType.create({
      data: {
        name: name.trim(),
        description: description != null ? String(description) : null,
        isActive: Boolean(isActive),
        displayOrder: Number(displayOrder) || 0,
        color: color != null ? String(color) : null,
        icon: icon != null ? String(icon) : null,
      },
    });

    return res.status(201).json({ success: true, projectType });
  } catch (err) {
    if (err.code === "P2002") return sendError(res, 409, "A project type with this name already exists", { code: "CONFLICT", requestId: req.id });
    console.error("[projectTypesController] create:", err);
    sendError(res, 500, "Failed to create project type", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function update(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const existing = await prisma.projectType.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "Project type not found", { code: CODES.NOT_FOUND, requestId: req.id });

    const { name, description, isActive, displayOrder, color, icon } = req.body || {};
    const projectType = await prisma.projectType.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(description !== undefined && { description: description != null ? String(description) : null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(displayOrder !== undefined && { displayOrder: Number(displayOrder) || 0 }),
        ...(color !== undefined && { color: color != null ? String(color) : null }),
        ...(icon !== undefined && { icon: icon != null ? String(icon) : null }),
      },
    });

    return res.json({ success: true, projectType });
  } catch (err) {
    if (err.code === "P2002") return sendError(res, 409, "A project type with this name already exists", { code: "CONFLICT", requestId: req.id });
    console.error("[projectTypesController] update:", err);
    sendError(res, 500, "Failed to update project type", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function remove(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const count = await prisma.project.count({ where: { projectTypeId: id } });
    if (count > 0) {
      return sendError(res, 400, `Cannot delete: ${count} project(s) are using this type.`, { code: CODES.BAD_REQUEST, requestId: req.id });
    }

    const type = await prisma.projectType.findUnique({ where: { id } });
    if (!type) return sendError(res, 404, "Project type not found", { code: CODES.NOT_FOUND, requestId: req.id });

    await prisma.projectType.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) {
    console.error("[projectTypesController] remove:", err);
    sendError(res, 500, "Failed to delete project type", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function toggle(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return sendError(res, 400, "Invalid ID", { code: CODES.BAD_REQUEST, requestId: req.id });

    const current = await prisma.projectType.findUnique({ where: { id }, select: { isActive: true, name: true } });
    if (!current) return sendError(res, 404, "Project type not found", { code: CODES.NOT_FOUND, requestId: req.id });

    const projectType = await prisma.projectType.update({
      where: { id },
      data: { isActive: !current.isActive },
    });

    return res.json({ success: true, projectType });
  } catch (err) {
    console.error("[projectTypesController] toggle:", err);
    sendError(res, 500, "Failed to toggle project type", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function reorder(req, res) {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return sendError(res, 400, "ids array is required", { code: CODES.BAD_REQUEST, requestId: req.id });

    await Promise.all(
      ids.map((id, index) =>
        prisma.projectType.update({
          where: { id: Number(id) },
          data: { displayOrder: index },
        })
      )
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("[projectTypesController] reorder:", err);
    sendError(res, 500, "Failed to reorder project types", { code: CODES.INTERNAL_ERROR, requestId: req.id });
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
