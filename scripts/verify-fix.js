
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Copy of the updated extraction logic
function extractMentions(text) {
    const mentionRegex = /@([\w.-]+)/g
    const matches = text.match(mentionRegex)
    if (!matches) return []
    return [...new Set(matches.map(m => m.substring(1)))]
}

async function main() {
    const complexUsername = "user.name-test"
    const testContent = `Hello @${complexUsername}, can you check this?`

    console.log("Testing content:", testContent)
    const mentionedUsernames = extractMentions(testContent)
    console.log("Extracted mentions:", mentionedUsernames)

    if (mentionedUsernames.includes(complexUsername)) {
        console.log("✅ Regex successfully captured complex username!")
    } else {
        console.log("❌ Regex failed to capture complex username.")
    }
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
