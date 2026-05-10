#!/usr/bin/env node
/**
 * DB snapshot (JSON) — schema-agnostic.
 *
 * Uses Prisma.dmmf to discover every model, so when you change schema.prisma you only need:
 *   npx prisma generate --schema=./prisma/schema.prisma
 * then run this script again. No edits here required.
 *
 * Output format matches backup-migrate-restore (prisma-json-backup) so npm run db:restore works.
 *
 * Usage:
 *   node scripts/db-snapshot.js
 *   node scripts/db-snapshot.js --out=./backups/custom.json
 *   node scripts/db-snapshot.js --backup-ext=bak
 *
 * Env:
 *   DATABASE_URL (required, mysql://...)
 *   BACKUP_EXT=json  (optional; default is .json)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const {
  prismaJsonReplacer,
  atomicWriteFile,
  parseMysqlDatabaseUrl,
} = require('./db-backup-helpers');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const MAX_JSON_BACKUP_BYTES = 500 * 1024 * 1024;

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function lowerFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function normalizeExt(raw) {
  if (raw == null || String(raw).trim() === '') return '.json';
  const e = String(raw).trim();
  if (e === 'default') return '.json';
  return e.startsWith('.') ? e : `.${e}`;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set (backend/.env).');

  const { database } = parseMysqlDatabaseUrl(dbUrl);
  const backupsDir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });

  const outArg = readArg('out', null);
  const ext = normalizeExt(readArg('backup-ext', process.env.BACKUP_EXT || null));
  const outFile = outArg ? path.resolve(outArg) : path.join(backupsDir, `${database}_latest${ext}`);

  const { PrismaClient, Prisma } = require('@prisma/client');
  const models = Prisma?.dmmf?.datamodel?.models || [];
  if (models.length === 0) {
    throw new Error(
      'Prisma.dmmf has no models. Run: npx prisma generate --schema=./prisma/schema.prisma'
    );
  }

  const prisma = new PrismaClient();
  const data = {};
  try {
    await prisma.$connect();
    await prisma.$queryRawUnsafe('SELECT 1');
    for (const m of models) {
      const delegate = prisma[lowerFirst(m.name)];
      if (!delegate || typeof delegate.findMany !== 'function') continue;
      try {
        data[m.name] = await delegate.findMany();
      } catch (e) {
        throw new Error(`Snapshot failed on model "${m.name}": ${e && e.message ? e.message : e}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  const modelCount = Object.keys(data).length;
  if (modelCount === 0) {
    throw new Error('Snapshot produced zero models (unexpected).');
  }

  let totalRows = 0;
  const rowCounts = {};
  for (const k of Object.keys(data)) {
    const n = Array.isArray(data[k]) ? data[k].length : 0;
    rowCounts[k] = n;
    totalRows += n;
  }

  const payload = {
    format: 'prisma-json-backup',
    database,
    exportedAt: new Date().toISOString(),
    modelCount,
    totalRows,
    rowCounts,
    data,
  };

  const json = JSON.stringify(payload, prismaJsonReplacer, 2);
  atomicWriteFile(outFile, json);
  const sz = fs.statSync(outFile).size;
  if (sz > MAX_JSON_BACKUP_BYTES) {
    console.warn(
      `⚠️  Snapshot file is large (${Math.round(sz / 1024 / 1024)}MB). Consider SQL dumps for very large DBs.`
    );
  }
  console.log(`✅ Snapshot: ${outFile}`);
  console.log(`   models=${payload.modelCount} totalRows=${totalRows}`);
}

main().catch((e) => {
  console.error('❌', e && e.message ? e.message : e);
  process.exit(1);
});
