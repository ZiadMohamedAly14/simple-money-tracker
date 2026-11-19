/**
 * Display helpers for the design's "big amount" (a large number with the
 * currency smaller beside it). Everything goes through Intl so digits,
 * grouping and sign position follow the language and numbering system.
 */
import { intlLocale, type Language, type NumberingSystem } from '../i18n/language';
import { currencyMinorDigits, type MoneyFormatOptions } from './money';

export interface MoneyParts {
  /** The signed number, e.g. "1,250.00" or "-0.50". */
  amount: string;
  /** The currency as the language shows it, e.g. "EGP", "ج.م.", "$". */
  currency: string;
}

/** A stored amount split into the number and the currency label. */
export function formatMoneyParts(minor: number, { language, currency, numberingSystem }: MoneyFormatOptions): MoneyParts {
  const digits = currencyMinorDigits(currency);
  const locale = intlLocale(language, numberingSystem);
  const amount = new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    minor / 10 ** digits,
  );
  const label = new Intl.NumberFormat(locale, { style: 'currency', currency })
    .formatToParts(0)
    .find((part) => part.type === 'currency')?.value;
  return { amount, currency: label ?? currency };
}

export interface AmountInputOptions {
  language: Language;
  /** Defaults to Western digits. */
  numberingSystem?: NumberingSystem;
}

/**
 * An amount being typed on the keypad (Western digits and ".", as
 * applyKeypadKey produces), shown grouped in the language's digits. Keeps a
 * trailing decimal point and fraction zeros so the display matches the keys pressed.
 */
export function formatAmountInput(value: string, { language, numberingSystem }: AmountInputOptions): string {
  const locale = intlLocale(language, numberingSystem);
  const [whole = '', fraction] = value.split('.');
  const wholeText = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(whole || '0'));
  if (fraction === undefined) return wholeText;

  const plain = new Intl.NumberFormat(locale, { useGrouping: false });
  const separator = plain.formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.';
  const fractionText = [...fraction].map((digit) => plain.format(Number(digit))).join('');
  return wholeText + separator + fractionText;
}
