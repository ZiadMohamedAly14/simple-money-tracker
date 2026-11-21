import { useEffect, useState } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { addMonths, currentMonth, monthOf, type Month } from '@money-tracker/shared';
import { localDb, localStore } from '@/db/appDatabase';
import { earliestTransactionQuery, monthPlansQuery, openMonth } from './budget';

export interface MonthSwitcher {
  month: Month;
  /** Whether there is an earlier Month to review (one with a plan or a Transaction). */
  canGoBack: boolean;
  /** Whether the shown Month is before the current one. */
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
}

/**
 * The Month the home screen shows, starting at the current one. It goes back
 * as far as the earliest Month with a plan or a Transaction, and forward to
 * the current Month. Each Month shown is opened (`openMonth`), so one with no
 * plan yet starts from the previous Month's.
 */
export function useMonthSwitcher(): MonthSwitcher {
  const thisMonth = currentMonth(new Date());
  const [month, setMonth] = useState(thisMonth);
  const { data: plans } = useLiveQuery(monthPlansQuery(localDb));
  const { data: earliest } = useLiveQuery(earliestTransactionQuery(localDb));

  useEffect(() => {
    openMonth(localStore, localDb, month);
  }, [month, plans.length]);

  const firstMonth = [plans[0]?.month, earliest[0] ? monthOf(earliest[0].date) : undefined, thisMonth]
    .filter((m): m is Month => m !== undefined)
    .reduce((a, b) => (a < b ? a : b));

  return {
    month,
    canGoBack: month > firstMonth,
    canGoForward: month < thisMonth,
    goBack: () => setMonth((m) => (m > firstMonth ? addMonths(m, -1) : m)),
    goForward: () => setMonth((m) => (m < thisMonth ? addMonths(m, 1) : m)),
  };
}
