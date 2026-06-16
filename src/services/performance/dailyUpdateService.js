"use strict";

const { prisma } = require("../../lib/prisma");
const { canManageDailyUpdate } = require("./performanceReviewAuth");

const VALID_STATUSES = ["done", "in_progress", "blocked"];
const UPDATE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function assertValidUpdateDate(value, fieldName = "updateDate") {
  const normalized = String(value).slice(0, 10);
  if (!UPDATE_DATE_REGEX.test(normalized)) {
    const err = new Error(`${fieldName} must be YYYY-MM-DD`);
    err.statusCode = 400;
    throw err;
  }
  return normalized;
}

function validateDailyUpdateBody(body, isCreate = true) {
  if (isCreate) {
    if (!body.projectId || Number.isNaN(Number(body.projectId))) {
      const err = new Error("projectId is required");
      err.statusCode = 400;
      throw err;
    }
    if (!body.updateText || !String(body.updateText).trim()) {
      const err = new Error("updateText is required");
      err.statusCode = 400;
      throw err;
    }
    if (!body.updateDate || !String(body.updateDate).trim()) {
      const err = new Error("updateDate is required (YYYY-MM-DD)");
      err.statusCode = 400;
      throw err;
    }
    assertValidUpdateDate(body.updateDate);
  } else {
    if (body.updateText != null && !String(body.updateText).trim()) {
      const err = new Error("updateText cannot be empty");
      err.statusCode = 400;
      throw err;
    }
    if (body.updateDate != null && String(body.updateDate).trim()) {
      assertValidUpdateDate(body.updateDate);
    }
  }

  if (body.status != null && !VALID_STATUSES.includes(String(body.status))) {
    const err = new Error("status must be done, in_progress, or blocked");
    err.statusCode = 400;
    throw err;
  }
}

async function assertProjectExists(projectId) {
  const project = await prisma.project.findUnique({
    where: { id: Number(projectId) },
    select: { id: true },
  });
  if (!project) {
    const err = new Error("Project not found");
    err.statusCode = 404;
    throw err;
  }
  return project;
}

async function assertTaskInProject(taskId, projectId) {
  if (taskId == null || taskId === "") return null;
  const task = await prisma.task.findFirst({
    where: { id: Number(taskId), projectId: Number(projectId) },
    select: { id: true },
  });
  if (!task) {
    const err = new Error("Task not found for this project");
    err.statusCode = 404;
    throw err;
  }
  return task;
}

/**
 * @param {object} body
 * @param {number} actorUserId
 */
async function createDailyUpdate(body, actorUserId) {
  validateDailyUpdateBody(body, true);

  const ownerUserId = Number(actorUserId);
  if (!(await canManageDailyUpdate(actorUserId, ownerUserId))) {
    const err = new Error("Permission denied: cannot create daily update for this user");
    err.statusCode = 403;
    throw err;
  }

  const projectId = Number(body.projectId);
  await assertProjectExists(projectId);
  await assertTaskInProject(body.taskId, projectId);

  const update = await prisma.dailyUpdate.create({
    data: {
      userId: ownerUserId,
      projectId,
      taskId: body.taskId != null && body.taskId !== "" ? Number(body.taskId) : null,
      updateText: String(body.updateText).trim(),
      status: body.status && VALID_STATUSES.includes(body.status) ? body.status : "in_progress",
      blockers: body.blockers != null ? String(body.blockers) : null,
      updateDate: assertValidUpdateDate(body.updateDate),
      submittedAt: new Date(),
    },
    include: {
      project: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
  });

  return formatDailyUpdate(update);
}

/**
 * @param {number} updateId
 * @param {object} body
 * @param {number} actorUserId
 */
async function updateDailyUpdate(updateId, body, actorUserId) {
  validateDailyUpdateBody(body, false);

  const existing = await prisma.dailyUpdate.findUnique({
    where: { id: Number(updateId) },
  });
  if (!existing) {
    const err = new Error("Daily update not found");
    err.statusCode = 404;
    throw err;
  }

  if (!(await canManageDailyUpdate(actorUserId, existing.userId))) {
    const err = new Error("Permission denied: cannot edit this daily update");
    err.statusCode = 403;
    throw err;
  }

  const data = {};
  if (body.updateText != null) data.updateText = String(body.updateText).trim();
  if (body.status != null) data.status = body.status;
  if (body.blockers !== undefined) data.blockers = body.blockers === "" ? null : String(body.blockers);
  if (body.updateDate != null) data.updateDate = assertValidUpdateDate(body.updateDate);
  if (body.projectId != null && !Number.isNaN(Number(body.projectId))) {
    data.projectId = Number(body.projectId);
  }
  if (body.taskId !== undefined) {
    data.taskId = body.taskId != null && body.taskId !== "" ? Number(body.taskId) : null;
  }
  if (!existing.submittedAt) {
    data.submittedAt = new Date();
  }

  const resolvedProjectId = data.projectId ?? existing.projectId;
  const resolvedTaskId = body.taskId !== undefined ? data.taskId : existing.taskId;

  await assertProjectExists(resolvedProjectId);
  await assertTaskInProject(resolvedTaskId, resolvedProjectId);

  const update = await prisma.dailyUpdate.update({
    where: { id: existing.id },
    data,
    include: {
      project: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
  });

  return formatDailyUpdate(update);
}

/**
 * @param {number} updateId
 * @param {number} actorUserId
 */
async function deleteDailyUpdate(updateId, actorUserId) {
  const existing = await prisma.dailyUpdate.findUnique({
    where: { id: Number(updateId) },
  });
  if (!existing) {
    const err = new Error("Daily update not found");
    err.statusCode = 404;
    throw err;
  }

  if (!(await canManageDailyUpdate(actorUserId, existing.userId))) {
    const err = new Error("Permission denied: cannot delete this daily update");
    err.statusCode = 403;
    throw err;
  }

  await prisma.dailyUpdate.delete({ where: { id: existing.id } });
  return { id: existing.id, deleted: true };
}

function formatDailyUpdate(u) {
  return {
    id: u.id,
    userId: u.userId,
    updateDate: u.updateDate,
    status: u.status,
    updateText: u.updateText,
    blockers: u.blockers,
    project: u.project ? { id: u.project.id, name: u.project.name } : null,
    task: u.task ? { id: u.task.id, title: u.task.title } : null,
  };
}

module.exports = {
  createDailyUpdate,
  updateDailyUpdate,
  deleteDailyUpdate,
};
