import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useTranslation } from 'react-i18next';
import {
  applyKeypadKey,
  currencyMinorDigits,
  currentMonth,
  evaluateNonNegativeAmount,
  monthFigures,
  type KeypadKey,
} from '@money-tracker/shared';
import { monthPlansQuery, setCategoryBudgets } from '@/data/budget';
import { categoryIconFor } from '@/data/categoryIcons';
import { PERSONAL_STEPS } from '@/data/currency';
import { categoriesQuery } from '@/data/transactions';
import { useAccountSettings, usePayDayHistory } from '@/data/useAccountSettings';
import { localDb, localStore } from '@/db/appDatabase';
import { useFormatMoney } from '@/i18n/useFormatMoney';
import { AmountKeypad, Button, Card, IconCircle, Screen, ScreenHeader, Text, useTypedAmountText } from '@/ui';
import { Caret } from '@/ui/Caret';

/**
 * Step 4 (optional): split Expected Income across Categories (PDF page 5).
 * Tap a Category, then type its budget on the keypad, which takes sums
 * (`+ − × ÷`). Onboarding is already complete here, so Skip just goes home
 * with every budget at 0. Unallocated may go negative.
 */
export default function SplitScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ month?: string }>();
  const history = usePayDayHistory();
  const month = params.month ?? currentMonth(new Date(), history);
  const { currency, numberingSystem } = useAccountSettings();
  const formatMoney = useFormatMoney(numberingSystem);
  const typedText = useTypedAmountText(numberingSystem);
  const fractionDigits = currencyMinorDigits(currency);
  const { data: categories } = useLiveQuery(categoriesQuery(localDb));
  const { data: plans } = useLiveQuery(monthPlansQuery(localDb, month));
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [target, setTarget] = useState<string | null>(null);

  const iconOf = useMemo(() => categoryIconFor(localStore.accountId()), []);
  const live = categories.filter((c) => c.archivedAt === null);
  const selected = target ?? live[0]?.id ?? null;

  // Each Category's budget: the result of its sum. Null while a sum is unfinished or negative.
  const results = useMemo(
    () => Object.fromEntries(Object.entries(typed).map(([id, text]) => [id, evaluateNonNegativeAmount(text, currency)])),
    [typed, currency],
  );
  const amounts = Object.fromEntries(
    Object.entries(results).filter((entry): entry is [string, number] => entry[1] !== null && typed[entry[0]] !== ''),
  );
  const allValid = Object.values(results).every((amount) => amount !== null);

  const { unallocated } = monthFigures({
    month,
    history,
    expectedIncome: plans[0]?.expectedIncome ?? 0,
    budgets: Object.values(amounts).map((amount) => ({ month, amount })),
    transactions: [],
  });

  function press(key: KeypadKey) {
    if (!selected) return;
    setTyped((current) => ({
      ...current,
      [selected]: applyKeypadKey(current[selected] ?? '', key, { kind: 'expression', fractionDigits }),
    }));
  }

  function done() {
    if (!allValid) return;
    setCategoryBudgets(localStore, month, amounts);
    router.replace('/');
  }

  return (
    <Screen
      scroll
      footer={
        <>
          <AmountKeypad entry={{ press, showDecimal: fractionDigits > 0 }} numberingSystem={numberingSystem} />
          <Button label={t('onboarding.splitDone')} disabled={!allValid} onPress={done} />
          <Button label={t('onboarding.splitSkip')} variant="secondary" onPress={() => router.replace('/')} />
        </>
      }
    >
      <ScreenHeader title={t('onboarding.splitTitle')} />
      <View className="gap-1">
        <Text tone="muted" className="text-sm">
          {t('onboarding.step', { step: 5, count: PERSONAL_STEPS })}
        </Text>
        <Text tone={unallocated < 0 ? 'negative' : 'muted'}>
          {t('onboarding.splitBody', { amount: formatMoney(unallocated, currency) })}
        </Text>
      </View>
      <View className="gap-2">
        {live.map((category) => {
          const name = category.isOther ? t('categories.other') : category.name;
          const text = typed[category.id] ?? '';
          const invalid = results[category.id] === null;
          return (
            <Card
              key={category.id}
              selected={category.id === selected}
              onPress={() => setTarget(category.id)}
              accessibilityLabel={t('home.figure', { label: name, amount: typedText(text) })}
              className="flex-row items-center gap-3 px-3 py-3"
            >
              <IconCircle icon={iconOf(category)} size="sm" />
              <Text weight="semibold" numberOfLines={1} className="flex-1 text-base">
                {name}
              </Text>
              <View style={{ flexDirection: 'row', direction: 'ltr' }} className="max-w-40">
                <Text weight="bold" tone={invalid ? 'negative' : text ? 'text' : 'muted'} numberOfLines={1} className="shrink text-base">
                  {typedText(text)}
                </Text>
                {category.id === selected ? <Caret size="sm" /> : null}
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
