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

describe('applyKeypadKey: adult amount with + − × ÷', () => {
  const egp: KeypadMode = { kind: 'expression', fractionDigits: 2 };
  const jpy: KeypadMode = { kind: 'expression', fractionDigits: 0 };

  it('builds an expression from numbers and operators', () => {
    expect(press(egp, ['1', '2', '0', 'plus', '3', '5'])).toBe('120+35');
    expect(press(egp, ['3', '0', '0', 'divide', '3'])).toBe('300/3');
    expect(press(egp, ['9', 'minus', '2', 'times', '4'])).toBe('9-2*4');
  });

  it('applies the amount rules to each number on its own', () => {
    expect(press(egp, ['1', 'decimal', '2', '5', '9', 'plus', '0', '0', '7', 'decimal', '5'])).toBe('1.25+7.5');
    expect(press(egp, ['5', 'plus', 'decimal', '5'])).toBe('5+0.5');
    expect(press(jpy, ['5', 'decimal', 'plus', '2', 'decimal'])).toBe('5+2');
  });

  it('ignores an operator before any number (no leading minus)', () => {
    expect(press(egp, ['minus', 'plus', '5'])).toBe('5');
  });

  it('replaces the last operator when another is pressed', () => {
    expect(press(egp, ['5', 'plus', 'times', '3'])).toBe('5*3');
  });

  it('drops a dangling decimal point when an operator follows', () => {
    expect(press(egp, ['1', '2', 'decimal', 'plus', '3'])).toBe('12+3');
  });

  it('backspace removes operators like any other character', () => {
    expect(press(egp, ['1', 'plus', 'backspace', '2'])).toBe('12');
  });

  it('caps each number at a size that can be stored exactly', () => {
    expect(press(egp, [...Array<KeypadKey>(20).fill('9'), 'plus', '1'])).toBe(`${'9'.repeat(13)}+1`);
  });
});

describe('applyKeypadKey: operators off the adult keypad', () => {
  it('a kid amount ignores operator keys', () => {
    expect(press({ kind: 'amount', fractionDigits: 2 }, ['5', 'plus', '3', 'times', 'minus', 'divide'])).toBe('53');
  });

  it('a PIN or code ignores operator keys', () => {
    expect(press({ kind: 'digits', length: 6 }, ['1', 'plus', '2', 'divide'])).toBe('12');
  });
});
