import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useTranslation } from 'react-i18next';
import { currentMonth, formatMonth, formatMoneyParts, ltrIsolate } from '@money-tracker/shared';
import { useAuthStatus } from '@/auth/appSession';
import { categoryIconFor } from '@/data/categoryIcons';
import { allCategoriesQuery, shownCategoryOf } from '@/data/categories';
import { monthTransactionListQuery } from '@/data/transactions';
import { useAccountSettings } from '@/data/useAccountSettings';
import { localDb, localStore } from '@/db/appDatabase';
import { useDateLabel } from '@/i18n/useDateLabel';
import { useFormatMoney } from '@/i18n/useFormatMoney';
import { useLanguage } from '@/i18n/useLanguage';
import { syncTriggers } from '@/sync/appSync';
import { useSyncOverdue } from '@/sync/useSyncOverdue';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Fab, joinSpoken, ListRow, PendingSyncLabel, ScreenHeader, Text, type GlyphName } from '@/ui';

/**
 * A Month's Transactions, newest first (PDF pages 7–8), read live from the
 * local database: the Month chosen on home (`month` param), or this one. Tap
 * one to edit or delete it. Adding from here dates it into that Month.
 */
export default function TransactionsScreen() {
  const status = useAuthStatus();
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  return <TransactionList />;
}

function TransactionList() {
  const { t } = useTranslation();
  const theme = useTheme();
  const language = useLanguage();
  const { currency, numberingSystem } = useAccountSettings();
  const formatMoney = useFormatMoney(numberingSystem);
  const dateLabel = useDateLabel(numberingSystem);
  const params = useLocalSearchParams<{ month?: string }>();
  const month = params.month ?? currentMonth(new Date());
  const { data: transactions } = useLiveQuery(monthTransactionListQuery(localDb, month), [month]);
  const { data: categories } = useLiveQuery(allCategoriesQuery(localDb));
  const syncOverdue = useSyncOverdue();
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setSyncing(true);
    await syncTriggers.refresh().catch(() => undefined);
    setSyncing(false);
  }, []);

  // An Expense whose Category is deleted shows as Other.
  const categoryOf = useMemo(() => {
    const iconFor = categoryIconFor(localStore.accountId());
    const shown = shownCategoryOf(categories);
    return (id: string | null): { name: string; icon: GlyphName } => {
      const category = id ? shown(id) : undefined;
      if (!category || category.isOther) return { name: t('categories.other'), icon: 'app:other' };
      return { name: category.name, icon: iconFor(category) };
    };
  }, [categories, t]);

  return (
    <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
      <View className="gap-3 px-5">
        <ScreenHeader
          title={`${t('transactions.title')} · ${formatMonth(month, { language, numberingSystem })}`}
          onBack={() => router.back()}
          end={syncOverdue ? <PendingSyncLabel align="end" /> : undefined}
        />
        <Button
          label={t('transactions.addIncome')}
          variant="secondary"
          icon="app:income-money"
          onPress={() => router.push({ pathname: '/transactions/new', params: { kind: 'income', month } })}
        />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-5 pb-28 pt-4"
        refreshControl={
          <RefreshControl refreshing={syncing} onRefresh={() => void refresh()} colors={[theme.colors.primary]} progressBackgroundColor={theme.colors.surface} />
        }
      >
        {transactions.length === 0 ? (
          <Text tone="muted" align="center" className="pt-8">
            {t('transactions.empty')}
          </Text>
        ) : (
          transactions.map((transaction) => {
            const isIncome = transaction.kind === 'income';
            const category = isIncome ? null : categoryOf(transaction.categoryId);
            // Income has no Category: its note is the title, or "Income" (design flaw 6).
            const title = isIncome ? (transaction.note ?? t('transactions.income')) : category!.name;
            const subtitle = [dateLabel(transaction.date), isIncome ? null : transaction.note].filter(Boolean).join(' · ');
            const signed = isIncome ? transaction.amount : -transaction.amount;
            const amount = formatMoneyParts(signed, { language, currency, numberingSystem }).amount;
            return (
              <ListRow
                key={transaction.id}
                icon={isIncome ? 'app:income-money' : category!.icon}
                title={title}
                subtitle={subtitle}
                onPress={() => router.push({ pathname: '/transactions/[id]', params: { id: transaction.id } })}
                accessibilityLabel={joinSpoken([title, subtitle, formatMoney(signed, currency)], t('common.listSeparator'))}
                end={
                  <Text weight="bold" tone={isIncome ? 'positive' : 'text'} className="text-base">
                    {isIncome ? ltrIsolate(`+${amount}`) : amount}
                  </Text>
                }
              />
            );
          })
        )}
      </ScrollView>
      <Fab
        icon="app:add"
        accessibilityLabel={t('transactions.addExpense')}
        onPress={() => router.push({ pathname: '/transactions/new', params: { month } })}
      />
    </SafeAreaView>
  );
}
