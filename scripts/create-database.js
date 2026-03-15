#!/usr/bin/env node
/**
 * Creates the database named in DATABASE_URL if it does not exist.
 * Uses mysql2 from Node (no CLI required). Then run: npx prisma migrate deploy
 * Usage: node scripts/create-database.js
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const url = process.env.DATABASE_URL;
if (!url || !url.startsWith("mysql://")) {
  console.error("DATABASE_URL (MySQL) not set in .env");
  process.exit(1);
}

// Parse mysql://user:password@host:port/database (password may be empty)
const match = url.match(/^mysql:\/\/([^:@]+):([^@]*)@([^:]+):(\d+)\/([^?]+)/);
if (!match) {
  console.error("Could not parse DATABASE_URL. Expected: mysql://user:password@host:port/database");
  process.exit(1);
}

const [, user, password, host, port, database] = match;
const dbName = database.trim();
if (!dbName) {
  console.error("No database name in DATABASE_URL");
  process.exit(1);
}

function createWithMysql2() {
  const mysql = require("mysql2/promise");
  const config = {
    host,
    port: parseInt(port, 10),
    user,
    password: password || undefined,
  };
  return mysql.createConnection(config).then((conn) => {
    return conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``).then(() => conn.end());
  });
}

createWithMysql2()
  .then(() => {
    console.log(`Database '${dbName}' is ready. Run: npx prisma migrate deploy`);
  })
  .catch((err) => {
    console.error("Failed to create database:", err.message);
    console.error("Ensure MySQL is running at " + host + ":" + port);
    process.exit(1);
  });
