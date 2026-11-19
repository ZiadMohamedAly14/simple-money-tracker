import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { normalizeEmail, type Language } from '@money-tracker/shared';
import { requestCode } from '@/api/auth';
import { createApiClient } from '@/api/client';
import { authSession } from '@/auth/appSession';
import { authErrorMessage } from '@/auth/authErrorMessage';
import { API_URL } from '@/config';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Screen, Text, TextField } from '@/ui';

const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Step 1 of sign-in: the adult enters their email and gets a code in the device's language. */
export default function SignInScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  // After a session ends, the remembered Account's email is filled in.
  const [email, setEmail] = useState(() => authSession.account()?.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function send() {
    const normalized = normalizeEmail(email);
    if (!LOOKS_LIKE_EMAIL.test(normalized)) {
      setError(t('auth.errors.invalidEmail'));
      return;
    }
    setError(null);
    setSending(true);
    const result = await requestCode(createApiClient(API_URL), normalized, i18n.language as Language);
    setSending(false);
    // A code sent less than a minute ago is still valid, so go on to enter it.
    if (result.status === 'ok' || (result.status === 'rejected' && result.reason === 'resend_too_soon')) {
      const resendAfter = result.status === 'ok' ? result.data.resendAfterSeconds : (result.retryAfterSeconds ?? 60);
      router.push({ pathname: '/verify', params: { email: normalized, resendAfter: String(resendAfter) } });
      return;
    }
    setError(authErrorMessage(t, result));
  }

  return (
    <Screen className="justify-center">
      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary">
        <Ionicons name="wallet-outline" size={32} color={theme.colors['on-primary']} />
      </View>
      <Text weight="bold" accessibilityRole="header" className="text-3xl">
        {t('auth.signInTitle')}
      </Text>
      <Text tone="muted" className="text-base">
        {t('auth.signInIntro')}
      </Text>

      <TextField
        label={t('auth.emailLabel')}
        ltr
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={() => void send()}
        placeholder={t('auth.emailPlaceholder')}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        inputMode="email"
        textContentType="emailAddress"
        returnKeyType="send"
      />

      {error ? (
        <Text accessibilityRole="alert" tone="negative">
          {error}
        </Text>
      ) : null}

      <Button label={t('auth.sendCode')} loading={sending} onPress={() => void send()} />
    </Screen>
  );
}
