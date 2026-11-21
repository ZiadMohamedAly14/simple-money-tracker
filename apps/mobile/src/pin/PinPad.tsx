import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PARENT_PIN_MAX_LENGTH, PARENT_PIN_MIN_LENGTH, applyKeypadKey, type KeypadKey } from '@money-tracker/shared';
import { Button, NumericKeypad, PinDots, Screen, Text } from '@/ui';

export interface PinPadProps {
  title: string;
  intro?: string;
  value: string;
  onChange: (value: string) => void;
  submitLabel: string;
  onSubmit: () => void;
  busy?: boolean;
  /** Blocks typing and submitting (e.g. while a wrong-PIN wait runs). */
  locked?: boolean;
  error?: string | null;
  header?: ReactNode;
  /** Shown under the main button (e.g. "Use fingerprint or face"). */
  extra?: ReactNode;
}

/**
 * A Parent PIN screen: title, dots, error, then the digits-only keypad
 * (design flaw 1: no decimal key) and the main button.
 */
export function PinPad({ title, intro, value, onChange, submitLabel, onSubmit, busy, locked, error, header, extra }: PinPadProps) {
  const { t } = useTranslation();
  const press = (key: KeypadKey) => onChange(applyKeypadKey(value, key, { kind: 'digits', length: PARENT_PIN_MAX_LENGTH }));

  return (
    <Screen
      footer={
        <>
          <NumericKeypad onKey={press} disabled={busy || locked} />
          <Button
            label={submitLabel}
            loading={busy}
            disabled={locked || value.length < PARENT_PIN_MIN_LENGTH}
            onPress={onSubmit}
          />
          {extra}
        </>
      }
    >
      {header}
      <View className="gap-2">
        <Text weight="bold" accessibilityRole="header" className="text-2xl">
          {title}
        </Text>
        {intro ? (
          <Text tone="muted" className="text-base">
            {intro}
          </Text>
        ) : null}
      </View>
      <PinDots count={value.length} slots={PARENT_PIN_MIN_LENGTH} accessibilityLabel={t('pin.dotsLabel', { count: value.length })} />
      {error ? (
        <Text accessibilityRole="alert" tone="negative" align="center">
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}
