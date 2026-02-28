// Database layer using sql.js (pure JS SQLite, no native compilation needed)
import initSqlJs, { Database } from "sql.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const DB_PATH = path.resolve(process.env.DB_PATH || "./orders.db");
let db: Database;

// Initialize DB: load existing file or create new one
export async function initDb(): Promise<void> {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id                 INTEGER PRIMARY KEY,
      latitude           REAL    NOT NULL,
      longitude          REAL    NOT NULL,
      subtotal           REAL    NOT NULL,
      timestamp          TEXT    NOT NULL,
      zip_code           TEXT,
      state              TEXT,
      tax_region         TEXT,
      county_fips        TEXT,
      state_rate         REAL    DEFAULT 0,
      county_rate        REAL    DEFAULT 0,
      city_rate          REAL    DEFAULT 0,
      special_rate       REAL    DEFAULT 0,
      composite_tax_rate REAL    DEFAULT 0,
      tax_amount         REAL    DEFAULT 0,
      total_amount       REAL    DEFAULT 0,
      jurisdictions      TEXT,   -- JSON array, e.g. ["New York State","New York City","MCTD"]
      import_session_id  TEXT,   -- tracks which import session this order came from (for rollback)
      created_at         TEXT    DEFAULT (datetime('now'))
    );
  `);

  // Non-destructive migration: add new columns to existing databases
  runMigrations();

  persist();
}

/**
 * Idempotent migrations — add columns that may not exist in older DB files.
 * ALTER TABLE in SQLite cannot check for column existence, so we attempt each
 * and silently swallow "duplicate column" errors.
 */
function runMigrations(): void {
  const migrations = [
    `ALTER TABLE orders ADD COLUMN county_fips   TEXT`,
    `ALTER TABLE orders ADD COLUMN jurisdictions TEXT`,
    `ALTER TABLE orders ADD COLUMN import_session_id TEXT`,
  ];
  for (const sql of migrations) {
    try { db.run(sql); } catch { /* column already exists — safe to ignore */ }
  }
}

// Save DB state to disk after every write
function persist() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

// Get current max ID (used to generate next ID for manual orders)
export function getMaxId(): number {
  const res = db.exec("SELECT MAX(id) as max_id FROM orders");
  return (res[0]?.values[0][0] as number) ?? 0;
}

// Run a write query and return the last inserted row ID
export function runQuery(sql: string, params: any[] = []): number {
  db.run(sql, params);
  persist();
  const res = db.exec("SELECT last_insert_rowid() as id");
  return res[0]?.values[0][0] as number ?? 0;
}

// Run a SELECT query and return all rows as objects
export function queryAll(sql: string, params: any[] = []): any[] {
  const res = db.exec(sql, params);
  if (!res.length) return [];
  const cols = res[0].columns;
  return res[0].values.map((row) =>
    Object.fromEntries(cols.map((c, i) => [c, row[i]]))
  );
}

// Run a SELECT query and return first row or null
export function queryOne(sql: string, params: any[] = []): any | null {
  return queryAll(sql, params)[0] ?? null;
}