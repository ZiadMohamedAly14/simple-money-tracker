import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { KID_STEPS } from '@/data/currency';
import { TopUpForm } from '@/kid/TopUpForm';
import { Button, ScreenHeader, Text } from '@/ui';

/**
 * Kid path, last step (optional): the first Top-up. Onboarding is already
 * recorded, so Skip just goes to the kid's wallet in the Parent Area.
 */
export default function KidFirstTopUpStep() {
  const { t } = useTranslation();
  const { kid } = useLocalSearchParams<{ kid: string }>();
  const toWallet = () => router.replace({ pathname: '/parent/kids/[id]', params: { id: kid } });

  return (
    <TopUpForm
      kidProfileId={kid}
      onSaved={toWallet}
      header={
        <>
          <ScreenHeader title={t('onboarding.kidTopUpTitle')} />
          <View className="gap-1">
            <Text tone="muted" className="text-sm">
              {t('onboarding.step', { step: KID_STEPS, count: KID_STEPS })}
            </Text>
            <Text tone="muted">{t('onboarding.kidTopUpBody')}</Text>
          </View>
        </>
      }
      footerExtra={<Button label={t('onboarding.kidTopUpSkip')} variant="secondary" onPress={toWallet} />}
    />
  );
}
