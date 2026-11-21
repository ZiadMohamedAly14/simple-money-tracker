import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, IconCircle, Screen, ScreenHeader, Text } from '@/ui';

/**
 * The kid onboarding path (currency, Kid Profile, Parent PIN, first Top-up)
 * is ticket 12. Until then this stub sends the parent to the personal path;
 * the Personal Budget exists either way (spec, story 16).
 */
export default function KidOnboardingStub() {
  const { t } = useTranslation();
  return (
    <Screen
      footer={<Button label={t('onboarding.kidSoonBack')} onPress={() => router.replace('/onboarding/currency')} />}
    >
      <ScreenHeader onBack={() => router.back()} />
      <View className="flex-1 items-center justify-center gap-3">
        <IconCircle icon="gift-outline" size="lg" />
        <Text weight="bold" align="center" accessibilityRole="header" className="text-xl">
          {t('onboarding.kidSoonTitle')}
        </Text>
        <Text tone="muted" align="center">
          {t('onboarding.kidSoonBody')}
        </Text>
      </View>
    </Screen>
  );
}
