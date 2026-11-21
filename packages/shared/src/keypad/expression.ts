/**
 * Simple sums on the adult amount keypad (spec: `120+35`, `300÷3`).
 *
 * An expression is what applyKeypadKey builds in `expression` mode: amounts
 * (Western digits, "." decimal point) joined by the ASCII operators
 * `+ - * /`. Screens show them as `+ − × ÷` (formatAmountExpression).
 *
 * Evaluation is exact: every number is a fraction of BigInts, so no float
 * ever touches the amount (ADR-0004). Only the final result is rounded,
 * half-up, to the currency's minor unit, which is what gets stored.
 */
import { currencyMinorDigits, type CurrencyCode } from '../money/money';

export type ExpressionOperator = '+' | '-' | '*' | '/';

export type ExpressionResult =
  | { status: 'ok'; /** In minor units; may be zero or negative. */ amount: number }
  /** Empty, or ends in an operator (`120+`). */
  | { status: 'incomplete' }
  | { status: 'divisionByZero' }
  /** Too large to store exactly. */
  | { status: 'tooLarge' }
  /** Not numbers joined by operators, or a number with too many fraction digits. */
  | { status: 'invalid' };

/** An exact fraction; `den` is always positive. */
interface Ratio {
  num: bigint;
  den: bigint;
}

const NUMBER = /^(\d+)(?:\.(\d*))?$/;

function parseNumber(text: string, fractionDigits: number): Ratio | null {
  const match = NUMBER.exec(text);
  if (!match) return null;
  const fraction = match[2] ?? '';
  if (fraction.length > fractionDigits) return null;
  return { num: BigInt((match[1] ?? '') + fraction), den: 10n ** BigInt(fraction.length) };
}

const multiply = (a: Ratio, b: Ratio): Ratio => ({ num: a.num * b.num, den: a.den * b.den });
const divide = (a: Ratio, b: Ratio): Ratio =>
  b.num < 0n ? { num: -a.num * b.den, den: a.den * -b.num } : { num: a.num * b.den, den: a.den * b.num };
const add = (a: Ratio, b: Ratio): Ratio => ({ num: a.num * b.den + b.num * a.den, den: a.den * b.den });
const negate = (a: Ratio): Ratio => ({ num: -a.num, den: a.den });

/** floor(num / den) for a positive den (BigInt division truncates toward zero). */
function floorDiv(num: bigint, den: bigint): bigint {
  const quotient = num / den;
  return num % den !== 0n && num < 0n ? quotient - 1n : quotient;
}

/** Evaluates a keypad expression into minor units of `currency`. */
export function evaluateAmountExpression(expression: string, currency: CurrencyCode): ExpressionResult {
  if (expression === '') return { status: 'incomplete' };
  const fractionDigits = currencyMinorDigits(currency);
  const tokens = expression.split(/([+\-*/])/);
  // Splitting on a captured operator alternates number, operator, number, …
  if (tokens.length > 1 && tokens.at(-1) === '') {
    const numbers = tokens.slice(0, -2).filter((_, i) => i % 2 === 0);
    return numbers.every((token) => NUMBER.test(token)) ? { status: 'incomplete' } : { status: 'invalid' };
  }

  let sum: Ratio = { num: 0n, den: 1n };
  let term: Ratio | null = null;
  let termSign: '+' | '-' = '+';
  let pending: ExpressionOperator | null = null;
  for (const [index, token] of tokens.entries()) {
    if (index % 2 === 1) {
      pending = token as ExpressionOperator;
      continue;
    }
    const value = parseNumber(token, fractionDigits);
    if (!value) return { status: 'invalid' };
    if (term === null) {
      term = value;
    } else if (pending === '*') {
      term = multiply(term, value);
    } else if (pending === '/') {
      if (value.num === 0n) return { status: 'divisionByZero' };
      term = divide(term, value);
    } else {
      sum = add(sum, termSign === '+' ? term : negate(term));
      termSign = pending === '-' ? '-' : '+';
      term = value;
    }
  }
  if (term === null) return { status: 'invalid' };
  sum = add(sum, termSign === '+' ? term : negate(term));

  // Half-up: floor(value × 10^digits + ½) = floor((2·num·10^digits + den) / (2·den)).
  const scale = 10n ** BigInt(fractionDigits);
  const minor = floorDiv(2n * sum.num * scale + sum.den, 2n * sum.den);
  const amount = Number(minor);
  return Number.isSafeInteger(amount) ? { status: 'ok', amount } : { status: 'tooLarge' };
}
