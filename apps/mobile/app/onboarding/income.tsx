import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DEFAULT_CATEGORY_KEYS, currentMonth, type DefaultCategoryKey } from '@money-tracker/shared';
import { completePersonalOnboarding, readPayDayHistory } from '@/data/budget';
import { FALLBACK_CURRENCY, PERSONAL_STEPS } from '@/data/currency';
import { localDb, localStore } from '@/db/appDatabase';
import { AmountEntryDisplay, AmountKeypad, Button, Screen, ScreenHeader, Text, useAmountEntry } from '@/ui';

/**
 * Step 3: this Month's Expected Income (PDF page 5). Next finishes onboarding
 * on this device, offline if need be: currency, default Categories and the
 * Month plan are saved, and the server is told on the next sync. The keypad
 * takes sums (`+ − × ÷`); Next saves the result.
 */
export default function ExpectedIncomeScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ currency?: string }>();
  const currency = params.currency ?? FALLBACK_CURRENCY;
  const entry = useAmountEntry(currency);
  // Expected Income may be 0 (unlike a Transaction), but not negative or an unfinished sum.
  const amount = entry.typed ? entry.nonNegative : null;

  function next() {
    if (amount === null) return;
    const month = currentMonth(new Date(), readPayDayHistory(localDb));
    const categoryNames = Object.fromEntries(
      DEFAULT_CATEGORY_KEYS.map((key) => [key, t(`categories.defaults.${key}`)]),
    ) as Record<DefaultCategoryKey, string>;
    completePersonalOnboarding(localStore, { currency, expectedIncome: amount, month, categoryNames });
    router.replace({ pathname: '/onboarding/split', params: { month } });
  }

  return (
    <Screen
      footer={
        <>
          <AmountKeypad entry={entry} />
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
        <AmountEntryDisplay entry={entry} currency={currency} accessibilityLabel={t('onboarding.incomeTitle')} />
      </View>
    </Screen>
  );
}
