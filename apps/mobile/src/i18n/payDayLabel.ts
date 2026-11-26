import type { TFunction } from 'i18next';
import { formatDigits, LAST_PAY_DAY, type DateTextOptions } from '@money-tracker/shared';

/** What the Pay Day text helpers need: the translator, the language, and the digits. */
export type PayDayTextOptions = DateTextOptions & { t: TFunction };

/**
 * A Pay Day (1–31) for display: "1st", "25th", "Last day of the month" for
 * 31; in Arabic "يوم ٢٥". Digits come from `Intl`, never by hand.
 */
export function payDayLabel(day: number, { t, ...digits }: PayDayTextOptions): string {
  if (day === LAST_PAY_DAY) return t('payDay.lastDay');
  return t(`payDay.dayOrdinal.${englishOrdinal(day)}`, { day: formatDigits(day, digits) });
}

/** English ordinal suffix class (1st, 2nd, 3rd, 4th; 11th–13th). Arabic maps every class to the same string. */
function englishOrdinal(day: number): 'one' | 'two' | 'few' | 'other' {
  if (day % 100 >= 11 && day % 100 <= 13) return 'other';
  return (['other', 'one', 'two', 'few'] as const)[day % 10] ?? 'other';
}
