const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    const totalProjects = await prisma.project.count();
    const activeProjects = await prisma.project.count({
        where: {
            status: {
                not: 'completed',
            },
        },
    });

    const totalTasks = await prisma.task.count();
    const completedTasks = await prisma.task.count({
        where: {
            status: 'completed',
        },
    });

    const users = await prisma.user.count();

    console.log(JSON.stringify({
        totalProjects,
        totalTasks,
        completedTasks,
        users,
    }, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
