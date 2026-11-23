import { formatMoney, fromMinorUnits, toMinorUnits } from './money';

/**
 * Intl adds invisible direction marks around Arabic text and uses no-break
 * spaces; compare what the reader sees.
 */
const visible = (text: string) =>
  text.replace(/[‎‏؜]/g, '').replace(/[  ]/g, ' ');

describe('formatMoney', () => {
  it('formats in English with Western digits by default', () => {
    expect(visible(formatMoney(123450, { language: 'en', currency: 'EGP' }))).toBe('EGP 1,234.50');
  });

  it('formats in Arabic with Western digits by default', () => {
    expect(visible(formatMoney(123450, { language: 'ar', currency: 'EGP' }))).toBe('1,234.50 ج.م.');
  });

  it('formats in Arabic with Arabic-Indic digits when chosen', () => {
    expect(
      visible(formatMoney(123450, { language: 'ar', currency: 'EGP', numberingSystem: 'arabic-indic' })),
    ).toBe('١٬٢٣٤٫٥٠ ج.م.');
  });

  it('keeps Western digits in English even when Arabic-Indic is chosen', () => {
    expect(
      visible(formatMoney(123450, { language: 'en', currency: 'EGP', numberingSystem: 'arabic-indic' })),
    ).toBe('EGP 1,234.50');
  });

  it('uses the currency’s own minor digits', () => {
    expect(formatMoney(500, { language: 'en', currency: 'JPY' })).toBe('¥500');
    expect(visible(formatMoney(1234, { language: 'en', currency: 'KWD' }))).toBe('KWD 1.234');
  });

  it('shows negative amounts, such as an overdrawn Jar or negative Unallocated', () => {
    expect(formatMoney(-50, { language: 'en', currency: 'USD' })).toBe('-$0.50');
    expect(visible(formatMoney(-50, { language: 'ar', currency: 'EGP' }))).toBe('-0.50 ج.م.');
  });
});

describe('fromMinorUnits', () => {
  it.each([
    [1250, 'EGP', '12.50'],
    [5, 'USD', '0.05'],
    [0, 'EGP', '0.00'],
    [500, 'JPY', '500'],
    [1234, 'KWD', '1.234'],
    [-50, 'EGP', '-0.50'],
    [123456789, 'EGP', '1234567.89'],
  ])('turns %d %s into the plain decimal text %s', (minor, currency, expected) => {
    expect(fromMinorUnits(minor, currency)).toBe(expected);
  });

  it('round-trips with toMinorUnits', () => {
    expect(toMinorUnits(fromMinorUnits(987654, 'EGP'), 'EGP')).toBe(987654);
  });
});

describe('toMinorUnits', () => {
  it('converts a decimal amount typed by the user into the smallest unit', () => {
    expect(toMinorUnits('12.50', 'EGP')).toBe(1250);
  });

  it.each([
    ['a whole amount', '12', 'EGP', 1200],
    ['one fraction digit', '0.5', 'USD', 50],
    ['a currency with no minor unit', '500', 'JPY', 500],
    ['a currency with three minor digits', '1.234', 'KWD', 1234],
    ['surrounding spaces', '  7.25 ', 'EGP', 725],
    ['grouping commas', '1,234.50', 'EGP', 123450],
    ['Arabic-Indic digits and decimal separator', '١٢٫٥', 'EGP', 1250],
    ['Arabic thousands separator', '١٬٠٠٠', 'EGP', 100000],
    ['Persian digits', '۱۲', 'EGP', 1200],
    ['a trailing decimal point', '3.', 'EGP', 300],
  ])('accepts %s', (_label, input, currency, expected) => {
    expect(toMinorUnits(input, currency)).toBe(expected);
  });

  it.each([
    ['empty text', '', 'EGP'],
    ['letters', 'abc', 'EGP'],
    ['a negative amount', '-5', 'EGP'],
    ['more fraction digits than the currency has', '1.234', 'EGP'],
    ['fraction digits for a currency without a minor unit', '1.5', 'JPY'],
    ['two decimal points', '1.2.3', 'EGP'],
    ['an amount too large to store exactly', '999999999999999999', 'EGP'],
  ])('rejects %s', (_label, input, currency) => {
    expect(toMinorUnits(input, currency)).toBeNull();
  });
});
