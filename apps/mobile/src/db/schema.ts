import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { NumberingSystem, SyncEntity, TransactionKind } from '@money-tracker/shared';

/**
 * The device's database: the only data source for screens (ADR-0003).
 * Synced tables use the sync contract's field names, so a row is a
 * `PulledRecord` of its entity. Keep in step with `migrations.ts`.
 */
const syncedColumns = () => ({
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  /** Device clock, Unix ms: the last local edit. */
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  /** 0 until the server has stored this version of the row. */
  serverVersion: integer('server_version').notNull().default(0),
});

export const accountSettings = sqliteTable('account_settings', {
  ...syncedColumns(),
  currency: text('currency').notNull(),
  numberingSystem: text('numbering_system').$type<NumberingSystem>().notNull(),
});

export const categories = sqliteTable('categories', {
  ...syncedColumns(),
  name: text('name').notNull(),
  order: integer('sort_order').notNull(),
  isOther: integer('is_other', { mode: 'boolean' }).notNull(),
  archivedAt: integer('archived_at'),
});

export const monthPlans = sqliteTable('month_plans', {
  ...syncedColumns(),
  month: text('month').notNull(),
  expectedIncome: integer('expected_income').notNull(),
});

export const categoryBudgets = sqliteTable('category_budgets', {
  ...syncedColumns(),
  month: text('month').notNull(),
  categoryId: text('category_id').notNull(),
  amount: integer('amount').notNull(),
});

export const transactions = sqliteTable('transactions', {
  ...syncedColumns(),
  kind: text('kind').$type<TransactionKind>().notNull(),
  amount: integer('amount').notNull(),
  categoryId: text('category_id'),
  date: text('date').notNull(),
  note: text('note'),
});

/** Local writes waiting to be pushed. Written in the same transaction as the row it points at. */
export const outbox = sqliteTable('outbox', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entity: text('entity').$type<SyncEntity>().notNull(),
  recordId: text('record_id').notNull(),
  queuedAt: integer('queued_at').notNull(),
});

/** Small per-device values: whose data this is, and the sync cursor. */
export const deviceState = sqliteTable('device_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/** The table behind each synced entity. Add new synced entities here, in `schema`, and in `migrations.ts`. */
export const SYNCED_TABLES = {
  accountSettings,
  category: categories,
  monthPlan: monthPlans,
  categoryBudget: categoryBudgets,
  transaction: transactions,
} satisfies Record<SyncEntity, unknown>;

export const schema = { accountSettings, categories, monthPlans, categoryBudgets, transactions, outbox, deviceState };
export type Schema = typeof schema;

export type AccountSettingsRow = typeof accountSettings.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type MonthPlanRow = typeof monthPlans.$inferSelect;
export type CategoryBudgetRow = typeof categoryBudgets.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
