/**
 * Prisma Seed - كل عمليات الـ seed في مكان واحد (JavaScript فقط، لا TypeScript)
 *
 * التشغيل:
 *   npm run prisma:seed
 * أو
 *   npx prisma db seed
 *
 * ينشئ: أنواع المشاريع، حالات المشاريع/المهام، الصلاحيات الكاملة (RBAC)، الأدوار،
 * ربط الصلاحيات بالأدوار، التسميات، ومستخدم الأدمن.
 *
 * بيانات دخول الأدمن بعد التشغيل:
 *   Username: admin
 *   Email: admin@example.com
 *   Password: password123
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// ─── تعريفات الصلاحيات الكاملة (RBAC) ─────────────────────────────────────
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

// ─── الدالة الرئيسية ──────────────────────────────────────────────────────
async function main() {
    console.log('🌱 بدء تشغيل seed قاعدة البيانات...\n');

    // 1) مسح البيانات القديمة (اختياري – احذف هذا القسم لو أردت الإبقاء على البيانات)
    console.log('🗑️  مسح البيانات القديمة...');
    await prisma.taskLabel.deleteMany();
    await prisma.label.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.taskStatus.deleteMany();
    await prisma.projectStatus.deleteMany();
    await prisma.projectType.deleteMany();

    // 2) أنواع المشاريع
    console.log('📁 إنشاء أنواع المشاريع...');
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
    console.log('✅ تم إنشاء ' + projectTypes.length + ' أنواع مشاريع');

    // 3) حالات المشاريع
    console.log('📊 إنشاء حالات المشاريع...');
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
    console.log('✅ تم إنشاء ' + projectStatuses.length + ' حالات مشاريع');

    // 4) حالات المهام
    console.log('✅ إنشاء حالات المهام...');
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
    console.log('✅ تم إنشاء ' + taskStatuses.length + ' حالات مهام');

    // 5) الصلاحيات الكاملة (من PERMISSIONS أعلاه)
    console.log('🔐 إنشاء الصلاحيات (RBAC)...');
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
    console.log('✅ تم إنشاء ' + permissions.length + ' صلاحية');

    // 6) الأدوار (دور admin للنظام + أدوار أخرى)
    console.log('👥 إنشاء الأدوار...');
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
    console.log('✅ تم إنشاء الأدوار (admin, project_manager, team_lead, developer, viewer)');

    // 7) ربط كل الصلاحيات بدور admin
    console.log('🔗 ربط الصلاحيات بدور admin...');
    for (const perm of permissions) {
        await prisma.rolePermission.create({
            data: { roleId: adminRole.id, permissionId: perm.id },
        });
    }
    console.log('✅ تم ربط ' + permissions.length + ' صلاحية بدور admin');

    // 8) التسميات (Labels)
    console.log('🏷️  إنشاء التسميات...');
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
    console.log('✅ تم إنشاء ' + labels.length + ' تسمية');

    // 9) مستخدم الأدمن + ربطه بدور admin (نطاق عام)
    console.log('👨‍💼 إنشاء مستخدم الأدمن...');
    const passwordHash = await bcrypt.hash('password123', 10);
    let adminUser = await prisma.user.findUnique({ where: { username: 'admin' } });
    if (!adminUser) {
        adminUser = await prisma.user.create({
            data: {
                username: 'admin',
                email: 'admin@example.com',
                passwordHash,
                role: 'admin',
            },
        });
        console.log('✅ تم إنشاء مستخدم الأدمن');
    } else {
        await prisma.user.update({
            where: { id: adminUser.id },
            data: { passwordHash, role: 'admin' },
        });
        console.log('✅ تحديث كلمة مرور ودور مستخدم الأدمن الموجود');
    }
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
        console.log('✅ ربط مستخدم الأدمن بدور admin');
    } else {
        console.log('✅ مستخدم الأدمن مربوط مسبقاً بدور admin');
    }

    // ─── الخلاصة وبيانات الدخول ───────────────────────────────────────────
    console.log('\n✨ انتهى تشغيل الـ seed بنجاح.\n');
    console.log('📊 الملخص:');
    console.log('   - ' + projectTypes.length + ' أنواع مشاريع');
    console.log('   - ' + projectStatuses.length + ' حالات مشاريع');
    console.log('   - ' + taskStatuses.length + ' حالات مهام');
    console.log('   - ' + permissions.length + ' صلاحية');
    console.log('   - 5 أدوار (admin, project_manager, team_lead, developer, viewer)');
    console.log('   - ' + labels.length + ' تسمية');
    console.log('   - مستخدم أدمن واحد\n');
    console.log('📝 بيانات دخول الأدمن:');
    console.log('   Username: admin');
    console.log('   Email: admin@example.com');
    console.log('   Password: password123\n');
}

main()
    .catch((e) => {
        console.error('❌ خطأ أثناء الـ seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
