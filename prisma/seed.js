/**
 * Prisma Seed - All seed operations in one place (JavaScript only)
 *
 * Usage:
 *   npm run prisma:seed
 * or
 *   npx prisma db seed
 *
 * Clears old data (optional - remove this section if you want to keep the data)
 * Creates: Project Types, Project/Task Statuses, Full Permissions (RBAC), Roles,
 * Role Permissions mappings, and Labels.
 *
 * To create the system admin for the first time (Bootstrap), use the following environment variables:
 *   BOOTSTRAP_ADMIN=true
 *   ADMIN_BOOTSTRAP_USERNAME=admin
 *   ADMIN_BOOTSTRAP_EMAIL=admin@example.com
 *   ADMIN_BOOTSTRAP_PASSWORD=StrongPasswordHere
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// ─── Full Permissions Definitions (RBAC) ─────────────────────────────────────
const PERMISSIONS = {
    USER: {
        CREATE: 'user.create',
        READ: 'user.read',
        UPDATE: 'user.update',
        DELETE: 'user.delete',
        ASSIGN_ROLE: 'user.assign_role',
        ACTIVATE: 'user.activate',
        DEACTIVATE: 'user.deactivate',
    },
    TEAM: {
        CREATE: 'team.create',
        READ: 'team.read',
        UPDATE: 'team.update',
        DELETE: 'team.delete',
        ADD_MEMBER: 'team.add_member',
        REMOVE_MEMBER: 'team.remove_member',
        ASSIGN_PROJECT: 'team.assign_project',
        REMOVE_PROJECT: 'team.remove_project',
    },
    PROJECT: {
        CREATE: 'project.create',
        READ: 'project.read',
        UPDATE: 'project.update',
        DELETE: 'project.delete',
        VIEW_ALL: 'project.viewAll',
        ASSIGN_TEAM: 'project.assign_team',
        REMOVE_TEAM: 'project.remove_team',
        MANAGE_SETTINGS: 'project.manage_settings',
    },
    TASK: {
        CREATE: 'task.create',
        READ: 'task.read',
        UPDATE: 'task.update',
        DELETE: 'task.delete',
        ASSIGN: 'task.assign',
        CHANGE_STATUS: 'task.change_status',
        CHANGE_PRIORITY: 'task.change_priority',
    },
    DEPENDENCY: {
        CREATE: 'dependency.create',
        READ: 'dependency.read',
        UPDATE: 'dependency.update',
        DELETE: 'dependency.delete',
        MANUAL_UNBLOCK: 'dependency.manual_unblock',
    },
    TODAY_TASK: {
        ASSIGN: 'today_task.assign',
        REMOVE: 'today_task.remove',
        REORDER: 'today_task.reorder',
        VIEW_ALL: 'today_task.view_all',
    },
    SETTINGS: {
        GLOBAL_READ: 'settings.global.read',
        GLOBAL_EDIT: 'settings.global.edit',
        PROJECT_READ: 'settings.project.read',
        PROJECT_EDIT: 'settings.project.edit',
        USER_READ: 'settings.user.read',
        USER_EDIT: 'settings.user.edit',
    },
    NOTIFICATION: {
        VIEW: 'notification.view',
        MANAGE: 'notification.manage',
        CONFIGURE: 'notification.configure',
    },
    LOG: {
        VIEW: 'log.view',
        EXPORT: 'log.export',
        VIEW_DETAILS: 'log.view_details',
    },
    ROLE: {
        CREATE: 'role.create',
        READ: 'role.read',
        UPDATE: 'role.update',
        DELETE: 'role.delete',
        ASSIGN: 'role.assign',
        MANAGE_PERMISSIONS: 'role.manage_permissions',
    },
    REPORT: {
        VIEW: 'report.view',
        EXPORT: 'report.export',
        GENERATE: 'report.generate',
    },
};

function getAllPermissions() {
    return Object.values(PERMISSIONS).flatMap((mod) => Object.values(mod));
}

// ─── Main Function ──────────────────────────────────────────────────────
async function main() {
    console.log('🌱 Starting database seed...\n');

    // 1) Clear old data (optional - remove this section if you want to keep the data)
    console.log('🗑️  Clearing old data...');
    await prisma.taskLabel.deleteMany();
    await prisma.label.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.taskStatus.deleteMany();
    await prisma.projectStatus.deleteMany();
    await prisma.projectType.deleteMany();

    // 2) Project Types
    console.log('📁 Creating project types...');
    const projectTypes = await Promise.all([
        prisma.projectType.create({
            data: {
                name: 'Web Development',
                description: 'Web application development projects',
                isActive: true,
                displayOrder: 1,
                color: '#3b82f6',
                icon: 'globe',
            },
        }),
        prisma.projectType.create({
            data: {
                name: 'Mobile Development',
                description: 'Mobile application development projects',
                isActive: true,
                displayOrder: 2,
                color: '#10b981',
                icon: 'smartphone',
            },
        }),
        prisma.projectType.create({
            data: {
                name: 'Backend API',
                description: 'Backend and API development projects',
                isActive: true,
                displayOrder: 3,
                color: '#8b5cf6',
                icon: 'server',
            },
        }),
        prisma.projectType.create({
            data: {
                name: 'UI/UX Design',
                description: 'Design and user experience projects',
                isActive: true,
                displayOrder: 4,
                color: '#f59e0b',
                icon: 'palette',
            },
        }),
    ]);
    console.log('✅ Created ' + projectTypes.length + ' project types');

    // 3) Project Statuses
    console.log('📊 Creating project statuses...');
    const projectStatuses = await Promise.all([
        prisma.projectStatus.create({
            data: {
                name: 'Planning',
                color: '#6b7280',
                isDefault: true,
                isFinal: false,
                isUrgent: false,
                orderIndex: 1,
                isActive: true,
            },
        }),
        prisma.projectStatus.create({
            data: {
                name: 'In Progress',
                color: '#3b82f6',
                isDefault: false,
                isFinal: false,
                isUrgent: false,
                orderIndex: 2,
                isActive: true,
            },
        }),
        prisma.projectStatus.create({
            data: {
                name: 'On Hold',
                color: '#f59e0b',
                isDefault: false,
                isFinal: false,
                isUrgent: false,
                orderIndex: 3,
                isActive: true,
            },
        }),
        prisma.projectStatus.create({
            data: {
                name: 'Urgent',
                color: '#ef4444',
                isDefault: false,
                isFinal: false,
                isUrgent: true,
                orderIndex: 4,
                isActive: true,
            },
        }),
        prisma.projectStatus.create({
            data: {
                name: 'Completed',
                color: '#10b981',
                isDefault: false,
                isFinal: true,
                isUrgent: false,
                orderIndex: 5,
                isActive: true,
            },
        }),
        prisma.projectStatus.create({
            data: {
                name: 'Cancelled',
                color: '#6b7280',
                isDefault: false,
                isFinal: true,
                isUrgent: false,
                orderIndex: 6,
                isActive: true,
            },
        }),
    ]);
    console.log('✅ Created ' + projectStatuses.length + ' project statuses');

    // 4) Task Statuses
    console.log('✅ Creating task statuses...');
    const taskStatuses = await Promise.all([
        prisma.taskStatus.create({
            data: {
                name: 'Pending',
                color: '#6b7280',
                isDefault: true,
                isFinal: false,
                isBlocking: false,
                orderIndex: 1,
                isActive: true,
            },
        }),
        prisma.taskStatus.create({
            data: {
                name: 'In Progress',
                color: '#3b82f6',
                isDefault: false,
                isFinal: false,
                isBlocking: false,
                orderIndex: 2,
                isActive: true,
            },
        }),
        prisma.taskStatus.create({
            data: {
                name: 'In Review',
                color: '#f59e0b',
                isDefault: false,
                isFinal: false,
                isBlocking: false,
                orderIndex: 3,
                isActive: true,
            },
        }),
        prisma.taskStatus.create({
            data: {
                name: 'Blocked',
                color: '#ef4444',
                isDefault: false,
                isFinal: false,
                isBlocking: true,
                orderIndex: 4,
                isActive: true,
            },
        }),
        prisma.taskStatus.create({
            data: {
                name: 'Completed',
                color: '#10b981',
                isDefault: false,
                isFinal: true,
                isBlocking: false,
                orderIndex: 5,
                isActive: true,
            },
        }),
        prisma.taskStatus.create({
            data: {
                name: 'Cancelled',
                color: '#6b7280',
                isDefault: false,
                isFinal: true,
                isBlocking: false,
                orderIndex: 6,
                isActive: true,
            },
        }),
    ]);
    console.log('✅ Created ' + taskStatuses.length + ' task statuses');

    // 5) Full Permissions (from PERMISSIONS above)
    console.log('🔐 Creating permissions (RBAC)...');
    const allKeys = getAllPermissions();
    const permissions = [];
    for (const key of allKeys) {
        const [module, ...actionParts] = key.split('.');
        const action = actionParts.join('.');
        const name = action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const category = actionParts.length > 1 ? actionParts[0] : null;
        const p = await prisma.permission.create({
            data: {
                key,
                name,
                description: 'Permission to ' + action.replace(/_/g, ' '),
                module,
                category,
            },
        });
        permissions.push(p);
    }
    console.log('✅ Created ' + permissions.length + ' permissions');

    // 6) Roles (System admin role + other roles)
    console.log('👥 Creating roles...');
    const adminRole = await prisma.role.create({
        data: {
            name: 'admin',
            description: 'System Administrator with full access',
            isSystemRole: true,
        },
    });
    await prisma.role.create({
        data: {
            name: 'project_manager',
            description: 'Project Manager',
            isSystemRole: true,
        },
    });
    await prisma.role.create({
        data: {
            name: 'team_lead',
            description: 'Team Lead',
            isSystemRole: true,
        },
    });
    await prisma.role.create({
        data: {
            name: 'developer',
            description: 'Developer',
            isSystemRole: true,
        },
    });
    await prisma.role.create({
        data: {
            name: 'viewer',
            description: 'Read-only access',
            isSystemRole: true,
        },
    });
    console.log('✅ Created roles (admin, project_manager, team_lead, developer, viewer)');

    // 7) Map all permissions to admin role
    console.log('🔗 Mapping permissions to admin role...');
    for (const perm of permissions) {
        await prisma.rolePermission.create({
            data: { roleId: adminRole.id, permissionId: perm.id },
        });
    }
    console.log('✅ Mapped ' + permissions.length + ' permissions to admin role');

    // 8) Labels
    console.log('🏷️  Creating labels...');
    const labels = await Promise.all([
        prisma.label.create({
            data: { name: 'Bug', color: '#ef4444', description: 'Bug fixes and issues' },
        }),
        prisma.label.create({
            data: { name: 'Feature', color: '#3b82f6', description: 'New features and enhancements' },
        }),
        prisma.label.create({
            data: { name: 'Documentation', color: '#8b5cf6', description: 'Documentation updates' },
        }),
        prisma.label.create({
            data: { name: 'Refactoring', color: '#f59e0b', description: 'Code refactoring and improvements' },
        }),
        prisma.label.create({
            data: { name: 'Testing', color: '#10b981', description: 'Testing and QA' },
        }),
        prisma.label.create({
            data: { name: 'Urgent', color: '#dc2626', description: 'Urgent tasks' },
        }),
    ]);
    console.log('✅ Created ' + labels.length + ' labels');

    // 9) Admin System Account Creation (Admin Bootstrap) if enabled
    console.log('👨‍💼 Setting up admin user (Admin Bootstrap)...');

    if (process.env.BOOTSTRAP_ADMIN === 'true') {
        const adminUsername = process.env.ADMIN_BOOTSTRAP_USERNAME?.trim();
        const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim();
        const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;

        if (!adminUsername || !adminEmail || !adminPassword) {
            console.error('❌ Bootstrap failed: Please provide ADMIN_BOOTSTRAP_USERNAME, ADMIN_BOOTSTRAP_EMAIL, and ADMIN_BOOTSTRAP_PASSWORD');
            process.exit(1);
        }

        // Strength validation
        if (adminPassword.length < 12) {
            console.error('❌ Bootstrap failed: Password must be at least 12 characters long');
            process.exit(1);
        }
        if (adminPassword === adminUsername || adminPassword === adminEmail) {
            console.error('❌ Bootstrap failed: Password cannot be identical to username or email');
            process.exit(1);
        }
        const weakPatterns = ['password', 'admin', '123456', 'qwerty'];
        const passLower = adminPassword.toLowerCase();
        if (weakPatterns.some(pattern => passLower.includes(pattern))) {
            console.error('❌ Bootstrap failed: Password is too weak and contains common patterns');
            process.exit(1);
        }

        // Hash securely
        const passwordHash = await bcrypt.hash(adminPassword, 10);

        const adminData = {
            username: adminUsername,
            email: adminEmail,
            passwordHash,
            role: 'admin',
        };

        const adminUser = await prisma.user.upsert({
            where: { username: adminUsername },
            update: {
                email: adminEmail,
                passwordHash,
                role: 'admin',
            },
            create: adminData,
        });
        console.log(`✅ Admin account setup successful: ${adminUsername}`);

        const existingLink = await prisma.userRole.findFirst({
            where: { userId: adminUser.id, roleId: adminRole.id, scopeType: 'global' },
        });
        if (!existingLink) {
            await prisma.userRole.create({
                data: {
                    userId: adminUser.id,
                    roleId: adminRole.id,
                    scopeType: 'global',
                    scopeId: null,
                },
            });
            console.log(`✅ Admin user mapped to admin role`);
        } else {
            console.log(`✅ Admin user was already mapped to admin role`);
        }
    } else {
        if (process.env.NODE_ENV === 'production') {
            console.log('ℹ️  Admin Bootstrap step skipped. To enable it, specify the required variables.');
        } else {
            console.log('ℹ️  Admin Bootstrap skipped (BOOTSTRAP_ADMIN !== true)');
        }
    }

    // ─── Summary and Report ───────────────────────────────────────────
    console.log('\n✨ Seed execution finished successfully.\n');
    console.log('📊 Summary:');
    console.log('   - ' + projectTypes.length + ' Project Types');
    console.log('   - ' + projectStatuses.length + ' Project Statuses');
    console.log('   - ' + taskStatuses.length + ' Task Statuses');
    console.log('   - ' + permissions.length + ' Permissions');
    console.log('   - 5 Roles (admin, project_manager, team_lead, developer, viewer)');
    console.log('   - ' + labels.length + ' Labels');
    if (process.env.BOOTSTRAP_ADMIN === 'true') {
        console.log('   - Admin system setup (Admin Bootstrap) completed successfully.\n');
        console.log('🔒 Security Reminder: Please set `BOOTSTRAP_ADMIN=false` in the future and remove the password from the variables.');
    } else {
        console.log('   - Admin user creation/update was not performed (disabled).\n');
    }
}

main()
    .catch((e) => {
        console.error('❌ Error during seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
