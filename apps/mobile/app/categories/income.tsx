import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  applyKeypadKey,
  currencyMinorDigits,
  currentMonth,
  formatAmountInput,
  formatMoneyParts,
  formatMonth,
  fromMinorUnits,
  toMinorUnits,
  type KeypadKey,
} from '@money-tracker/shared';
import { monthPlansQuery, setExpectedIncome } from '@/data/budget';
import { useAccountSettings } from '@/data/useAccountSettings';
import { localDb, localStore } from '@/db/appDatabase';
import { useLanguage } from '@/i18n/useLanguage';
import { AmountDisplay, Button, NumericKeypad, Screen, ScreenHeader, Text } from '@/ui';

/**
 * Changes a Month's Expected Income (story 35). Unallocated on the Categories
 * and home screens follows, since it is worked out from the plan.
 */
export default function EditExpectedIncomeScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const params = useLocalSearchParams<{ month?: string }>();
  const month = params.month ?? currentMonth(new Date());
  const { currency, numberingSystem } = useAccountSettings();
  const fractionDigits = currencyMinorDigits(currency);
  const [typed, setTyped] = useState(() => {
    const current = monthPlansQuery(localDb, month).all()[0]?.expectedIncome ?? 0;
    return current > 0 ? fromMinorUnits(current, currency) : '';
  });
  const amount = typed ? toMinorUnits(typed, currency) : 0;

  function press(key: KeypadKey) {
    setTyped((current) => applyKeypadKey(current, key, { kind: 'amount', fractionDigits }));
  }

  function save() {
    if (amount === null) return;
    setExpectedIncome(localStore, month, amount);
    router.back();
  }

  return (
    <Screen
      footer={
        <>
          <NumericKeypad onKey={press} showDecimal={fractionDigits > 0} />
          <Button label={t('categories.save')} disabled={amount === null} onPress={save} />
        </>
      }
    >
      <ScreenHeader title={t('categories.expectedIncome')} onBack={() => router.back()} />
      <Text tone="muted">{formatMonth(month, { language, numberingSystem })}</Text>
      <View className="flex-1 justify-center">
        <AmountDisplay
          amount={formatAmountInput(typed || '0', { language, numberingSystem })}
          currency={formatMoneyParts(0, { language, currency }).currency}
          accessibilityLabel={t('categories.expectedIncome')}
        />
      </View>
    </Screen>
  );
}
