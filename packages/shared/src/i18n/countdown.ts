import { intlLocale, type Language, type NumberingSystem } from './language';

export interface CountdownOptions {
  language: Language;
  /** Defaults to Western digits. */
  numberingSystem?: NumberingSystem;
}

/** Seconds left as "m:ss" (e.g. "0:30") in the language's digits. */
export function formatCountdown(seconds: number, { language, numberingSystem }: CountdownOptions): string {
  const total = Math.max(0, Math.ceil(seconds));
  const locale = intlLocale(language, numberingSystem);
  const minutes = new Intl.NumberFormat(locale, { useGrouping: false }).format(Math.floor(total / 60));
  const rest = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 }).format(total % 60);
  return `${minutes}:${rest}`;
}
