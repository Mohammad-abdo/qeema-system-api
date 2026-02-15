const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkLogicalIntegrity() {
    console.log('--- Starting Logical Integrity Check ---');

    const tasksWithoutStatusId = await prisma.task.count({
        where: { taskStatusId: null },
    });

    if (tasksWithoutStatusId > 0) {
        console.warn(`[WARN] Found ${tasksWithoutStatusId} tasks using only legacy 'status' string (taskStatusId is null).`);
    } else {
        console.log('[OK] All tasks have a dynamic TaskStatus assigned.');
    }

    const projectsWithoutTypeId = await prisma.project.count({
        where: { projectTypeId: null },
    });

    if (projectsWithoutTypeId > 0) {
        console.warn(`[WARN] Found ${projectsWithoutTypeId} projects using only legacy 'type' string (projectTypeId is null).`);
    }

    const usersWithoutRoles = await prisma.user.findMany({
        where: { roles: { none: {} } },
        select: { id: true, username: true, role: true },
    });

    if (usersWithoutRoles.length > 0) {
        console.warn(`[WARN] Found ${usersWithoutRoles.length} users with legacy 'role' string but no entries in 'UserRole' table:`);
    } else {
        console.log('[OK] All users have at least one granular UserRole.');
    }

    const tasks = await prisma.task.findMany({
        where: { taskStatusId: { not: null } },
        include: { taskStatus: true },
        take: 100,
    });

    let mismatchCount = 0;
    tasks.forEach((t) => {
        const legacy = t.status.toLowerCase().replace('_', ' ');
        const dynamic = (t.taskStatus && t.taskStatus.name ? t.taskStatus.name.toLowerCase().replace('_', ' ') : '') || '';
        if (legacy !== dynamic && !dynamic.includes(legacy)) {
            mismatchCount++;
        }
    });

    if (mismatchCount > 0) {
        console.warn(`[WARN] Found ${mismatchCount} tasks (in sample of 100) where legacy status string matches dynamic status name.`);
    }

    const invalidDateProjects = await prisma.project.findMany({
        where: {
            startDate: { not: null },
            endDate: { not: null },
        },
        select: { id: true, name: true, startDate: true, endDate: true },
    });

    const dateErrors = invalidDateProjects.filter((p) => p.startDate && p.endDate && p.startDate > p.endDate);

    if (dateErrors.length > 0) {
        console.error(`[ERROR] Found ${dateErrors.length} projects where Start Date > End Date:`);
        dateErrors.forEach((p) => console.log(` - ID: ${p.id}, Name: ${p.name}`));
    } else {
        console.log('[OK] All projects have valid date ranges (Start <= End).');
    }

    const startedButPending = await prisma.task.count({
        where: {
            status: 'pending',
            actualHours: { gt: 0 },
        },
    });

    if (startedButPending > 0) {
        console.warn(`[WARN] Found ${startedButPending} tasks with 'Pending' status but have logged hours.`);
    } else {
        console.log('[OK] No pending tasks with logged hours.');
    }

    console.log('--- Integrity Check Complete ---');
}

checkLogicalIntegrity()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
