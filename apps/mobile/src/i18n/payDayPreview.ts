import { formatDayMonth, formatMonth, payDayState, type MonthDates, type PayDayHistory } from '@money-tracker/shared';
import { changeoverMonths, type PreviewMonth } from '@/data/payDay';
import { payDayLabel, type PayDayTextOptions } from './payDayLabel';

/** One line of a changeover preview: "December (Bridge Month)" over "1 Dec – 24 Dec". */
export interface PreviewLine {
  title: string;
  dates: string;
}

export interface ChangeoverPreview {
  startNow: PreviewLine[] | null;
  startAfterThisMonth: PreviewLine[];
}

/**
 * The text Settings shows for each way of changing Pay Day to `payDay` on
 * `today` (spec decision 6), e.g. Start now: "November" over "1 Nov – 24 Nov", then
 * "December" over "from 25 Nov". Dates are formatted in UTC so the zone can't shift them.
 */
export function changeoverPreview(history: PayDayHistory, payDay: number, today: string, options: PayDayTextOptions): ChangeoverPreview {
  const months = changeoverMonths(history, payDay, today);
  const line = previewLine(options);
  return {
    startNow: months.startNow ? months.startNow.map(line) : null,
    startAfterThisMonth: months.startAfterThisMonth.map(line),
  };
}

/**
 * A Month's dates for display, "26 Oct – 25 Nov" (the Month screen header).
 * Both ends are written in full so the locale's day/month order holds.
 */
export function formatMonthDates({ start, end }: MonthDates, options: PayDayTextOptions): string {
  return options.t('payDay.range', { start: formatDayMonth(start, options), end: formatDayMonth(end, options) });
}

/**
 * The Pay Day as Settings lists it: "1st", or while a change is pending
 * "1st → 25th from 1 Dec" (spec decision 8).
 */
export function payDaySummary(history: PayDayHistory, today: string, options: PayDayTextOptions): string {
  const { payDay, pending } = payDayState(history, today);
  const current = payDayLabel(payDay, options);
  if (!pending) return current;
  return options.t('payDay.pending', { from: current, to: payDayLabel(pending.payDay, options), date: formatDayMonth(pending.from, options) });
}

function previewLine(options: PayDayTextOptions) {
  const { t } = options;
  return ({ month, start, end, bridge }: PreviewMonth): PreviewLine => {
    const name = formatMonth(month, { ...options, year: false });
    return {
      title: bridge ? t('payDay.bridgeMonth', { month: name }) : name,
      dates: end === null ? t('payDay.from', { date: formatDayMonth(start, options) }) : formatMonthDates({ start, end }, options),
    };
  };
}
