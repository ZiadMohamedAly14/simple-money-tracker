import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { intlLocale, type KeypadKey, type NumberingSystem } from '@money-tracker/shared';
import { useLanguage } from '@/i18n/useLanguage';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

const ROWS: readonly (readonly KeypadKey[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['decimal', '0', 'backspace'],
];

export interface NumericKeypadProps {
  /** Feed into applyKeypadKey(value, key, mode) from @money-tracker/shared. */
  onKey: (key: KeypadKey) => void;
  /** Amounts in a currency with minor units only; never for codes or PINs (design flaw 1). */
  showDecimal?: boolean;
  /** Digits shown on the keys. Values stay Western either way. */
  numberingSystem?: NumberingSystem;
  disabled?: boolean;
}

/**
 * 3×4 grid of white keys. Follows the layout direction, so "1" sits at the
 * start (right in Arabic), as in the design.
 */
export function NumericKeypad({ onKey, showDecimal = false, numberingSystem, disabled }: NumericKeypadProps) {
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
