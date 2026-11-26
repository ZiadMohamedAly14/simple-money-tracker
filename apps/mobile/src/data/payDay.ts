import { addMonths, monthDates, monthOf, payDayOptions, type Month, type PayDayHistory, type PayDayOption } from '@money-tracker/shared';

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
 * The current and next Months under each way of changing Pay Day to `payDay`
 * on `today` (spec decision 6): Start now shows the current Month and the
 * first Month on the new Pay Day; Start after this Month adds the Bridge
 * Month between them.
 */
export function changeoverMonths(history: PayDayHistory, payDay: number, today: string): ChangeoverMonths {
  const options = payDayOptions(history, payDay, today);
  // From the current Month to the first Month on the new Pay Day; any Month between them is the Bridge Month.
  const months = ({ entry, history: newHistory }: PayDayOption): PreviewMonth[] => {
    const current = monthOf(today, newHistory);
    const firstOnNewPayDay = monthOf(entry.startsOn, newHistory);
    const result: PreviewMonth[] = [];
    for (let month = current; month <= firstOnNewPayDay; month = addMonths(month, 1)) {
      const { start, end } = monthDates(month, newHistory);
      const isBridge = month !== current && month !== firstOnNewPayDay;
      result.push({ month, start, end: month === firstOnNewPayDay ? null : end, bridge: isBridge });
    }
    return result;
  };
  return {
    startNow: options.startNow ? months(options.startNow) : null,
    startAfterThisMonth: months(options.startAfterThisMonth),
  };
}
