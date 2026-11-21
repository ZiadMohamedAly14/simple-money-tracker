import { useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { createKidProfile } from '@/data/kidWallet';
import { localStore } from '@/db/appDatabase';
import { KidProfileForm, useJarNames, type KidProfileDraft } from '@/kid/KidProfileForm';
import { Button, Screen, ScreenHeader } from '@/ui';

/**
 * "Create a new kid" while setting up a phone for a kid: adds the Kid Profile
 * and goes back to "Set up this device" with the new kid picked. Works offline;
 * the setup syncs it before the phone becomes a Kid-Mode device.
 */
export default function KidDeviceNewKidScreen() {
  const { t } = useTranslation();
  const jarNames = useJarNames();
  const [draft, setDraft] = useState<KidProfileDraft>({ name: '' });

  function create() {
    if (!draft.name.trim()) return;
    const id = createKidProfile(localStore, { ...draft, jarNames });
    router.dismissTo({ pathname: '/kid-device', params: { kid: id } });
  }

  return (
    <Screen scroll footer={<Button label={t('kid.profile.create')} disabled={!draft.name.trim()} onPress={create} />}>
      <ScreenHeader title={t('kid.profile.title')} onBack={() => router.back()} />
      <KidProfileForm value={draft} onChange={setDraft} />
    </Screen>
  );
}
