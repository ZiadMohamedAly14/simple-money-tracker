import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { changeAccountSettings } from '@/data/budget';
import { ONBOARDING_CURRENCIES } from '@/data/currency';
import { useAccountSettings } from '@/data/useAccountSettings';
import { localDb, localStore } from '@/db/appDatabase';
import { ListRow, Notice, Screen, ScreenHeader } from '@/ui';

/**
 * Relabels the Account's currency (spec story 79). Amounts are stored in minor
 * units and never converted; the change syncs to every device.
 */
export default function SettingsCurrencyScreen() {
  const { t } = useTranslation();
  const { currency } = useAccountSettings();

  function choose(code: string) {
    if (code !== currency) changeAccountSettings(localStore, localDb, { currency: code });
    router.back();
  }

  return (
    <Screen scroll className="pt-4">
      <ScreenHeader title={t('settings.currencyTitle')} onBack={() => router.back()} />
      <Notice text={t('settings.currencyNote')} icon="app:info" />
      <View className="gap-3">
        {ONBOARDING_CURRENCIES.map((code) => (
          <ListRow
            key={code}
            icon="app:currency"
            title={t(`currencies.${code}`)}
            subtitle={code}
            selected={currency === code}
            onPress={() => choose(code)}
          />
        ))}
      </View>
    </Screen>
  );
}
