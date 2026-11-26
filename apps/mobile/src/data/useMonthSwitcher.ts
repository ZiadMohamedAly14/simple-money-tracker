import { useEffect, useState } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { addMonths, toLocalDate, type Month } from '@money-tracker/shared';
import { localDb, localStore } from '@/db/appDatabase';
import { earliestTransactionQuery, monthPlansQuery, openMonth, payDayHistoryOf, payDayHistoryQuery } from './budget';
import { reviewableMonths } from './months';

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
 * The Month the home screen shows, starting at the current one under the
 * Account's Pay Day history. It goes back as far as the earliest Month with a
 * plan or a Transaction, and forward to the current Month. Each Month shown is
 * opened (`openMonth`), so one with no plan yet starts from the previous Month's.
 */
export function useMonthSwitcher(): MonthSwitcher {
  const { data: historyRows, updatedAt: historyRead } = useLiveQuery(payDayHistoryQuery(localDb));
  const { data: plans } = useLiveQuery(monthPlansQuery(localDb));
  const { data: earliest } = useLiveQuery(earliestTransactionQuery(localDb));
  const { first, current } = reviewableMonths({
    today: toLocalDate(new Date()),
    history: payDayHistoryOf(historyRows),
    firstPlanMonth: plans[0]?.month,
    earliestTransactionDate: earliest[0]?.date,
  });
  // Null shows the current Month, which isn't known until the Pay Day history is read.
  const [chosen, setChosen] = useState<Month | null>(null);
  const month = chosen ?? current;

  useEffect(() => {
    if (historyRead) openMonth(localStore, localDb, month);
  }, [historyRead, month, plans.length]);

  return {
    month,
    canGoBack: month > first,
    canGoForward: month < current,
    goBack: () => setChosen(month > first ? addMonths(month, -1) : month),
    goForward: () => setChosen(month < current ? addMonths(month, 1) : month),
  };
}
