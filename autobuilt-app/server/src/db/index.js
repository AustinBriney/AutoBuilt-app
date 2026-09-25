import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.AUTOBUILT_DB || path.join(__dirname, '../../data/autobuilt.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Exported so other modules (e.g. the logo upload route) can locate the same
// persistent directory the SQLite file lives on, without recomputing
// AUTOBUILT_DB parsing themselves.
export const PERSISTENT_DIR = path.dirname(DB_PATH);

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// `CREATE TABLE IF NOT EXISTS` in schema.sql only helps brand-new tables —
// on a real (persistent) database that already exists from an earlier
// version, adding a column to an existing table needs an explicit ALTER.
// Right now Render's disk is ephemeral so every deploy gets a fresh file
// and this is a no-op, but it's here so a future persistent-disk/Postgres
// upgrade doesn't silently break on old rows. Safe to run every boot —
// "duplicate column" errors from an already-migrated DB are swallowed.
const migrations = [
  `ALTER TABLE businesses ADD COLUMN calcom_webhook_secret TEXT`,
  `ALTER TABLE services ADD COLUMN calcom_event_type_id TEXT`,
  `ALTER TABLE appointments ADD COLUMN external_ref TEXT`,
  `ALTER TABLE businesses ADD COLUMN plan TEXT`,
  `ALTER TABLE businesses ADD COLUMN logo_url TEXT`,
];
for (const sql of migrations) {
  try {
    db.exec(sql);
  } catch (err) {
    if (!/duplicate column name/i.test(err.message)) throw err;
  }
}
db.exec(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_appts_external_ref ON appointments(business_id, external_ref) WHERE external_ref IS NOT NULL`
);

export default db;
