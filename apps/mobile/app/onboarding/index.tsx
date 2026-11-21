import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PERSONAL_STEPS } from '@/data/currency';
import { Button, ListRow, Screen, Text } from '@/ui';

type Purpose = 'me' | 'kid';

/** Step 1: "Who is it for?" (PDF page 3). */
export default function PurposeScreen() {
  const { t } = useTranslation();
  const [purpose, setPurpose] = useState<Purpose>('me');

  function next() {
    router.push(purpose === 'me' ? '/onboarding/currency' : { pathname: '/onboarding/currency', params: { path: 'kid' } });
  }

  return (
    <Screen footer={<Button label={t('onboarding.next')} onPress={next} />} className="pt-6">
      <View className="gap-1">
        <Text tone="muted" className="text-sm">
          {t('onboarding.step', { step: 1, count: PERSONAL_STEPS })}
        </Text>
        <Text weight="bold" accessibilityRole="header" className="text-2xl">
          {t('onboarding.purposeTitle')}
        </Text>
      </View>
      <ListRow
        icon="app:wallet"
        title={t('onboarding.purposeMe')}
        subtitle={t('onboarding.purposeMeBody')}
        selected={purpose === 'me'}
        onPress={() => setPurpose('me')}
      />
      <ListRow
        icon="app:kids"
        title={t('onboarding.purposeKid')}
        subtitle={t('onboarding.purposeKidBody')}
        selected={purpose === 'kid'}
        onPress={() => setPurpose('kid')}
      />
    </Screen>
  );
}
