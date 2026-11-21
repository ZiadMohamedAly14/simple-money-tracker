/**
 * What a key on the in-app numeric keypad does to the text typed so far.
 * Values always use Western digits and "." (whatever the keypad shows), so an
 * amount goes straight into toMinorUnits, an expression into
 * evaluateAmountExpression, and a code into normalizeSignInCode.
 */
import type { ExpressionOperator } from './expression';

export type DigitKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
/** `+ − × ÷`, on adult amount keypads only. */
export type OperatorKey = 'plus' | 'minus' | 'times' | 'divide';
export type KeypadKey = DigitKey | 'decimal' | 'backspace' | OperatorKey;

export type KeypadMode =
  /** A sign-in code or PIN: digits only, up to `length` of them. */
  | { kind: 'digits'; length: number }
  /** A plain amount (the child's keypad) in a currency with `fractionDigits` minor digits. */
  | { kind: 'amount'; fractionDigits: number }
  /** An adult amount: amounts joined by `+ − × ÷` (spec), each typed like a plain amount. */
  | { kind: 'expression'; fractionDigits: number };

/** Digits a stored amount can hold exactly (Number.MAX_SAFE_INTEGER has 16). */
const MAX_AMOUNT_DIGITS = 15;

const OPERATOR_OF: Record<OperatorKey, ExpressionOperator> = { plus: '+', minus: '-', times: '*', divide: '/' };
const isOperatorKey = (key: KeypadKey): key is OperatorKey => key in OPERATOR_OF;
const ENDS_IN_OPERATOR = /[+\-*/]$/;

/** A digit or decimal key typed into one plain amount. */
function typeAmount(value: string, key: DigitKey | 'decimal', fractionDigits: number): string {
  const [whole = '', fraction] = value.split('.');
  if (key === 'decimal') {
    if (fractionDigits === 0 || fraction !== undefined) return value;
    return (whole || '0') + '.';
  }
  if (fraction !== undefined) {
    return fraction.length >= fractionDigits ? value : value + key;
  }
  if (whole === '0') return key;
  if (whole.length >= MAX_AMOUNT_DIGITS - fractionDigits) return value;
  return value + key;
}

export function applyKeypadKey(value: string, key: KeypadKey, mode: KeypadMode): string {
  if (key === 'backspace') return value.slice(0, -1);

  if (mode.kind === 'digits') {
    if (!/^\d$/.test(key) || value.length >= mode.length) return value;
    return value + key;
  }

  if (mode.kind === 'amount') {
    return isOperatorKey(key) ? value : typeAmount(value, key, mode.fractionDigits);
  }

  if (isOperatorKey(key)) {
    if (value === '') return value;
    const base = ENDS_IN_OPERATOR.test(value) ? value.slice(0, -1) : value.replace(/\.$/, '');
    return base + OPERATOR_OF[key];
  }
  const start = value.search(/[^+\-*/]*$/);
  return value.slice(0, start) + typeAmount(value.slice(start), key, mode.fractionDigits);
}
