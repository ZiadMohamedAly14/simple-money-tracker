import { monthDates, monthOf, type Month, type PayDayHistory } from '@money-tracker/shared';

export interface ReviewableMonthsInput {
  /** The device's local date `YYYY-MM-DD`. */
  today: string;
  history: PayDayHistory;
  /** The earliest Month with a plan, if any. */
  firstPlanMonth: Month | undefined;
  /** The earliest live Transaction's date, if any. */
  earliestTransactionDate: string | undefined;
}

/**
 * The Months the home screen's switcher can show: back to the earliest Month
 * with a plan or a Transaction, forward to the current Month. Month names
 * never repeat or skip (ADR-0009), so stepping between them is `addMonths`.
 */
export function reviewableMonths({ today, history, firstPlanMonth, earliestTransactionDate }: ReviewableMonthsInput): {
  first: Month;
  current: Month;
} {
  const current = monthOf(today, history);
  const first = [firstPlanMonth, earliestTransactionDate === undefined ? undefined : monthOf(earliestTransactionDate, history), current]
    .filter((m): m is Month => m !== undefined)
    .reduce((a, b) => (a < b ? a : b));
  return { first, current };
}

/**
 * The date a new Transaction starts with when added from `month` (the home
 * screen passes the Month on show): today, or that Month's last day when it is
 * an earlier Month, so the Transaction lands in the Month being reviewed.
 */
export function defaultDateIn(month: Month | undefined, history: PayDayHistory, today: string): string {
  if (!month || month >= monthOf(today, history)) return today;
  return monthDates(month, history).end;
}
