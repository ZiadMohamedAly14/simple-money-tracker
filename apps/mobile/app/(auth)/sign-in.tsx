import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { normalizeEmail, type Language } from '@money-tracker/shared';
import { requestCode } from '@/api/auth';
import { createApiClient } from '@/api/client';
import { authErrorMessage } from '@/auth/authErrorMessage';
import { API_URL } from '@/config';
import { useTheme } from '@/theme/ThemeProvider';

const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Step 1 of sign-in: the adult enters their email and gets a code in the device's language. */
export default function SignInScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [email, setEmail] = useState('');
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
    <View className="flex-1 justify-center gap-4 px-6">
      <Text className="text-start text-2xl font-bold text-text">{t('auth.signInTitle')}</Text>
      <Text className="text-start text-muted">{t('auth.signInIntro')}</Text>

      <View className="gap-2">
        <Text className="text-start text-sm text-muted">{t('auth.emailLabel')}</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={() => void send()}
          placeholder={t('auth.emailPlaceholder')}
          placeholderTextColor={theme.colors.muted}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          inputMode="email"
          textContentType="emailAddress"
          returnKeyType="send"
          accessibilityLabel={t('auth.emailLabel')}
          // Emails are left-to-right even in an Arabic layout.
          style={{ writingDirection: 'ltr' }}
          className="min-h-control rounded-theme border border-border bg-surface px-4 text-text"
        />
      </View>

      {error ? (
        <Text accessibilityRole="alert" className="text-start text-negative">
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={sending}
        onPress={() => void send()}
        className="min-h-control items-center justify-center rounded-theme bg-primary"
      >
        {sending ? (
          <ActivityIndicator color={theme.colors['on-primary']} />
        ) : (
          <Text className="font-semibold text-on-primary">{t('auth.sendCode')}</Text>
        )}
      </Pressable>
    </View>
  );
}
