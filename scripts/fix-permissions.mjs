import { PrismaClient } from '@prisma/client'
import { getAllPermissions } from '../src/lib/permissions'

const prisma = new PrismaClient()

async function main() {
    console.log('🔧 Fixing permissions in database...\n')

    // First, delete all existing permissions and role permissions
    await prisma.rolePermission.deleteMany()
    await prisma.permission.deleteMany()

    console.log('✅ Cleaned existing permissions\n')

    // Get all permissions from the permissions definition file
    const allPermissionKeys = getAllPermissions()
    console.log(`📋 Creating ${allPermissionKeys.length} permissions...\n`)

    const createdPermissions = []
    for (const key of allPermissionKeys) {
        const [module, ...actionParts] = key.split('.')
        const action = actionParts.join('.')
        const name = action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        const category = actionParts.length > 1 ? actionParts[0] : null

        const p = await prisma.permission.create({
            data: {
                key,
                name,
                description: `Permission to ${action.replace(/_/g, ' ')}`,
                module,
                category,
            },
        })
        createdPermissions.push(p)
    }

    console.log(`✅ Created ${createdPermissions.length} permissions\n`)

    // Re-assign all permissions to admin role  
    const adminRole = await prisma.role.findFirst({
        where: { name: 'admin' }
    })

    if (adminRole) {
        console.log('🔗 Assigning all permissions to admin role...\n')
        for (const perm of createdPermissions) {
            await prisma.rolePermission.create({
                data: { roleId: adminRole.id, permissionId: perm.id },
            })
        }
        console.log(`✅ Assigned ${createdPermissions.length} permissions to admin role\n`)
    }

    // Show modules
    const modules = await prisma.permission.findMany({
        select: { module: true },
        distinct: ['module']
    })

    console.log(`📊 Modules in database (${modules.length}):`)
    modules.forEach((m, i) => {
        console.log(`   ${i + 1}. ${m.module}`)
    })

    console.log('\n✅ Permissions fixed successfully!')

    await prisma.$disconnect()
}

main()
    .catch((e) => {
        console.error('❌ Error:', e)
        process.exit(1)
    })
