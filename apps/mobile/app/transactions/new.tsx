import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { monthOf, toLocalDate } from '@money-tracker/shared';
import { recordExpense, recordIncome } from '@/data/transactions';
import { localDb, localStore } from '@/db/appDatabase';
import { TransactionForm } from '@/transactions/TransactionForm';

/**
 * Records an Expense (the + button) or Income (`?kind=income`). Saved to the
 * local database first, so it works offline; it syncs on its own about 2 s later.
 * Opened from a past Month (`month` param), the date starts on that Month's last day.
 */
export default function NewTransactionScreen() {
  const { t } = useTranslation();
  const { kind, month } = useLocalSearchParams<{ kind?: string; month?: string }>();
  const isIncome = kind === 'income';

  return (
    <TransactionForm
      kind={isIncome ? 'income' : 'expense'}
      title={isIncome ? t('transactions.addIncome') : t('transactions.addExpense')}
      defaultDate={defaultDateIn(month)}
      onClose={() => router.back()}
      onSave={({ amount, date, note, categoryId }) => {
        if (isIncome) recordIncome(localStore, localDb, { amount, date, note });
        else recordExpense(localStore, localDb, { amount, date, note, categoryId: categoryId ?? undefined });
        router.back();
      }}
    />
  );
}

/** Today, or the last day of `month` when that is an earlier Month. */
function defaultDateIn(month: string | undefined): string {
  const today = toLocalDate(new Date());
  if (!month || month >= monthOf(today)) return today;
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(lastDay).padStart(2, '0')}`;
}
