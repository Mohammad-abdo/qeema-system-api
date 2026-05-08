#!/usr/bin/env node
/**
 * git pull → backup → generate → migrate → restore (MySQL + Prisma)
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
 *   node scripts/backup-migrate-restore.js --mode=deploy --mysql-bin="C:\Path\To\MySQL\bin"
 *   node scripts/backup-migrate-restore.js --mode=deploy --db-password="YOUR_DB_PASSWORD"
 *   node scripts/backup-migrate-restore.js --mode=deploy --skip-git
 *   node scripts/backup-migrate-restore.js --backup-only
 *   node scripts/backup-migrate-restore.js --restore-only --dump-file="C:\path\to\backup.sql"
 *   node scripts/backup-migrate-restore.js --mode=reset --allow-production
 *
 * Git:
 * - By default it will run `git pull` at repo root (../ from backend).
 * - Use --skip-git to disable.
 * - If repo has local changes it will refuse unless --allow-dirty.
 *
 * MySQL password:
 * - Uses password from DATABASE_URL if present.
 * - Or override with --db-password="..." or env var MYSQL_PASSWORD
 *
 * MySQL connection overrides:
 * - --db-user / MYSQL_USER
 * - --db-host / MYSQL_HOST
 * - --db-port / MYSQL_PORT
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

function lowerFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
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
  const format = readArg('format', 'sql'); // sql | json
  const mode = readArg('mode', 'deploy');
  const allowProduction = hasFlag('allow-production');
  const skipGit = hasFlag('skip-git');
  const allowDirty = hasFlag('allow-dirty');
  const overrideDbPassword = readArg('db-password', null) || process.env.MYSQL_PASSWORD || null;
  const overrideDbUser = readArg('db-user', null) || process.env.MYSQL_USER || null;
  const overrideDbHost = readArg('db-host', null) || process.env.MYSQL_HOST || null;
  const overrideDbPortRaw = readArg('db-port', null) || process.env.MYSQL_PORT || null;
  const backupOnly = hasFlag('backup-only');
  const restoreOnly = hasFlag('restore-only');
  const dumpFileArg = readArg('dump-file', null);

  if (backupOnly && restoreOnly) {
    throw new Error('Use only one of: --backup-only OR --restore-only');
  }

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

  const stepResults = [];
  const startedAt = Date.now();
  async function runStep(title, fn) {
    const t0 = Date.now();
    try {
      const res = await fn();
      if (res && res.skipped) {
        stepResults.push({
          title,
          status: 'skipped',
          reason: res.reason || 'skipped',
          ms: Date.now() - t0,
        });
        return { ok: false, skipped: true };
      }
      stepResults.push({ title, status: 'ok', ms: Date.now() - t0 });
      return { ok: true };
    } catch (e) {
      stepResults.push({
        title,
        status: 'failed',
        error: e && e.message ? e.message : String(e),
        ms: Date.now() - t0,
      });
      return { ok: false, failed: true };
    }
  }

  const parsed = parseDatabaseUrl(dbUrl);
  const host = overrideDbHost !== null ? String(overrideDbHost) : parsed.host;
  const port =
    overrideDbPortRaw !== null && String(overrideDbPortRaw).trim() !== ''
      ? Number(overrideDbPortRaw)
      : parsed.port;
  const user = overrideDbUser !== null ? String(overrideDbUser) : parsed.user;
  const password = overrideDbPassword !== null ? String(overrideDbPassword) : parsed.password;
  const database = parsed.database;
  const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
  const repoRoot = path.join(__dirname, '..', '..');

  const backupsDir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });

  // Single "latest" backup file (overwritten each time)
  const latestFile =
    format === 'json'
      ? path.join(backupsDir, `${database}_latest.json`)
      : path.join(backupsDir, `${database}_latest.sql`);
  const dumpFile = dumpFileArg ? path.resolve(dumpFileArg) : latestFile;

  console.log(`🧰 Mode: ${mode}`);
  console.log(`🧾 Format: ${format}`);
  console.log(`🗄️  Target DB: ${user || '(no-user)'}@${host}:${port}/${database}`);
  console.log(`💾 Backup file: ${dumpFile}\n`);

  // 1) Git pull
  const gitStep = await runStep('git pull', async () => {
    if (skipGit) return { skipped: true, reason: '--skip-git' };

    console.log('1/5) ⬇️  Pulling latest code (git pull)...');
    const status = runCapture('git', ['status', '--porcelain'], { cwd: repoRoot });
    if (status.trim() && !allowDirty) {
      throw new Error(
        'Working tree has local changes. Commit/stash them or re-run with --allow-dirty (not recommended on servers).'
      );
    }
    run('git', ['pull'], { cwd: repoRoot });
    console.log('✅ Git pull done.\n');
  });

  // 2) Backup
  const backupStep = await runStep('backup', async () => {
    if (restoreOnly) return { skipped: true, reason: '--restore-only' };

    if (format === 'sql') {
      console.log('2/5) 📦 Creating MySQL dump...');
      try {
        if (fs.existsSync(dumpFile)) fs.rmSync(dumpFile, { force: true });
      } catch {
        // ignore
      }
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
      return;
    }

    if (format === 'json') {
      console.log('2/5) 📦 Creating Prisma JSON backup...');
      const { PrismaClient, Prisma } = require('@prisma/client');
      const prisma = new PrismaClient();
      try {
        const models = Prisma?.dmmf?.datamodel?.models || [];
        const data = {};
        for (const m of models) {
          const delegate = prisma[lowerFirst(m.name)];
          if (!delegate || typeof delegate.findMany !== 'function') continue;
          data[m.name] = await delegate.findMany();
        }
        const payload = {
          format: 'prisma-json-backup',
          database,
          exportedAt: new Date().toISOString(),
          modelCount: Object.keys(data).length,
          data,
        };
        fs.writeFileSync(dumpFile, JSON.stringify(payload, null, 2), 'utf8');
      } finally {
        await prisma.$disconnect();
      }
      console.log('✅ JSON backup created.\n');
      return;
    }

    throw new Error(`Unknown --format=${format}. Use sql|json`);
  });

  if (backupOnly) {
    // Report at the end even for early-exit modes
    console.log('✨ Git pull → backup completed (backup-only).');
  }

  if (!restoreOnly) {
    // 3) Generate client (as requested: generate before migrate)
    await runStep('prisma generate', async () => {
      console.log('3/5) 🏗️  Generating Prisma client...');
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
    });

    await runStep(`prisma migrate (${mode})`, async () => {
      console.log('4/5) 🧬 Applying Prisma schema changes...');
      if (mode === 'deploy') {
        runNpx(['prisma', 'migrate', 'deploy', '--schema', schemaPath], {
          cwd: path.join(__dirname, '..'),
        });
      } else if (mode === 'reset') {
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
    });
  } else {
    await runStep('prisma generate/migrate', async () => {
      console.log('3/5) ⏭️  Skipping prisma generate/migrate (--restore-only)\n');
      return { skipped: true, reason: '--restore-only' };
    });
  }

  // 5) Restore
  await runStep('restore', async () => {
    console.log('5/5) 📥 Restoring data into database...');
    if (!fs.existsSync(dumpFile)) {
      throw new Error(`Dump file not found: ${dumpFile}`);
    }
    if (format === 'sql') {
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
      return;
    }

    if (format === 'json') {
      console.log('🔁 Restoring from Prisma JSON backup...');
      const payload = JSON.parse(fs.readFileSync(dumpFile, 'utf8'));
      if (!payload || payload.format !== 'prisma-json-backup' || !payload.data) {
        throw new Error('Invalid JSON backup file format.');
      }
      const { PrismaClient, Prisma } = require('@prisma/client');
      const prisma = new PrismaClient();
      try {
        await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=0;');

        const models = Prisma?.dmmf?.datamodel?.models || [];
        for (const m of models) {
          const delegate = prisma[lowerFirst(m.name)];
          if (!delegate || typeof delegate.deleteMany !== 'function') continue;
          await delegate.deleteMany();
        }

        for (const m of models) {
          const rows = payload.data[m.name];
          if (!rows || !Array.isArray(rows) || rows.length === 0) continue;
          const delegate = prisma[lowerFirst(m.name)];
          if (!delegate || typeof delegate.createMany !== 'function') continue;

          const chunkSize = 500;
          for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            await delegate.createMany({ data: chunk });
          }
        }

        await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=1;');
      } finally {
        await prisma.$disconnect();
      }
      console.log('✅ JSON restore done.\n');
      return;
    }

    throw new Error(`Unknown --format=${format}. Use sql|json`);
  });

  // Final report
  const ok = stepResults.filter((s) => s.status === 'ok').length;
  const failed = stepResults.filter((s) => s.status === 'failed').length;
  const skipped = stepResults.filter((s) => s.status === 'skipped').length;
  const totalMs = Date.now() - startedAt;

  console.log('\n====================');
  console.log('📋 Run report');
  console.log('====================');
  for (const s of stepResults) {
    const time = `${s.ms}ms`;
    if (s.status === 'ok') console.log(`✅ ${s.title} (${time})`);
    else if (s.status === 'skipped') console.log(`⏭️  ${s.title} (${time}) - ${s.reason}`);
    else console.log(`❌ ${s.title} (${time}) - ${s.error}`);
  }
  console.log('--------------------');
  console.log(`Done in ${totalMs}ms | ok=${ok} failed=${failed} skipped=${skipped}`);

  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('❌ Failed:', e && e.message ? e.message : e);
  process.exit(1);
});

