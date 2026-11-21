import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { intlLocale, type KeypadKey, type NumberingSystem, type OperatorKey } from '@money-tracker/shared';
import { useLanguage } from '@/i18n/useLanguage';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

const ROWS: readonly (readonly KeypadKey[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['decimal', '0', 'backspace'],
];

/** The operator column at the end side, one per row (adult amount keypads only). */
const OPERATORS: readonly OperatorKey[] = ['divide', 'times', 'minus', 'plus'];
const OPERATOR_SYMBOL: Record<OperatorKey, string> = { plus: '+', minus: '−', times: '×', divide: '÷' };

export interface NumericKeypadProps {
  /** Feed into applyKeypadKey(value, key, mode) from @money-tracker/shared. */
  onKey: (key: KeypadKey) => void;
  /** Amounts in a currency with minor units only; never for codes or PINs (design flaw 1). */
  showDecimal?: boolean;
  /** `+ − × ÷` keys, on adult amount keypads only (never the child's keypad, codes or PINs). Use `expression` mode. */
  showOperators?: boolean;
  /** Digits shown on the keys. Values stay Western either way. */
  numberingSystem?: NumberingSystem;
  disabled?: boolean;
}

/**
 * 3×4 grid of white keys, plus a tint operator column when `showOperators`.
 * Follows the layout direction, so "1" sits at the start (right in Arabic),
 * as in the design.
 */
export function NumericKeypad({ onKey, showDecimal = false, showOperators = false, numberingSystem, disabled }: NumericKeypadProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const language = useLanguage();
  const labels = useMemo(() => {
    const format = new Intl.NumberFormat(intlLocale(language, numberingSystem), { useGrouping: false });
    const decimal = format.formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.';
    return { digit: (key: string) => format.format(Number(key)), decimal };
  }, [language, numberingSystem]);

  return (
    <View className="gap-2">
      {ROWS.map((row, index) => (
        <View key={index} className="flex-row gap-2">
          {row.map((key) => {
            if (key === 'decimal' && !showDecimal) return <View key={key} className="flex-1" />;
            const label =
              key === 'backspace' ? t('keypad.backspace') : key === 'decimal' ? t('keypad.decimal') : labels.digit(key);
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={label}
                disabled={disabled}
                onPress={() => onKey(key)}
                className="min-h-control flex-1 items-center justify-center rounded-theme bg-surface active:opacity-60"
              >
                {key === 'backspace' ? (
                  <Ionicons name="backspace" size={26} color={theme.colors.text} />
                ) : (
                  <Text weight="medium" align="center" className="text-2xl">
                    {key === 'decimal' ? labels.decimal : label}
                  </Text>
                )}
              </Pressable>
            );
          })}
          {showOperators ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(`keypad.${OPERATORS[index]!}`)}
              disabled={disabled}
              onPress={() => onKey(OPERATORS[index]!)}
              className="min-h-control flex-1 items-center justify-center rounded-theme bg-tint active:opacity-60"
            >
              <Text weight="medium" align="center" className="text-2xl">
                {OPERATOR_SYMBOL[OPERATORS[index]!]}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export interface CodeBoxesProps {
  /** Digits typed so far (Western). */
  value: string;
  length: number;
  numberingSystem?: NumberingSystem;
  accessibilityLabel?: string;
}

/** One box per code digit; filled boxes get a primary outline. Always left to right. */
export function CodeBoxes({ value, length, numberingSystem, accessibilityLabel }: CodeBoxesProps) {
  const language = useLanguage();
  const format = useMemo(
    () => new Intl.NumberFormat(intlLocale(language, numberingSystem), { useGrouping: false }),
    [language, numberingSystem],
  );
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: value }}
      className="flex-row gap-2"
      style={{ direction: 'ltr' }}
    >
      {Array.from({ length }, (_, index) => {
        const digit = value[index];
        return (
          <View
            key={index}
            className={`h-14 flex-1 items-center justify-center rounded-xl border ${
              digit ? 'border-primary bg-background' : 'border-surface bg-surface'
            }`}
          >
            <Text weight="semibold" align="center" className="text-2xl">
              {digit ? format.format(Number(digit)) : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export interface PinDotsProps {
  /** How many digits have been typed. The digits themselves are never shown. */
  count: number;
  /** Dots to show; filled ones beyond it still appear. */
  slots: number;
  accessibilityLabel?: string;
}

/** A PIN being typed, as dots (filled = typed). Always left to right. */
export function PinDots({ count, slots, accessibilityLabel }: PinDotsProps) {
  const total = Math.max(slots, count);
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: total, now: count }}
      className="flex-row justify-center gap-4 py-4"
      style={{ direction: 'ltr' }}
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          className={`h-4 w-4 rounded-full border-2 border-primary ${index < count ? 'bg-primary' : 'bg-transparent'}`}
        />
      ))}
    </View>
  );
}
