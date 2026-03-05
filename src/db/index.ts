import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { appLogger } from '../logger';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function initDb(): Database.Database {
  const dbPath = process.env.DB_PATH || './data/goldmine.db';
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  appLogger.info(`Database initialized at ${dbPath}`);
  return db;
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      youtube_id TEXT UNIQUE NOT NULL,
      title TEXT,
      duration INTEGER,
      file_hash TEXT,
      phash TEXT,
      status TEXT DEFAULT 'pending',
      vk_post_id TEXT,
      scheduled_at INTEGER,
      posted_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS queue_tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      payload TEXT,
      progress INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      updated_at INTEGER DEFAULT (strftime('%s','now')),
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS moderation_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      peer_id INTEGER,
      user_id INTEGER,
      action TEXT NOT NULL,
      reason TEXT,
      duration INTEGER,
      moderator_id INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER PRIMARY KEY,
      role TEXT NOT NULL DEFAULT 'user',
      assigned_by INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS user_warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      peer_id INTEGER,
      reason TEXT,
      moderator_id INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS user_stats (
      user_id INTEGER PRIMARY KEY,
      message_count INTEGER DEFAULT 0,
      warn_count INTEGER DEFAULT 0,
      mute_count INTEGER DEFAULT 0,
      risk_score REAL DEFAULT 0,
      last_message_at INTEGER,
      join_date INTEGER
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT,
      action TEXT NOT NULL,
      details TEXT,
      ip TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (strftime('%s','now'))
    );
  `);

  appLogger.info('Database migrations completed');
}

export default { initDb, getDb };
