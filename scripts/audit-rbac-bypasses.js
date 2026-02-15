/**
 * Audit script to find RBAC bypasses. Usage: node scripts/audit-rbac-bypasses.js
 */

const fs = require('fs');
const path = require('path');

const BYPASS_PATTERNS = [
    { name: 'Direct role check', pattern: /\.role\s*===?\s*['"](\w+)['"]/gi, severity: 'critical' },
    { name: 'Role comparison without permission check', pattern: /if\s*\(\s*(?:session\.user\.)?role\s*===?\s*['"](\w+)['"]\s*\)/gi, severity: 'critical' },
    { name: 'Admin bypass (user?.role = admin)', pattern: /user\?.?role\s*===?\s*['"]admin['"]/gi, severity: 'critical' },
    { name: 'hasPermissionOrRole function (deprecated)', pattern: /hasPermissionOrRole\s*\(/gi, severity: 'high' },
    { name: 'Role-based ternary (role ? true :)', pattern: /\.role\s*\?\s*true\s*:/gi, severity: 'high' },
    { name: 'Admin check without permission', pattern: /isAdmin\s*&&\s*(?!hasPermission|requirePermission)/gi, severity: 'medium' },
];

function scanDirectory(dirPath, baseDir = dirPath) {
    const findings = [];
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.name.startsWith('.') || ['node_modules', 'dist', 'build'].includes(entry.name)) continue;
            if (entry.isDirectory()) {
                findings.push(...scanDirectory(fullPath, baseDir));
            } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const lines = content.split('\n');
                const relPath = path.relative(baseDir, fullPath);
                lines.forEach((line, index) => {
                    for (const patternDef of BYPASS_PATTERNS) {
                        const re = new RegExp(patternDef.pattern.source, patternDef.pattern.flags);
                        if (re.test(line)) {
                            if (line.includes('@deprecated') || line.includes('// DEPRECATED')) continue;
                            findings.push({
                                file: relPath,
                                line: index + 1,
                                type: patternDef.name,
                                match: line.trim(),
                                severity: patternDef.severity,
                            });
                        }
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error scanning', dirPath, error);
    }
    return findings;
}

function printFindings(findings) {
    if (findings.length === 0) {
        console.log('✅ No RBAC bypasses found!\n');
        return;
    }
    const critical = findings.filter((f) => f.severity === 'critical');
    const high = findings.filter((f) => f.severity === 'high');
    const medium = findings.filter((f) => f.severity === 'medium');
    console.log(`\n⚠️  Found ${findings.length} potential RBAC bypass issues:\n`);
    if (critical.length > 0) {
        console.log(`🔴 CRITICAL (${critical.length}):\n`);
        critical.forEach((f) => {
            console.log(`  ${f.file}:${f.line}\n     Type: ${f.type}\n     ${f.match}\n`);
        });
    }
    if (high.length > 0) {
        console.log(`🟠 HIGH (${high.length}):\n`);
        high.forEach((f) => {
            console.log(`  ${f.file}:${f.line}\n     Type: ${f.type}\n     ${f.match}\n`);
        });
    }
    if (medium.length > 0) {
        console.log(`🟡 MEDIUM (${medium.length}):\n`);
        medium.slice(0, 5).forEach((f) => {
            console.log(`  ${f.file}:${f.line}\n     Type: ${f.type}\n     ${f.match}\n`);
        });
        if (medium.length > 5) console.log(`  ... and ${medium.length - 5} more medium severity issues`);
    }
}

function printSummary(findings) {
    const critical = findings.filter((f) => f.severity === 'critical').length;
    const high = findings.filter((f) => f.severity === 'high').length;
    const medium = findings.filter((f) => f.severity === 'medium').length;
    console.log('\n' + '='.repeat(60));
    console.log('RBAC Bypass Audit Summary');
    console.log('='.repeat(60));
    console.log(`Total Issues: ${findings.length}\n  🔴 Critical: ${critical}\n  🟠 High: ${high}\n  🟡 Medium: ${medium}\n`);
    if (critical > 0) {
        console.log('❌ CRITICAL ISSUES FOUND\n');
        process.exit(1);
    } else if (high > 0) {
        console.log('⚠️  High severity issues found\n');
    } else {
        console.log('✅ No critical issues found\n');
    }
}

console.log('🔍 Scanning for RBAC bypasses...\n');
const findings = scanDirectory('./src');
printFindings(findings);
printSummary(findings);
console.log('Remediation: Replace role checks with requirePermission() / hasPermission.\n');
