import { useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { categoryBreakdown, type CategoryFigures, type Month, type MonthFigures } from '@money-tracker/shared';
import { localDb } from '@/db/appDatabase';
import type { categories } from '@/db/schema';
import { categoryBudgetsQuery, monthOverviewOf, monthPlansQuery, monthTransactionsQuery } from './budget';
import { allCategoriesQuery } from './categories';

type CategoryRow = typeof categories.$inferSelect;

export interface MonthBudget {
  figures: MonthFigures;
  /** The per-Category breakdown, in display order, each with its Category. */
  rows: (CategoryFigures & { category: CategoryRow })[];
  /** The Month's Transactions (live). */
  transactionCount: number;
}

/** A Month's figures and per-Category breakdown from live queries, so they update as data changes or syncs in. */
export function useMonthBudget(month: Month): MonthBudget {
  const { data: plans } = useLiveQuery(monthPlansQuery(localDb, month), [month]);
  const { data: budgets } = useLiveQuery(categoryBudgetsQuery(localDb, month), [month]);
  const { data: transactions } = useLiveQuery(monthTransactionsQuery(localDb, month), [month]);
  const { data: allCategories } = useLiveQuery(allCategoriesQuery(localDb));

  return useMemo(() => {
    const byId = new Map(allCategories.map((c) => [c.id, c]));
    return {
      figures: monthOverviewOf(month, plans, budgets, transactions),
      rows: categoryBreakdown({ month, categories: allCategories, budgets, transactions }).map((row) => ({
        ...row,
        category: byId.get(row.categoryId)!,
      })),
      transactionCount: transactions.length,
    };
  }, [month, plans, budgets, transactions, allCategories]);
}
