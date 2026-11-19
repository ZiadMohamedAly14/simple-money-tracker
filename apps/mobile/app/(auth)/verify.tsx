import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SIGN_IN_CODE_LENGTH, normalizeSignInCode, type Language } from '@money-tracker/shared';
import { requestCode, verifyCode } from '@/api/auth';
import { createApiClient } from '@/api/client';
import { authErrorMessage } from '@/auth/authErrorMessage';
import { saveSession } from '@/auth/tokenStore';
import { API_URL } from '@/config';
import { useTheme } from '@/theme/ThemeProvider';

/** Step 2 of sign-in: enter the emailed code. Verifying creates the Account the first time. */
export default function VerifyScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
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

  async function submit() {
    const normalized = normalizeSignInCode(code);
    if (!normalized) {
      setError(t('auth.errors.invalidCode'));
      return;
    }
    setError(null);
    setBusy(true);
    const result = await verifyCode(createApiClient(API_URL), { email, code: normalized });
    if (result.status === 'ok') {
      await saveSession(result.data);
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

  return (
    <View className="flex-1 justify-center gap-4 px-6">
      <Text className="text-start text-2xl font-bold text-text">{t('auth.verifyTitle')}</Text>
      <Text className="text-start text-muted">{t('auth.verifyIntro', { email })}</Text>

      <View className="gap-2">
        <Text className="text-start text-sm text-muted">{t('auth.codeLabel')}</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          onSubmitEditing={() => void submit()}
          keyboardType="number-pad"
          inputMode="numeric"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={SIGN_IN_CODE_LENGTH + 2}
          autoFocus
          accessibilityLabel={t('auth.codeLabel')}
          style={{ writingDirection: 'ltr', letterSpacing: 8 }}
          className="min-h-control rounded-theme border border-border bg-surface px-4 text-center text-2xl text-text"
        />
      </View>

      {error ? (
        <Text accessibilityRole="alert" className="text-start text-negative">
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void submit()}
        className="min-h-control items-center justify-center rounded-theme bg-primary"
      >
        {busy ? (
          <ActivityIndicator color={theme.colors['on-primary']} />
        ) : (
          <Text className="font-semibold text-on-primary">{t('auth.verify')}</Text>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={busy || resendIn > 0}
        onPress={() => void resend()}
        className="min-h-control items-center justify-center"
      >
        <Text className={resendIn > 0 ? 'text-muted' : 'font-semibold text-primary'}>
          {resendIn > 0 ? t('auth.resendIn', { seconds: resendIn }) : t('auth.resend')}
        </Text>
      </Pressable>

      <Pressable accessibilityRole="button" onPress={() => router.back()} className="min-h-control items-center justify-center">
        <Text className="text-muted">{t('auth.changeEmail')}</Text>
      </Pressable>
    </View>
  );
}
