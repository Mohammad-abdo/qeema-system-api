const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function applyMigration() {
  try {
    console.log('Applying RBAC migration...')
    
    // Create roles table
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS roles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          is_system_role INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
      console.log('✅ Created roles table')
      
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS roles_name_idx ON roles(name)')
    } catch (e) {
      if (e.message?.includes('already exists')) {
        console.log('⚠ roles table already exists')
      } else {
        throw e
      }
    }
    
    // Create permissions table
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS permissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          description TEXT,
          module TEXT NOT NULL,
          category TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
      console.log('✅ Created permissions table')
      
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS permissions_module_idx ON permissions(module)')
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS permissions_category_idx ON permissions(category)')
    } catch (e) {
      if (e.message?.includes('already exists')) {
        console.log('⚠ permissions table already exists')
      } else {
        throw e
      }
    }
    
    // Create role_permissions table
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS role_permissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          role_id INTEGER NOT NULL,
          permission_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(role_id, permission_id),
          FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
          FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
        )
      `)
      console.log('✅ Created role_permissions table')
      
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS role_permissions_role_id_idx ON role_permissions(role_id)')
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS role_permissions_permission_id_idx ON role_permissions(permission_id)')
    } catch (e) {
      if (e.message?.includes('already exists')) {
        console.log('⚠ role_permissions table already exists')
      } else {
        throw e
      }
    }
    
    // Create user_roles table
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS user_roles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          role_id INTEGER NOT NULL,
          scope_type TEXT,
          scope_id INTEGER,
          assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          assigned_by INTEGER,
          UNIQUE(user_id, role_id, scope_type, scope_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
          FOREIGN KEY (assigned_by) REFERENCES users(id)
        )
      `)
      console.log('✅ Created user_roles table')
      
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON user_roles(user_id)')
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS user_roles_role_id_idx ON user_roles(role_id)')
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS user_roles_scope_idx ON user_roles(scope_type, scope_id)')
    } catch (e) {
      if (e.message?.includes('already exists')) {
        console.log('⚠ user_roles table already exists')
      } else {
        throw e
      }
    }
    
    console.log('\n✅ RBAC migration completed successfully!')
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

applyMigration()

