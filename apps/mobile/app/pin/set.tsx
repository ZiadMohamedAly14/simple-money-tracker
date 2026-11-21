import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatCountdown, isValidParentPin } from '@money-tracker/shared';
import { useLanguage } from '@/i18n/useLanguage';
import { parentArea, parentPinGate } from '@/pin/appPinGate';
import type { SetPinResult } from '@/pin/parentPinGate';
import { PinPad } from '@/pin/PinPad';
import { ScreenHeader } from '@/ui';

type Step = 'current' | 'new' | 'confirm';

/**
 * Sets the Parent PIN (the first time) or changes it (current PIN first).
 * Used from the Parent Area gate and, later, kid-path onboarding: pass `next`,
 * the route to continue to. Right after a first PIN, devices with biometrics
 * enrolled get the optional "use biometrics instead?" offer.
 */
export default function SetPinScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [changing, setChanging] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>('new');
  const [current, setCurrent] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void parentPinGate.hasPin().then((has) => {
      setChanging(has);
      setStep(has ? 'current' : 'new');
    });
  }, []);

  if (changing === null) return null;

  function errorFor(result: Exclude<SetPinResult, { status: 'ok' }>): string {
    switch (result.status) {
      case 'wrong_pin':
        return result.attemptsRemaining > 0
          ? t('pin.errors.wrongAttempts', { count: result.attemptsRemaining })
          : t('pin.errors.wrong');
      case 'locked':
        return t('pin.errors.locked', { time: formatCountdown(result.retryAfterSeconds, { language }) });
      default:
        return t(`pin.errors.${result.status}`);
    }
  }

  async function save() {
    if (confirm !== pin) {
      setError(t('pin.errors.mismatch'));
      setPin('');
      setConfirm('');
      setStep('new');
      return;
    }
    setBusy(true);
    const result = await parentPinGate.setPin(pin, changing ? current : undefined);
    setBusy(false);
    if (result.status !== 'ok') {
      setError(errorFor(result));
      if (result.status === 'wrong_pin' || result.status === 'locked') {
        setCurrent('');
        setPin('');
        setConfirm('');
        setStep('current');
      }
      return;
    }

    if (changing) {
      Alert.alert(t('pin.changed'));
      router.back();
      return;
    }
    // The parent just chose this PIN, so the Parent Area can open now.
    parentArea.unlock();
    const then = (next ?? '/') as Href;
    if (await parentPinGate.canOfferBiometrics()) {
      router.replace({ pathname: '/pin/biometrics', params: { next: next ?? '/' } });
    } else {
      router.replace(then);
    }
  }

  function advance() {
    setError(null);
    if (step === 'current') return setStep('new');
    if (step === 'new') {
      if (!isValidParentPin(pin)) return setError(t('pin.errors.tooShort'));
      return setStep('confirm');
    }
    void save();
  }

  const screens: Record<Step, { title: string; intro?: string; value: string; set: (value: string) => void }> = {
    current: { title: t('pin.currentTitle'), intro: t('pin.currentIntro'), value: current, set: setCurrent },
    new: {
      title: changing ? t('pin.newTitle') : t('pin.setTitle'),
      intro: changing ? undefined : t('pin.setIntro'),
      value: pin,
      set: setPin,
    },
    confirm: { title: t('pin.confirmTitle'), intro: t('pin.confirmIntro'), value: confirm, set: setConfirm },
  };
  const screen = screens[step];

  return (
    <PinPad
      header={<ScreenHeader onBack={() => router.back()} />}
      title={screen.title}
      intro={screen.intro}
      value={screen.value}
      onChange={(value) => {
        setError(null);
        screen.set(value);
      }}
      submitLabel={step === 'confirm' ? t('pin.save') : t('pin.next')}
      onSubmit={advance}
      busy={busy}
      error={error}
    />
  );
}
