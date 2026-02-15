
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Copy of the extraction logic from comments.ts
function extractMentions(text) {
    const mentionRegex = /@(\w+)/g
    const matches = text.match(mentionRegex)
    if (!matches) return []
    // Remove @ symbol and return unique usernames
    return [...new Set(matches.map(m => m.substring(1)))]
}

async function main() {
    const testContent = "Hello @admin, can you check this? Also @manager"
    console.log("Testing content:", testContent)

    const mentionedUsernames = extractMentions(testContent)
    console.log("Extracted mentions:", mentionedUsernames)

    if (mentionedUsernames.length > 0) {
        const mentionedUsers = await prisma.user.findMany({
            where: {
                username: { in: mentionedUsernames }
            },
            select: { id: true, username: true }
        })
        console.log("Found users in DB:", mentionedUsers)

        if (mentionedUsers.length === 0) {
            console.log("❌ No users found! Check if usernames 'admin' or 'manager' exist in your DB.")
        } else {
            console.log("✅ Users found successfully. Logic seems correct.")
        }
    } else {
        console.log("❌ No mentions extracted! Regex might be wrong.")
    }
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
