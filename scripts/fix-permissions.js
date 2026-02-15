const { PrismaClient } = require('@prisma/client');

// Inline permission definitions (same as seed-admin-only / initialize-rbac)
const PERMISSIONS = {
    USER: { CREATE: "user.create", READ: "user.read", UPDATE: "user.update", DELETE: "user.delete", ASSIGN_ROLE: "user.assign_role", ACTIVATE: "user.activate", DEACTIVATE: "user.deactivate" },
    TEAM: { CREATE: "team.create", READ: "team.read", UPDATE: "team.update", DELETE: "team.delete", ADD_MEMBER: "team.add_member", REMOVE_MEMBER: "team.remove_member", ASSIGN_PROJECT: "team.assign_project", REMOVE_PROJECT: "team.remove_project" },
    PROJECT: { CREATE: "project.create", READ: "project.read", UPDATE: "project.update", DELETE: "project.delete", ASSIGN_TEAM: "project.assign_team", REMOVE_TEAM: "project.remove_team", MANAGE_SETTINGS: "project.manage_settings" },
    TASK: { CREATE: "task.create", READ: "task.read", UPDATE: "task.update", DELETE: "task.delete", ASSIGN: "task.assign", CHANGE_STATUS: "task.change_status", CHANGE_PRIORITY: "task.change_priority" },
    DEPENDENCY: { CREATE: "dependency.create", READ: "dependency.read", UPDATE: "dependency.update", DELETE: "dependency.delete", MANUAL_UNBLOCK: "dependency.manual_unblock" },
    TODAY_TASK: { ASSIGN: "today_task.assign", REMOVE: "today_task.remove", REORDER: "today_task.reorder", VIEW_ALL: "today_task.view_all" },
    SETTINGS: { GLOBAL_READ: "settings.global.read", GLOBAL_EDIT: "settings.global.edit", PROJECT_READ: "settings.project.read", PROJECT_EDIT: "settings.project.edit", USER_READ: "settings.user.read", USER_EDIT: "settings.user.edit" },
    NOTIFICATION: { VIEW: "notification.view", MANAGE: "notification.manage", CONFIGURE: "notification.configure" },
    LOG: { VIEW: "log.view", EXPORT: "log.export", VIEW_DETAILS: "log.view_details" },
    ROLE: { CREATE: "role.create", READ: "role.read", UPDATE: "role.update", DELETE: "role.delete", ASSIGN: "role.assign", MANAGE_PERMISSIONS: "role.manage_permissions" },
    REPORT: { VIEW: "report.view", EXPORT: "report.export", GENERATE: "report.generate" },
};

function getAllPermissions() {
    return Object.values(PERMISSIONS).flatMap((module) => Object.values(module));
}

const prisma = new PrismaClient();

async function main() {
    console.log('🔧 Fixing permissions in database...\n');

    await prisma.rolePermission.deleteMany();
    await prisma.permission.deleteMany();

    console.log('✅ Cleaned existing permissions\n');

    const allPermissionKeys = getAllPermissions();
    console.log(`📋 Creating ${allPermissionKeys.length} permissions...\n`);

    const createdPermissions = [];
    for (const key of allPermissionKeys) {
        const [module, ...actionParts] = key.split('.');
        const action = actionParts.join('.');
        const name = action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        const category = actionParts.length > 1 ? actionParts[0] : null;

        const p = await prisma.permission.create({
            data: {
                key,
                name,
                description: `Permission to ${action.replace(/_/g, ' ')}`,
                module,
                category,
            },
        });
        createdPermissions.push(p);
    }

    console.log(`✅ Created ${createdPermissions.length} permissions\n`);

    const adminRole = await prisma.role.findFirst({
        where: { name: 'admin' },
    });

    if (adminRole) {
        console.log('🔗 Assigning all permissions to admin role...\n');
        for (const perm of createdPermissions) {
            await prisma.rolePermission.create({
                data: { roleId: adminRole.id, permissionId: perm.id },
            });
        }
        console.log(`✅ Assigned ${createdPermissions.length} permissions to admin role\n`);
    }

    const modules = await prisma.permission.findMany({
        select: { module: true },
        distinct: ['module'],
    });

    console.log(`📊 Modules in database (${modules.length}):`);
    modules.forEach((m, i) => {
        console.log(`   ${i + 1}. ${m.module}`);
    });

    console.log('\n✅ Permissions fixed successfully!');
    console.log('\n⚠️  When you run prisma/seed.js ensure it uses the same permission set.');

    await prisma.$disconnect();
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    });
