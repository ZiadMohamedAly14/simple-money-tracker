import { useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { categoryBreakdown, monthDates, type CategoryFigures, type Month, type MonthFigures } from '@money-tracker/shared';
import { localDb } from '@/db/appDatabase';
import type { categories } from '@/db/schema';
import { categoryBudgetsQuery, monthOverviewOf, monthPlansQuery, monthTransactionsQuery } from './budget';
import { allCategoriesQuery } from './categories';
import { usePayDayHistory } from './useAccountSettings';

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
  const history = usePayDayHistory();
  const { start, end } = monthDates(month, history);
  const { data: plans } = useLiveQuery(monthPlansQuery(localDb, month), [month]);
  const { data: budgets } = useLiveQuery(categoryBudgetsQuery(localDb, month), [month]);
  const { data: transactions } = useLiveQuery(monthTransactionsQuery(localDb, { start, end }), [start, end]);
  const { data: allCategories } = useLiveQuery(allCategoriesQuery(localDb));

  return useMemo(() => {
    const byId = new Map(allCategories.map((c) => [c.id, c]));
    return {
      figures: monthOverviewOf(month, history, plans, budgets, transactions),
      rows: categoryBreakdown({ month, history, categories: allCategories, budgets, transactions }).map((row) => ({
        ...row,
        category: byId.get(row.categoryId)!,
      })),
      transactionCount: transactions.length,
    };
  }, [month, history, plans, budgets, transactions, allCategories]);
}
