import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "..", "schema.sql");

export async function runAuthMigrations(): Promise<void> {
  const authTables = [
    `CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, emailVerified INTEGER NOT NULL DEFAULT 0, image TEXT, createdAt TEXT NOT NULL DEFAULT (datetime('now')), updatedAt TEXT NOT NULL DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS session (id TEXT PRIMARY KEY, expiresAt TEXT NOT NULL, token TEXT NOT NULL UNIQUE, createdAt TEXT NOT NULL DEFAULT (datetime('now')), updatedAt TEXT NOT NULL DEFAULT (datetime('now')), ipAddress TEXT, userAgent TEXT, userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS account (id TEXT PRIMARY KEY, accountId TEXT NOT NULL, providerId TEXT NOT NULL, userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, accessToken TEXT, refreshToken TEXT, idToken TEXT, accessTokenExpiresAt TEXT, refreshTokenExpiresAt TEXT, scope TEXT, password TEXT, createdAt TEXT NOT NULL DEFAULT (datetime('now')), updatedAt TEXT NOT NULL DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS verification (id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL, expiresAt TEXT NOT NULL, createdAt TEXT NOT NULL DEFAULT (datetime('now')), updatedAt TEXT NOT NULL DEFAULT (datetime('now')))`,
  ];
  for (const sql of authTables) await db.execute(sql);
}

export async function runMigrations(): Promise<void> {
  const sql = readFileSync(schemaPath, "utf8");
  // Split on statement-ending semicolons (skip empty lines and comments)
  // Strip -- line comments, then split on semicolons
  const stripped = sql.replace(/--[^\n]*/g, "");
  const statements = stripped
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await db.execute(stmt);
  }

  // Additive column migrations (safe to re-run)
  const alterations = [
    "ALTER TABLE people ADD COLUMN middle_name TEXT",
    "ALTER TABLE people ADD COLUMN maiden_name TEXT",
    "ALTER TABLE documents ADD COLUMN crop_data TEXT",
  ];
  for (const sql of alterations) {
    await db.execute(sql).catch(() => {/* column already exists */});
  }

  console.log("Database migrations applied.");
}
