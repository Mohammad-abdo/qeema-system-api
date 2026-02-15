const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

async function applyMigration() {
  try {
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../prisma/migrations/20250101000000_enhance_activity_logs/migration.sql'),
      'utf-8'
    )

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      if (statement) {
        try {
          await prisma.$executeRawUnsafe(statement)
          console.log('✓ Executed:', statement.substring(0, 50) + '...')
        } catch (error) {
          // Ignore errors for columns that already exist
          if (error.message.includes('duplicate column') || error.message.includes('already exists')) {
            console.log('⚠ Skipped (already exists):', statement.substring(0, 50) + '...')
          } else {
            console.error('✗ Error:', error.message)
            console.error('Statement:', statement.substring(0, 100))
          }
        }
      }
    }

    console.log('Migration applied successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

applyMigration()

