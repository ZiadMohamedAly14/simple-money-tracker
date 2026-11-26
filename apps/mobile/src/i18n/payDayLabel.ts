import type { TFunction } from 'i18next';
import { intlLocale, type Language, type NumberingSystem } from '@money-tracker/shared';

export interface PayDayLabelOptions {
  t: TFunction;
  language: Language;
  numberingSystem?: NumberingSystem;
}

/** Pay Day 31 is shown as "Last day of the month" (spec decision 2). */
export const LAST_PAY_DAY = 31;

/**
 * A Pay Day (1–31) for display: "1st", "25th", "Last day of the month" for
 * 31; in Arabic "يوم ٢٥". Digits come from `Intl`, never by hand.
 */
export function payDayLabel(day: number, { t, language, numberingSystem }: PayDayLabelOptions): string {
  if (day === LAST_PAY_DAY) return t('payDay.lastDay');
  const digits = new Intl.NumberFormat(intlLocale(language, numberingSystem), { useGrouping: false }).format(day);
  return t(`payDay.dayOrdinal.${englishOrdinal(day)}`, { day: digits });
}

/** English ordinal suffix class (1st, 2nd, 3rd, 4th; 11th–13th). Arabic maps every class to the same string. */
function englishOrdinal(day: number): 'one' | 'two' | 'few' | 'other' {
  if (day % 100 >= 11 && day % 100 <= 13) return 'other';
  return (['other', 'one', 'two', 'few'] as const)[day % 10] ?? 'other';
}
