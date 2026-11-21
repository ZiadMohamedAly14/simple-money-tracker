import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { parentArea } from '@/pin/appPinGate';
import { Button, Card, Screen, ScreenHeader, Text } from '@/ui';

/** The Parent Area, once the gate is open. Kid Profiles, Top-ups and Jars arrive in ticket 12. */
export default function ParentAreaScreen() {
  const { t } = useTranslation();

  function lock() {
    parentArea.lock();
    router.back();
  }

  return (
    <Screen scroll>
      <ScreenHeader title={t('parentArea.title')} onBack={() => router.back()} />
      <Card className="p-4">
        <Text tone="muted">{t('parentArea.intro')}</Text>
      </Card>
      <View className="gap-3">
        <Button label={t('pin.change')} variant="secondary" onPress={() => router.push('/pin/set')} />
        <Button label={t('parentArea.lock')} variant="secondary" icon="lock-closed-outline" onPress={lock} />
      </View>
    </Screen>
  );
}
