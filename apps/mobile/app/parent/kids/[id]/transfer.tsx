import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatMoneyParts, fromMinorUnits, spendableFrom, toLocalDate } from '@money-tracker/shared';
import { addJarTransfer, deleteJarTransfer, editJarTransfer } from '@/data/kidWallet';
import { useAccountSettings } from '@/data/useAccountSettings';
import { localDb, localStore } from '@/db/appDatabase';
import type { KidTransactionRow } from '@/db/schema';
import { useLanguage } from '@/i18n/useLanguage';
import { useKidWallet } from '@/kid/useKidWallet';
import { AmountEntryDisplay, AmountKeypad, Button, Chip, Notice, Screen, ScreenHeader, Text, useAmountEntry } from '@/ui';
import { showDialog } from '@/ui/dialogStore';

/**
 * Jar Transfer from the Parent Area ("Transfer between jars", PDF page 11): an amount
 * (the adult keypad takes sums), a From Jar and a To Jar. It can't move more
 * than the From Jar holds. With `transferId` the parent edits or deletes one.
 * Only parents make Jar Transfers (spec). Works offline.
 */
export default function JarTransferScreen() {
  const { t } = useTranslation();
  const { id, transferId } = useLocalSearchParams<{ id: string; transferId?: string }>();
  const { kid, transactions } = useKidWallet(id);
  if (!kid) return null;

  const editing = transferId ? transactions.find((tx) => tx.id === transferId && tx.kind === 'jarTransfer') : undefined;
  if (transferId && !editing) {
    return (
      <Screen>
        <ScreenHeader onBack={() => router.back()} />
        <Text tone="muted" align="center" className="pt-8">
          {t('kid.transfer.gone')}
        </Text>
      </Screen>
    );
  }
  return <JarTransferForm key={editing?.id ?? 'new'} kidProfileId={id} kidName={kid.name} editing={editing} />;
}

function JarTransferForm({ kidProfileId, kidName, editing }: { kidProfileId: string; kidName: string; editing?: KidTransactionRow }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { currency, numberingSystem } = useAccountSettings();
  const { jarRows, wallet } = useKidWallet(kidProfileId);
  const entry = useAmountEntry(currency, editing ? fromMinorUnits(editing.amount, currency) : '');

  // Archived Jars still holding money can be emptied; a Jar being edited stays listed.
  const balances = Object.fromEntries(wallet.jars.map((jar) => [jar.id, jar.balance]));
  const keep = new Set([editing?.jarId, editing?.toJarId]);
  const fromChoices = jarRows.filter((jar) => jar.archivedAt === null || (balances[jar.id] ?? 0) > 0 || keep.has(jar.id));
  const toChoices = jarRows.filter((jar) => jar.archivedAt === null || keep.has(jar.id));
  const [fromJarId, setFromJarId] = useState<string | undefined>(editing?.jarId ?? undefined);
  const [toJarId, setToJarId] = useState<string | undefined>(editing?.toJarId ?? undefined);

  const parts = (minor: number) => formatMoneyParts(minor, { language, currency, numberingSystem });
  const jarName = (jarId: string | undefined) => jarRows.find((jar) => jar.id === jarId)?.name ?? '';
  const available = fromJarId ? spendableFrom(balances, fromJarId, editing) : 0;
  const amount = entry.amount;
  const tooMuch = amount !== null && fromJarId !== undefined && amount > available;
  const ready = amount !== null && fromJarId !== undefined && toJarId !== undefined && fromJarId !== toJarId && !tooMuch;

  function save() {
    if (!ready || amount === null || !fromJarId || !toJarId) return;
    const result = editing
      ? editJarTransfer(localStore, localDb, editing.id, { fromJarId, toJarId, amount })
      : addJarTransfer(localStore, localDb, { kidProfileId, fromJarId, toJarId, amount, date: toLocalDate(new Date()) });
    if (result.status === 'ok' || result.status === 'deleted') router.back();
  }

  function confirmDelete() {
    if (!editing) return;
    showDialog(t('kid.transfer.deleteTitle'), t('kid.transfer.deleteBody', { jar: jarName(editing.jarId ?? undefined) }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('kid.transfer.delete'),
        style: 'destructive',
        onPress: () => {
          deleteJarTransfer(localStore, localDb, editing.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen
      scroll
      footer={
        <>
          <AmountKeypad entry={entry} numberingSystem={numberingSystem} />
          <Button
            label={editing ? t('kid.transfer.saveEdit') : t('kid.transfer.save', { amount: parts(amount ?? 0).amount })}
            icon="app:move-money"
            disabled={!ready}
            onPress={save}
          />
          {editing ? <Button label={t('kid.transfer.delete')} variant="danger" icon="app:delete" onPress={confirmDelete} /> : null}
        </>
      }
    >
      <ScreenHeader title={editing ? t('kid.transfer.editTitle') : t('kid.transfer.title', { name: kidName })} onBack={() => router.back()} />
      <AmountEntryDisplay entry={entry} currency={currency} numberingSystem={numberingSystem} accessibilityLabel={t('kid.transfer.amountLabel')} />

      <View className="gap-2">
        <Text weight="semibold" tone="muted" className="text-sm">
          {t('kid.transfer.from')}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {fromChoices.map((jar) => (
            <Chip
              key={jar.id}
              label={`${jar.name} · ${parts(balances[jar.id] ?? 0).amount}`}
              selected={jar.id === fromJarId}
              onPress={() => {
                setFromJarId(jar.id);
                if (jar.id === toJarId) setToJarId(undefined);
              }}
            />
          ))}
        </View>
      </View>
      <View className="gap-2">
        <Text weight="semibold" tone="muted" className="text-sm">
          {t('kid.transfer.to')}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {toChoices
            .filter((jar) => jar.id !== fromJarId)
            .map((jar) => (
              <Chip key={jar.id} label={jar.name} selected={jar.id === toJarId} onPress={() => setToJarId(jar.id)} />
            ))}
        </View>
      </View>
      {tooMuch ? <Notice icon="app:gentle-warning" text={t('kid.transfer.notEnough', { jar: jarName(fromJarId), amount: parts(available).amount })} /> : null}
    </Screen>
  );
}
