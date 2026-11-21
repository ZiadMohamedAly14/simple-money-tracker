import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  applyKeypadKey,
  currencyMinorDigits,
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
import { Text } from './Text';

export interface AmountEntry {
  /** What was typed: amounts joined by `+ - * /` (Western digits). */
  typed: string;
  press: (key: KeypadKey) => void;
  result: ExpressionResult;
  /** The amount to save, in minor units; null while it is zero, negative, incomplete or divides by zero. */
  amount: number | null;
  showDecimal: boolean;
}

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
  return { typed, press, result, amount, showDecimal: fractionDigits > 0 };
}

export interface AmountEntryDisplayProps {
  entry: AmountEntry;
  currency: CurrencyCode;
  numberingSystem?: NumberingSystem;
  accessibilityLabel?: string;
}

/**
 * The amount line. A plain amount shows big; a sum shows as typed, left to
 * right even in Arabic, with its live result (or why there is none) below.
 */
export function AmountEntryDisplay({ entry, currency, numberingSystem, accessibilityLabel }: AmountEntryDisplayProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  const currencyLabel = formatMoneyParts(0, { language, currency, numberingSystem }).currency;

  if (!/[+\-*/]/.test(entry.typed)) {
    return (
      <AmountDisplay
        amount={formatAmountInput(entry.typed || '0', { language, numberingSystem })}
        currency={currencyLabel}
        accessibilityLabel={accessibilityLabel}
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
        <Text weight="bold" align="center" numberOfLines={1} adjustsFontSizeToFit className="shrink text-4xl">
          {formatAmountExpression(entry.typed, { language, numberingSystem })}
        </Text>
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
  entry: AmountEntry;
  numberingSystem?: NumberingSystem;
}

/** The adult amount keypad: digits, the decimal key if the currency has minor units, and `+ − × ÷`. */
export function AmountKeypad({ entry, numberingSystem }: AmountKeypadProps) {
  return <NumericKeypad onKey={entry.press} showDecimal={entry.showDecimal} showOperators numberingSystem={numberingSystem} />;
}
