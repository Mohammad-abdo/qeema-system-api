"use strict";

const { prisma } = require("./prisma");

async function hasPermissionWithoutRoleBypass(userId, permission, projectId) {
  try {
    const scopeCondition = [
      { scopeType: null },
      { scopeType: "global" },
    ];
    if (projectId) {
      scopeCondition.push({ scopeType: "project", scopeId: projectId });
    }
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId: Number(userId),
        OR: scopeCondition,
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });
    for (const userRole of userRoles) {
      for (const rp of userRole.role.permissions) {
        if (rp.permission.key === permission) return true;
      }
    }
    return false;
  } catch (err) {
    console.error("[rbac] Error checking permission:", err);
    return false;
  }
}

async function getPermissionsList(userId, projectId) {
  try {
    const scopeCondition = [
      { scopeType: null },
      { scopeType: "global" },
    ];
    if (projectId) {
      scopeCondition.push({ scopeType: "project", scopeId: projectId });
    }
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId: Number(userId),
        OR: scopeCondition,
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });
    const set = new Set();
    for (const userRole of userRoles) {
      for (const rp of userRole.role.permissions) {
        set.add(rp.permission.key);
      }
    }
    return Array.from(set);
  } catch (err) {
    console.error("[rbac] getPermissionsList:", err);
    return [];
  }
}

async function isAdmin(userId) {
  try {
    const ur = await prisma.userRole.findFirst({
      where: {
        userId: Number(userId),
        role: { name: "admin" },
      },
    });
    return !!ur;
  } catch (err) {
    console.error("[rbac] isAdmin:", err);
    return false;
  }
}

module.exports = { hasPermissionWithoutRoleBypass, getPermissionsList, isAdmin };
