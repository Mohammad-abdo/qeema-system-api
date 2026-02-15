const fs = require('fs');
const path = require('path');

// Read the seed file
const seedPath = path.join(__dirname, '..', 'prisma', 'seed.ts');
let content = fs.readFileSync(seedPath, 'utf8');

// The old permissions code starts at line 57 and ends at line 99
// We'll replace everything from "// 1. Seed Permissions" to the end of createdPermissions logging

const oldCode = `  // 1. Seed Permissions
  console.log('📋 Seeding Permissions...')
  const permissions = [
    // Project permissions
    { key: 'project.create', name: 'Create Project', module: 'project', category: 'management' },
    { key: 'project.read', name: 'View Project', module: 'project', category: 'view' },
    { key: 'project.update', name: 'Update Project', module: 'project', category: 'edit' },
    { key: 'project.delete', name: 'Delete Project', module: 'project', category: 'management' },
    { key: 'project.manage_settings', name: 'Manage Project Settings', module: 'project', category: 'management' },
    
    // Task permissions
    { key: 'task.create', name: 'Create Task', module: 'task', category: 'management' },
    { key: 'task.read', name: 'View Task', module: 'task', category: 'view' },
    { key: 'task.update', name: 'Update Task', module: 'task', category: 'edit' },
    { key: 'task.delete', name: 'Delete Task', module: 'task', category: 'management' },
    { key: 'task.assign', name: 'Assign Task', module: 'task', category: 'management' },
    
    // User permissions
    { key: 'user.create', name: 'Create User', module: 'user', category: 'management' },
    { key: 'user.read', name: 'View User', module: 'user', category: 'view' },
    { key: 'user.update', name: 'Update User', module: 'user', category: 'edit' },
    { key: 'user.delete', name: 'Delete User', module: 'user', category: 'management' },
    
    // Team permissions
    { key: 'team.create', name: 'Create Team', module: 'team', category: 'management' },
    { key: 'team.read', name: 'View Team', module: 'team', category: 'view' },
    { key: 'team.update', name: 'Update Team', module: 'team', category: 'edit' },
    { key: 'team.delete', name: 'Delete Team', module: 'team', category: 'management' },
    
    // Settings permissions
    { key: 'settings.read', name: 'View Settings', module: 'settings', category: 'view' },
    { key: 'settings.update', name: 'Update Settings', module: 'settings', category: 'edit' },
    
    // Reports permissions
    { key: 'reports.read', name: 'View Reports', module: 'reports', category: 'view' },
  ]

  const createdPermissions = []
  for (const perm of permissions) {
    const p = await prisma.permission.create({ data: perm })
    createdPermissions.push(p)
  }
  console.log(\`✅ Created \${createdPermissions.length} permissions\\n\`)`;

const newCode = `  // 1. Seed Permissions - DYNAMICALLY FROM permissions.ts
  console.log('📋 Seeding Permissions...')
  
  // Get all permissions from the permissions definition file
  const allPermissionKeys = getAllPermissions()
  
  const createdPermissions = []
  for (const key of allPermissionKeys) {
    const [module, ...actionParts] = key.split('.')
    const action = actionParts.join('.')
    const name = action.replace(/_/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase())
    const category = actionParts.length > 1 ? actionParts[0] : null

    const p = await prisma.permission.create({
      data: {
        key,
        name,
        description: \`Permission to \${action.replace(/_/g, ' ')}\`,
        module,
        category,
      },
    })
    createdPermissions.push(p)
  }
  console.log(\`✅ Created \${createdPermissions.length} permissions\\n\`)`;

// Replace the content
content = content.replace(oldCode, newCode);

// Write back
fs.writeFileSync(seedPath, content, 'utf8');

console.log('✅ Successfully updated prisma/seed.ts');
console.log('   The seed file now uses getAllPermissions() to create all 62 permissions.');
console.log('   You can now run "npm run seed" without losing permission tabs!');
