/**
 * Production-safe idempotent seed. NO deleteMany. Safe to run on production after migrations.
 * Use: npm run seed:prod:safe
 * Optional admin bootstrap: BOOTSTRAP_ADMIN=true plus ADMIN_BOOTSTRAP_USERNAME, ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD
 */
require('dotenv').config({ path: require('path').join(process.cwd(), '.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { getAllPermissions } = require('./seed-shared');
const prisma = new PrismaClient();

const PROJECT_TYPES = [
    { name: 'Web Development', description: 'Web application development projects', displayOrder: 1, color: '#3b82f6', icon: 'globe' },
    { name: 'Mobile Development', description: 'Mobile application development projects', displayOrder: 2, color: '#10b981', icon: 'smartphone' },
    { name: 'Backend API', description: 'Backend and API development projects', displayOrder: 3, color: '#8b5cf6', icon: 'server' },
    { name: 'UI/UX Design', description: 'Design and user experience projects', displayOrder: 4, color: '#f59e0b', icon: 'palette' },
];
const PROJECT_STATUSES = [
    { name: 'Planning', color: '#6b7280', isDefault: true, isFinal: false, isUrgent: false, orderIndex: 1 },
    { name: 'In Progress', color: '#3b82f6', isDefault: false, isFinal: false, isUrgent: false, orderIndex: 2 },
    { name: 'On Hold', color: '#f59e0b', isDefault: false, isFinal: false, isUrgent: false, orderIndex: 3 },
    { name: 'Urgent', color: '#ef4444', isDefault: false, isFinal: false, isUrgent: true, orderIndex: 4 },
    { name: 'Completed', color: '#10b981', isDefault: false, isFinal: true, isUrgent: false, orderIndex: 5 },
    { name: 'Cancelled', color: '#6b7280', isDefault: false, isFinal: true, isUrgent: false, orderIndex: 6 },
];
const TASK_STATUSES = [
    { name: 'Pending', color: '#6b7280', isDefault: true, isFinal: false, isBlocking: false, orderIndex: 1 },
    { name: 'In Progress', color: '#3b82f6', isDefault: false, isFinal: false, isBlocking: false, orderIndex: 2 },
    { name: 'In Review', color: '#f59e0b', isDefault: false, isFinal: false, isBlocking: false, orderIndex: 3 },
    { name: 'Blocked', color: '#ef4444', isDefault: false, isFinal: false, isBlocking: true, orderIndex: 4 },
    { name: 'Completed', color: '#10b981', isDefault: false, isFinal: true, isBlocking: false, orderIndex: 5 },
    { name: 'Cancelled', color: '#6b7280', isDefault: false, isFinal: true, isBlocking: false, orderIndex: 6 },
];
const LABELS = [
    { name: 'Bug', color: '#ef4444', description: 'Bug fixes and issues' },
    { name: 'Feature', color: '#3b82f6', description: 'New features and enhancements' },
    { name: 'Documentation', color: '#8b5cf6', description: 'Documentation updates' },
    { name: 'Refactoring', color: '#f59e0b', description: 'Code refactoring and improvements' },
    { name: 'Testing', color: '#10b981', description: 'Testing and QA' },
    { name: 'Urgent', color: '#dc2626', description: 'Urgent tasks' },
];

function permNameDesc(key) {
    const [module, ...actionParts] = key.split('.');
    const action = actionParts.join('.');
    let name = action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    let description = 'Permission to ' + action.replace(/_/g, ' ');
    if (key === 'today_task.assign') {
        name = 'Task Assignment';
        description = "Access Task Assignment (Today's focus) page and assign tasks to users";
    }
    if (key === 'focus.shift.daily.view') {
        name = 'Daily Shift Sheet';
        description = 'Access daily shift sheet report for users';
    }
    if (key === 'focus.shift.edit') {
        name = 'Edit Shift Sheet';
        description = 'Edit daily shift records for users';
    }
    return { name, description, module, category: actionParts.length > 1 ? actionParts[0] : null };
}

async function main() {
    console.log('🌱 Production-safe idempotent seed (no destructive operations)\n');

    const allKeys = getAllPermissions();
    const permissionMap = new Map();

    for (const key of allKeys) {
        const { name, description, module, category } = permNameDesc(key);
        const p = await prisma.permission.upsert({
            where: { key },
            update: { name, description, module, category },
            create: { key, name, description, module, category },
        });
        permissionMap.set(key, p.id);
    }
    console.log('✅ Permissions upserted:', permissionMap.size);

    const roleData = [
        { name: 'admin', description: 'System Administrator with full access', isSystemRole: true },
        { name: 'project_manager', description: 'Project Manager', isSystemRole: true },
        { name: 'team_lead', description: 'Team Lead', isSystemRole: true },
        { name: 'developer', description: 'Developer', isSystemRole: true },
        { name: 'viewer', description: 'Read-only access', isSystemRole: true },
    ];
    const roles = {};
    for (const r of roleData) {
        const role = await prisma.role.upsert({
            where: { name: r.name },
            update: { description: r.description, isSystemRole: r.isSystemRole },
            create: r,
        });
        roles[r.name] = role;
    }
    console.log('✅ Roles upserted:', Object.keys(roles).length);

    for (const key of allKeys) {
        const permId = permissionMap.get(key);
        const existing = await prisma.rolePermission.findUnique({
            where: { roleId_permissionId: { roleId: roles.admin.id, permissionId: permId } },
        });
        if (!existing) {
            await prisma.rolePermission.create({
                data: { roleId: roles.admin.id, permissionId: permId },
            });
        }
    }
    const todayTaskKeys = ['today_task.assign', 'today_task.remove', 'today_task.reorder', 'today_task.view_all'];
    for (const key of todayTaskKeys) {
        const permId = permissionMap.get(key);
        if (!permId) continue;
        const existing = await prisma.rolePermission.findUnique({
            where: { roleId_permissionId: { roleId: roles.team_lead.id, permissionId: permId } },
        });
        if (!existing) {
            await prisma.rolePermission.create({
                data: { roleId: roles.team_lead.id, permissionId: permId },
            });
        }
    }
    // Staff performance RBAC: team_lead gets report.view + report.export (scoped in API); developer has none
    const teamLeadReportKeys = ['report.view', 'report.export'];
    for (const key of teamLeadReportKeys) {
        const permId = permissionMap.get(key);
        if (!permId) continue;
        const existing = await prisma.rolePermission.findUnique({
            where: { roleId_permissionId: { roleId: roles.team_lead.id, permissionId: permId } },
        });
        if (!existing) {
            await prisma.rolePermission.create({
                data: { roleId: roles.team_lead.id, permissionId: permId },
            });
        }
    }
    const shiftPermKeys = ['focus.shift.daily.view', 'focus.shift.edit'];
    for (const key of shiftPermKeys) {
        const permId = permissionMap.get(key);
        if (!permId) continue;
        const existing = await prisma.rolePermission.findUnique({
            where: { roleId_permissionId: { roleId: roles.project_manager.id, permissionId: permId } },
        });
        if (!existing) {
            await prisma.rolePermission.create({
                data: { roleId: roles.project_manager.id, permissionId: permId },
            });
        }
    }
    const metadataReadPermId = permissionMap.get('settings.global.read');
    if (metadataReadPermId) {
        const existing = await prisma.rolePermission.findUnique({
            where: { roleId_permissionId: { roleId: roles.developer.id, permissionId: metadataReadPermId } },
        });
        if (!existing) {
            await prisma.rolePermission.create({
                data: { roleId: roles.developer.id, permissionId: metadataReadPermId },
            });
        }
    }
    console.log('✅ Role-permission links ensured');

    for (const t of PROJECT_TYPES) {
        const existing = await prisma.projectType.findFirst({ where: { name: t.name } });
        if (!existing) {
            await prisma.projectType.create({
                data: { ...t, isActive: true },
            });
        }
    }
    console.log('✅ Project types ensured');

    for (const s of PROJECT_STATUSES) {
        await prisma.projectStatus.upsert({
            where: { name: s.name },
            update: { color: s.color, isDefault: s.isDefault, isFinal: s.isFinal, isUrgent: s.isUrgent, orderIndex: s.orderIndex, isActive: true },
            create: { ...s, isActive: true },
        });
    }
    console.log('✅ Project statuses upserted');

    for (const s of TASK_STATUSES) {
        await prisma.taskStatus.upsert({
            where: { name: s.name },
            update: { color: s.color, isDefault: s.isDefault, isFinal: s.isFinal, isBlocking: s.isBlocking, orderIndex: s.orderIndex, isActive: true },
            create: { ...s, isActive: true },
        });
    }
    console.log('✅ Task statuses upserted');

    for (const l of LABELS) {
        await prisma.label.upsert({
            where: { name: l.name },
            update: { color: l.color, description: l.description },
            create: l,
        });
    }
    console.log('✅ Labels upserted');

    if (process.env.BOOTSTRAP_ADMIN === 'true') {
        if (process.env.NODE_ENV === 'production') {
            const user = process.env.ADMIN_BOOTSTRAP_USERNAME?.trim();
            const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim();
            const pass = process.env.ADMIN_BOOTSTRAP_PASSWORD;
            if (!user || !email || !pass) {
                console.error('❌ In production, BOOTSTRAP_ADMIN=true requires ADMIN_BOOTSTRAP_USERNAME, ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD');
                process.exit(1);
            }
        }
        const adminUsername = process.env.ADMIN_BOOTSTRAP_USERNAME?.trim();
        const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim();
        const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
        if (!adminUsername || !adminEmail || !adminPassword) {
            console.log('ℹ️  Bootstrap skipped: set ADMIN_BOOTSTRAP_USERNAME, ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD');
        } else {
            if (adminPassword.length < 12) {
                console.error('❌ Bootstrap failed: Password must be at least 12 characters');
                process.exit(1);
            }
            if (adminPassword === adminUsername || adminPassword === adminEmail) {
                console.error('❌ Bootstrap failed: Password cannot equal username or email');
                process.exit(1);
            }
            const weak = ['password', 'admin', '123456', 'qwerty'];
            if (weak.some((p) => adminPassword.toLowerCase().includes(p))) {
                console.error('❌ Bootstrap failed: Password too weak');
                process.exit(1);
            }
            const passwordHash = await bcrypt.hash(adminPassword, 10);
            const adminUser = await prisma.user.upsert({
                where: { username: adminUsername },
                update: { email: adminEmail, passwordHash, role: 'admin' },
                create: { username: adminUsername, email: adminEmail, passwordHash, role: 'admin', isActive: true },
            });
            const adminRole = roles.admin;
            const existingLink = await prisma.userRole.findFirst({
                where: { userId: adminUser.id, roleId: adminRole.id, scopeType: 'global' },
            });
            if (!existingLink) {
                await prisma.userRole.create({
                    data: { userId: adminUser.id, roleId: adminRole.id, scopeType: 'global', scopeId: null },
                });
            }
            console.log('✅ Admin bootstrap completed (credentials never logged)');
        }
    } else {
        console.log('ℹ️  Bootstrap skipped (BOOTSTRAP_ADMIN !== true)');
    }

    console.log('\n✨ Production-safe seed finished.\n');
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
