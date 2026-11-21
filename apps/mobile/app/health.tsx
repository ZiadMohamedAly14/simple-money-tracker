import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatMoneyParts, ltrIsolate } from '@money-tracker/shared';
import { useAuthStatus } from '@/auth/appSession';
import { createApiClient } from '@/api/client';
import { checkHealth, type HealthResult } from '@/api/health';
import { API_URL } from '@/config';
import { useLanguage } from '@/i18n/useLanguage';
import { useTheme } from '@/theme/ThemeProvider';
import { AmountDisplay, Card, IconCircle, Screen, ScreenHeader, Text } from '@/ui';

/**
 * Connection screen (from Settings): proves the app can reach the API, and
 * shows a sample amount as a quick right-to-left check.
 */
export default function HealthRoute() {
  // Signed-out devices go to sign-in first. A device whose session ended keeps
  // showing its data (HealthScreen shows a sign-in-again notice instead).
  const status = useAuthStatus();
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  return <HealthScreen />;
}

function HealthScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const language = useLanguage();
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
  const sample = formatMoneyParts(123450, { language, currency: 'EGP' });

  return (
    <Screen scroll className="pt-4">
      <ScreenHeader title={t('health.title')} onBack={() => router.back()} />

      <Card className="flex-row items-center gap-3 p-4">
        <IconCircle icon={health?.status === 'ok' ? 'app:cloud' : 'app:offline'} />
        <View className="flex-1 gap-1">
          {statusLine === null ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <Text weight="semibold" className="text-base">
              {statusLine}
            </Text>
          )}
          <Text tone="muted" className="text-xs">
            {ltrIsolate(API_URL)}
          </Text>
        </View>
      </Card>

      <Card className="gap-1 p-4">
        <Text tone="muted" className="text-sm">
          {t('health.sampleAmount')}
        </Text>
        <AmountDisplay
          amount={sample.amount}
          currency={sample.currency}
          size="md"
          align="start"
          accessibilityLabel={t('health.sampleAmount')}
        />
      </Card>
    </Screen>
  );
}
