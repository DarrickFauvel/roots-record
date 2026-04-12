import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "..", "schema.sql");

export async function runMigrations(): Promise<void> {
  const sql = readFileSync(schemaPath, "utf8");
  // Split on statement-ending semicolons (skip empty lines and comments)
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const stmt of statements) {
    await db.execute(stmt);
  }
  console.log("Database migrations applied.");
}
