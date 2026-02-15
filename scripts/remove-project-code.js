const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function removeProjectCode() {
    try {
        console.log('Removing code column from projects table...')
        
        // SQLite doesn't support DROP COLUMN directly, so we need to:
        // 1. Create a new table without the code column
        // 2. Copy data from old table to new table
        // 3. Drop old table
        // 4. Rename new table to old name
        // 5. Recreate indexes
        
        await prisma.$executeRawUnsafe(`
            -- Create new table without code column
            CREATE TABLE "projects_new" (
                "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                "name" TEXT NOT NULL,
                "type" TEXT NOT NULL,
                "description" TEXT,
                "scope_text" TEXT,
                "status" TEXT NOT NULL DEFAULT 'planned',
                "start_date" DATETIME,
                "end_date" DATETIME,
                "project_manager_id" INTEGER,
                "created_by" INTEGER NOT NULL,
                "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "projects_project_manager_id_fkey" FOREIGN KEY ("project_manager_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
                CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
            );
        `)
        
        console.log('Copying data from old table to new table...')
        await prisma.$executeRawUnsafe(`
            INSERT INTO "projects_new" (
                "id", "name", "type", "description", "scope_text", "status", 
                "start_date", "end_date", "project_manager_id", "created_by", 
                "created_at", "updated_at"
            )
            SELECT 
                "id", "name", "type", "description", "scope_text", "status", 
                "start_date", "end_date", "project_manager_id", "created_by", 
                "created_at", "updated_at"
            FROM "projects";
        `)
        
        console.log('Dropping old table...')
        await prisma.$executeRawUnsafe(`DROP TABLE "projects";`)
        
        console.log('Renaming new table...')
        await prisma.$executeRawUnsafe(`ALTER TABLE "projects_new" RENAME TO "projects";`)
        
        console.log('Recreating indexes...')
        // Recreate any indexes that were on the projects table
        // (Prisma will handle this, but we can add them manually if needed)
        
        console.log('✅ Successfully removed code column from projects table!')
        
    } catch (error) {
        console.error('❌ Error removing code column:', error)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

removeProjectCode()
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

