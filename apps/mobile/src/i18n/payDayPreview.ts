import type { TFunction } from 'i18next';
import { intlLocale, type Language, type Month, type MonthDates, type NumberingSystem, type PayDayHistory } from '@money-tracker/shared';
import { changeoverMonths, payDayState, type PreviewMonth } from '@/data/payDay';
import { payDayLabel } from './payDayLabel';

export interface PreviewTextOptions {
  t: TFunction;
  language: Language;
  numberingSystem?: NumberingSystem;
}

/** One line of a changeover preview: "December (Bridge Month)" over "Dec 1 – Dec 24". */
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
 * `today` (spec decision 6), e.g. Start now: "November" over "Nov 1 – Nov 24", then
 * "December" over "from Nov 25". Dates are formatted in UTC so the zone can't shift them.
 */
export function changeoverPreview(history: PayDayHistory, payDay: number, today: string, options: PreviewTextOptions): ChangeoverPreview {
  const months = changeoverMonths(history, payDay, today);
  const line = previewLine(options);
  return {
    startNow: months.startNow ? months.startNow.map(line) : null,
    startAfterThisMonth: months.startAfterThisMonth.map(line),
  };
}

/**
 * A Month's dates for display, "Oct 26 – Nov 25" (the Month screen header).
 * Both ends are written in full so the locale's day/month order holds.
 */
export function formatMonthDates({ start, end }: MonthDates, options: PreviewTextOptions): string {
  const { t, dayMonth } = formatters(options);
  return t('payDay.range', { start: dayMonth(start), end: dayMonth(end) });
}

/** A date as short month and day, "Dec 1" ("1 ديسمبر" in Arabic), in the chosen digits. */
export function formatDayMonth(date: string, options: PreviewTextOptions): string {
  return formatters(options).dayMonth(date);
}

/**
 * The Pay Day as Settings lists it: "1st", or while a change is pending
 * "1st → 25th from Dec 1" (spec decision 8).
 */
export function payDaySummary(history: PayDayHistory, today: string, options: PreviewTextOptions): string {
  const { payDay, pending } = payDayState(history, today);
  const current = payDayLabel(payDay, options);
  if (!pending) return current;
  return options.t('payDay.pending', { from: current, to: payDayLabel(pending.payDay, options), date: formatDayMonth(pending.from, options) });
}

function previewLine(options: PreviewTextOptions) {
  const { t, dayMonth, monthName } = formatters(options);
  return ({ month, start, end, bridge }: PreviewMonth): PreviewLine => ({
    title: bridge ? t('payDay.bridgeMonth', { month: monthName(month) }) : monthName(month),
    dates: end === null ? t('payDay.from', { date: dayMonth(start) }) : formatMonthDates({ start, end }, options),
  });
}

function formatters({ t, language, numberingSystem }: PreviewTextOptions) {
  const locale = intlLocale(language, numberingSystem);
  const utc = (date: string) => new Date(`${date}T00:00:00Z`);
  const dayMonthFormat = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const monthFormat = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' });
  return {
    t,
    dayMonth: (date: string) => dayMonthFormat.format(utc(date)),
    monthName: (month: Month) => monthFormat.format(utc(`${month}-01`)),
  };
}
