const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { startOfWeek, endOfWeek, subWeeks, addDays } = require('date-fns')

async function main() {
    const scenario = process.argv[2] || 'trend' // 'trend', 'bad'

    console.log(`Seeding data for scenario: ${scenario}`)

    // 1. Create User & Project
    // Try to find an admin user or create one
    let user = await prisma.user.findFirst({ where: { role: 'admin' } })
    if (!user) {
        user = await prisma.user.create({
            data: {
                username: 'validation_admin',
                email: 'admin@validation.com',
                password: 'hash', // dummy
                role: 'admin'
            }
        })
    }

    const projectName = `Validation Project - ${scenario}`
    // Clean up old
    await prisma.project.deleteMany({ where: { name: projectName } })

    const project = await prisma.project.create({
        data: {
            name: projectName,
            status: 'active',
            startDate: subWeeks(new Date(), 2),
            endDate: addDays(new Date(), 30),
            projectManagerId: user.id,
            createdById: user.id
        }
    })

    console.log(`Created Project: ${project.name} (ID: ${project.id})`)

    // Helper dates
    const today = new Date()
    const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 })
    const lastWeekStart = subWeeks(thisWeekStart, 1)

    // Scenario 1: Positive Trend
    if (scenario === 'trend') {
        // Last Week: 3 Tasks (Velocity ~ 15h)
        for (let i = 0; i < 3; i++) {
            await prisma.task.create({
                data: {
                    title: `Old Task ${i}`,
                    projectId: project.id,
                    status: 'completed',
                    priority: 'medium',
                    estimatedHours: 5,
                    createdAt: lastWeekStart,
                    updatedAt: addDays(lastWeekStart, 2),
                    completedAt: addDays(lastWeekStart, 2),
                    assignees: { connect: { id: user.id } }
                }
            })
        }

        // This Week: 5 Tasks (Velocity ~ 25h) -> Trend UP
        for (let i = 0; i < 5; i++) {
            await prisma.task.create({
                data: {
                    title: `New Task ${i}`,
                    projectId: project.id,
                    status: 'completed',
                    priority: 'medium',
                    estimatedHours: 5,
                    createdAt: thisWeekStart,
                    updatedAt: addDays(thisWeekStart, 1),
                    completedAt: addDays(thisWeekStart, 1),
                    assignees: { connect: { id: user.id } }
                }
            })
        }
    }

    // Scenario 2: Bad Week
    if (scenario === 'bad') {
        // This Week: High Overdue & Blocked
        // 5 Active tasks
        for (let i = 0; i < 5; i++) {
            const isOverdue = i < 3 // 3 overdue
            const isBlocked = i >= 3 // 2 blocked

            let status = 'in_progress'
            let dueDate = addDays(thisWeekStart, 4) // future

            if (isOverdue) {
                dueDate = subDays(today, 1) // past
            }
            if (isBlocked) {
                status = 'waiting'
            }

            const task = await prisma.task.create({
                data: {
                    title: `Bad Task ${i}`,
                    projectId: project.id,
                    status: status,
                    priority: 'urgent',
                    estimatedHours: 10,
                    dueDate: dueDate,
                    createdAt: thisWeekStart,
                    assignees: { connect: { id: user.id } }
                }
            })

            // Block it via dependency if blocked
            if (isBlocked) {
                // Create a blocker task
                const blocker = await prisma.task.create({
                    data: {
                        title: `Blocker for ${i}`,
                        projectId: project.id,
                        status: 'in_progress',
                        createdAt: thisWeekStart
                    }
                })
                await prisma.taskDependency.create({
                    data: {
                        taskId: task.id,
                        dependsOnTaskId: blocker.id
                    }
                })
            }
        }
    }

    console.log("Seeding complete.")
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
