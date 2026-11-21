import { useCallback, useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { Redirect, router } from 'expo-router';
import { getNetworkStateAsync } from 'expo-network';
import { useTranslation } from 'react-i18next';
import { formatCountdown } from '@money-tracker/shared';
import { authSession, useElevated, useKidModeProfileId } from '@/auth/appSession';
import { useLanguage } from '@/i18n/useLanguage';
import { parentArea, parentPinGate, useParentAreaUnlocked } from '@/pin/appPinGate';
import { PinPad } from '@/pin/PinPad';
import { Notice, ScreenHeader, Text } from '@/ui';
import { ThemedStack } from '@/theme/ThemedStack';

/**
 * The PIN-gated Parent Area. On a Personal-Mode device it opens with the PIN
 * (checked offline against the device's copy of its hash) or, if turned on,
 * biometrics. With no PIN yet, the parent sets one first. On a Kid-Mode device
 * the server checks the PIN (ADR-0002), so it needs the internet.
 */
export default function ParentAreaLayout() {
  const unlocked = useParentAreaUnlocked();
  const kidMode = useKidModeProfileId() !== null;
  const elevated = useElevated();
  if (kidMode && !(unlocked && elevated)) return <KidDeviceGate />;
  if (!unlocked) return <ParentGate />;
  return <ThemedStack />;
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
        <>
          {biometrics ? <TextButton label={t('pin.useBiometrics')} onPress={() => void tryBiometrics()} /> : null}
          <TextButton label={t('pin.forgot')} onPress={() => router.push('/pin/reset')} />
        </>
      }
    />
  );
}

function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="min-h-11 items-center justify-center">
      <Text weight="semibold" tone="primary" align="center">
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The gate on a Kid-Mode device: the PIN goes to the server, which answers
 * with a short-lived full access token (never stored). Offline it explains
 * that the Parent Area needs the internet. The PIN can't be reset here: the
 * parent does that on their own phone.
 */
function KidDeviceGate() {
  const { t } = useTranslation();
  const language = useLanguage();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);

  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = setTimeout(() => setWaitSeconds((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [waitSeconds]);

  // Say up front that the Parent Area needs the internet, rather than after the PIN.
  useEffect(() => {
    let cancelled = false;
    getNetworkStateAsync()
      .then(({ isConnected, isInternetReachable }) => {
        if (!cancelled) setOffline(!isConnected || isInternetReachable === false);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    setBusy(true);
    const result = await authSession.elevate(pin);
    setBusy(false);
    setPin('');
    setOffline(result.status === 'unreachable');
    setError(null);
    switch (result.status) {
      case 'ok':
        parentArea.unlock();
        return;
      case 'unreachable':
        return;
      case 'wrong_pin':
        setError(result.attemptsRemaining > 0 ? t('pin.errors.wrongAttempts', { count: result.attemptsRemaining }) : t('pin.errors.wrong'));
        return;
      case 'pin_locked':
        setWaitSeconds(result.retryAfterSeconds);
        return;
      default:
        setError(t('pin.errors.failed'));
    }
  }

  const lockedMessage =
    waitSeconds > 0 ? t('pin.errors.locked', { time: formatCountdown(waitSeconds, { language }) }) : null;

  return (
    <PinPad
      header={
        <>
          <ScreenHeader onBack={() => router.back()} backIcon="close" />
          {offline ? <Notice icon="app:offline" text={t('parentAccess.needsInternet')} /> : null}
          {forgot ? <Notice icon="app:key" text={t('parentAccess.forgotOnKidDevice')} /> : null}
        </>
      }
      title={t('pin.gateTitle')}
      intro={t('parentAccess.gateIntro')}
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
      extra={<TextButton label={t('pin.forgot')} onPress={() => setForgot(true)} />}
    />
  );
}
