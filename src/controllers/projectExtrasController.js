"use strict";

const { prisma } = require("../lib/prisma");
const { hasPermissionWithoutRoleBypass } = require("../lib/rbac");
const { sendError, CODES } = require("../lib/errorResponse");
const { logActivity } = require("../lib/activityLogger");

async function ensureProjectAccess(userId, projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, createdById: true, projectManagerId: true },
  });
  if (!project) return { error: "Project not found", status: 404 };
  const allowed = await hasPermissionWithoutRoleBypass(userId, "project.update", projectId);
  const isCreator = project.createdById === userId;
  const isPm = project.projectManagerId === userId;
  if (!allowed && !isCreator && !isPm) {
    return { error: "Permission denied", status: 403 };
  }
  return { project };
}

async function listDeliverables(req, res) {
  try {
    const projectId = parseInt(req.params.id, 10);
    if (Number.isNaN(projectId)) return sendError(res, 400, "Invalid project ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const items = await prisma.deliverable.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
    return res.json({ success: true, deliverables: items });
  } catch (err) {
    console.error("[projectExtras] listDeliverables:", err);
    sendError(res, 500, err.message || "Failed to list deliverables", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function createDeliverable(req, res) {
  try {
    const projectId = parseInt(req.params.id, 10);
    const userId = Number(req.user.id);
    if (Number.isNaN(projectId)) return sendError(res, 400, "Invalid project ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const access = await ensureProjectAccess(userId, projectId);
    if (access.error) return sendError(res, access.status, access.error, { code: access.status === 404 ? CODES.NOT_FOUND : CODES.FORBIDDEN, requestId: req.id });

    const body = req.body || {};
    const name = body.name != null ? String(body.name).trim() : "";
    if (!name) return sendError(res, 400, "Name is required", { code: CODES.BAD_REQUEST, requestId: req.id });

    const deliverable = await prisma.deliverable.create({
      data: {
        projectId,
        name,
        description: body.description != null ? String(body.description) : null,
        acceptanceCriteria: body.acceptanceCriteria != null ? String(body.acceptanceCriteria) : null,
        status: body.status != null ? String(body.status) : "pending",
      },
    });
    await logActivity({
      actionType: "deliverable_created",
      actionCategory: "project",
      entityType: "deliverable",
      entityId: deliverable.id,
      projectId,
      performedById: userId,
      actionSummary: `Deliverable '${name}' created`,
    }, req);
    return res.status(201).json({ success: true, deliverable });
  } catch (err) {
    console.error("[projectExtras] createDeliverable:", err);
    sendError(res, 500, err.message || "Failed to create deliverable", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function updateDeliverable(req, res) {
  try {
    const projectId = parseInt(req.params.id, 10);
    const deliverableId = parseInt(req.params.deliverableId, 10);
    const userId = Number(req.user.id);
    if (Number.isNaN(projectId) || Number.isNaN(deliverableId)) {
      return sendError(res, 400, "Invalid IDs", { code: CODES.BAD_REQUEST, requestId: req.id });
    }
    const access = await ensureProjectAccess(userId, projectId);
    if (access.error) return sendError(res, access.status, access.error, { code: access.status === 404 ? CODES.NOT_FOUND : CODES.FORBIDDEN, requestId: req.id });

    const existing = await prisma.deliverable.findFirst({ where: { id: deliverableId, projectId } });
    if (!existing) return sendError(res, 404, "Deliverable not found", { code: CODES.NOT_FOUND, requestId: req.id });

    const body = req.body || {};
    const deliverable = await prisma.deliverable.update({
      where: { id: deliverableId },
      data: {
        name: body.name != null ? String(body.name).trim() : undefined,
        description: body.description !== undefined ? (body.description != null ? String(body.description) : null) : undefined,
        acceptanceCriteria: body.acceptanceCriteria !== undefined
          ? (body.acceptanceCriteria != null ? String(body.acceptanceCriteria) : null)
          : undefined,
        status: body.status != null ? String(body.status) : undefined,
      },
    });
    return res.json({ success: true, deliverable });
  } catch (err) {
    console.error("[projectExtras] updateDeliverable:", err);
    sendError(res, 500, err.message || "Failed to update deliverable", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function removeDeliverable(req, res) {
  try {
    const projectId = parseInt(req.params.id, 10);
    const deliverableId = parseInt(req.params.deliverableId, 10);
    const userId = Number(req.user.id);
    const access = await ensureProjectAccess(userId, projectId);
    if (access.error) return sendError(res, access.status, access.error, { code: access.status === 404 ? CODES.NOT_FOUND : CODES.FORBIDDEN, requestId: req.id });

    const existing = await prisma.deliverable.findFirst({ where: { id: deliverableId, projectId } });
    if (!existing) return sendError(res, 404, "Deliverable not found", { code: CODES.NOT_FOUND, requestId: req.id });

    await prisma.deliverable.delete({ where: { id: deliverableId } });
    return res.json({ success: true });
  } catch (err) {
    console.error("[projectExtras] removeDeliverable:", err);
    sendError(res, 500, err.message || "Failed to delete deliverable", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function listPhases(req, res) {
  try {
    const projectId = parseInt(req.params.id, 10);
    if (Number.isNaN(projectId)) return sendError(res, 400, "Invalid project ID", { code: CODES.BAD_REQUEST, requestId: req.id });
    const phases = await prisma.projectPhase.findMany({
      where: { projectId },
      orderBy: { sequenceOrder: "asc" },
    });
    return res.json({ success: true, phases });
  } catch (err) {
    console.error("[projectExtras] listPhases:", err);
    sendError(res, 500, err.message || "Failed to list phases", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function createPhase(req, res) {
  try {
    const projectId = parseInt(req.params.id, 10);
    const userId = Number(req.user.id);
    const access = await ensureProjectAccess(userId, projectId);
    if (access.error) return sendError(res, access.status, access.error, { code: access.status === 404 ? CODES.NOT_FOUND : CODES.FORBIDDEN, requestId: req.id });

    const body = req.body || {};
    const name = body.name != null ? String(body.name).trim() : "";
    if (!name) return sendError(res, 400, "Name is required", { code: CODES.BAD_REQUEST, requestId: req.id });

    const maxOrder = await prisma.projectPhase.aggregate({
      where: { projectId },
      _max: { sequenceOrder: true },
    });
    const sequenceOrder = (maxOrder._max.sequenceOrder ?? -1) + 1;

    const phase = await prisma.projectPhase.create({
      data: {
        projectId,
        name,
        description: body.description != null ? String(body.description) : null,
        sequenceOrder: body.sequenceOrder != null ? parseInt(body.sequenceOrder, 10) : sequenceOrder,
        status: body.status != null ? String(body.status) : "pending",
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
      },
    });
    return res.status(201).json({ success: true, phase });
  } catch (err) {
    console.error("[projectExtras] createPhase:", err);
    sendError(res, 500, err.message || "Failed to create phase", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function updatePhase(req, res) {
  try {
    const projectId = parseInt(req.params.id, 10);
    const phaseId = parseInt(req.params.phaseId, 10);
    const userId = Number(req.user.id);
    const access = await ensureProjectAccess(userId, projectId);
    if (access.error) return sendError(res, access.status, access.error, { code: access.status === 404 ? CODES.NOT_FOUND : CODES.FORBIDDEN, requestId: req.id });

    const existing = await prisma.projectPhase.findFirst({ where: { id: phaseId, projectId } });
    if (!existing) return sendError(res, 404, "Phase not found", { code: CODES.NOT_FOUND, requestId: req.id });

    const body = req.body || {};
    const phase = await prisma.projectPhase.update({
      where: { id: phaseId },
      data: {
        name: body.name != null ? String(body.name).trim() : undefined,
        description: body.description !== undefined ? (body.description != null ? String(body.description) : null) : undefined,
        sequenceOrder: body.sequenceOrder != null ? parseInt(body.sequenceOrder, 10) : undefined,
        status: body.status != null ? String(body.status) : undefined,
        startDate: body.startDate !== undefined ? (body.startDate ? new Date(body.startDate) : null) : undefined,
        endDate: body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : undefined,
      },
    });
    return res.json({ success: true, phase });
  } catch (err) {
    console.error("[projectExtras] updatePhase:", err);
    sendError(res, 500, err.message || "Failed to update phase", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function reorderPhases(req, res) {
  try {
    const projectId = parseInt(req.params.id, 10);
    const userId = Number(req.user.id);
    const access = await ensureProjectAccess(userId, projectId);
    if (access.error) return sendError(res, access.status, access.error, { code: access.status === 404 ? CODES.NOT_FOUND : CODES.FORBIDDEN, requestId: req.id });

    const order = Array.isArray(req.body?.order) ? req.body.order : [];
    await prisma.$transaction(
      order.map((phaseId, index) =>
        prisma.projectPhase.updateMany({
          where: { id: parseInt(phaseId, 10), projectId },
          data: { sequenceOrder: index },
        })
      )
    );
    const phases = await prisma.projectPhase.findMany({
      where: { projectId },
      orderBy: { sequenceOrder: "asc" },
    });
    return res.json({ success: true, phases });
  } catch (err) {
    console.error("[projectExtras] reorderPhases:", err);
    sendError(res, 500, err.message || "Failed to reorder phases", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function removePhase(req, res) {
  try {
    const projectId = parseInt(req.params.id, 10);
    const phaseId = parseInt(req.params.phaseId, 10);
    const userId = Number(req.user.id);
    const access = await ensureProjectAccess(userId, projectId);
    if (access.error) return sendError(res, access.status, access.error, { code: access.status === 404 ? CODES.NOT_FOUND : CODES.FORBIDDEN, requestId: req.id });

    const existing = await prisma.projectPhase.findFirst({ where: { id: phaseId, projectId } });
    if (!existing) return sendError(res, 404, "Phase not found", { code: CODES.NOT_FOUND, requestId: req.id });

    await prisma.projectPhase.delete({ where: { id: phaseId } });
    return res.json({ success: true });
  } catch (err) {
    console.error("[projectExtras] removePhase:", err);
    sendError(res, 500, err.message || "Failed to delete phase", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

module.exports = {
  listDeliverables,
  createDeliverable,
  updateDeliverable,
  removeDeliverable,
  listPhases,
  createPhase,
  updatePhase,
  reorderPhases,
  removePhase,
};
