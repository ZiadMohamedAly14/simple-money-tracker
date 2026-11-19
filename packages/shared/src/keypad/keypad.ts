/**
 * What a key on the in-app numeric keypad does to the text typed so far.
 * Values always use Western digits and "." (whatever the keypad shows), so an
 * amount goes straight into toMinorUnits and a code into normalizeSignInCode.
 */
export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'decimal' | 'backspace';

export type KeypadMode =
  /** A sign-in code or PIN: digits only, up to `length` of them. */
  | { kind: 'digits'; length: number }
  /** An amount in a currency with `fractionDigits` minor digits (currencyMinorDigits). */
  | { kind: 'amount'; fractionDigits: number };

/** Digits a stored amount can hold exactly (Number.MAX_SAFE_INTEGER has 16). */
const MAX_AMOUNT_DIGITS = 15;

export function applyKeypadKey(value: string, key: KeypadKey, mode: KeypadMode): string {
  if (key === 'backspace') return value.slice(0, -1);

  if (mode.kind === 'digits') {
    if (key === 'decimal' || value.length >= mode.length) return value;
    return value + key;
  }

  const [whole = '', fraction] = value.split('.');
  if (key === 'decimal') {
    if (mode.fractionDigits === 0 || fraction !== undefined) return value;
    return (whole || '0') + '.';
  }
  if (fraction !== undefined) {
    return fraction.length >= mode.fractionDigits ? value : value + key;
  }
  if (whole === '0') return key;
  if (whole.length >= MAX_AMOUNT_DIGITS - mode.fractionDigits) return value;
  return value + key;
}
