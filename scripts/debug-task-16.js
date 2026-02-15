
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const taskId = 16
    const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { project: true }
    })

    if (!task) {
        console.log(`Task ${taskId} NOT FOUND`)
    } else {
        console.log('Task Found:', {
            id: task.id,
            title: task.title,
            projectId: task.projectId,
            projectName: task.project.name,
            status: task.status
        })
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
