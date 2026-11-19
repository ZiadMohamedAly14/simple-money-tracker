/**
 * Money helpers. Amounts are integers in the currency's smallest unit
 * (ADR-0004); conversion to and from decimal text is done on strings so no
 * float arithmetic ever touches a stored amount.
 */
import { intlLocale, type Language, type NumberingSystem } from '../i18n/language';

/** ISO 4217 code, e.g. "EGP", "USD". One per Account. */
export type CurrencyCode = string;

/** Number of fraction digits in the currency's smallest unit (EGP 2, JPY 0, KWD 3). */
export function currencyMinorDigits(currency: CurrencyCode): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits ?? 2;
}

const ARABIC_INDIC_ZERO = 0x0660; // ٠
const PERSIAN_ZERO = 0x06f0; // ۰

/**
 * Western digits, "." as the decimal separator, no grouping separators or
 * spaces, so Arabic-Indic or Persian input parses the same as Western input.
 */
function normalizeAmountText(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - ARABIC_INDIC_ZERO))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - PERSIAN_ZERO))
    .replace(/٫/g, '.') // Arabic decimal separator ٫
    .replace(/[,٬\s]/g, ''); // grouping: comma, Arabic thousands separator ٬, spaces
}

/**
 * Parses an amount the user typed into the smallest unit.
 * Returns null if the text is not a valid non-negative amount for the currency.
 */
export function toMinorUnits(input: string, currency: CurrencyCode): number | null {
  const digits = currencyMinorDigits(currency);
  const match = /^(\d+)(?:\.(\d*))?$/.exec(normalizeAmountText(input));
  if (!match) return null;
  const whole = match[1] ?? '';
  const fraction = match[2] ?? '';
  if (fraction.length > digits) return null;
  const minor = Number(whole + fraction.padEnd(digits, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}

/**
 * Plain decimal text for a stored amount ("12.50"), with Western digits and
 * no grouping or symbol. Use it to prefill an amount field; use formatMoney
 * for display.
 */
export function fromMinorUnits(minor: number, currency: CurrencyCode): string {
  const digits = currencyMinorDigits(currency);
  const sign = minor < 0 ? '-' : '';
  const text = String(Math.abs(minor)).padStart(digits + 1, '0');
  if (digits === 0) return sign + text;
  return `${sign}${text.slice(0, -digits)}.${text.slice(-digits)}`;
}

export interface MoneyFormatOptions {
  language: Language;
  currency: CurrencyCode;
  /** Defaults to Western digits. */
  numberingSystem?: NumberingSystem;
}

/** Display text for a stored amount, e.g. "EGP 1,234.50" or "١٬٢٣٤٫٥٠ ج.م.". */
export function formatMoney(minor: number, { language, currency, numberingSystem }: MoneyFormatOptions): string {
  const digits = currencyMinorDigits(currency);
  return new Intl.NumberFormat(intlLocale(language, numberingSystem), {
    style: 'currency',
    currency,
  }).format(minor / 10 ** digits);
}
