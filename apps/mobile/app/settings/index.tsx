import { useCallback, useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type Language, type NumberingSystem } from '@money-tracker/shared';
import { authSession, useAuthStatus } from '@/auth/appSession';
import { changeAccountSettings } from '@/data/budget';
import { useAccountSettings } from '@/data/useAccountSettings';
import { localDb, localStore } from '@/db/appDatabase';
import { switchLanguage } from '@/i18n/i18n';
import { useLanguage } from '@/i18n/useLanguage';
import { parentPinGate } from '@/pin/appPinGate';
import { DirectionalIcon } from '@/theme/DirectionalIcon';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Card, ListRow, Screen, ScreenHeader, SegmentedControl, Text } from '@/ui';

/**
 * Settings (PDF pages 7–8): language (this device), digits and currency label
 * (Account settings, synced), Parent Area biometrics (this device, once a
 * Parent PIN exists) and sign-out.
 */
export default function SettingsRoute() {
  const status = useAuthStatus();
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  return <SettingsScreen />;
}

function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const language = useLanguage();
  const { currency, numberingSystem } = useAccountSettings();
  const needsSignIn = useAuthStatus() === 'needsSignIn';
  const [biometrics, setBiometrics] = useState<'hidden' | 'on' | 'off'>('hidden');
  const [biometricsBusy, setBiometricsBusy] = useState(false);

  // Re-read on focus: a PIN may just have been set from the Parent Area.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void parentPinGate.biometricsSetting().then((value) => {
        if (!cancelled) setBiometrics(value);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  async function toggleBiometrics(on: boolean) {
    setBiometricsBusy(true);
    if (on) await parentPinGate.enableBiometrics(t('pin.biometricsPrompt'));
    else await parentPinGate.disableBiometrics();
    setBiometrics(await parentPinGate.biometricsSetting());
    setBiometricsBusy(false);
  }

  function confirmSignOut() {
    const body = localStore.pendingCount() > 0 ? t('settings.signOutPendingBody') : t('settings.signOutBody');
    Alert.alert(t('settings.signOutTitle'), body, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('session.signOut'), style: 'destructive', onPress: () => void authSession.signOut() },
    ]);
  }

  const languages = SUPPORTED_LANGUAGES.map((value) => ({ value, label: t(`language.${value}`) }));
  const numberingSystems: { value: NumberingSystem; label: string }[] = [
    { value: 'western', label: t('settings.western') },
    { value: 'arabic-indic', label: t('settings.arabicIndic') },
  ];

  return (
    <Screen scroll className="pt-4">
      <ScreenHeader title={t('settings.title')} onBack={() => router.back()} />

      {needsSignIn ? (
        <Card className="gap-3 p-4">
          <Text>{t('session.needsSignInBody')}</Text>
          <Button label={t('session.signInAgain')} onPress={() => router.push('/sign-in')} />
        </Card>
      ) : null}

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

      <Card className="gap-2 p-4">
        <Text tone="muted" className="text-sm">
          {t('settings.numberingLabel')}
        </Text>
        <SegmentedControl<NumberingSystem>
          options={numberingSystems}
          value={numberingSystem}
          onChange={(next) => changeAccountSettings(localStore, localDb, { numberingSystem: next })}
          accessibilityLabel={t('settings.numberingLabel')}
        />
      </Card>

      <ListRow
        icon="cash-outline"
        title={t('settings.currencyLabel')}
        subtitle={t(`currencies.${currency}`, { defaultValue: currency })}
        end={
          <View className="flex-row items-center gap-1">
            <Text weight="semibold">{currency}</Text>
            <DirectionalIcon name="chevron-forward" size={18} color={theme.colors.muted} />
          </View>
        }
        onPress={() => router.push('/settings/currency')}
      />

      {biometrics !== 'hidden' ? (
        <ListRow
          icon="app:fingerprint-biometrics"
          title={t('settings.biometricsLabel')}
          subtitle={t('settings.biometricsBody')}
          end={
            <Switch
              value={biometrics === 'on'}
              disabled={biometricsBusy}
              onValueChange={(on) => void toggleBiometrics(on)}
              trackColor={{ true: theme.colors.primary, false: theme.colors.tint }}
              accessibilityLabel={t('settings.biometricsLabel')}
            />
          }
        />
      ) : null}

      <ListRow
        icon="cloud-outline"
        title={t('settings.connection')}
        end={<DirectionalIcon name="chevron-forward" size={18} color={theme.colors.muted} />}
        onPress={() => router.push('/health')}
      />

      <Button label={t('session.signOut')} variant="danger" onPress={confirmSignOut} />
    </Screen>
  );
}
