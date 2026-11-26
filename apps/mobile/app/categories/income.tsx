import { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatMonth, fromMinorUnits } from '@money-tracker/shared';
import { monthPlansQuery, setExpectedIncome } from '@/data/budget';
import { useAccountSettings } from '@/data/useAccountSettings';
import { useMonthParam } from '@/data/useMonthParam';
import { localDb, localStore } from '@/db/appDatabase';
import { useLanguage } from '@/i18n/useLanguage';
import { AmountEntryDisplay, AmountKeypad, Button, Screen, ScreenHeader, Text, useAmountEntry } from '@/ui';

/**
 * Changes a Month's Expected Income (story 35). Unallocated on the Categories
 * and home screens follows, since it is worked out from the plan. The keypad
 * takes sums (`+ − × ÷`); Save stores the result.
 */
export default function EditExpectedIncomeScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { month } = useMonthParam();
  const { currency, numberingSystem } = useAccountSettings();
  const initial = useMemo(() => {
    const current = monthPlansQuery(localDb, month).all()[0]?.expectedIncome ?? 0;
    return current > 0 ? fromMinorUnits(current, currency) : '';
  }, [month, currency]);
  const entry = useAmountEntry(currency, initial);
  // Clearing it means 0; a negative result or an unfinished sum can't be saved.
  const amount = entry.nonNegative;

  function save() {
    if (amount === null) return;
    setExpectedIncome(localStore, month, amount);
    router.back();
  }

  return (
    <Screen
      footer={
        <>
          <AmountKeypad entry={entry} numberingSystem={numberingSystem} />
          <Button label={t('categories.save')} disabled={amount === null} onPress={save} />
        </>
      }
    >
      <ScreenHeader title={t('categories.expectedIncome')} onBack={() => router.back()} />
      <Text tone="muted">{formatMonth(month, { language, numberingSystem })}</Text>
      <View className="flex-1 justify-center">
        <AmountEntryDisplay
          entry={entry}
          currency={currency}
          numberingSystem={numberingSystem}
          accessibilityLabel={t('categories.expectedIncome')}
        />
      </View>
    </Screen>
  );
}
