"use strict";

const { prisma } = require("../../lib/prisma");
const { isAdmin, hasPermissionWithoutRoleBypass } = require("../../lib/rbac");

async function getLedTeamIds(actorUserId) {
  const actorId = Number(actorUserId);
  const ledTeams = await prisma.team.findMany({
    where: { teamLeadId: actorId },
    select: { id: true },
  });
  const ledTeamIds = ledTeams.map((t) => t.id);

  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { role: true, teamId: true },
  });

  if (actor?.role === "team_lead" && actor.teamId && !ledTeamIds.includes(actor.teamId)) {
    ledTeamIds.push(actor.teamId);
  }

  return ledTeamIds;
}

async function getTeamMemberIds(actorUserId) {
  const ledTeamIds = await getLedTeamIds(actorUserId);
  if (!ledTeamIds.length) return [];

  const members = await prisma.user.findMany({
    where: { teamId: { in: ledTeamIds }, isActive: true },
    select: { id: true },
  });
  return members.map((m) => m.id);
}

async function isTeamLeadForUser(actorUserId, targetUserId) {
  const target = await prisma.user.findUnique({
    where: { id: Number(targetUserId) },
    select: { teamId: true },
  });
  if (!target?.teamId) return false;

  const team = await prisma.team.findFirst({
    where: {
      id: target.teamId,
      teamLeadId: Number(actorUserId),
    },
    select: { id: true },
  });
  return !!team;
}

async function actorIsTeamLead(actorUserId) {
  const user = await prisma.user.findUnique({
    where: { id: Number(actorUserId) },
    select: { role: true },
  });
  if (user?.role === "team_lead") return true;

  const ledTeam = await prisma.team.findFirst({
    where: { teamLeadId: Number(actorUserId) },
    select: { id: true },
  });
  return !!ledTeam;
}

/**
 * @param {number} actorUserId
 */
async function getPerformanceActorContext(actorUserId) {
  const actorId = Number(actorUserId);
  const admin = await isAdmin(actorId);
  const teamLead = admin ? false : await actorIsTeamLead(actorId);
  const teamMemberIds = admin ? [] : teamLead ? await getTeamMemberIds(actorId) : [];
  const canViewOrgWide =
    admin || (await hasPermissionWithoutRoleBypass(actorId, "report.view"));
  const canExport =
    admin ||
    (teamLead && (await hasPermissionWithoutRoleBypass(actorId, "report.export"))) ||
    (canViewOrgWide && (await hasPermissionWithoutRoleBypass(actorId, "report.export")));
  const canManage = await canManagePerformanceReviews(actorId);

  return {
    isAdmin: admin,
    isTeamLead: teamLead,
    teamMemberIds,
    canViewOrgWide,
    canViewModule: canViewOrgWide || teamLead,
    canExport,
    canManage,
  };
}

/**
 * @param {number} actorUserId
 * @param {number} targetUserId
 */
async function canViewPerformanceProfile(actorUserId, targetUserId) {
  const actorId = Number(actorUserId);
  const targetId = Number(targetUserId);
  if (!actorId || Number.isNaN(targetId)) return false;

  const ctx = await getPerformanceActorContext(actorId);
  if (ctx.canViewOrgWide) return true;
  if (ctx.isTeamLead && ctx.teamMemberIds.includes(targetId)) return true;
  return actorId === targetId;
}

/**
 * @param {number} actorUserId
 */
async function canExportPerformance(actorUserId) {
  const ctx = await getPerformanceActorContext(actorUserId);
  return ctx.canExport;
}

/**
 * @param {number} actorUserId
 * @param {number} ownerUserId
 */
async function canManageDailyUpdate(actorUserId, ownerUserId) {
  const actorId = Number(actorUserId);
  const ownerId = Number(ownerUserId);
  if (!actorId || Number.isNaN(ownerId)) return false;
  if (await isAdmin(actorId)) return true;
  return actorId === ownerId;
}

/**
 * @param {number} actorUserId
 * @param {{ userId?: number|null, role?: string|null, projectId?: number|null, rating?: string|null, allowedUserIds?: number[]|null }} filters
 */
async function applyViewScope(actorUserId, filters = {}) {
  const actorId = Number(actorUserId);
  const ctx = await getPerformanceActorContext(actorId);
  const scoped = { ...filters };

  if (ctx.canViewOrgWide) {
    return scoped;
  }

  if (ctx.isTeamLead) {
    const allowed = new Set(ctx.teamMemberIds);
    if (scoped.userId != null && !Number.isNaN(Number(scoped.userId))) {
      const uid = Number(scoped.userId);
      if (!allowed.has(uid)) {
        const err = new Error("Permission denied: cannot view performance for this employee");
        err.statusCode = 403;
        throw err;
      }
      scoped.allowedUserIds = [uid];
      return scoped;
    }
    scoped.allowedUserIds = [...allowed];
    return scoped;
  }

  scoped.userId = actorId;
  scoped.allowedUserIds = [actorId];
  return scoped;
}

/**
 * @param {number} actorUserId
 * @param {number} targetUserId
 */
async function assertCanViewProfile(actorUserId, targetUserId) {
  const ok = await canViewPerformanceProfile(actorUserId, targetUserId);
  if (!ok) {
    const err = new Error("Permission denied: cannot view this performance profile");
    err.statusCode = 403;
    throw err;
  }
}

/**
 * @param {number} actorUserId
 * @param {number|null|undefined} targetUserId
 */
async function canManagePerformanceReviews(actorUserId, targetUserId) {
  const actorId = Number(actorUserId);
  if (!actorId) return false;

  if (await isAdmin(actorId)) return true;
  if (await hasPermissionWithoutRoleBypass(actorId, "report.generate")) return true;

  if (targetUserId != null && !Number.isNaN(Number(targetUserId))) {
    const targetId = Number(targetUserId);
    if (await isTeamLeadForUser(actorId, targetId)) return true;
    const ctx = await getPerformanceActorContext(actorId);
    if (ctx.isTeamLead && ctx.teamMemberIds.includes(targetId)) return true;
    return false;
  }

  return await actorIsTeamLead(actorId);
}

/**
 * Restrict bulk generation for team leads to their team members only.
 * @param {number} actorUserId
 * @param {{ teamId?: number|null, userIds?: number[]|null }} filters
 */
async function applyTeamLeadScope(actorUserId, filters = {}) {
  if (await isAdmin(actorUserId)) return filters;
  if (await hasPermissionWithoutRoleBypass(actorUserId, "report.generate")) return filters;

  const ledTeamIds = await getLedTeamIds(actorUserId);

  if (ledTeamIds.length === 0) {
    const err = new Error("Permission denied: not authorized to manage performance reviews");
    err.statusCode = 403;
    throw err;
  }

  if (filters.teamId != null && !ledTeamIds.includes(Number(filters.teamId))) {
    const err = new Error("Permission denied: cannot manage reviews for this team");
    err.statusCode = 403;
    throw err;
  }

  if (!filters.teamId && ledTeamIds.length === 1) {
    return { ...filters, teamId: ledTeamIds[0] };
  }

  if (!filters.teamId && ledTeamIds.length > 1) {
    const members = await prisma.user.findMany({
      where: { teamId: { in: ledTeamIds }, isActive: true },
      select: { id: true },
    });
    const allowedIds = new Set(members.map((m) => m.id));
    const requested = filters.userIds?.length
      ? filters.userIds.map(Number).filter((id) => allowedIds.has(id))
      : [...allowedIds];
    return { ...filters, userIds: requested };
  }

  return filters;
}

module.exports = {
  canManagePerformanceReviews,
  applyTeamLeadScope,
  isTeamLeadForUser,
  actorIsTeamLead,
  getPerformanceActorContext,
  canViewPerformanceProfile,
  canExportPerformance,
  canManageDailyUpdate,
  applyViewScope,
  assertCanViewProfile,
  getTeamMemberIds,
};
