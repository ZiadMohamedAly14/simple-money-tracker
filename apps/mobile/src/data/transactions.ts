import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { monthOf, otherCategoryId } from '@money-tracker/shared';
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

/** The parts of an Expense an adult can change. */
export type ExpenseChanges = Partial<Pick<NewExpense, 'amount' | 'date' | 'note' | 'categoryId'>>;

/**
 * Changes an Expense locally and queues it for sync. A new date may move it
 * into another Month, which is created first if it has no plan. False if it's
 * gone (deleted, maybe on another device).
 */
export function editExpense(store: LocalStore, db: LocalDb, id: string, changes: ExpenseChanges): boolean {
  const edited = store.update('transaction', id, changes);
  if (edited && changes.date) openMonth(store, db, monthOf(changes.date));
  return edited;
}

/** Deletes an Expense: it stays as a deletion marker so the deletion syncs (ADR-0001). */
export function deleteExpense(store: LocalStore, id: string): boolean {
  return store.remove('transaction', id);
}

/** Live-queryable: Expenses, newest date first. Run with `.all()` or pass to `useLiveQuery`. */
export function expensesQuery(db: LocalDb) {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.kind, 'expense'), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.date), desc(transactions.id));
}

/** Live-queryable: Categories in display order. */
export function categoriesQuery(db: LocalDb) {
  return db
    .select()
    .from(categories)
    .where(isNull(categories.deletedAt))
    .orderBy(asc(categories.order), asc(categories.id));
}
