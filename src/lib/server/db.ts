import "server-only";
import path from "node:path";
import fs from "node:fs";
import { openDb, type Db } from "../sqlite";

// Built-in node:sqlite (Node >= 22.13) — no native addon to compile or download.
let db: Db | null = null;

export function dbPath(): string {
  return process.env.DB_PATH ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "torob.db");
}

export function getDb(): Db {
  if (db) return db;
  const p = dbPath();
  if (!fs.existsSync(/*turbopackIgnore: true*/ p)) throw new Error(`Database not found at ${p}. Run "npm run data:build".`);
  db = openDb(p, true);
  db.exec("PRAGMA cache_size = -64000; PRAGMA mmap_size = 268435456; PRAGMA query_only = 1;");
  return db;
}
