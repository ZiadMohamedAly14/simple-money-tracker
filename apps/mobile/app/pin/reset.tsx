import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SIGN_IN_CODE_LENGTH, applyKeypadKey, formatCountdown, isValidParentPin, ltrIsolate, type KeypadKey } from '@money-tracker/shared';
import { authSession } from '@/auth/appSession';
import { useLanguage } from '@/i18n/useLanguage';
import { parentArea, parentPinGate } from '@/pin/appPinGate';
import type { RequestResetResult, ResetPinResult } from '@/pin/parentPinGate';
import { PinPad } from '@/pin/PinPad';
import { Button, CodeBoxes, Glyph, NumericKeypad, Screen, ScreenHeader, Text } from '@/ui';
import { useTheme } from '@/theme/ThemeProvider';

type Step = 'send' | 'code' | 'new' | 'confirm';

/**
 * Resetting a forgotten Parent PIN (spec story 49) on the parent's own phone:
 * a code goes to the Account's email, which a child can't read; with it the
 * parent chooses a new PIN. Needs the internet. A Kid-Mode device never
 * reaches this screen (its gate says to reset on the parent's phone).
 */
export default function ResetPinScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const theme = useTheme();
  const email = authSession.account()?.email ?? '';
  const [step, setStep] = useState<Step>('send');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function requestError(result: Exclude<RequestResetResult, { status: 'ok' }>): string {
    if (result.status === 'wait') return t('pinReset.wait', { time: formatCountdown(result.retryAfterSeconds, { language }) });
    if (result.status === 'unreachable') return t('pinReset.offline');
    if (result.status === 'session_ended') return t('pin.errors.session_ended');
    return t('pin.errors.failed');
  }

  async function send() {
    setError(null);
    setBusy(true);
    const result = await parentPinGate.requestReset(language);
    setBusy(false);
    if (result.status === 'ok') {
      setCode('');
      setResendIn(result.resendAfterSeconds);
      setStep('code');
      return;
    }
    if (result.status === 'wait') setResendIn(result.retryAfterSeconds);
    setError(requestError(result));
  }

  function resetError(result: Exclude<ResetPinResult, { status: 'ok' }>): string {
    switch (result.status) {
      case 'invalid_code':
        return t('pinReset.wrongCode', { count: result.attemptsRemaining });
      case 'code_expired':
      case 'too_many_guesses':
        return t('pinReset.codeExpired');
      case 'unreachable':
        return t('pinReset.offline');
      case 'session_ended':
        return t('pin.errors.session_ended');
      default:
        return t('pin.errors.failed');
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
    const result = await parentPinGate.resetPin(code, pin);
    setBusy(false);
    if (result.status === 'ok') {
      // The parent just proved the email and chose this PIN, so the Parent Area opens.
      parentArea.unlock();
      router.replace('/parent');
      return;
    }
    setError(resetError(result));
    setPin('');
    setConfirm('');
    if (result.status === 'invalid_code') {
      setCode('');
      setStep('code');
    } else if (result.status === 'code_expired' || result.status === 'too_many_guesses') {
      setCode('');
      setStep('send');
    }
  }

  function pressCode(key: KeypadKey) {
    setError(null);
    setCode((current) => applyKeypadKey(current, key, { kind: 'digits', length: SIGN_IN_CODE_LENGTH }));
  }

  if (step === 'new' || step === 'confirm') {
    const isNew = step === 'new';
    return (
      <PinPad
        header={<ScreenHeader onBack={() => setStep(isNew ? 'code' : 'new')} />}
        title={isNew ? t('pin.newTitle') : t('pin.confirmTitle')}
        intro={isNew ? t('pin.setIntro') : t('pin.confirmIntro')}
        value={isNew ? pin : confirm}
        onChange={(value) => {
          setError(null);
          (isNew ? setPin : setConfirm)(value);
        }}
        submitLabel={isNew ? t('pin.next') : t('pin.save')}
        onSubmit={() => {
          setError(null);
          if (!isNew) return void save();
          if (!isValidParentPin(pin)) return setError(t('pin.errors.tooShort'));
          setStep('confirm');
        }}
        busy={busy}
        error={error}
      />
    );
  }

  const errorText = error ? (
    <Text accessibilityRole="alert" tone="negative" align="center">
      {error}
    </Text>
  ) : null;

  if (step === 'send') {
    return (
      <Screen footer={<Button label={t('pinReset.send')} icon="app:email" loading={busy} disabled={resendIn > 0} onPress={() => void send()} />}>
        <ScreenHeader onBack={() => router.back()} />
        <View className="gap-2">
          <Text weight="bold" accessibilityRole="header" className="text-2xl">
            {t('pinReset.title')}
          </Text>
          <Text tone="muted" className="text-base">
            {t('pinReset.intro')}
          </Text>
        </View>
        <View className="flex-row items-center gap-2 px-1">
          <Glyph name="app:email" size={18} color={theme.colors.muted} />
          <Text tone="muted" numberOfLines={1} className="flex-1 text-sm">
            {ltrIsolate(email)}
          </Text>
        </View>
        {errorText}
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          <NumericKeypad onKey={pressCode} disabled={busy} />
          <Button
            label={t('pin.next')}
            disabled={code.length < SIGN_IN_CODE_LENGTH}
            onPress={() => {
              setError(null);
              setStep('new');
            }}
          />
        </>
      }
    >
      <ScreenHeader onBack={() => setStep('send')} />
      <View className="gap-2">
        <Text weight="bold" accessibilityRole="header" className="text-2xl">
          {t('pinReset.codeTitle')}
        </Text>
        <Text tone="muted" className="text-base">
          {t('auth.verifyIntro', { email: ltrIsolate(email) })}
        </Text>
      </View>
      <CodeBoxes value={code} length={SIGN_IN_CODE_LENGTH} accessibilityLabel={t('auth.codeLabel')} />
      <Button
        label={resendIn > 0 ? t('auth.resendIn', { time: formatCountdown(resendIn, { language }) }) : t('auth.resend')}
        variant="secondary"
        disabled={busy || resendIn > 0}
        onPress={() => void send()}
      />
      {errorText}
    </Screen>
  );
}
