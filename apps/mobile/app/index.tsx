import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@money-tracker/shared';
import { authSession, useAuthStatus } from '@/auth/appSession';
import { createApiClient } from '@/api/client';
import { checkHealth, type HealthResult } from '@/api/health';
import { API_URL } from '@/config';
import { switchLanguage } from '@/i18n/i18n';
import { useFormatMoney } from '@/i18n/useFormatMoney';
import { DirectionalIcon } from '@/theme/DirectionalIcon';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Walking-skeleton health screen: proves the app can reach the API, and
 * doubles as the right-to-left check for the shell (text, a sample amount, a
 * mirrored chevron and the language switch).
 */
export default function HomeScreen() {
  // Signed-out devices go to sign-in first. A device whose session ended keeps
  // showing its data (HealthScreen shows a sign-in-again notice instead).
  const status = useAuthStatus();
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  return <HealthScreen />;
}

function HealthScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const formatMoney = useFormatMoney();
  const needsSignIn = useAuthStatus() === 'needsSignIn';
  const [health, setHealth] = useState<HealthResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkHealth(createApiClient(API_URL)).then((result) => {
      if (!cancelled) setHealth(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const statusLine =
    health === null
      ? null
      : health.status === 'error'
        ? t('health.error', { message: health.message })
        : t(`health.${health.status}`);

  return (
    <View className="flex-1 justify-center gap-4 px-6">
      <Text className="text-start text-2xl font-bold text-text">{t('health.title')}</Text>

      {needsSignIn ? (
        <View className="gap-2 rounded-theme border border-border bg-surface p-4">
          <Text className="text-start text-text">{t('session.needsSignInBody')}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/sign-in')} className="min-h-control justify-center">
            <Text className="text-start font-semibold text-primary">{t('session.signInAgain')}</Text>
          </Pressable>
        </View>
      ) : null}

      <View className="gap-2 rounded-theme border border-border bg-surface p-4">
        {statusLine === null ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <Text className="text-start text-lg font-semibold text-text">{statusLine}</Text>
        )}
        <Text className="text-start text-xs text-muted">{API_URL}</Text>
      </View>

      <View className="min-h-control flex-row items-center justify-between rounded-theme border border-border bg-surface px-4">
        <Text className="text-start text-text">{t('health.sampleAmount')}</Text>
        <View className="flex-row items-center gap-2">
          <Text className="font-semibold text-text">{formatMoney(123450, 'EGP')}</Text>
          <DirectionalIcon name="chevron-forward" size={18} color={theme.colors.muted} />
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-start text-sm text-muted">{t('language.label')}</Text>
        <View className="flex-row gap-2">
          {SUPPORTED_LANGUAGES.map((language) => {
            const selected = i18n.language === language;
            return (
              <Pressable
                key={language}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => void switchLanguage(language)}
                className={`min-h-control flex-1 items-center justify-center rounded-theme border ${
                  selected ? 'border-primary bg-primary' : 'border-border bg-surface'
                }`}
              >
                <Text className={selected ? 'font-semibold text-on-primary' : 'text-text'}>
                  {t(`language.${language}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => void authSession.signOut()}
        className="min-h-control items-center justify-center"
      >
        <Text className="text-negative">{t('session.signOut')}</Text>
      </Pressable>
    </View>
  );
}
