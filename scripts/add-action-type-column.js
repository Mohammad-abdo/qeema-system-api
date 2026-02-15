const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function addColumn() {
  try {
    console.log('Adding action_type column...')
    await prisma.$executeRawUnsafe('ALTER TABLE activity_logs ADD COLUMN action_type TEXT')
    console.log('✅ Column action_type added successfully!')
    
    // Verify it was added
    const tableInfo = await prisma.$queryRaw`
      PRAGMA table_info(activity_logs);
    `
    const hasActionType = tableInfo.some((col) => col.name === 'action_type')
    if (hasActionType) {
      console.log('✅ Verified: action_type column exists')
    } else {
      console.log('❌ Warning: action_type column not found after adding')
    }
  } catch (error) {
    if (error.message?.includes('duplicate column')) {
      console.log('⚠ Column already exists (this is OK)')
    } else {
      console.error('❌ Error:', error.message)
    }
  } finally {
    await prisma.$disconnect()
  }
}

addColumn()

