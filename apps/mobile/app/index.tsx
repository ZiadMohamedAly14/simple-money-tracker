import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, formatMoneyParts, type Language } from '@money-tracker/shared';
import { loadSession } from '@/auth/tokenStore';
import { createApiClient } from '@/api/client';
import { checkHealth, type HealthResult } from '@/api/health';
import { API_URL } from '@/config';
import { switchLanguage } from '@/i18n/i18n';
import { useFormatMoney } from '@/i18n/useFormatMoney';
import { useLanguage } from '@/i18n/useLanguage';
import { useTheme } from '@/theme/ThemeProvider';
import { AmountDisplay, Card, IconCircle, Screen, SegmentedControl, Text } from '@/ui';

/**
 * Walking-skeleton health screen: proves the app can reach the API, and
 * doubles as the right-to-left check for the shell (text, a sample amount, a
 * mirrored chevron and the language switch).
 */
export default function HomeScreen() {
  // Signed-out devices go to sign-in first. Ticket 04 owns the full session lifecycle.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    loadSession().then((session) => setSignedIn(session !== null));
  }, []);

  if (signedIn === null) return null;
  if (!signedIn) return <Redirect href="/sign-in" />;
  return <HealthScreen />;
}

function HealthScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const language = useLanguage();
  const formatMoney = useFormatMoney();
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
  const languages = SUPPORTED_LANGUAGES.map((value) => ({ value, label: t(`language.${value}`) }));

  return (
    <Screen scroll className="pt-4">
      <View className="gap-1">
        <Text weight="bold" accessibilityRole="header" className="text-3xl">
          {t('common.appName')}
        </Text>
        <Text tone="muted">{t('health.title')}</Text>
      </View>

      <Card className="flex-row items-center gap-3 p-4">
        <IconCircle icon={health?.status === 'ok' ? 'cloud-done-outline' : 'cloud-offline-outline'} />
        <View className="flex-1 gap-1">
          {statusLine === null ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <Text weight="semibold" className="text-base">
              {statusLine}
            </Text>
          )}
          <Text tone="muted" className="text-xs">
            {API_URL}
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
          accessibilityLabel={formatMoney(123450, 'EGP')}
        />
      </Card>

      <Card className="gap-2 p-4">
        <Text tone="muted" className="text-sm">
          {t('language.label')}
        </Text>
        <SegmentedControl<Language>
          options={languages}
          value={language}
          onChange={(next) => void switchLanguage(next)}
          accessibilityLabel={t('language.label')}
        />
      </Card>
    </Screen>
  );
}
