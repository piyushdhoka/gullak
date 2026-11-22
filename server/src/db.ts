// SQLite storage (Node's built-in node:sqlite, no native modules to compile).
// Schema changes are numbered migrations tracked with PRAGMA user_version.

import { DatabaseSync } from 'node:sqlite';

export type DB = DatabaseSync;

const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    user_agent TEXT
  );

  CREATE TABLE capture_keys (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE,
    key_hint TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_used_at TEXT
  );

  CREATE TABLE sms_inbox (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    received_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','parsed','duplicate','ignored','unrecognised','dismissed')),
    reason TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX sms_inbox_user_status ON sms_inbox(user_id, status, received_at);

  CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sms_id TEXT REFERENCES sms_inbox(id) ON DELETE SET NULL,
    occurred_at TEXT NOT NULL,
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    direction TEXT NOT NULL CHECK (direction IN ('debit','credit')),
    payee TEXT,
    payee_key TEXT,
    merchant TEXT,
    vpa TEXT,
    category TEXT NOT NULL DEFAULT 'Other',
    category_source TEXT NOT NULL DEFAULT 'unknown'
      CHECK (category_source IN ('user','merchant','heuristic','model','unknown')),
    bank TEXT,
    account TEXT,
    upi_ref TEXT,
    channel TEXT NOT NULL DEFAULT 'other' CHECK (channel IN ('upi','card','netbanking','atm','other')),
    source TEXT NOT NULL DEFAULT 'sms' CHECK (source IN ('sms','manual')),
    note TEXT,
    hidden INTEGER NOT NULL DEFAULT 0,
    dedupe_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (user_id, dedupe_key)
  );
  CREATE INDEX transactions_user_time ON transactions(user_id, occurred_at);
  CREATE INDEX transactions_user_payee ON transactions(user_id, payee_key);
  CREATE INDEX transactions_user_review ON transactions(user_id, category_source);

  CREATE TABLE payee_rules (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payee_key TEXT NOT NULL,
    category TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, payee_key)
  );

  CREATE TABLE push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX push_subscriptions_user ON push_subscriptions(user_id);
  `,
];

export function openDb(path: string): DB {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  migrate(db);
  return db;
}

function migrate(db: DB) {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let v = row.user_version; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

export const nowIso = () => new Date().toISOString();
