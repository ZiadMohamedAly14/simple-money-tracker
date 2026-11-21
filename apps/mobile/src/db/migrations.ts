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
  [
    `CREATE TABLE account_settings (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      server_version INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL,
      numbering_system TEXT NOT NULL
    )`,
    `CREATE TABLE month_plans (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      server_version INTEGER NOT NULL DEFAULT 0,
      month TEXT NOT NULL,
      expected_income INTEGER NOT NULL
    )`,
    `CREATE TABLE category_budgets (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      server_version INTEGER NOT NULL DEFAULT 0,
      month TEXT NOT NULL,
      category_id TEXT NOT NULL,
      amount INTEGER NOT NULL
    )`,
    `CREATE INDEX category_budgets_month ON category_budgets (month)`,
  ],
  [
    `CREATE TABLE kid_profiles (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      server_version INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL,
      avatar TEXT,
      archived_at INTEGER
    )`,
    `CREATE TABLE jars (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      server_version INTEGER NOT NULL DEFAULT 0,
      kid_profile_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      archived_at INTEGER
    )`,
    `CREATE INDEX jars_kid_profile ON jars (kid_profile_id)`,
    `CREATE TABLE kid_transactions (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      server_version INTEGER NOT NULL DEFAULT 0,
      kid_profile_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      amount INTEGER NOT NULL,
      splits TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT
    )`,
    `CREATE INDEX kid_transactions_kid_profile ON kid_transactions (kid_profile_id, date)`,
  ],
  [
    // Kid Expenses (jar_id) and Jar Transfers (jar_id → to_jar_id), ticket 13.
    `ALTER TABLE kid_transactions ADD COLUMN jar_id TEXT`,
    `ALTER TABLE kid_transactions ADD COLUMN to_jar_id TEXT`,
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
