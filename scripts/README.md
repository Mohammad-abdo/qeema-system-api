# Backend Scripts

This folder contains utility scripts for database management, testing, and system administration. All scripts have been moved from the frontend to the backend since they interact with the database through Prisma.

## Quick Start

### Common Scripts (via npm)

```bash
# Initialize RBAC system with roles and permissions
npm run script:init-rbac

# List all users in the database
npm run script:list-users

# Verify database table counts
npm run script:verify-db

# Seed admin user only
npm run script:seed-admin

# Check permissions setup
npm run script:check-permissions
```

## All Available Scripts

### Database Migrations

- **add-action-type-column.js** - Add action type column to activity logs
- **add-project-priority-migration.js** - Add priority and urgent fields to projects
- **apply-activity-log-migration.js** - Apply activity log schema changes
- **apply-rbac-migration.js** - Apply RBAC (Role-Based Access Control) migrations
- **apply-team-migration.js** - Apply team-related schema changes

### RBAC & Permissions

- **initialize-rbac.js** - Initialize the complete RBAC system with default roles and permissions
- **init-permissions.mjs** - Initialize permissions only
- **fix-permissions.mjs** / **fix-permissions.ts** - Fix permission assignments
- **fix-rbac-patterns.ts** - Fix RBAC pattern issues
- **check-permissions.ts** - Verify permission setup

### Database Management

- **check_orphaned_data.ts** - Find orphaned records in the database
- **verify-db-counts.js** - Verify table row counts
- **verify-fix.js** - Verify database fixes
- **remove-project-code.js** - Remove project code field (legacy cleanup)

### User Management

- **list-users.js** - List all users in the database
- **seed-admin-only.ts** - Create admin user only
- **invalidate-old-sessions.ts** - Invalidate old user sessions

### Testing & Debugging

- **test-api.js** - Test API endpoints
- **test-activity-logging.js** - Test activity logging functionality
- **test-mentions.js** - Test mention functionality
- **test-file-upload-validation.ts** - Test file upload validation
- **test-nextauth-secret.ts** - Test NextAuth secret configuration
- **debug-notifications.js** - Debug notification system
- **debug-task-16.js** - Debug specific task issues

### Data Seeding

- **seed-report-data.js** - Seed sample report data
- **update-seed.js** - Update seed data
- **load/** - Load test data (subdirectory)

### Performance & Monitoring

- **audit-query-performance.ts** - Audit database query performance
- **audit-rbac-bypasses.ts** - Audit RBAC bypass attempts
- **benchmark-productivity.ts** - Benchmark productivity metrics
- **benchmark-week1-improvements.ts** - Benchmark week 1 improvements
- **monitor-local.ps1** - Monitor local development (PowerShell)
- **monitor-production.sh** - Monitor production environment (Bash)
- **verify_stats.ts** - Verify statistics calculations

### Utilities

- **generate-select-clauses.ts** - Generate Prisma select clauses
- **validate-contracts.cjs** - Validate API contracts

## Running Scripts

### JavaScript Files (.js)
```bash
node scripts/<script-name>.js
```

### TypeScript Files (.ts)
```bash
# Using tsx (if installed)
npx tsx scripts/<script-name>.ts

# Or using ts-node
npx ts-node scripts/<script-name>.ts
```

### ES Modules (.mjs)
```bash
node scripts/<script-name>.mjs
```

### PowerShell Scripts (.ps1)
```powershell
.\scripts\<script-name>.ps1
```

### Bash Scripts (.sh)
```bash
bash scripts/<script-name>.sh
```

## Important Notes

1. **Database Connection**: All scripts use the Prisma client configured in the backend
2. **Environment Variables**: Make sure `.env` file is properly configured
3. **Migrations**: Run migrations before using migration scripts
4. **RBAC**: Initialize RBAC before testing permission-related features
5. **Backup**: Always backup your database before running migration scripts

## Dependencies

All scripts use the backend's installed dependencies:
- `@prisma/client` - Database access
- `date-fns` / `date-fns-tz` - Date handling
- Other backend dependencies as needed

## Troubleshooting

If a script fails:
1. Check that the database is running
2. Verify Prisma client is generated: `npm run prisma:generate`
3. Check environment variables in `.env`
4. Review script output for specific error messages
