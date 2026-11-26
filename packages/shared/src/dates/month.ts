import { dateLocale, type Language, type NumberingSystem } from '../i18n/language';
import { toLocalDate } from './localDate';

/**
 * A Month as `YYYY-MM`: the unit of budgeting (GLOSSARY). The key is the
 * Month's name, not the calendar month of its dates: with Pay Day 26, 26 Nov –
 * 25 Dec is "2026-12" (ADR-0009). It always comes from a local calendar date,
 * never from a UTC time, so a Transaction recorded just after midnight counts
 * in the Month of the device's date.
 */
export type Month = string;

/**
 * One change of Pay Day (ADR-0009): the new Pay Day (1–31, 31 meaning "Last
 * day of the month") and the local date `YYYY-MM-DD` the first Month on it
 * starts. The Month before that date ends the day before it.
 */
export type PayDayEntry = { payDay: number; startsOn: string };

/** The highest Pay Day, shown as "Last day of the month" (spec decision 2). */
export const LAST_PAY_DAY = 31;

/** Whether a value is a Pay Day: a whole day 1–31. */
export function isPayDay(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= LAST_PAY_DAY;
}

/** An Account's Pay Day changes, in any order. Empty means Pay Day 1 (calendar months). */
export type PayDayHistory = readonly PayDayEntry[];

/** A Month's first and last local dates `YYYY-MM-DD`, both inclusive. */
export type MonthDates = { start: string; end: string };

/** One way to make a Pay Day change: the entry to record, and the Account's history with it applied. */
export type PayDayOption = { entry: PayDayEntry; history: PayDayHistory };

/** The changeover options for a new Pay Day (spec decision 7). `startNow` is null when it would skip a Month name. */
export type PayDayOptions = { startAfterThisMonth: PayDayOption; startNow: PayDayOption | null };

/** The Month a local date `YYYY-MM-DD` falls in under the Account's Pay Day history. */
export function monthOf(localDate: string, history: PayDayHistory): Month {
  const { payDay, next } = segmentAt(sorted(history), (entry) => entry.startsOn <= localDate);
  const month = monthOnPayDay(localDate, payDay);
  // The last Month before a change stretches up to the change, keeping names consecutive.
  if (next && month >= nameOf(next)) return addMonths(nameOf(next), -1);
  return month;
}

/** The first and last day of a Month under the Account's Pay Day history. */
export function monthDates(month: Month, history: PayDayHistory): MonthDates {
  const { payDay, next } = segmentAt(sorted(history), (entry) => nameOf(entry) <= month);
  const following = addMonths(month, 1);
  const nextStart = next && nameOf(next) === following ? next.startsOn : startOnPayDay(following, payDay);
  return { start: startOnPayDay(month, payDay), end: dayBefore(nextStart) };
}

/**
 * The Pay Day the Account is on, and the change still pending, if any (spec
 * decision 8). A change is pending only until the Month that ends the day
 * before it starts: once that Month has started, the change shapes a started
 * Month and is settled (ADR-0009). So a "Start now" change is never pending,
 * and a "Start after this Month" change is pending until its Bridge Month
 * starts. `payDay` is the Pay Day of the latest settled change (1 without
 * one); `pending.from` is the first day the pending change alters, the Bridge
 * Month's first day.
 */
export type PayDayState = { payDay: number; pending: { payDay: number; from: string } | null };

export function payDayState(history: PayDayHistory, today: string): PayDayState {
  const { settled, pending } = splitHistory(history, today);
  const payDay = settled.at(-1)?.payDay ?? 1;
  if (!pending) return { payDay, pending: null };
  return { payDay, pending: { payDay: pending.payDay, from: monthBefore(pending, history).start } };
}

/**
 * The history to save when the adult picks the Pay Day the Account is on
 * while a change is pending: the pending change is dropped (last edit wins).
 */
export function cancelPendingPayDay(history: PayDayHistory, today: string): PayDayHistory {
  return splitHistory(history, today).settled;
}

/**
 * The two ways to change Pay Day to `payDay` on the local date `today` (spec
 * decision 7, ADR-0009). Neither redraws a Month that has already started, and
 * neither repeats or skips a Month name. A change still pending on `today` is
 * replaced (last edit wins). While the current Month's end is set by a settled
 * change still ahead (during a Bridge Month, or a Month stretched by Start
 * now), Start now isn't offered: it would redraw that Month again.
 */
export function payDayOptions(history: PayDayHistory, payDay: number, today: string): PayDayOptions {
  const { settled } = splitHistory(history, today);
  const current = monthOf(today, settled);
  const option = (startsOn: string): PayDayOption => {
    const entry = { payDay, startsOn };
    return { entry, history: [...settled, entry] };
  };
  // Start now: the current Month runs until the new Pay Day starts the next name.
  const startNow = startOnPayDay(addMonths(current, 1), payDay);
  const currentEndIsSet = (settled.at(-1)?.startsOn ?? '') > today;
  // Start after: the next Month is a Bridge Month up to the new Pay Day that starts the name after it.
  return {
    startAfterThisMonth: option(startOnPayDay(addMonths(current, 2), payDay)),
    startNow: startNow > today && !currentEndIsSet ? option(startNow) : null,
  };
}

/**
 * The history for an Account that picks `payDay` while setting up on the local
 * date `today` (spec decision 5): the current Month is simply the one under
 * that Pay Day, however few days are left. Pay Day 1 needs no entry.
 */
export function setupPayDayHistory(payDay: number, today: string): PayDayHistory {
  if (payDay === 1) return [];
  return [{ payDay, startsOn: startOnPayDay(monthOnPayDay(today, payDay), payDay) }];
}

/** How dates are shown: the language, and the digits (Western by default). */
export type DateTextOptions = { language: Language; numberingSystem?: NumberingSystem };

/** A Month's name and year for display, e.g. "November 2026" or "نوفمبر 2026"; just "November" with `year: false`. */
export function formatMonth(month: Month, { language, numberingSystem, year = true }: DateTextOptions & { year?: boolean }): string {
  const [yearNumber, monthNumber] = month.split('-').map(Number) as [number, number];
  // Built and formatted in UTC so the device's zone can't shift it.
  return new Intl.DateTimeFormat(dateLocale(language, numberingSystem), {
    month: 'long',
    ...(year ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(yearNumber, monthNumber - 1, 1)));
}

/** A local date `YYYY-MM-DD` as day and short month: "1 Dec", "١ ديسمبر". */
export function formatDayMonth(localDate: string, { language, numberingSystem }: DateTextOptions): string {
  // Formatted in UTC so the device's zone can't shift it.
  return new Intl.DateTimeFormat(dateLocale(language, numberingSystem), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${localDate}T00:00:00Z`),
  );
}

/**
 * The Month `count` Months after `month` (before it when negative): the Month
 * switcher's steps. Month names never repeat or skip, so this needs no Pay Day.
 */
export function addMonths(month: Month, count: number): Month {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const index = year * 12 + (monthNumber - 1) + count;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** The Month the device's calendar is in at `moment`, under the Account's Pay Day history. */
export function currentMonth(moment: Date, history: PayDayHistory): Month {
  return monthOf(toLocalDate(moment), history);
}

/**
 * Splits a history into settled changes (in force, or shaping a Month that
 * has started) and the one change still pending, if any (last edit wins).
 */
function splitHistory(history: PayDayHistory, today: string): { settled: PayDayEntry[]; pending?: PayDayEntry } {
  const entries = sorted(history);
  const isSettled = (entry: PayDayEntry) => entry.startsOn <= today || monthBefore(entry, history).start <= today;
  return { settled: entries.filter(isSettled), pending: entries.find((entry) => !isSettled(entry)) };
}

/** The dates of the Month that ends the day before an entry's first Month starts. */
const monthBefore = (entry: PayDayEntry, history: PayDayHistory): MonthDates => monthDates(addMonths(nameOf(entry), -1), history);

const sorted = (history: PayDayHistory): PayDayEntry[] => [...history].sort((a, b) => (a.startsOn < b.startsOn ? -1 : a.startsOn > b.startsOn ? 1 : 0));

/**
 * The Pay Day in force in the last stretch of history matching `isFrom`
 * (Pay Day 1 before the first entry), and the entry that ends it, if any.
 */
function segmentAt(history: PayDayEntry[], isFrom: (entry: PayDayEntry) => boolean): { payDay: number; next?: PayDayEntry } {
  const index = history.filter(isFrom).length - 1;
  return { payDay: history[index]?.payDay ?? 1, next: history[index + 1] };
}

/** The name of the first Month on an entry's Pay Day. */
const nameOf = (entry: PayDayEntry): Month => monthOnPayDay(entry.startsOn, entry.payDay);

/** The Month a date falls in if one Pay Day had always been in force (spec decision 4). */
function monthOnPayDay(localDate: string, payDay: number): Month {
  const calendarMonth = localDate.slice(0, 7);
  const startedIn = localDate >= payDayDate(payDay, calendarMonth) ? calendarMonth : addMonths(calendarMonth, -1);
  return addMonths(startedIn, payDay >= 16 ? 1 : 0);
}

/** The first day of a Month if one Pay Day had always been in force. */
const startOnPayDay = (month: Month, payDay: number): string => payDayDate(payDay, addMonths(month, payDay >= 16 ? -1 : 0));

/** Whether a local date is where a Month on `payDay` starts (clamped to the last day of a short month). */
export function isPayDayStart(payDay: number, startsOn: string): boolean {
  return payDayDate(payDay, startsOn.slice(0, 7)) === startsOn;
}

/** The date Pay Day falls on in a calendar month, on its last day when the month is too short. */
function payDayDate(payDay: number, calendarMonth: string): string {
  const [year, monthNumber] = calendarMonth.split('-').map(Number) as [number, number];
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${calendarMonth}-${String(Math.min(payDay, daysInMonth)).padStart(2, '0')}`;
}

function dayBefore(localDate: string): string {
  const [year, monthNumber, day] = localDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, monthNumber - 1, day - 1)).toISOString().slice(0, 10);
}
