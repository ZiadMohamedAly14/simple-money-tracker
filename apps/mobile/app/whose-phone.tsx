import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ListRow, Screen, Text } from '@/ui';

/**
 * "Whose phone is this?", shown right after an email-code sign-in when the
 * Account is already onboarded and has a Parent PIN (`asksWhosePhone`).
 * Mine goes home; For a kid opens "Set up this device" (pick or create the
 * kid, then confirm the PIN once).
 */
export default function WhosePhoneScreen() {
  const { t } = useTranslation();
  return (
    <Screen scroll className="pt-8">
      <View className="gap-2">
        <Text weight="bold" accessibilityRole="header" className="text-2xl">
          {t('whosePhone.title')}
        </Text>
        <Text tone="muted" className="text-base">
          {t('whosePhone.intro')}
        </Text>
      </View>
      <ListRow icon="app:wallet" title={t('whosePhone.mine')} subtitle={t('whosePhone.mineBody')} onPress={() => router.replace('/')} />
      <ListRow
        icon="app:kid-device"
        title={t('whosePhone.forKid')}
        subtitle={t('whosePhone.forKidBody')}
        onPress={() => router.push('/kid-device')}
      />
    </Screen>
  );
}
