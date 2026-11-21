import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DEFAULT_CATEGORY_KEYS, type DefaultCategoryKey } from '@money-tracker/shared';
import { FALLBACK_CURRENCY, KID_STEPS } from '@/data/currency';
import { completeKidOnboarding } from '@/data/kidWallet';
import { localStore } from '@/db/appDatabase';
import { KidProfileForm, useJarNames, type KidProfileDraft } from '@/kid/KidProfileForm';
import { parentPinGate } from '@/pin/appPinGate';
import { Button, Screen, ScreenHeader, Text } from '@/ui';

/**
 * Kid path, step 3: the first Kid Profile (name, optional avatar). Next
 * finishes onboarding on this device, offline if need be: currency, the
 * default Categories (the Personal Budget is there for later) and the Kid
 * Profile with Save, Spend and Give. Then the Parent PIN, then an optional
 * first Top-up.
 */
export default function KidProfileStep() {
  const { t } = useTranslation();
  const jarNames = useJarNames();
  const currency = useLocalSearchParams<{ currency?: string }>().currency ?? FALLBACK_CURRENCY;
  const [draft, setDraft] = useState<KidProfileDraft>({ name: '', avatar: null });
  const [busy, setBusy] = useState(false);

  async function next() {
    if (!draft.name.trim()) return;
    setBusy(true);
    const categoryNames = Object.fromEntries(
      DEFAULT_CATEGORY_KEYS.map((key) => [key, t(`categories.defaults.${key}`)]),
    ) as Record<DefaultCategoryKey, string>;
    const kid = completeKidOnboarding(localStore, { currency, categoryNames, kid: { ...draft, jarNames } });
    const topUp = `/onboarding/kid-top-up?kid=${kid}`;
    // An Account that already has a PIN (set on another device) skips straight to the Top-up.
    if (await parentPinGate.hasPin()) router.replace(topUp);
    else router.replace({ pathname: '/pin/set', params: { next: topUp } });
  }

  return (
    <Screen
      scroll
      footer={<Button label={t('onboarding.next')} disabled={!draft.name.trim()} loading={busy} onPress={() => void next()} />}
    >
      <ScreenHeader onBack={() => router.back()} />
      <View className="gap-1">
        <Text tone="muted" className="text-sm">
          {t('onboarding.step', { step: 3, count: KID_STEPS })}
        </Text>
        <Text weight="bold" accessibilityRole="header" className="text-2xl">
          {t('onboarding.kidProfileTitle')}
        </Text>
        <Text tone="muted">{t('onboarding.kidProfileBody')}</Text>
      </View>
      <KidProfileForm value={draft} onChange={setDraft} />
    </Screen>
  );
}
