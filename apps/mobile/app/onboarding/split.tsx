import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useTranslation } from 'react-i18next';
import { currentMonth, monthFigures, toMinorUnits } from '@money-tracker/shared';
import { monthPlansQuery, setCategoryBudgets } from '@/data/budget';
import { categoryIconFor } from '@/data/categoryIcons';
import { PERSONAL_STEPS } from '@/data/currency';
import { categoriesQuery } from '@/data/transactions';
import { useAccountSettings } from '@/data/useAccountSettings';
import { localDb, localStore } from '@/db/appDatabase';
import { useFormatMoney } from '@/i18n/useFormatMoney';
import { syncEngine } from '@/sync/appSync';
import { Button, Card, IconCircle, Screen, ScreenHeader, Text, TextField } from '@/ui';

/**
 * Step 4 (optional): split Expected Income across Categories (PDF page 5).
 * Onboarding is already complete here, so Skip just goes home with every
 * budget at 0. Unallocated may go negative.
 */
export default function SplitScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ month?: string }>();
  const month = params.month ?? currentMonth(new Date());
  const { currency, numberingSystem } = useAccountSettings();
  const formatMoney = useFormatMoney(numberingSystem);
  const { data: categories } = useLiveQuery(categoriesQuery(localDb));
  const { data: plans } = useLiveQuery(monthPlansQuery(localDb, month));
  const [typed, setTyped] = useState<Record<string, string>>({});

  const iconOf = useMemo(() => categoryIconFor(localStore.accountId()), []);
  const live = categories.filter((c) => c.archivedAt === null);

  const amounts = useMemo(() => {
    const parsed: Record<string, number> = {};
    for (const [categoryId, text] of Object.entries(typed)) {
      const amount = text.trim() ? toMinorUnits(text, currency) : null;
      if (amount !== null) parsed[categoryId] = amount;
    }
    return parsed;
  }, [typed, currency]);

  const { unallocated } = monthFigures({
    month,
    expectedIncome: plans[0]?.expectedIncome ?? 0,
    budgets: Object.values(amounts).map((amount) => ({ month, amount })),
    transactions: [],
  });

  function done() {
    setCategoryBudgets(localStore, month, amounts);
    void syncEngine.sync();
    router.replace('/');
  }

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label={t('onboarding.splitDone')} onPress={done} />
          <Button label={t('onboarding.splitSkip')} variant="secondary" onPress={() => router.replace('/')} />
        </>
      }
    >
      <ScreenHeader title={t('onboarding.splitTitle')} />
      <View className="gap-1">
        <Text tone="muted" className="text-sm">
          {t('onboarding.step', { step: 4, count: PERSONAL_STEPS })}
        </Text>
        <Text tone={unallocated < 0 ? 'negative' : 'muted'}>
          {t('onboarding.splitBody', { amount: formatMoney(unallocated, currency) })}
        </Text>
      </View>
      <View className="gap-2">
        {live.map((category) => {
          const name = category.isOther ? t('categories.other') : category.name;
          const text = typed[category.id] ?? '';
          const invalid = text.trim() !== '' && amounts[category.id] === undefined;
          return (
            <Card key={category.id} className="flex-row items-center gap-3 px-3 py-2">
              <IconCircle icon={iconOf(category)} size="sm" />
              <Text weight="semibold" numberOfLines={1} className="flex-1 text-base">
                {name}
              </Text>
              <TextField
                value={text}
                onChangeText={(next) => setTyped((current) => ({ ...current, [category.id]: next }))}
                placeholder="0"
                keyboardType="decimal-pad"
                accessibilityLabel={name}
                className={`w-28 ${invalid ? 'opacity-60' : ''}`}
              />
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
