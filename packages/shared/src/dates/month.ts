import { intlLocale, type Language, type NumberingSystem } from '../i18n/language';
import { toLocalDate } from './localDate';

/**
 * A Month as `YYYY-MM`: the unit of budgeting (GLOSSARY). It always comes from
 * a local calendar date, never from a UTC time, so a Transaction recorded just
 * after midnight counts in the Month of the device's date.
 */
export type Month = string;

/** The Month a local date `YYYY-MM-DD` falls in. */
export function monthOf(localDate: string): Month {
  return localDate.slice(0, 7);
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

/** The Month the device's calendar is in at `moment`. */
export function currentMonth(moment: Date): Month {
  return monthOf(toLocalDate(moment));
}
