import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  applyKeypadKey,
  currencyMinorDigits,
  formatAmountInput,
  formatMoneyParts,
  toLocalDate,
  toMinorUnits,
  type KeypadKey,
} from '@money-tracker/shared';
import { PLACEHOLDER_CURRENCY } from '@/data/currency';
import { recordExpense } from '@/data/transactions';
import { localStore } from '@/db/appDatabase';
import { useLanguage } from '@/i18n/useLanguage';
import { syncEngine } from '@/sync/appSync';
import { AmountDisplay, Button, Chip, NumericKeypad, Screen, ScreenHeader, Text } from '@/ui';

/**
 * Sync tracer bullet (ticket 05): a bare Expense in the Other Category, dated
 * today. Saved locally first, so it works offline. Choosing a Category, the
 * date and a note is ticket 08.
 */
export default function NewExpenseScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const currency = PLACEHOLDER_CURRENCY;
  const fractionDigits = currencyMinorDigits(currency);
  const [typed, setTyped] = useState('');
  const amount = toMinorUnits(typed, currency);

  function press(key: KeypadKey) {
    setTyped((current) => applyKeypadKey(current, key, { kind: 'amount', fractionDigits }));
  }

  function save() {
    if (!amount) return;
    recordExpense(localStore, { amount, date: toLocalDate(new Date()) });
    void syncEngine.sync(); // ticket 06 replaces this with a debounced trigger
    router.back();
  }

  return (
    <Screen
      footer={
        <>
          <NumericKeypad onKey={press} showDecimal={fractionDigits > 0} />
          <Button label={t('expenses.save')} disabled={!amount} onPress={save} />
        </>
      }
    >
      <ScreenHeader title={t('expenses.add')} onBack={() => router.back()} backIcon="close" />
      <View className="flex-1 justify-center gap-4">
        <AmountDisplay
          amount={formatAmountInput(typed || '0', { language })}
          currency={formatMoneyParts(0, { language, currency }).currency}
          accessibilityLabel={t('expenses.amountLabel')}
        />
        <View className="flex-row justify-center">
          <Chip label={t('categories.other')} selected />
        </View>
        <Text tone="muted" align="center">
          {t('expenses.today')}
        </Text>
      </View>
    </Screen>
  );
}
