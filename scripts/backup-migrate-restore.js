#!/usr/bin/env node
/**
 * Backup → migrate/generate → restore (MySQL + Prisma)
 *
 * Why: On some servers, using `prisma migrate reset` wipes data. This script keeps a dump,
 * applies schema changes, then restores data.
 *
 * Requirements:
 * - MySQL CLI tools installed and on PATH: `mysqldump` and `mysql`
 * - DATABASE_URL in backend/.env
 *
 * Usage:
 *   node scripts/backup-migrate-restore.js --mode=deploy
 *   node scripts/backup-migrate-restore.js --mode=reset --allow-production
 *
 * Modes:
 * - deploy: `prisma migrate deploy` (recommended for production)
 * - reset : `prisma migrate reset --force` (DANGEROUS; usually NOT for prod)
 * - push  : `prisma db push` (no migrations; use with care)
 */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function resolveMysqlTool(toolName) {
  const mysqlBinArg = readArg('mysql-bin', null);
  const mysqlBinEnv = process.env.MYSQL_BIN;
  const mysqlBin = mysqlBinArg || mysqlBinEnv;

  if (!mysqlBin) return toolName;

  const exe = process.platform === 'win32' ? `${toolName}.exe` : toolName;
  const full = path.resolve(mysqlBin, exe);
  if (!fs.existsSync(full)) {
    throw new Error(
      `MySQL tool not found at ${full}. ` +
        `Fix --mysql-bin / MYSQL_BIN to point to the folder containing mysql/mysqldump.`
    );
  }
  return full;
}

function runNpx(args, options) {
  if (process.platform === 'win32') {
    // .cmd shims are not directly executable with spawnSync(shell:false) on Windows.
    return run('cmd.exe', ['/c', 'npx', ...args], options);
  }
  return run('npx', args, options);
}

function run(cmd, args, options = {}) {
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (res.error) {
    if (res.error && res.error.code === 'ENOENT') {
      throw new Error(
        `Missing required executable: ${cmd}. ` +
          `Ensure it is installed and available on PATH. ` +
          `For MySQL tools you can pass --mysql-bin="C:\\path\\to\\mysql\\bin" (or set MYSQL_BIN).`
      );
    }
    throw res.error;
  }
  if (typeof res.status === 'number' && res.status !== 0) {
    throw new Error(`Command failed (${res.status}): ${cmd} ${args.join(' ')}`);
  }
}

function parseDatabaseUrl(dbUrl) {
  const url = new URL(dbUrl);
  const database = (url.pathname || '').replace(/^\//, '');
  if (!database) throw new Error('DATABASE_URL is missing database name (e.g. .../pms).');

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username || ''),
    password: decodeURIComponent(url.password || ''),
    database,
  };
}

function runCapture(cmd, args, options = {}) {
  const res = spawnSync(cmd, args, {
    stdio: 'pipe',
    shell: false,
    encoding: 'utf8',
    ...options,
  });

  if (res.error) {
    if (res.error && res.error.code === 'ENOENT') {
      throw new Error(
        `Missing required executable: ${cmd}. ` +
          `Ensure it is installed and available on PATH. ` +
          `For MySQL tools you can pass --mysql-bin="C:\\path\\to\\mysql\\bin" (or set MYSQL_BIN).`
      );
    }
    throw res.error;
  }

  const stdout = res.stdout || '';
  const stderr = res.stderr || '';
  const combined = `${stdout}\n${stderr}`.trim();

  if (typeof res.status === 'number' && res.status !== 0) {
    const err = new Error(`Command failed (${res.status}): ${cmd} ${args.join(' ')}`);
    err.output = combined;
    throw err;
  }

  return combined;
}

function formatTimestamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds()),
  ].join('');
}

async function main() {
  const mode = readArg('mode', 'deploy');
  const allowProduction = hasFlag('allow-production');

  if (process.env.NODE_ENV === 'production' && !allowProduction) {
    console.error('❌ Refusing to run on production without --allow-production');
    console.error('   Recommended: use --mode=deploy (no reset) and keep DB backups.');
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not set (check backend/.env).');
    process.exit(1);
  }

  const { host, port, user, password, database } = parseDatabaseUrl(dbUrl);
  const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

  const backupsDir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });

  const stamp = formatTimestamp();
  const dumpFile = path.join(backupsDir, `${database}_${stamp}.sql`);

  console.log(`🧰 Mode: ${mode}`);
  console.log(`🗄️  Target DB: ${user || '(no-user)'}@${host}:${port}/${database}`);
  console.log(`💾 Backup file: ${dumpFile}\n`);

  // 1) Backup
  console.log('1/4) 📦 Creating MySQL dump...');
  const dumpArgs = [
    `--host=${host}`,
    `--port=${port}`,
    `--user=${user}`,
    '--single-transaction',
    '--routines',
    '--triggers',
    '--events',
    '--set-gtid-purged=OFF',
    '--column-statistics=0',
    '--databases',
    database,
    `--result-file=${dumpFile}`,
  ];
  if (password) dumpArgs.splice(3, 0, `--password=${password}`);
  run(resolveMysqlTool('mysqldump'), dumpArgs);
  console.log('✅ Backup created.\n');

  // 2) Apply schema changes
  console.log('2/4) 🧬 Applying Prisma schema changes...');
  if (mode === 'deploy') {
    runNpx(['prisma', 'migrate', 'deploy', '--schema', schemaPath], {
      cwd: path.join(__dirname, '..'),
    });
  } else if (mode === 'reset') {
    // WARNING: will drop and recreate all tables (data will be restored after).
    runNpx(['prisma', 'migrate', 'reset', '--force', '--schema', schemaPath], {
      cwd: path.join(__dirname, '..'),
    });
  } else if (mode === 'push') {
    runNpx(['prisma', 'db', 'push', '--schema', schemaPath], {
      cwd: path.join(__dirname, '..'),
    });
  } else {
    throw new Error(`Unknown --mode=${mode}. Use deploy|reset|push`);
  }
  console.log('✅ Prisma schema step done.\n');

  // 3) Generate client
  console.log('3/4) 🏗️  Generating Prisma client...');
  const cwd = path.join(__dirname, '..');
  const npxCmd = process.platform === 'win32' ? ['cmd.exe', ['/c', 'npx']] : ['npx', []];

  try {
    const [cmd, prefixArgs] = npxCmd;
    runCapture(cmd, [...prefixArgs, 'prisma', 'generate', '--schema', schemaPath], { cwd });
  } catch (e) {
    const output = (e && e.output) || (e && e.message) || '';
    const isWindowsEperm = process.platform === 'win32' && /EPERM/i.test(output);
    if (!isWindowsEperm) throw e;

    console.warn('\n⚠️  Prisma generate failed with EPERM on Windows. Retrying after cleanup...\n');

    const prismaClientDir = path.join(cwd, 'node_modules', '.prisma', 'client');
    try {
      fs.rmSync(prismaClientDir, { recursive: true, force: true });
    } catch {
      // ignore
    }

    const [cmd, prefixArgs] = npxCmd;
    runCapture(cmd, [...prefixArgs, 'prisma', 'generate', '--schema', schemaPath], { cwd });
  }
  console.log('✅ Prisma generate done.\n');

  // 4) Restore
  console.log('4/4) 📥 Restoring data into database...');
  // Using mysql client with "source" avoids shell redirection issues.
  const sourcePath = dumpFile.replace(/\\/g, '\\\\');
  const restoreArgs = [
    `--host=${host}`,
    `--port=${port}`,
    `--user=${user}`,
  ];
  if (password) restoreArgs.push(`--password=${password}`);
  restoreArgs.push(database, `--execute=source ${sourcePath}`);
  run(resolveMysqlTool('mysql'), restoreArgs);
  console.log('✅ Restore done.\n');

  console.log('✨ Backup → migrate → generate → restore completed successfully.');
}

main().catch((e) => {
  console.error('❌ Failed:', e && e.message ? e.message : e);
  process.exit(1);
});

