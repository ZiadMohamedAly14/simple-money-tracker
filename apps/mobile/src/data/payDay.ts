import { addMonths, monthDates, monthOf, payDayOptions, type Month, type PayDayHistory } from '@money-tracker/shared';

/**
 * One Month in a Pay Day changeover preview: its name, its first day, and its
 * last day (null for the first Month on the new Pay Day, shown as "from …").
 * `bridge` marks the Bridge Month of a "Start after this Month" change.
 */
export interface PreviewMonth {
  month: Month;
  start: string;
  end: string | null;
  bridge: boolean;
}

/** The Months each changeover option gives (spec decision 7); `startNow` is null when it isn't offered. */
export interface ChangeoverMonths {
  startNow: PreviewMonth[] | null;
  startAfterThisMonth: PreviewMonth[];
}

/**
 * The Pay Day in force on `today`, and the change still to come, if any
 * (spec decision 8). `pending.from` is the next date the change alters: the
 * Bridge Month's first day until it starts, then the first day on the new Pay Day.
 */
export interface PayDayState {
  payDay: number;
  pending: { payDay: number; from: string } | null;
}

export function payDayState(history: PayDayHistory, today: string): PayDayState {
  const entries = [...history].sort((a, b) => (a.startsOn < b.startsOn ? -1 : 1));
  const inForce = entries.filter((entry) => entry.startsOn <= today).at(-1);
  // Last edit wins, so at most one entry is still ahead.
  const next = entries.find((entry) => entry.startsOn > today);
  const payDay = inForce?.payDay ?? 1;
  if (!next) return { payDay, pending: null };
  const monthBefore = monthDates(addMonths(monthOf(next.startsOn, history), -1), history);
  return { payDay, pending: { payDay: next.payDay, from: monthBefore.start > today ? monthBefore.start : next.startsOn } };
}

/**
 * The history to save when the adult picks the Pay Day already in force while
 * a change is pending: the pending change is dropped (last edit wins).
 */
export function cancelPendingPayDay(history: PayDayHistory, today: string): PayDayHistory {
  return history.filter((entry) => entry.startsOn <= today);
}

/**
 * The current and next Months under each way of changing Pay Day to `payDay`
 * on `today` (spec decision 6): Start now shows the current Month and the
 * first Month on the new Pay Day; Start after this Month adds the Bridge
 * Month between them.
 */
export function changeoverMonths(history: PayDayHistory, payDay: number, today: string): ChangeoverMonths {
  const options = payDayOptions(history, payDay, today);
  const months = (newHistory: PayDayHistory, count: number): PreviewMonth[] => {
    const current = monthOf(today, newHistory);
    return Array.from({ length: count }, (_, index) => {
      const month = addMonths(current, index);
      const { start, end } = monthDates(month, newHistory);
      const last = index === count - 1;
      return { month, start, end: last ? null : end, bridge: count === 3 && index === 1 };
    });
  };
  return {
    startNow: options.startNow ? months(options.startNow.history, 2) : null,
    startAfterThisMonth: months(options.startAfterThisMonth.history, 3),
  };
}
