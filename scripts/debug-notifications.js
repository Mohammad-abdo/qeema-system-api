
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const notifications = await prisma.projectNotification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
            id: true,
            type: true,
            entityType: true,
            entityId: true,
            title: true,
            userId: true,
            createdAt: true
        }
    })

    const fs = require('fs')
    fs.writeFileSync('scripts/debug-output.json', JSON.stringify(notifications, null, 2))
    console.log('Written to scripts/debug-output.json')
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
