import { router, useLocalSearchParams } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useTranslation } from 'react-i18next';
import { fromMinorUnits } from '@money-tracker/shared';
import { deleteTransaction, editExpense, editIncome, transactionQuery } from '@/data/transactions';
import { useAccountSettings } from '@/data/useAccountSettings';
import { localDb, localStore } from '@/db/appDatabase';
import { TransactionForm } from '@/transactions/TransactionForm';
import { Button, Screen, ScreenHeader, Text } from '@/ui';
import { showDialog } from '@/ui/dialogStore';

/**
 * Edits or deletes any Income or Expense. Delete is a button here, not only a
 * gesture (design flaw 11). If another device deleted it, says so.
 */
export default function EditTransactionScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currency } = useAccountSettings();
  const { data, updatedAt } = useLiveQuery(transactionQuery(localDb, id), [id]);
  const transaction = data[0];

  if (!updatedAt) return null;
  if (!transaction) {
    return (
      <Screen footer={<Button label={t('common.back')} onPress={() => router.back()} />}>
        <ScreenHeader onBack={() => router.back()} backIcon="close" />
        <Text tone="muted" align="center" className="pt-8">
          {t('transactions.gone')}
        </Text>
      </Screen>
    );
  }

  const isIncome = transaction.kind === 'income';

  function confirmDelete() {
    showDialog(t('transactions.deleteTitle'), t('transactions.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('transactions.delete'),
        style: 'destructive',
        onPress: () => {
          deleteTransaction(localStore, id);
          router.back();
        },
      },
    ]);
  }

  return (
    <TransactionForm
      // Remount if the currency arrives after the first render, so the amount is re-read in it.
      key={currency}
      kind={transaction.kind}
      title={isIncome ? t('transactions.editIncome') : t('transactions.editExpense')}
      initial={{
        amount: fromMinorUnits(transaction.amount, currency),
        date: transaction.date,
        note: transaction.note,
        categoryId: transaction.categoryId,
      }}
      onClose={() => router.back()}
      onDelete={confirmDelete}
      onSave={({ amount, date, note, categoryId }) => {
        if (isIncome) editIncome(localStore, localDb, id, { amount, date, note });
        else editExpense(localStore, localDb, id, { amount, date, note, categoryId: categoryId ?? undefined });
        router.back();
      }}
    />
  );
}
