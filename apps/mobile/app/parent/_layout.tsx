import { useCallback, useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { Redirect, Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatCountdown } from '@money-tracker/shared';
import { useLanguage } from '@/i18n/useLanguage';
import { parentArea, parentPinGate, useParentAreaUnlocked } from '@/pin/appPinGate';
import { PinPad } from '@/pin/PinPad';
import { ScreenHeader, Text } from '@/ui';

/**
 * The PIN-gated Parent Area. On a Personal-Mode device it opens with the PIN
 * (checked offline against the device's copy of its hash) or, if turned on,
 * biometrics. With no PIN yet, the parent sets one first.
 */
export default function ParentAreaLayout() {
  const unlocked = useParentAreaUnlocked();
  if (!unlocked) return <ParentGate />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />;
}

function ParentGate() {
  const { t } = useTranslation();
  const language = useLanguage();
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [biometrics, setBiometrics] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);

  const tryBiometrics = useCallback(async () => {
    if (await parentPinGate.unlockWithBiometrics(t('pin.biometricsPrompt'))) parentArea.unlock();
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Pick up a PIN set or changed on another device, if online; the stored copy otherwise.
      await parentPinGate.refresh();
      const [pinSet, useBiometrics] = await Promise.all([parentPinGate.hasPin(), parentPinGate.biometricsEnabled()]);
      if (cancelled) return;
      setHasPin(pinSet);
      setBiometrics(useBiometrics);
      if (pinSet && useBiometrics) void tryBiometrics();
    })();
    return () => {
      cancelled = true;
    };
  }, [tryBiometrics]);

  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = setTimeout(() => setWaitSeconds((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [waitSeconds]);

  if (hasPin === null) return null;
  if (!hasPin) return <Redirect href={{ pathname: '/pin/set', params: { next: '/parent' } }} />;

  async function submit() {
    setBusy(true);
    const result = await parentPinGate.checkPin(pin);
    setBusy(false);
    setPin('');
    if (result.status === 'ok') {
      setError(null);
      parentArea.unlock();
      return;
    }
    if (result.status === 'no_pin') {
      setHasPin(false);
      return;
    }
    setWaitSeconds(result.retryAfterSeconds);
    setError(result.status === 'wrong' && result.retryAfterSeconds === 0 ? t('pin.errors.wrong') : null);
  }

  const lockedMessage =
    waitSeconds > 0 ? t('pin.errors.locked', { time: formatCountdown(waitSeconds, { language }) }) : null;

  return (
    <PinPad
      header={<ScreenHeader onBack={() => router.back()} backIcon="close" />}
      title={t('pin.gateTitle')}
      intro={t('pin.gateIntro')}
      value={pin}
      onChange={(next) => {
        setError(null);
        setPin(next);
      }}
      submitLabel={t('pin.unlock')}
      onSubmit={() => void submit()}
      busy={busy}
      locked={waitSeconds > 0}
      error={lockedMessage ?? error}
      extra={
        biometrics ? (
          <Pressable accessibilityRole="button" onPress={() => void tryBiometrics()} className="min-h-11 items-center justify-center">
            <Text weight="semibold" tone="primary" align="center">
              {t('pin.useBiometrics')}
            </Text>
          </Pressable>
        ) : null
      }
    />
  );
}
