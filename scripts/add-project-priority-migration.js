const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function addProjectPriority() {
    try {
        console.log('Adding priority and urgent fields to projects table...')
        
        // Add priority column (default: 'normal')
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "projects" ADD COLUMN "priority" TEXT DEFAULT 'normal';
        `)
        
        // Add urgent_reason column
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "projects" ADD COLUMN "urgent_reason" TEXT;
        `)
        
        // Add urgent_marked_at column
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "projects" ADD COLUMN "urgent_marked_at" DATETIME;
        `)
        
        // Add urgent_marked_by_id column
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "projects" ADD COLUMN "urgent_marked_by_id" INTEGER;
        `)
        
        // Add foreign key for urgent_marked_by_id
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "projects_urgent_marked_by_id_idx" ON "projects"("urgent_marked_by_id");
        `)
        
        console.log('Adding urgent fields to project_notifications table...')
        
        // Add is_urgent column
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "project_notifications" ADD COLUMN "is_urgent" INTEGER DEFAULT 0;
        `)
        
        // Add requires_acknowledgment column
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "project_notifications" ADD COLUMN "requires_acknowledgment" INTEGER DEFAULT 0;
        `)
        
        // Add acknowledged_at column
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "project_notifications" ADD COLUMN "acknowledged_at" DATETIME;
        `)
        
        // Create indexes
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "project_notifications_urgent_idx" 
            ON "project_notifications"("project_id", "user_id", "is_urgent", "requires_acknowledgment");
        `)
        
        console.log('Creating urgent_project_acknowledgements table...')
        
        // Create urgent_project_acknowledgements table
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "urgent_project_acknowledgements" (
                "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                "project_id" INTEGER NOT NULL,
                "user_id" INTEGER NOT NULL,
                "acknowledged_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "urgent_project_acknowledgements_project_id_fkey" 
                    FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
                CONSTRAINT "urgent_project_acknowledgements_user_id_fkey" 
                    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
            );
        `)
        
        // Create unique constraint
        await prisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "urgent_project_acknowledgements_project_id_user_id_key" 
            ON "urgent_project_acknowledgements"("project_id", "user_id");
        `)
        
        // Create indexes
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "urgent_project_acknowledgements_project_id_idx" 
            ON "urgent_project_acknowledgements"("project_id");
        `)
        
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "urgent_project_acknowledgements_user_id_idx" 
            ON "urgent_project_acknowledgements"("user_id");
        `)
        
        console.log('✅ Successfully added project priority fields!')
        
    } catch (error) {
        console.error('❌ Error adding project priority fields:', error)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

addProjectPriority()
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

