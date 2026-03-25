import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance = null;

export async function getDb() {
  if (dbInstance) return dbInstance;
  dbInstance = await open({
    filename: path.join(__dirname, 'demo.db'),
    driver: sqlite3.Database,
  });
  return dbInstance;
}

export async function initDb() {
  const db = await getDb();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS records (
      row_id TEXT PRIMARY KEY,
      data JSON,
      last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS room_snapshots (
      room_id TEXT PRIMARY KEY,
      yjs_blob BLOB,
      last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}
