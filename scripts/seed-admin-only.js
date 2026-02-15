const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Permission definitions (same as RBAC)
const PERMISSIONS = {
    USER: {
        CREATE: "user.create",
        READ: "user.read",
        UPDATE: "user.update",
        DELETE: "user.delete",
        ASSIGN_ROLE: "user.assign_role",
        ACTIVATE: "user.activate",
        DEACTIVATE: "user.deactivate",
    },
    TEAM: {
        CREATE: "team.create",
        READ: "team.read",
        UPDATE: "team.update",
        DELETE: "team.delete",
        ADD_MEMBER: "team.add_member",
        REMOVE_MEMBER: "team.remove_member",
        ASSIGN_PROJECT: "team.assign_project",
        REMOVE_PROJECT: "team.remove_project",
    },
    PROJECT: {
        CREATE: "project.create",
        READ: "project.read",
        UPDATE: "project.update",
        DELETE: "project.delete",
        ASSIGN_TEAM: "project.assign_team",
        REMOVE_TEAM: "project.remove_team",
        MANAGE_SETTINGS: "project.manage_settings",
    },
    TASK: {
        CREATE: "task.create",
        READ: "task.read",
        UPDATE: "task.update",
        DELETE: "task.delete",
        ASSIGN: "task.assign",
        CHANGE_STATUS: "task.change_status",
        CHANGE_PRIORITY: "task.change_priority",
    },
    DEPENDENCY: {
        CREATE: "dependency.create",
        READ: "dependency.read",
        UPDATE: "dependency.update",
        DELETE: "dependency.delete",
        MANUAL_UNBLOCK: "dependency.manual_unblock",
    },
    TODAY_TASK: {
        ASSIGN: "today_task.assign",
        REMOVE: "today_task.remove",
        REORDER: "today_task.reorder",
        VIEW_ALL: "today_task.view_all",
    },
    SETTINGS: {
        GLOBAL_READ: "settings.global.read",
        GLOBAL_EDIT: "settings.global.edit",
        PROJECT_READ: "settings.project.read",
        PROJECT_EDIT: "settings.project.edit",
        USER_READ: "settings.user.read",
        USER_EDIT: "settings.user.edit",
    },
    NOTIFICATION: {
        VIEW: "notification.view",
        MANAGE: "notification.manage",
        CONFIGURE: "notification.configure",
    },
    LOG: {
        VIEW: "log.view",
        EXPORT: "log.export",
        VIEW_DETAILS: "log.view_details",
    },
    ROLE: {
        CREATE: "role.create",
        READ: "role.read",
        UPDATE: "role.update",
        DELETE: "role.delete",
        ASSIGN: "role.assign",
        MANAGE_PERMISSIONS: "role.manage_permissions",
    },
    REPORT: {
        VIEW: "report.view",
        EXPORT: "report.export",
        GENERATE: "report.generate",
    },
};

function getAllPermissions() {
    return Object.values(PERMISSIONS).flatMap((module) => Object.values(module));
}

const prisma = new PrismaClient();

async function main() {
    console.log('🔧 Seeding Admin User Only...\n');

    // 1. Create all permissions
    console.log('📋 Creating Permissions...');
    const allPermissionKeys = getAllPermissions();

    const createdPermissions = [];
    for (const key of allPermissionKeys) {
        const [module, ...actionParts] = key.split('.');
        const action = actionParts.join('.');
        const name = action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        const category = actionParts.length > 1 ? actionParts[0] : null;

        const existing = await prisma.permission.findUnique({ where: { key } });
        if (!existing) {
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
        } else {
            createdPermissions.push(existing);
        }
    }
    console.log(`✅ Ensured ${createdPermissions.length} permissions exist\n`);

    // 2. Create admin role (if it doesn't exist)
    console.log('👤 Creating Admin Role...');
    let adminRole = await prisma.role.findUnique({
        where: { name: 'admin' },
    });

    if (!adminRole) {
        adminRole = await prisma.role.create({
            data: {
                name: 'admin',
                description: 'System Administrator with full access',
                isSystemRole: true,
            },
        });
        console.log('✅ Created admin role');
    } else {
        console.log('✅ Admin role already exists');
    }

    // 3. Assign all permissions to admin role
    console.log('🔗 Assigning permissions to admin role...');

    await prisma.rolePermission.deleteMany({
        where: { roleId: adminRole.id },
    });

    for (const perm of createdPermissions) {
        await prisma.rolePermission.create({
            data: { roleId: adminRole.id, permissionId: perm.id },
        });
    }
    console.log(`✅ Assigned ${createdPermissions.length} permissions to admin\n`);

    // 4. Create admin user
    console.log('👨‍💼 Creating Admin User...');
    const defaultPassword = await bcrypt.hash('password123', 10);

    let adminUser = await prisma.user.findUnique({
        where: { username: 'admin' },
    });

    if (!adminUser) {
        adminUser = await prisma.user.create({
            data: {
                username: 'admin',
                email: 'admin@example.com',
                passwordHash: defaultPassword,
                role: 'admin',
            },
        });
        console.log('✅ Created admin user');
    } else {
        console.log('✅ Admin user already exists');
    }

    // 5. Assign admin role to admin user (global scope)
    console.log('🔑 Assigning role to admin user...');

    const existingUserRole = await prisma.userRole.findFirst({
        where: {
            userId: adminUser.id,
            roleId: adminRole.id,
            scopeType: 'global',
        },
    });

    if (!existingUserRole) {
        await prisma.userRole.create({
            data: {
                userId: adminUser.id,
                roleId: adminRole.id,
                scopeType: 'global',
                scopeId: null,
            },
        });
        console.log('✅ Assigned admin role to user');
    } else {
        console.log('✅ Admin user already has admin role');
    }

    console.log('\n🎉 Admin setup complete!\n');
    console.log('📝 Login credentials:');
    console.log('   Username: admin');
    console.log('   Email: admin@example.com');
    console.log('   Password: password123\n');

    await prisma.$disconnect();
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    });
