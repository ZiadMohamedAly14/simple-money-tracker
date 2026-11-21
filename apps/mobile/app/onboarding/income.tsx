import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_CATEGORY_KEYS,
  applyKeypadKey,
  currencyMinorDigits,
  currentMonth,
  formatAmountInput,
  formatMoneyParts,
  toMinorUnits,
  type DefaultCategoryKey,
  type KeypadKey,
} from '@money-tracker/shared';
import { completePersonalOnboarding } from '@/data/budget';
import { FALLBACK_CURRENCY, PERSONAL_STEPS } from '@/data/currency';
import { localStore } from '@/db/appDatabase';
import { useLanguage } from '@/i18n/useLanguage';
import { syncEngine } from '@/sync/appSync';
import { AmountDisplay, Button, NumericKeypad, Screen, ScreenHeader, Text } from '@/ui';

/**
 * Step 3: this Month's Expected Income (PDF page 5). Next finishes onboarding
 * on this device, offline if need be: currency, default Categories and the
 * Month plan are saved, and the server is told on the next sync. The keypad
 * gains `+ − × ÷` in ticket 08.
 */
export default function ExpectedIncomeScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const params = useLocalSearchParams<{ currency?: string }>();
  const currency = params.currency ?? FALLBACK_CURRENCY;
  const fractionDigits = currencyMinorDigits(currency);
  const [typed, setTyped] = useState('');
  const amount = typed ? toMinorUnits(typed, currency) : null;

  function press(key: KeypadKey) {
    setTyped((current) => applyKeypadKey(current, key, { kind: 'amount', fractionDigits }));
  }

  function next() {
    if (amount === null) return;
    const month = currentMonth(new Date());
    const categoryNames = Object.fromEntries(
      DEFAULT_CATEGORY_KEYS.map((key) => [key, t(`categories.defaults.${key}`)]),
    ) as Record<DefaultCategoryKey, string>;
    completePersonalOnboarding(localStore, { currency, expectedIncome: amount, month, categoryNames });
    void syncEngine.sync(); // ticket 06 replaces this with a debounced trigger
    router.replace({ pathname: '/onboarding/split', params: { month } });
  }

  return (
    <Screen
      footer={
        <>
          <NumericKeypad onKey={press} showDecimal={fractionDigits > 0} />
          <Button label={t('onboarding.next')} disabled={amount === null} onPress={next} />
        </>
      }
    >
      <ScreenHeader onBack={() => router.back()} />
      <View className="gap-1">
        <Text tone="muted" className="text-sm">
          {t('onboarding.step', { step: 3, count: PERSONAL_STEPS })}
        </Text>
        <Text weight="bold" accessibilityRole="header" className="text-2xl">
          {t('onboarding.incomeTitle')}
        </Text>
        <Text tone="muted">{t('onboarding.incomeBody')}</Text>
      </View>
      <View className="flex-1 justify-center">
        <AmountDisplay
          amount={formatAmountInput(typed || '0', { language })}
          currency={formatMoneyParts(0, { language, currency }).currency}
          accessibilityLabel={t('onboarding.incomeTitle')}
        />
      </View>
    </Screen>
  );
}
