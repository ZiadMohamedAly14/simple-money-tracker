import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { otherCategoryId } from '@money-tracker/shared';
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
