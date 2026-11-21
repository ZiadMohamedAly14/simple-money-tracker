import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { parentPinGate } from '@/pin/appPinGate';
import { Button, IconCircle, Screen, Text } from '@/ui';

/**
 * Shown right after the first Parent PIN, only on a device with biometrics
 * enrolled. Skippable; the PIN always works. Settings can change it later (ticket 17).
 */
export default function BiometricsOfferScreen() {
  const { t } = useTranslation();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [busy, setBusy] = useState(false);
  const proceed = () => router.replace((next ?? '/') as Href);

  async function turnOn() {
    setBusy(true);
    // One scan first, so it is only turned on if it actually works on this phone.
    const ok = await parentPinGate.enableBiometrics(t('pin.biometricsPrompt'));
    setBusy(false);
    if (ok) proceed();
  }

  return (
    <Screen
      footer={
        <>
          <Button label={t('pin.biometricsOn')} icon="finger-print" loading={busy} onPress={() => void turnOn()} />
          <Button label={t('pin.biometricsSkip')} variant="secondary" disabled={busy} onPress={proceed} />
        </>
      }
    >
      <View className="flex-1 items-center justify-center gap-4">
        <IconCircle icon="finger-print" />
        <Text weight="bold" accessibilityRole="header" align="center" className="text-2xl">
          {t('pin.biometricsTitle')}
        </Text>
        <Text tone="muted" align="center" className="text-base">
          {t('pin.biometricsBody')}
        </Text>
      </View>
    </Screen>
  );
}
