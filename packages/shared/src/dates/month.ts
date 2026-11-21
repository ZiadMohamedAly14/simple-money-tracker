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

/** The Month the device's calendar is in at `moment`. */
export function currentMonth(moment: Date): Month {
  return monthOf(toLocalDate(moment));
}
