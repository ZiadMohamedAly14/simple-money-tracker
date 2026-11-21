import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  applyKeypadKey,
  currencyMinorDigits,
  defaultJarId,
  formatAmountInput,
  formatMoneyParts,
  fromMinorUnits,
  spendableFrom,
  toLocalDate,
  toMinorUnits,
  type KeypadKey,
} from '@money-tracker/shared';
import { addKidExpense, deleteKidExpense, editKidExpense } from '@/data/kidWallet';
import { useAccountSettings } from '@/data/useAccountSettings';
import { localDb, localStore } from '@/db/appDatabase';
import type { KidTransactionRow } from '@/db/schema';
import { useLanguage } from '@/i18n/useLanguage';
import { useKidWallet } from '@/kid/useKidWallet';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AmountDisplay, Button, Chip, Notice, NumericKeypad, Screen, ScreenHeader, Text, TextField } from '@/ui';

/**
 * "I spent money" (PDF page 9): about three taps, open, type the amount and
 * pick a Jar (Spend is picked already), save. The keypad has no operators
 * (spec). An amount the Jar can't cover, or any amount from a Jar below
 * zero, shows a kind notice and Save stays off. With `expenseId` the kid
 * fixes or deletes one of their Kid Expenses.
 */
export default function KidSpendScreen() {
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId?: string }>();
  const { t } = useTranslation();
  const { kid, transactions } = useKidWallet(id);
  const editing = expenseId ? transactions.find((tx) => tx.id === expenseId && tx.kind === 'kidExpense') : undefined;

  let body = null;
  if (kid && expenseId && !editing) {
    body = (
      <Screen>
        <ScreenHeader onBack={() => router.back()} />
        <Text tone="muted" align="center" className="pt-8">
          {t('kid.spend.gone')}
        </Text>
      </Screen>
    );
  } else if (kid) {
    body = <SpendForm key={editing?.id ?? 'new'} kidProfileId={id} editing={editing} />;
  }
  return <ThemeProvider name="kid">{body}</ThemeProvider>;
}

function SpendForm({ kidProfileId, editing }: { kidProfileId: string; editing?: KidTransactionRow }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { currency, numberingSystem } = useAccountSettings();
  const fractionDigits = currencyMinorDigits(currency);
  const { jarRows, wallet } = useKidWallet(kidProfileId);
  const accountId = localStore.accountId() ?? '';

  const choices = jarRows.filter((jar) => jar.archivedAt === null || jar.id === editing?.jarId);
  const spendJar = defaultJarId(accountId, kidProfileId, 'spend');
  const firstChoice = choices.find((jar) => jar.id === spendJar) ?? choices[0];
  const [jarId, setJarId] = useState<string | undefined>(editing?.jarId ?? firstChoice?.id);
  const [typed, setTyped] = useState(editing ? fromMinorUnits(editing.amount, currency) : '');
  const [note, setNote] = useState(editing?.note ?? '');

  const amount = toMinorUnits(typed || '0', currency) ?? 0;
  const balances = Object.fromEntries(wallet.jars.map((jar) => [jar.id, jar.balance]));
  const available = jarId ? spendableFrom(balances, jarId, editing) : 0;
  const jar = jarRows.find((row) => row.id === jarId);
  const belowZero = jarId ? (balances[jarId] ?? 0) < 0 && available === 0 : false;
  const tooMuch = amount > available;
  const parts = (minor: number) => formatMoneyParts(minor, { language, currency, numberingSystem });

  function press(key: KeypadKey) {
    setTyped((current) => applyKeypadKey(current, key, { kind: 'amount', fractionDigits }));
  }

  function save() {
    if (!jarId || amount <= 0 || tooMuch) return;
    const cleanNote = note.trim() || null;
    const result = editing
      ? editKidExpense(localStore, localDb, editing.id, { jarId, amount, note: cleanNote })
      : addKidExpense(localStore, localDb, { kidProfileId, jarId, amount, date: toLocalDate(new Date()), note: cleanNote });
    if (result.status !== 'not_enough') router.back();
  }

  function confirmDelete() {
    if (!editing) return;
    Alert.alert(t('kid.spend.deleteTitle'), t('kid.spend.deleteBody', { jar: jar?.name ?? '' }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('kid.spend.delete'),
        style: 'destructive',
        onPress: () => {
          deleteKidExpense(localStore, localDb, editing.id);
          router.back();
        },
      },
    ]);
  }

  let notice: string | null = null;
  if (belowZero) notice = t('kid.spend.jarBelowZero', { jar: jar?.name ?? '' });
  else if (tooMuch) notice = t('kid.spend.notEnough', { amount: parts(available).amount, jar: jar?.name ?? '' });

  return (
    <Screen
      scroll
      footer={
        <>
          <NumericKeypad onKey={press} showDecimal={fractionDigits > 0} numberingSystem={numberingSystem} />
          <Button label={t('kid.spend.save')} large disabled={!jarId || amount <= 0 || tooMuch} onPress={save} />
          {editing ? <Button label={t('kid.spend.delete')} variant="danger" icon="app:delete" onPress={confirmDelete} /> : null}
        </>
      }
    >
      <ScreenHeader title={editing ? t('kid.spend.editTitle') : t('kid.spend.title')} onBack={() => router.back()} />
      <AmountDisplay
        amount={formatAmountInput(typed || '0', { language, numberingSystem })}
        currency={parts(0).currency}
        accessibilityLabel={t('kid.spend.amountLabel')}
      />
      <View className="flex-row flex-wrap justify-center gap-2">
        {choices.map((choice) => (
          <Chip key={choice.id} label={choice.name} selected={choice.id === jarId} onPress={() => setJarId(choice.id)} />
        ))}
      </View>
      {notice ? <Notice icon="app:gentle-warning" text={notice} /> : null}
      <TextField value={note} onChangeText={setNote} placeholder={t('kid.spend.notePlaceholder')} maxLength={500} />
    </Screen>
  );
}
