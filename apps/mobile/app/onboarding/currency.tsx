import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ONBOARDING_CURRENCIES, PERSONAL_STEPS, type OnboardingCurrency } from '@/data/currency';
import { Button, ListRow, Screen, ScreenHeader, Text } from '@/ui';

/** Step 2: pick the Account's one currency (PDF page 5). It can be relabelled later in Settings. */
export default function CurrencyScreen() {
  const { t } = useTranslation();
  const [currency, setCurrency] = useState<OnboardingCurrency>('EGP');

  return (
    <Screen
      scroll
      footer={
        <Button
          label={t('onboarding.next')}
          onPress={() => router.push({ pathname: '/onboarding/income', params: { currency } })}
        />
      }
    >
      <ScreenHeader onBack={() => router.back()} />
      <View className="gap-1">
        <Text tone="muted" className="text-sm">
          {t('onboarding.step', { step: 2, count: PERSONAL_STEPS })}
        </Text>
        <Text weight="bold" accessibilityRole="header" className="text-2xl">
          {t('onboarding.currencyTitle')}
        </Text>
      </View>
      <View className="gap-3">
        {ONBOARDING_CURRENCIES.map((code) => (
          <ListRow
            key={code}
            icon="cash-outline"
            title={t(`currencies.${code}`)}
            subtitle={code}
            selected={currency === code}
            onPress={() => setCurrency(code)}
          />
        ))}
      </View>
    </Screen>
  );
}
