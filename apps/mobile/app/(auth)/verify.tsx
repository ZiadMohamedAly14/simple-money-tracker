import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  SIGN_IN_CODE_LENGTH,
  applyKeypadKey,
  findSignInCode,
  formatCountdown,
  ltrIsolate,
  normalizeSignInCode,
  type KeypadKey,
  type Language,
} from '@money-tracker/shared';
import { requestCode, verifyCode } from '@/api/auth';
import { createApiClient } from '@/api/client';
import { authErrorMessage } from '@/auth/authErrorMessage';
import { authSession } from '@/auth/appSession';
import { API_URL } from '@/config';
import { useLanguage } from '@/i18n/useLanguage';
import { Button, CodeBoxes, NumericKeypad, Screen, ScreenHeader, Text } from '@/ui';

/** Step 2 of sign-in: enter the emailed code. Verifying creates the Account the first time. */
export default function VerifyScreen() {
  const { t, i18n } = useTranslation();
  const language = useLanguage();
  const params = useLocalSearchParams<{ email: string; resendAfter?: string }>();
  const email = params.email ?? '';
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(Number(params.resendAfter ?? 60) || 60);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function submit(entered: string = code) {
    const normalized = normalizeSignInCode(entered);
    if (!normalized) {
      setError(t('auth.errors.invalidCode'));
      return;
    }
    setError(null);
    setBusy(true);
    const result = await verifyCode(createApiClient(API_URL), { email, code: normalized });
    if (result.status === 'ok') {
      await authSession.signedIn(result.data);
      setBusy(false);
      router.replace('/');
      return;
    }
    setBusy(false);
    setError(authErrorMessage(t, result));
  }

  async function resend() {
    setError(null);
    setBusy(true);
    const result = await requestCode(createApiClient(API_URL), email, i18n.language as Language);
    setBusy(false);
    if (result.status === 'ok') {
      setCode('');
      setResendIn(result.data.resendAfterSeconds);
      return;
    }
    if (result.status === 'rejected' && result.retryAfterSeconds) setResendIn(result.retryAfterSeconds);
    setError(authErrorMessage(t, result));
  }

  /** The in-app keypad replaces the system keyboard, so paste needs its own button. */
  async function paste() {
    const found = findSignInCode(await Clipboard.getStringAsync());
    if (!found) {
      setError(t('auth.errors.noCodeToPaste'));
      return;
    }
    setCode(found);
    await submit(found);
  }

  function press(key: KeypadKey) {
    setError(null);
    setCode((current) => applyKeypadKey(current, key, { kind: 'digits', length: SIGN_IN_CODE_LENGTH }));
  }

  return (
    <Screen
      footer={
        <>
          {/* Codes are digits only: no decimal key (design flaw 1). */}
          <NumericKeypad onKey={press} disabled={busy} />
          <Button
            label={t('auth.verify')}
            loading={busy}
            disabled={code.length < SIGN_IN_CODE_LENGTH}
            onPress={() => void submit()}
          />
        </>
      }
    >
      <ScreenHeader onBack={() => router.back()} />
      <View className="gap-2">
        <Text weight="bold" accessibilityRole="header" className="text-2xl">
          {t('auth.verifyTitle')}
        </Text>
        <Text tone="muted" className="text-base">
          {t('auth.verifyIntro', { email: ltrIsolate(email) })}
        </Text>
      </View>

      <CodeBoxes value={code} length={SIGN_IN_CODE_LENGTH} accessibilityLabel={t('auth.codeLabel')} />

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void paste()}
        className="min-h-11 items-center justify-center"
      >
        <Text weight="semibold" tone="primary" align="center">
          {t('auth.pasteCode')}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={busy || resendIn > 0}
        onPress={() => void resend()}
        className="min-h-11 items-center justify-center"
      >
        <Text weight={resendIn > 0 ? 'regular' : 'semibold'} tone={resendIn > 0 ? 'muted' : 'primary'} align="center">
          {resendIn > 0 ? t('auth.resendIn', { time: formatCountdown(resendIn, { language }) }) : t('auth.resend')}
        </Text>
      </Pressable>

      {error ? (
        <Text accessibilityRole="alert" tone="negative" align="center">
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}
