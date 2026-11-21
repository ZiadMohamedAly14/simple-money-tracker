import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { recordExpense, recordIncome } from '@/data/transactions';
import { localStore } from '@/db/appDatabase';
import { TransactionForm } from '@/transactions/TransactionForm';

/**
 * Records an Expense (the + button) or Income (`?kind=income`). Saved to the
 * local database first, so it works offline; it syncs on its own about 2 s later.
 */
export default function NewTransactionScreen() {
  const { t } = useTranslation();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const isIncome = kind === 'income';

  return (
    <TransactionForm
      kind={isIncome ? 'income' : 'expense'}
      title={isIncome ? t('transactions.addIncome') : t('transactions.addExpense')}
      onClose={() => router.back()}
      onSave={({ amount, date, note, categoryId }) => {
        if (isIncome) recordIncome(localStore, { amount, date, note });
        else recordExpense(localStore, { amount, date, note, categoryId: categoryId ?? undefined });
        router.back();
      }}
    />
  );
}
