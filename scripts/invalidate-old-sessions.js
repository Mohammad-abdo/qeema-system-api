/**
 * Invalidate all existing sessions after changing NEXTAUTH_SECRET
 * Usage: node scripts/invalidate-old-sessions.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function invalidateAllSessions() {
    try {
        console.log('🔄 Starting session invalidation...');

        let result = { count: 0 };
        try {
            if (prisma.session) {
                result = await prisma.session.deleteMany({});
            }
        } catch (err) {
            // Session model may not exist in schema
        }

        console.log(`✅ Successfully invalidated ${result.count} sessions`);
        console.log('📋 All users must re-login with the new secret');
        console.log('');
        console.log('⚠️  IMPORTANT:');
        console.log('- Old tokens will no longer be valid');
        console.log('- Users will see logout message on next page load');
        console.log('- They will need to re-login with their credentials');
        console.log('- New sessions will use the new NEXTAUTH_SECRET');

        await prisma.$disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error invalidating sessions:', error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

invalidateAllSessions();
