import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SIGN_IN_CODE_LENGTH, applyKeypadKey, formatCountdown, ltrIsolate, type KeypadKey } from '@money-tracker/shared';
import type { DeletionResult } from '@/auth/accountDeletion';
import { accountDeletion, authSession } from '@/auth/appSession';
import { authErrorMessage } from '@/auth/authErrorMessage';
import { useLanguage } from '@/i18n/useLanguage';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Card, CodeBoxes, Glyph, Notice, NumericKeypad, Screen, ScreenHeader, Text } from '@/ui';

/**
 * Settings → Delete account (no mockup; reuses the code screen's pattern).
 * Step one explains what goes and emails a code; step two takes the code and
 * deletes. Once the server has deleted the Account, this phone is wiped and
 * goes back to sign-in. Needs the internet.
 */
export default function DeleteAccountScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const language = useLanguage();
  const email = authSession.account()?.email ?? '';
  const [step, setStep] = useState<'explain' | 'code'>('explain');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function messageFor(result: Exclude<DeletionResult, { status: 'ok' }>): string {
    if (result.status === 'unreachable') return t('settings.deleteOffline');
    if (result.status === 'session_ended') return t('auth.errors.session_ended');
    return authErrorMessage(t, result);
  }

  async function sendCode() {
    setError(null);
    setBusy(true);
    const result = await accountDeletion.requestCode(language);
    setBusy(false);
    if (result.status === 'ok') {
      setCode('');
      setStep('code');
      setResendIn(60);
      return;
    }
    if (result.status === 'rejected' && result.retryAfterSeconds) {
      setStep('code');
      setResendIn(result.retryAfterSeconds);
    }
    setError(messageFor(result));
  }

  async function confirm() {
    setError(null);
    setBusy(true);
    const result = await accountDeletion.confirm(code);
    setBusy(false);
    if (result.status === 'ok') {
      router.replace('/sign-in');
      return;
    }
    setError(messageFor(result));
  }

  function press(key: KeypadKey) {
    setError(null);
    setCode((current) => applyKeypadKey(current, key, { kind: 'digits', length: SIGN_IN_CODE_LENGTH }));
  }

  const errorText = error ? (
    <Text accessibilityRole="alert" tone="negative" align="center">
      {error}
    </Text>
  ) : null;

  if (step === 'explain') {
    return (
      <Screen
        scroll
        footer={
          <Button label={t('settings.deleteSendCode')} variant="danger" icon="app:email" loading={busy} onPress={() => void sendCode()} />
        }
      >
        <ScreenHeader title={t('settings.deleteAccount')} onBack={() => router.back()} />
        <Card className="items-center gap-3 px-6 py-8">
          <Glyph name="app:delete" size={40} color={theme.colors.negative} />
          <Text weight="bold" accessibilityRole="header" align="center" className="text-xl">
            {t('settings.deleteTitle')}
          </Text>
        </Card>
        <Notice icon="app:gentle-warning" text={t('settings.deleteBody')} />
        {email ? (
          <View className="flex-row items-center gap-2 px-1">
            <Glyph name="app:email" size={18} color={theme.colors.muted} />
            <Text tone="muted" numberOfLines={1} className="flex-1 text-sm">
              {t('kidDevice.signedInAs', { email: ltrIsolate(email) })}
            </Text>
          </View>
        ) : null}
        {errorText}
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          {/* Codes are digits only: no decimal key (design flaw 1). */}
          <NumericKeypad onKey={press} disabled={busy} />
          <Button
            label={t('settings.deleteConfirm')}
            variant="danger"
            icon="app:delete"
            loading={busy}
            disabled={code.length < SIGN_IN_CODE_LENGTH}
            onPress={() => void confirm()}
          />
        </>
      }
    >
      <ScreenHeader title={t('settings.deleteAccount')} onBack={() => setStep('explain')} />
      <Text tone="muted" className="text-base">
        {t('settings.deleteCodeIntro', { email: ltrIsolate(email) })}
      </Text>
      <CodeBoxes value={code} length={SIGN_IN_CODE_LENGTH} accessibilityLabel={t('auth.codeLabel')} />
      <Pressable
        accessibilityRole="button"
        disabled={busy || resendIn > 0}
        onPress={() => void sendCode()}
        className="min-h-11 items-center justify-center"
      >
        <Text weight={resendIn > 0 ? 'regular' : 'semibold'} tone={resendIn > 0 ? 'muted' : 'primary'} align="center">
          {resendIn > 0 ? t('auth.resendIn', { time: formatCountdown(resendIn, { language }) }) : t('auth.resend')}
        </Text>
      </Pressable>
      {errorText}
    </Screen>
  );
}
