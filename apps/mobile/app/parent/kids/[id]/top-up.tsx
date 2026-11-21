import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { deleteTopUp } from '@/data/kidWallet';
import { localStore } from '@/db/appDatabase';
import { TopUpForm } from '@/kid/TopUpForm';
import { useKidWallet } from '@/kid/useKidWallet';
import { Button, Screen, ScreenHeader, Text } from '@/ui';
import { showDialog } from '@/ui/dialogStore';

/**
 * Adds a Top-up (PDF page 11, "Top-up split"), or with `topUpId` edits or
 * deletes one. Only the parent can change Top-ups (GLOSSARY). Works offline.
 */
export default function TopUpScreen() {
  const { t } = useTranslation();
  const { id, topUpId } = useLocalSearchParams<{ id: string; topUpId?: string }>();
  const { kid, transactions } = useKidWallet(id);
  if (kid === undefined) return null;

  const editing = topUpId ? transactions.find((tx) => tx.id === topUpId) : undefined;
  if (topUpId && !editing) {
    // Deleted, maybe on another device.
    return (
      <Screen>
        <ScreenHeader onBack={() => router.back()} />
        <Text tone="muted" align="center" className="pt-8">
          {t('kid.topUp.gone')}
        </Text>
      </Screen>
    );
  }

  function confirmDelete() {
    if (!editing) return;
    showDialog(t('kid.topUp.deleteTitle'), t('kid.topUp.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('kid.topUp.delete'),
        style: 'destructive',
        onPress: () => {
          deleteTopUp(localStore, editing.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <TopUpForm
      key={editing?.id ?? 'new'}
      kidProfileId={id}
      editing={editing}
      onSaved={() => router.back()}
      header={
        <ScreenHeader
          title={editing ? t('kid.topUp.editTitle') : t('kid.topUp.title', { name: kid?.name ?? '' })}
          onBack={() => router.back()}
        />
      }
      footerExtra={
        editing ? <Button label={t('kid.topUp.delete')} variant="danger" icon="app:delete" onPress={confirmDelete} /> : null
      }
    />
  );
}
