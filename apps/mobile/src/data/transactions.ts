import { and, asc, desc, eq, isNull, like } from 'drizzle-orm';
import { monthOf, otherCategoryId, type Month } from '@money-tracker/shared';
import { openMonth } from './budget';
import type { LocalStore } from '@/db/localStore';
import { categories, transactions } from '@/db/schema';
import type { LocalDb } from '@/db/types';

export interface NewExpense {
  /** Positive, in minor units. */
  amount: number;
  /** Local calendar date `YYYY-MM-DD`. */
  date: string;
  note?: string | null;
  /** Defaults to the Other Category. */
  categoryId?: string;
}

/**
 * Saves an Expense locally and queues it for sync. Works offline. Its date may
 * be in any Month; a Month with no plan yet is created first (`openMonth`).
 * Returns its ID.
 */
export function recordExpense(store: LocalStore, db: LocalDb, { amount, date, note = null, categoryId }: NewExpense): string {
  const accountId = store.accountId();
  if (!accountId) throw new Error('No Account is signed in on this device');
  openMonth(store, db, monthOf(date));
  return store.create('transaction', {
    kind: 'expense',
    amount,
    date,
    note,
    categoryId: categoryId ?? otherCategoryId(accountId),
  });
}

export interface NewIncome {
  /** Positive, in minor units. */
  amount: number;
  /** Local calendar date `YYYY-MM-DD`. */
  date: string;
  note?: string | null;
}

/**
 * Saves Income locally (no Category) and queues it for sync. Works offline.
 * Like an Expense, a Month with no plan yet is created first. Returns its ID.
 */
export function recordIncome(store: LocalStore, db: LocalDb, { amount, date, note = null }: NewIncome): string {
  if (!store.accountId()) throw new Error('No Account is signed in on this device');
  openMonth(store, db, monthOf(date));
  return store.create('transaction', { kind: 'income', amount, date, note, categoryId: null });
}

/** The parts of an Expense an adult can change. */
export type ExpenseChanges = Partial<Pick<NewExpense, 'amount' | 'date' | 'note' | 'categoryId'>>;

/**
 * Changes an Expense locally and queues it for sync. A new date may move it
 * into another Month, which is created first if it has no plan. If its
 * Category has been deleted, it is filed under Other. False if it's gone
 * (deleted, maybe on another device).
 */
export function editExpense(store: LocalStore, db: LocalDb, id: string, changes: ExpenseChanges): boolean {
  const accountId = store.accountId();
  const current = transactionQuery(db, id).get();
  if (!accountId || !current) return false;
  // An Expense whose Category is deleted shows as Other; saving it files it there.
  const categoryId = changes.categoryId ?? current.categoryId;
  if (categoryId && !isLiveCategory(db, categoryId)) changes = { ...changes, categoryId: otherCategoryId(accountId) };
  const edited = store.update('transaction', id, changes);
  if (edited && changes.date) openMonth(store, db, monthOf(changes.date));
  return edited;
}

const isLiveCategory = (db: LocalDb, id: string): boolean =>
  db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, id), isNull(categories.deletedAt))).get() !== undefined;

/** The parts of an Income an adult can change. Income never has a Category. */
export type IncomeChanges = Partial<Pick<NewIncome, 'amount' | 'date' | 'note'>>;

/**
 * Changes an Income locally and queues it for sync. A new date may move it
 * into another Month, which is created first if it has no plan. False if it's
 * gone (deleted, maybe on another device).
 */
export function editIncome(store: LocalStore, db: LocalDb, id: string, { amount, date, note }: IncomeChanges): boolean {
  const changes: IncomeChanges = {};
  if (amount !== undefined) changes.amount = amount;
  if (date !== undefined) changes.date = date;
  if (note !== undefined) changes.note = note;
  const edited = store.update('transaction', id, changes);
  if (edited && date) openMonth(store, db, monthOf(date));
  return edited;
}

/** Deletes an Income or Expense: it stays as a deletion marker so the deletion syncs (ADR-0001). */
export function deleteTransaction(store: LocalStore, id: string): boolean {
  return store.remove('transaction', id);
}

/**
 * Deletes several Transactions at once (multi-select on the Transactions
 * screen), in one local write, each with a deletion marker that syncs like a
 * single delete. Ones already deleted are skipped. Returns how many were deleted.
 */
export function deleteTransactions(store: LocalStore, ids: readonly string[]): number {
  return store.removeAll(ids.map((id) => ({ entity: 'transaction' as const, id })));
}

/** Live-queryable: Expenses, newest date first. Run with `.all()` or pass to `useLiveQuery`. */
export function expensesQuery(db: LocalDb) {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.kind, 'expense'), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.date), desc(transactions.id));
}

/** Live-queryable: a Month's Transactions (Income and Expenses), newest date first, then newest recorded. */
export function monthTransactionListQuery(db: LocalDb, month: Month) {
  return db
    .select()
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), like(transactions.date, `${month}-%`)))
    .orderBy(desc(transactions.date), desc(transactions.id));
}

/** Live-queryable: one Transaction, unless deleted (`.get()`, or `useLiveQuery` and take the first row). */
export function transactionQuery(db: LocalDb, id: string) {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
    .limit(1);
}

/** Live-queryable: Categories in display order. */
export function categoriesQuery(db: LocalDb) {
  return db
    .select()
    .from(categories)
    .where(isNull(categories.deletedAt))
    .orderBy(asc(categories.order), asc(categories.id));
}
