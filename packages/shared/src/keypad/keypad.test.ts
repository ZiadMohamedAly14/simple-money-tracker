import { toMinorUnits } from '../money/money';
import { applyKeypadKey, type KeypadKey, type KeypadMode } from './keypad';

/** Presses keys one by one from an empty value. */
const press = (mode: KeypadMode, keys: KeypadKey[]) => keys.reduce((value, key) => applyKeypadKey(value, key, mode), '');

describe('applyKeypadKey: sign-in code or PIN', () => {
  const code: KeypadMode = { kind: 'digits', length: 6 };

  it('appends digits, keeping a leading zero', () => {
    expect(press(code, ['0', '4', '8'])).toBe('048');
  });

  it('stops at the code length', () => {
    expect(press(code, ['1', '2', '3', '4', '5', '6', '7'])).toBe('123456');
  });

  it('ignores the decimal key', () => {
    expect(press(code, ['1', 'decimal', '2'])).toBe('12');
  });

  it('deletes the last digit, and does nothing when empty', () => {
    expect(press(code, ['1', '2', 'backspace'])).toBe('1');
    expect(press(code, ['backspace'])).toBe('');
  });
});

describe('applyKeypadKey: amount', () => {
  const egp: KeypadMode = { kind: 'amount', fractionDigits: 2 };
  const jpy: KeypadMode = { kind: 'amount', fractionDigits: 0 };

  it('types a whole amount', () => {
    expect(press(egp, ['1', '2', '5', '0'])).toBe('1250');
  });

  it('replaces a lone leading zero', () => {
    expect(press(egp, ['0', '0', '7'])).toBe('7');
  });

  it('starts a fraction with "0." when the decimal key comes first', () => {
    expect(press(egp, ['decimal', '5'])).toBe('0.5');
  });

  it('allows one decimal point only', () => {
    expect(press(egp, ['1', 'decimal', '2', 'decimal', '3'])).toBe('1.23');
  });

  it('stops at the currency’s fraction digits', () => {
    expect(press(egp, ['1', 'decimal', '2', '5', '9'])).toBe('1.25');
  });

  it('ignores the decimal key for a currency with no minor unit', () => {
    expect(press(jpy, ['5', 'decimal', '0'])).toBe('50');
  });

  it('deletes the decimal point like any other character', () => {
    expect(press(egp, ['1', 'decimal', 'backspace', '2'])).toBe('12');
  });

  it('never produces an amount too large to store exactly', () => {
    const value = press(egp, Array<KeypadKey>(30).fill('9'));
    expect(value).toBe('9'.repeat(13));
    expect(toMinorUnits(value, 'EGP')).toBe(999_999_999_999_900);
  });
});
