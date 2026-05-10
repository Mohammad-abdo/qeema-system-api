'use strict';

const fs = require('fs');
const path = require('path');

/** @param {unknown} v */
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

/**
 * JSON.stringify replacer: BigInt (required — JSON.stringify throws on bigint otherwise).
 * Note: Prisma.Decimal is usually converted to string by JSON.stringify before the replacer runs;
 * those fields round-trip as strings, which Prisma typically accepts on restore.
 * @param {string} _k
 * @param {unknown} val
 */
function prismaJsonReplacer(_k, val) {
  if (typeof val === 'bigint') {
    return { __prisma_json: 'BigInt', s: val.toString() };
  }
  if (val && typeof val === 'object') {
    const ctor = val.constructor && val.constructor.name;
    if (ctor === 'Decimal' && typeof val.toString === 'function') {
      return { __prisma_json: 'Decimal', s: val.toString() };
    }
  }
  return val;
}

/**
 * JSON.parse reviver for prismaJsonReplacer output.
 * @param {string} _k
 * @param {unknown} val
 */
function prismaJsonReviver(_k, val) {
  if (isPlainObject(val) && val.__prisma_json === 'BigInt' && typeof val.s === 'string') {
    try {
      return BigInt(val.s);
    } catch {
      return val;
    }
  }
  if (isPlainObject(val) && val.__prisma_json === 'Decimal' && typeof val.s === 'string') {
    try {
      const { Prisma } = require('@prisma/client');
      if (Prisma && typeof Prisma.Decimal === 'function') {
        return new Prisma.Decimal(val.s);
      }
    } catch {
      // ignore
    }
    return val.s;
  }
  return val;
}

/**
 * Write JSON atomically (reduce corrupt .bak on crash / EPERM mid-write).
 * @param {string} targetPath
 * @param {string} jsonString
 */
function atomicWriteFile(targetPath, jsonString) {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${targetPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, jsonString, 'utf8');
  try {
    if (process.platform === 'win32') {
      try {
        if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      } catch {
        // ignore
      }
    }
    fs.renameSync(tmp, targetPath);
  } catch (e) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // ignore
    }
    throw e;
  }
}

/**
 * @param {string} dbUrl
 * @returns {{ host: string, port: number, user: string, password: string, database: string }}
 */
function parseMysqlDatabaseUrl(dbUrl) {
  if (!dbUrl || typeof dbUrl !== 'string') {
    throw new Error('DATABASE_URL is empty.');
  }
  let url;
  try {
    url = new URL(dbUrl);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.');
  }
  const proto = (url.protocol || '').replace(/:$/, '').toLowerCase();
  if (proto !== 'mysql') {
    throw new Error(`DATABASE_URL must use mysql:// (got protocol "${proto || 'empty'}").`);
  }
  const database = (url.pathname || '').replace(/^\//, '').split('/')[0];
  if (!database) {
    throw new Error('DATABASE_URL is missing database name (e.g. .../pms).');
  }
  const portRaw = url.port;
  const port = portRaw ? Number(portRaw) : 3306;
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error(`DATABASE_URL has invalid port: ${portRaw}`);
  }
  return {
    host: url.hostname,
    port,
    user: decodeURIComponent(url.username || ''),
    password: decodeURIComponent(url.password || ''),
    database,
  };
}

/**
 * @param {string} expectedDb from DATABASE_URL
 * @param {boolean} allowDbMismatch if true, warn only when names differ
 */
function validatePrismaBackupPayload(payload, expectedDb, allowDbMismatch) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Backup file is empty or not valid JSON.');
  }
  if (payload.format !== 'prisma-json-backup') {
    throw new Error(
      `Backup file is not a prisma-json-backup (format=${String(payload.format)}). ` +
        'Use a file produced by db:snapshot / db:backup / backup-migrate-restore JSON.'
    );
  }
  if (!payload.data || typeof payload.data !== 'object') {
    throw new Error('Backup file is missing data object.');
  }
  if (payload.database && expectedDb && payload.database !== expectedDb) {
    const msg = `Backup is for database "${payload.database}" but DATABASE_URL points to "${expectedDb}".`;
    if (!allowDbMismatch) {
      throw new Error(`${msg} Fix DATABASE_URL or pass --allow-db-mismatch to override (risky).`);
    }
    console.warn(`⚠️  ${msg} (--allow-db-mismatch)`);
  }
}

module.exports = {
  prismaJsonReplacer,
  prismaJsonReviver,
  atomicWriteFile,
  parseMysqlDatabaseUrl,
  validatePrismaBackupPayload,
};
