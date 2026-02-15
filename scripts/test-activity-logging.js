const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testLogging() {
  try {
    console.log('Testing activity log creation...')
    
    // Check if columns exist
    const tableInfo = await prisma.$queryRaw`
      PRAGMA table_info(activity_logs);
    `
    console.log('\n=== Activity Logs Table Structure ===')
    console.table(tableInfo)
    
    // Try to create a test log
    console.log('\n=== Attempting to create test log ===')
    try {
      const testLog = await prisma.activityLog.create({
        data: {
          actionType: "test_action",
          actionCategory: "test",
          actionSummary: "Test activity log entry",
          performedById: 1, // Assuming admin user ID is 1
        },
      })
      console.log('✅ Successfully created test log:', testLog.id)
      console.log('Test log data:', JSON.stringify(testLog, null, 2))
    } catch (error) {
      console.error('❌ Failed to create test log:')
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      console.error('Error meta:', JSON.stringify(error.meta, null, 2))
    }
    
    // Check existing logs
    console.log('\n=== Existing Activity Logs ===')
    const existingLogs = await prisma.activityLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    })
    console.log(`Found ${existingLogs.length} logs`)
    existingLogs.forEach((log, index) => {
      console.log(`\nLog ${index + 1}:`)
      console.log('  ID:', log.id)
      console.log('  Action Type:', log.actionType)
      console.log('  Action Category:', log.actionCategory)
      console.log('  Summary:', log.actionSummary)
      console.log('  Performed By:', log.performedById)
      console.log('  Created:', log.createdAt)
    })
    
  } catch (error) {
    console.error('Test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testLogging()

