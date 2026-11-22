import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fromMinorUnits, monthOf, toLocalDate } from '@money-tracker/shared';
import { useAccountSettings } from '@/data/useAccountSettings';
import { recordExpense, recordIncome } from '@/data/transactions';
import { localDb, localStore } from '@/db/appDatabase';
import { TransactionForm } from '@/transactions/TransactionForm';

/**
 * Records an Expense (the + button) or Income (`?kind=income`). Saved to the
 * local database first, so it works offline; it syncs on its own about 2 s later.
 * Tapping a Category on home passes `categoryId`, so its chip starts selected.
 * Opened from a past Month (`month` param), the date starts on that Month's last day.
 * The hero card's expected-income chip passes `amount` (minor units) and `note`, so Add
 * income opens filled in, ready to confirm or edit.
 */
export default function NewTransactionScreen() {
  const { t } = useTranslation();
  const { kind, month, categoryId, amount, note } = useLocalSearchParams<{
    kind?: string;
    month?: string;
    categoryId?: string;
    amount?: string;
    note?: string;
  }>();
  const { currency } = useAccountSettings();
  const isIncome = kind === 'income';
  const prefilled = Number(amount) > 0 ? Number(amount) : null;

  return (
    <TransactionForm
      // Remount if the currency arrives after the first render, so a filled-in amount is re-read in it.
      key={currency}
      kind={isIncome ? 'income' : 'expense'}
      title={isIncome ? t('transactions.addIncome') : t('transactions.addExpense')}
      defaultDate={defaultDateIn(month)}
      defaultCategoryId={isIncome ? undefined : categoryId}
      initial={
        prefilled === null
          ? undefined
          : { amount: fromMinorUnits(prefilled, currency), date: defaultDateIn(month), note: note ?? null, categoryId: null }
      }
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
