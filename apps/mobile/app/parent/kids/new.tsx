import { useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { createKidProfile } from '@/data/kidWallet';
import { localStore } from '@/db/appDatabase';
import { KidProfileForm, useJarNames, type KidProfileDraft } from '@/kid/KidProfileForm';
import { Button, Screen, ScreenHeader } from '@/ui';

/** Adds another Kid Profile from the Parent Area (spec, story 38). Works offline. */
export default function NewKidProfileScreen() {
  const { t } = useTranslation();
  const jarNames = useJarNames();
  const [draft, setDraft] = useState<KidProfileDraft>({ name: '', avatar: null });

  function create() {
    if (!draft.name.trim()) return;
    const id = createKidProfile(localStore, { ...draft, jarNames });
    router.replace({ pathname: '/parent/kids/[id]', params: { id } });
  }

  return (
    <Screen scroll footer={<Button label={t('kid.profile.create')} disabled={!draft.name.trim()} onPress={create} />}>
      <ScreenHeader title={t('kid.profile.title')} onBack={() => router.back()} />
      <KidProfileForm value={draft} onChange={setDraft} />
    </Screen>
  );
}
