import { intlLocale, type Language, type NumberingSystem } from '../i18n/language';
import { toLocalDate } from './localDate';

/**
 * A Month as `YYYY-MM`: the unit of budgeting (GLOSSARY). It always comes from
 * a local calendar date, never from a UTC time, so a Transaction recorded just
 * after midnight counts in the Month of the device's date.
 */
export type Month = string;

/**
 * One change of Pay Day (ADR-0009): the new Pay Day (1–31, 31 meaning "Last
 * day of the month") and the local date `YYYY-MM-DD` the first Month on it starts.
 */
export type PayDayEntry = { payDay: number; startsOn: string };

/** An Account's Pay Day changes. Empty means Pay Day 1 (calendar months). */
export type PayDayHistory = readonly PayDayEntry[];

/** The Month a local date `YYYY-MM-DD` falls in under the Account's Pay Day history. */
export function monthOf(localDate: string, history: PayDayHistory = []): Month {
  const entry = history[history.length - 1];
  if (!entry) return localDate.slice(0, 7);
  const calendarMonth = localDate.slice(0, 7);
  const day = Number(localDate.slice(8, 10));
  const startedIn = day >= Number(payDayDate(entry.payDay, calendarMonth).slice(8, 10)) ? calendarMonth : addMonths(calendarMonth, -1);
  return addMonths(startedIn, entry.payDay >= 16 ? 1 : 0);
}

/** A Month's first and last local dates, both inclusive. */
export type MonthDates = { start: string; end: string };

/** The first and last day of a Month under the Account's Pay Day history. */
export function monthDates(month: Month, history: PayDayHistory = []): MonthDates {
  const payDay = history[history.length - 1]?.payDay ?? 1;
  const startOf = (name: Month) => payDayDate(payDay, addMonths(name, payDay >= 16 ? -1 : 0));
  return { start: startOf(month), end: dayBefore(startOf(addMonths(month, 1))) };
}

function dayBefore(localDate: string): string {
  const [year, monthNumber, day] = localDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, monthNumber - 1, day - 1)).toISOString().slice(0, 10);
}

/** The date Pay Day falls on in a calendar month, on its last day when the month is too short. */
function payDayDate(payDay: number, calendarMonth: string): string {
  const [year, monthNumber] = calendarMonth.split('-').map(Number) as [number, number];
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${calendarMonth}-${String(Math.min(payDay, daysInMonth)).padStart(2, '0')}`;
}

/** A Month's name and year for display, e.g. "November 2026" or "نوفمبر 2026". */
export function formatMonth(month: Month, { language, numberingSystem }: { language: Language; numberingSystem?: NumberingSystem }): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  // Built and formatted in UTC so the device's zone can't shift it.
  return new Intl.DateTimeFormat(intlLocale(language, numberingSystem), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

/** The Month `count` Months after `month` (before it when negative): the Month switcher's steps. */
export function addMonths(month: Month, count: number): Month {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const index = year * 12 + (monthNumber - 1) + count;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** The Month the device's calendar is in at `moment`. */
export function currentMonth(moment: Date): Month {
  return monthOf(toLocalDate(moment));
}
