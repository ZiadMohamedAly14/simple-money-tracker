import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useTranslation } from 'react-i18next';
import { ltrIsolate } from '@money-tracker/shared';
import { authSession } from '@/auth/appSession';
import { kidProfilesQuery } from '@/data/kidWallet';
import { localDb } from '@/db/appDatabase';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Glyph, ListRow, Screen, ScreenHeader, Text } from '@/ui';

/**
 * "Set up this device" (PDF page 13, "Kid device setup"), step 1: the parent,
 * signed in on the kid's phone, picks or creates the Kid Profile this phone is
 * for. Step 2 (`pin`) confirms the Parent PIN and makes it a Kid-Mode device.
 * Opened from the Parent Area ("Set up this phone for a kid") or right after
 * sign-in ("Whose phone is this?" → For a kid). It sits outside the Parent
 * Area's gate so the PIN is asked once, at step 2, where the server checks it.
 */
export default function KidDeviceSetupScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { kid: created } = useLocalSearchParams<{ kid?: string }>();
  const { data: kids } = useLiveQuery(kidProfilesQuery(localDb));
  const [picked, setPicked] = useState<string | null>(created ?? null);
  const chosen = picked ?? (kids.length === 1 ? kids[0]!.id : null);
  const email = authSession.account()?.email;

  return (
    <Screen
      scroll
      footer={
        <Button
          label={t('kidDevice.next')}
          disabled={!chosen || !kids.some((kid) => kid.id === chosen)}
          onPress={() => chosen && router.push({ pathname: '/kid-device/pin', params: { kid: chosen } })}
        />
      }
    >
      <ScreenHeader title={t('kidDevice.title')} onBack={() => router.back()} />
      <ListRow icon="app:kid-device" title={t('kidDevice.forKid')} subtitle={t('kidDevice.forKidBody')} selected />
      {email ? (
        <View className="flex-row items-center gap-2 px-1">
          <Glyph name="app:email" size={18} color={theme.colors.muted} />
          <Text tone="muted" numberOfLines={1} className="flex-1 text-sm">
            {t('kidDevice.signedInAs', { email: ltrIsolate(email) })}
          </Text>
        </View>
      ) : null}
      <Text weight="semibold" accessibilityRole="header" className="text-lg">
        {t('kidDevice.chooseKid')}
      </Text>
      {kids.map((kid) => (
        <ListRow
          key={kid.id}
          icon="app:wallet"
          title={kid.name}
          subtitle={t('kidDevice.kidWallet')}
          selected={kid.id === chosen}
          onPress={() => setPicked(kid.id)}
        />
      ))}
      <ListRow
        icon="app:add"
        title={t('kidDevice.createKid')}
        onPress={() => router.push('/kid-device/new')}
      />
      <Text tone="muted" className="text-sm">
        {t('kidDevice.explain')}
      </Text>
    </Screen>
  );
}
