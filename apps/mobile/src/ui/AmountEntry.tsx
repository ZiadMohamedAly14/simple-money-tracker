import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  applyKeypadKey,
  currencyMinorDigits,
  evaluateNonNegativeAmount,
  evaluateAmountExpression,
  formatAmountExpression,
  formatAmountInput,
  formatMoney,
  formatMoneyParts,
  type CurrencyCode,
  type ExpressionResult,
  type KeypadKey,
  type NumberingSystem,
} from '@money-tracker/shared';
import { useLanguage } from '@/i18n/useLanguage';
import { AmountDisplay } from './Amount';
import { NumericKeypad } from './Keypad';
import { Caret } from './Caret';
import { Text } from './Text';

export interface AmountEntry {
  /** What was typed: amounts joined by `+ - * /` (Western digits). */
  typed: string;
  press: (key: KeypadKey) => void;
  result: ExpressionResult;
  /** The amount to save, in minor units; null while it is zero, negative, incomplete or divides by zero. */
  amount: number | null;
  /** For amounts that may be 0 (budgets, Expected Income): nothing typed is 0; null if negative or unfinished. */
  nonNegative: number | null;
  showDecimal: boolean;
}

/** Whether typed keypad text is a sum rather than a plain amount. */
export const isSum = (typed: string): boolean => /[+\-*/]/.test(typed);

/**
 * An adult amount keypad's state: a sum like `120+35` (spec), evaluated live.
 * `initial` prefills it (fromMinorUnits of a stored amount when editing).
 */
export function useAmountEntry(currency: CurrencyCode, initial = ''): AmountEntry {
  const fractionDigits = currencyMinorDigits(currency);
  const [typed, setTyped] = useState(initial);
  const press = useCallback(
    (key: KeypadKey) => setTyped((current) => applyKeypadKey(current, key, { kind: 'expression', fractionDigits })),
    [fractionDigits],
  );
  const result = evaluateAmountExpression(typed, currency);
  const amount = result.status === 'ok' && result.amount > 0 ? result.amount : null;
  return { typed, press, result, amount, nonNegative: evaluateNonNegativeAmount(typed, currency), showDecimal: fractionDigits > 0 };
}

export interface AmountEntryDisplayProps {
  /** A `useAmountEntry`, or any typed text with `evaluateAmountExpression`'s result for it. */
  entry: Pick<AmountEntry, 'typed' | 'result'>;
  currency: CurrencyCode;
  numberingSystem?: NumberingSystem;
  accessibilityLabel?: string;
  /** The whole amount is selected (the next key replaces it): highlighted, with no cursor. */
  selected?: boolean;
}

/**
 * The amount line. A plain amount shows big; a sum shows as typed, left to
 * right even in Arabic, with its live result (or why there is none) below.
 */
export function AmountEntryDisplay({ entry, currency, numberingSystem, accessibilityLabel, selected }: AmountEntryDisplayProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  const currencyLabel = formatMoneyParts(0, { language, currency, numberingSystem }).currency;

  if (!isSum(entry.typed)) {
    return (
      <AmountDisplay
        amount={formatAmountInput(entry.typed || '0', { language, numberingSystem })}
        currency={currencyLabel}
        accessibilityLabel={accessibilityLabel}
        caret
        selected={selected}
      />
    );
  }

  const { result } = entry;
  const below =
    result.status === 'ok'
      ? { text: t('transactions.resultLabel', { amount: formatMoney(result.amount, { language, currency, numberingSystem }) }), tone: 'muted' as const }
      : result.status === 'divisionByZero'
        ? { text: t('transactions.divisionByZero'), tone: 'negative' as const }
        : result.status === 'tooLarge'
          ? { text: t('transactions.tooLarge'), tone: 'negative' as const }
          : { text: ' ', tone: 'muted' as const };
  return (
    <View accessible accessibilityLabel={accessibilityLabel} accessibilityValue={{ text: below.text }} className="gap-1">
      <View className="flex-row items-baseline justify-center gap-2">
        <View style={{ flexDirection: 'row', direction: 'ltr' }} className={`shrink ${selected ? 'rounded bg-primary/20' : ''}`}>
          <Text weight="bold" align="center" numberOfLines={1} adjustsFontSizeToFit className="shrink text-4xl">
            {formatAmountExpression(entry.typed, { language, numberingSystem })}
          </Text>
          {selected ? null : <Caret size="lg" />}
        </View>
        <Text weight="semibold" className="text-lg">
          {currencyLabel}
        </Text>
      </View>
      <Text tone={below.tone} align="center" className="text-base">
        {below.text}
      </Text>
    </View>
  );
}

export interface AmountKeypadProps {
  /** A `useAmountEntry`, or `press` from screens that type into several amounts with `expression` mode. */
  entry: Pick<AmountEntry, 'press' | 'showDecimal'>;
  numberingSystem?: NumberingSystem;
}

/** The adult amount keypad: digits, the decimal key if the currency has minor units, and `+ − × ÷`. */
export function AmountKeypad({ entry, numberingSystem }: AmountKeypadProps) {
  return <NumericKeypad onKey={entry.press} showDecimal={entry.showDecimal} showOperators numberingSystem={numberingSystem} />;
}

/**
 * Typed keypad text as one line, for rows that show a small amount being
 * typed (a Jar's share, a Category's budget): a plain amount, or a sum left to right.
 */
export function useTypedAmountText(numberingSystem?: NumberingSystem) {
  const language = useLanguage();
  return useMemo(
    () => (typed: string) =>
      isSum(typed)
        ? formatAmountExpression(typed, { language, numberingSystem })
        : formatAmountInput(typed || '0', { language, numberingSystem }),
    [language, numberingSystem],
  );
}
