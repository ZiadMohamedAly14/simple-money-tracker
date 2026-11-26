import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { KID_STEPS, ONBOARDING_CURRENCIES, PERSONAL_STEPS, type OnboardingCurrency } from '@/data/currency';
import { Button, ListRow, Screen, ScreenHeader, Text } from '@/ui';

/**
 * Step 2 on both paths: pick the Account's one currency (PDF page 5). It can be
 * relabelled later in Settings. `path=kid` continues to the Kid Profile step;
 * the personal path continues to Pay Day.
 */
export default function CurrencyScreen() {
  const { t } = useTranslation();
  const kidPath = useLocalSearchParams<{ path?: string }>().path === 'kid';
  const [currency, setCurrency] = useState<OnboardingCurrency>('EGP');

  return (
    <Screen
      scroll
      footer={
        <Button
          label={t('onboarding.next')}
          onPress={() => router.push({ pathname: kidPath ? '/onboarding/kid' : '/onboarding/pay-day', params: { currency } })}
        />
      }
    >
      <ScreenHeader onBack={() => router.back()} />
      <View className="gap-1">
        <Text tone="muted" className="text-sm">
          {t('onboarding.step', { step: 2, count: kidPath ? KID_STEPS : PERSONAL_STEPS })}
        </Text>
        <Text weight="bold" accessibilityRole="header" className="text-2xl">
          {t('onboarding.currencyTitle')}
        </Text>
      </View>
      <View className="gap-3">
        {ONBOARDING_CURRENCIES.map((code) => (
          <ListRow
            key={code}
            icon="app:currency"
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
