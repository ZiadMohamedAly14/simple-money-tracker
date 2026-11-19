import { sql } from 'drizzle-orm';
import type { LocalDb } from './types';

/**
 * Hand-written schema migrations, applied in order and tracked with SQLite's
 * `user_version`. Never edit a shipped entry: append a new one. Plain SQL so
 * the same list runs on expo-sqlite and on better-sqlite3 in tests.
 */
const MIGRATIONS: readonly string[][] = [
  [
    `CREATE TABLE categories (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      server_version INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      is_other INTEGER NOT NULL,
      archived_at INTEGER
    )`,
    `CREATE TABLE transactions (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      server_version INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL,
      amount INTEGER NOT NULL,
      category_id TEXT,
      date TEXT NOT NULL,
      note TEXT
    )`,
    `CREATE INDEX transactions_date ON transactions (date)`,
    `CREATE TABLE outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      entity TEXT NOT NULL,
      record_id TEXT NOT NULL,
      queued_at INTEGER NOT NULL
    )`,
    `CREATE INDEX outbox_record ON outbox (entity, record_id)`,
    `CREATE TABLE device_state (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)`,
  ],
];

/** Brings the database up to the latest schema. Safe to call on every app start. */
export function migrate(db: LocalDb): void {
  const row = db.get<{ user_version: number }>(sql`PRAGMA user_version`);
  const from = row?.user_version ?? 0;
  MIGRATIONS.slice(from).forEach((statements, index) => {
    db.transaction((tx) => {
      statements.forEach((statement) => tx.run(sql.raw(statement)));
      tx.run(sql.raw(`PRAGMA user_version = ${from + index + 1}`));
    });
  });
}
