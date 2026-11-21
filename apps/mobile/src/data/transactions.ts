import { and, asc, desc, eq, isNull, like, sql } from 'drizzle-orm';
import { otherCategoryId, type Month } from '@money-tracker/shared';
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

/** Saves an Expense locally and queues it for sync. Works offline. Returns its ID. */
export function recordExpense(store: LocalStore, { amount, date, note = null, categoryId }: NewExpense): string {
  const accountId = store.accountId();
  if (!accountId) throw new Error('No Account is signed in on this device');
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

/** Saves Income locally (no Category) and queues it for sync. Works offline. Returns its ID. */
export function recordIncome(store: LocalStore, { amount, date, note = null }: NewIncome): string {
  if (!store.accountId()) throw new Error('No Account is signed in on this device');
  return store.create('transaction', { kind: 'income', amount, date, note, categoryId: null });
}

/** The parts of an Expense an adult can change. */
export type ExpenseChanges = Partial<Pick<NewExpense, 'amount' | 'date' | 'note' | 'categoryId'>>;

/** Changes an Expense locally and queues it for sync. False if it's gone (deleted, maybe on another device). */
export function editExpense(store: LocalStore, id: string, changes: ExpenseChanges): boolean {
  return store.update('transaction', id, changes);
}

/** The parts of an Income an adult can change. Income never has a Category. */
export type IncomeChanges = Partial<Pick<NewIncome, 'amount' | 'date' | 'note'>>;

/** Changes an Income locally and queues it for sync. False if it's gone (deleted, maybe on another device). */
export function editIncome(store: LocalStore, id: string, { amount, date, note }: IncomeChanges): boolean {
  const changes: IncomeChanges = {};
  if (amount !== undefined) changes.amount = amount;
  if (date !== undefined) changes.date = date;
  if (note !== undefined) changes.note = note;
  return store.update('transaction', id, changes);
}

/** Deletes an Income or Expense: it stays as a deletion marker so the deletion syncs (ADR-0001). */
export function deleteTransaction(store: LocalStore, id: string): boolean {
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

/**
 * Live-queryable: the Categories offered when recording an Expense. The most
 * recently recorded-against come first (by the Expense's UUIDv7 ID, which
 * sorts by when it was recorded, on whichever device), then the never-used
 * ones in display order. Archived Categories are left out.
 */
export function categoryChoicesQuery(db: LocalDb) {
  const lastUse = sql`(
    select max(${transactions.id}) from ${transactions}
    where ${transactions.categoryId} = ${categories.id}
      and ${transactions.kind} = 'expense'
      and ${transactions.deletedAt} is null
  )`;
  return db
    .select()
    .from(categories)
    .where(and(isNull(categories.deletedAt), isNull(categories.archivedAt)))
    .orderBy(sql`${lastUse} desc nulls last`, asc(categories.order), asc(categories.id));
}
