/**
 * Select Clause Generator Helper - Usage: node scripts/generate-select-clauses.js
 */

const fs = require('fs');
const path = require('path');

const commonFieldMap = {
    task: {
        listView: ['id', 'title', 'priority', 'status', 'dueDate', 'projectId'],
        detailView: ['id', 'title', 'description', 'priority', 'status', 'dueDate', 'projectId', 'createdAt', 'createdById'],
        withAssignees: ['id', 'title', 'priority', 'status', 'dueDate', 'assignees: { select: { id: true, username: true, email: true, avatarUrl: true } }'],
        withStatus: ['id', 'title', 'priority', 'status', 'taskStatus: { select: { id: true, name: true, color: true } }'],
    },
    project: {
        listView: ['id', 'name', 'status', 'projectManagerId', 'startDate', 'endDate'],
        detailView: ['id', 'name', 'description', 'status', 'projectManagerId', 'projectManager: { select: { id: true, username: true, email: true } }'],
        withStats: ['id', 'name', 'status', '_count: { select: { tasks: true, members: true } }'],
    },
    user: {
        basic: ['id', 'username', 'email', 'avatarUrl', 'role'],
        profile: ['id', 'username', 'email', 'avatarUrl', 'role', 'isActive', 'createdAt'],
        withStats: ['id', 'username', 'email', '_count: { select: { tasks: true, projects: true } }'],
    },
    team: {
        listView: ['id', 'name', 'status', 'teamLeadId'],
        detailView: ['id', 'name', 'description', 'status', 'teamLead: { select: { id: true, username: true } }', 'members: { select: { userId: true, role: true } }'],
    },
    activityLog: {
        listView: ['id', 'actionType', 'actionSummary', 'performedById', 'createdAt', 'entityType'],
        detailView: ['id', 'actionType', 'actionCategory', 'actionSummary', 'actionDetails', 'performedById', 'createdAt', 'entityType', 'entityId'],
    },
};

function analyzeFile(filePath, content) {
    const analyses = [];
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
        if (!line.includes('prisma.') || !line.includes('find')) return;

        const tableMatch = line.match(/prisma\.(\w+)\.find/);
        if (!tableMatch) return;

        const table = tableMatch[1];
        const hasSelect = line.includes('select:');
        const hasInclude = line.includes('include:');

        let context = 'listView';
        if (line.includes('findUnique') || line.includes('findFirst')) context = 'detailView';
        if (line.includes('_count')) context = hasInclude ? 'withStats' : context;

        if (hasInclude && !hasSelect) {
            const fields = (commonFieldMap[table] && commonFieldMap[table][context]) || (commonFieldMap[table] && commonFieldMap[table].listView) || [];
            analyses.push({
                file: filePath,
                line: idx + 1,
                table,
                currentSelect: hasSelect ? 'has select' : null,
                suggestedSelect: generateSelectString(table, fields),
                impact: 'HIGH',
            });
        }
    });

    return analyses;
}

function generateSelectString(table, fields) {
    const simpleFields = fields.filter((f) => !f.includes(':'));
    const complexFields = fields.filter((f) => f.includes(':'));

    let select = 'select: {\n';
    simpleFields.forEach((field) => { select += `      ${field}: true,\n`; });
    complexFields.forEach((field) => { select += `      ${field},\n`; });
    select += '    }';
    return select;
}

function scanDirectory(dirPath) {
    const allAnalyses = [];
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.name.startsWith('.') || ['node_modules', 'dist', 'build', '.next'].includes(entry.name)) continue;
            if (entry.isDirectory()) {
                allAnalyses.push(...scanDirectory(fullPath));
            } else if (entry.isFile() && entry.name.endsWith('.ts') && entry.name.includes('action')) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                allAnalyses.push(...analyzeFile(fullPath, content));
            }
        }
    } catch (error) {
        console.error('Error scanning', dirPath, error);
    }
    return allAnalyses;
}

console.log('🔧 Select Clause Optimization Helper');
console.log('='.repeat(70));
console.log();

const analyses = scanDirectory('./src');

if (analyses.length === 0) {
    console.log('✅ No queries found needing select clause optimization');
    console.log('This tool looks for queries using \'include\' without \'select\'.');
} else {
    console.log(`Found ${analyses.length} queries that could use select clauses:\n`);
    const byTable = analyses.reduce((acc, a) => {
        if (!acc[a.table]) acc[a.table] = [];
        acc[a.table].push(a);
        return acc;
    }, {});
    Object.entries(byTable).forEach(([table, items]) => {
        console.log(`📊 ${table.toUpperCase()} (${items.length} queries):`);
        items.forEach((item) => console.log(`   Line ${item.line}: ${item.file.split(path.sep).pop() || item.file}`));
        console.log();
    });
}

console.log('='.repeat(70));
console.log('💡 Quick Reference - Common Select Patterns:');
Object.entries(commonFieldMap).forEach(([model, contexts]) => {
    console.log(`${model.toUpperCase()}:`);
    Object.entries(contexts).forEach(([context, fields]) => {
        console.log(`  ${context}: [${fields.slice(0, 3).join(', ')}...]`);
    });
    console.log();
});
