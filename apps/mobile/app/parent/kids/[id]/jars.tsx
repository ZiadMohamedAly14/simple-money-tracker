import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { addJar, archiveJar, renameJar, topUpJarsOf, walletOf } from '@/data/kidWallet';
import { localStore } from '@/db/appDatabase';
import { jarStyle, useKidWallet } from '@/kid/useKidWallet';
import { Button, Card, IconCircle, Screen, ScreenHeader, TextField } from '@/ui';
import { showDialog } from '@/ui/dialogStore';

/**
 * Manage a Kid Wallet's Jars (no mockup; reuses the card and field patterns):
 * rename, archive (hidden from new Top-ups, money and history kept) and add.
 * Works offline.
 */
export default function ManageJarsScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { jarRows } = useKidWallet(id);
  const [names, setNames] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');
  const live = topUpJarsOf(jarRows);
  const keys = new Map(walletOf(localStore.accountId(), jarRows, []).jars.map((jar) => [jar.id, jar.key]));

  function rename(jarId: string) {
    const name = names[jarId]?.trim();
    if (!name) return;
    renameJar(localStore, jarId, name);
    setNames(({ [jarId]: _done, ...rest }) => rest);
  }

  function confirmArchive(jarId: string, name: string) {
    showDialog(t('kid.jarsScreen.archiveTitle', { jar: name }), t('kid.jarsScreen.archiveBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('kid.jarsScreen.archive'), style: 'destructive', onPress: () => archiveJar(localStore, jarId) },
    ]);
  }

  function add() {
    if (!newName.trim()) return;
    addJar(localStore, id, newName, Math.max(-1, ...jarRows.map((jar) => jar.order)) + 1);
    setNewName('');
  }

  return (
    <Screen scroll>
      <ScreenHeader title={t('kid.jarsScreen.title')} onBack={() => router.back()} />
      {live.map((jar) => {
        const style = jarStyle(keys.get(jar.id) ?? null);
        const draft = names[jar.id];
        const changed = draft !== undefined && draft.trim() !== '' && draft.trim() !== jar.name;
        return (
          <Card key={jar.id} className="gap-3 p-3">
            <View className="flex-row items-center gap-3">
              <IconCircle icon={style.icon} tone={style.tone === 'primary' ? 'tint' : style.tone} />
              <View className="flex-1">
                <TextField
                  value={draft ?? jar.name}
                  onChangeText={(text) => setNames((current) => ({ ...current, [jar.id]: text }))}
                  onSubmitEditing={() => rename(jar.id)}
                  accessibilityLabel={t('kid.jarsScreen.nameLabel', { jar: jar.name })}
                  maxLength={40}
                  returnKeyType="done"
                />
              </View>
            </View>
            <View className="flex-row gap-2">
              {changed ? (
                <Button label={t('kid.jarsScreen.save')} onPress={() => rename(jar.id)} className="flex-1" />
              ) : null}
              <Button
                label={t('kid.jarsScreen.archive')}
                variant="secondary"
                disabled={live.length <= 1}
                onPress={() => confirmArchive(jar.id, jar.name)}
                className="flex-1"
              />
            </View>
          </Card>
        );
      })}
      <Card className="gap-3 p-3">
        <TextField
          label={t('kid.jarsScreen.newLabel')}
          value={newName}
          onChangeText={setNewName}
          placeholder={t('kid.jarsScreen.newPlaceholder')}
          onSubmitEditing={add}
          maxLength={40}
          returnKeyType="done"
        />
        <Button label={t('kid.jarsScreen.add')} icon="app:add" disabled={!newName.trim()} onPress={add} />
      </Card>
    </Screen>
  );
}
