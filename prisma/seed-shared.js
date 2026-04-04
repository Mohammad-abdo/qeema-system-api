/**
 * Shared permission definitions and helpers for seed scripts.
 * Used by seed.js (dev reset) and seed-prod-safe.js (production-safe idempotent).
 */
const PERMISSIONS = {
    USER: { CREATE: 'user.create', READ: 'user.read', UPDATE: 'user.update', DELETE: 'user.delete', ASSIGN_ROLE: 'user.assign_role', ACTIVATE: 'user.activate', DEACTIVATE: 'user.deactivate' },
    TEAM: { CREATE: 'team.create', READ: 'team.read', UPDATE: 'team.update', DELETE: 'team.delete', ADD_MEMBER: 'team.add_member', REMOVE_MEMBER: 'team.remove_member', ASSIGN_PROJECT: 'team.assign_project', REMOVE_PROJECT: 'team.remove_project' },
    PROJECT: { CREATE: 'project.create', READ: 'project.read', UPDATE: 'project.update', DELETE: 'project.delete', VIEW_ALL: 'project.viewAll', ASSIGN_TEAM: 'project.assign_team', REMOVE_TEAM: 'project.remove_team', MANAGE_SETTINGS: 'project.manage_settings' },
    TASK: { CREATE: 'task.create', READ: 'task.read', UPDATE: 'task.update', DELETE: 'task.delete', ASSIGN: 'task.assign', CHANGE_STATUS: 'task.change_status', CHANGE_PRIORITY: 'task.change_priority' },
    DEPENDENCY: { CREATE: 'dependency.create', READ: 'dependency.read', UPDATE: 'dependency.update', DELETE: 'dependency.delete', MANUAL_UNBLOCK: 'dependency.manual_unblock' },
    TODAY_TASK: { ASSIGN: 'today_task.assign', REMOVE: 'today_task.remove', REORDER: 'today_task.reorder', VIEW_ALL: 'today_task.view_all' },
    SETTINGS: { GLOBAL_READ: 'settings.global.read', GLOBAL_EDIT: 'settings.global.edit', PROJECT_READ: 'settings.project.read', PROJECT_EDIT: 'settings.project.edit', USER_READ: 'settings.user.read', USER_EDIT: 'settings.user.edit' },
    NOTIFICATION: { VIEW: 'notification.view', MANAGE: 'notification.manage', CONFIGURE: 'notification.configure' },
    LOG: { VIEW: 'log.view', EXPORT: 'log.export', VIEW_DETAILS: 'log.view_details' },
    ROLE: { CREATE: 'role.create', READ: 'role.read', UPDATE: 'role.update', DELETE: 'role.delete', ASSIGN: 'role.assign', MANAGE_PERMISSIONS: 'role.manage_permissions' },
    REPORT: { VIEW: 'report.view', EXPORT: 'report.export', GENERATE: 'report.generate' },
};

function getAllPermissions() {
    return Object.values(PERMISSIONS).flatMap((mod) => Object.values(mod));
}

module.exports = { PERMISSIONS, getAllPermissions };
