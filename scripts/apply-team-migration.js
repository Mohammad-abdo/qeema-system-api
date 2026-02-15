const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function applyMigration() {
  try {
    console.log('Applying team enhancements migration...')
    
    // Add status column to teams table
    try {
      await prisma.$executeRawUnsafe('ALTER TABLE teams ADD COLUMN status TEXT DEFAULT "active"')
      console.log('✅ Added status column to teams')
    } catch (e) {
      if (e.message?.includes('duplicate column')) {
        console.log('⚠ Status column already exists')
      } else {
        throw e
      }
    }
    
    // Add updated_at column to teams table (SQLite doesn't support DEFAULT CURRENT_TIMESTAMP in ALTER TABLE)
    try {
      await prisma.$executeRawUnsafe('ALTER TABLE teams ADD COLUMN updated_at DATETIME')
      // Set default value for existing rows
      await prisma.$executeRawUnsafe('UPDATE teams SET updated_at = created_at WHERE updated_at IS NULL')
      console.log('✅ Added updated_at column to teams')
    } catch (e) {
      if (e.message?.includes('duplicate column')) {
        console.log('⚠ updated_at column already exists')
      } else {
        throw e
      }
    }
    
    // Create team_members table
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS team_members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          team_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          role TEXT DEFAULT "member",
          joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(team_id, user_id),
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `)
      console.log('✅ Created team_members table')
      
      // Create indexes
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS team_members_team_id_idx ON team_members(team_id)')
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON team_members(user_id)')
      console.log('✅ Created indexes for team_members')
    } catch (e) {
      if (e.message?.includes('already exists')) {
        console.log('⚠ team_members table already exists')
      } else {
        throw e
      }
    }
    
    // Create project_teams table
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS project_teams (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          team_id INTEGER NOT NULL,
          assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(project_id, team_id),
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
        )
      `)
      console.log('✅ Created project_teams table')
      
      // Create indexes
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS project_teams_project_id_idx ON project_teams(project_id)')
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS project_teams_team_id_idx ON project_teams(team_id)')
      console.log('✅ Created indexes for project_teams')
    } catch (e) {
      if (e.message?.includes('already exists')) {
        console.log('⚠ project_teams table already exists')
      } else {
        throw e
      }
    }
    
    console.log('\n✅ Migration completed successfully!')
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

applyMigration()

