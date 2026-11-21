import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useTranslation } from 'react-i18next';
import { formatMoneyParts, intlLocale, toLocalDate } from '@money-tracker/shared';
import { useAuthStatus } from '@/auth/appSession';
import { categoriesQuery, expensesQuery } from '@/data/transactions';
import { useAccountSettings } from '@/data/useAccountSettings';
import { localDb } from '@/db/appDatabase';
import { useFormatMoney } from '@/i18n/useFormatMoney';
import { useLanguage } from '@/i18n/useLanguage';
import { syncTriggers } from '@/sync/appSync';
import { useSyncOverdue } from '@/sync/useSyncOverdue';
import { useTheme } from '@/theme/ThemeProvider';
import { Fab, ListRow, PendingSyncLabel, ScreenHeader, Text } from '@/ui';

/**
 * Sync tracer bullet (ticket 05): the Expenses on this device, read live from
 * the local database. Pull to sync; "Pending sync" shows once changes have
 * waited over a minute. The full Transactions screen is ticket 08.
 */
export default function ExpensesScreen() {
  const status = useAuthStatus();
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  return <ExpenseList />;
}

function ExpenseList() {
  const { t } = useTranslation();
  const theme = useTheme();
  const language = useLanguage();
  const { currency, numberingSystem } = useAccountSettings();
  const formatMoney = useFormatMoney(numberingSystem);
  const { data: expenses } = useLiveQuery(expensesQuery(localDb));
  const { data: categories } = useLiveQuery(categoriesQuery(localDb));
  const syncOverdue = useSyncOverdue();
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setSyncing(true);
    await syncTriggers.refresh().catch(() => undefined);
    setSyncing(false);
  }, []);

  const categoryName = useMemo(() => {
    const names = new Map(categories.map((c) => [c.id, c.isOther ? t('categories.other') : c.name]));
    return (id: string | null) => (id ? (names.get(id) ?? '') : '');
  }, [categories, t]);

  const dateLabel = useMemo(() => {
    const format = new Intl.DateTimeFormat(intlLocale(language), { day: 'numeric', month: 'short', timeZone: 'UTC' });
    const today = toLocalDate(new Date());
    return (date: string) => (date === today ? t('expenses.today') : format.format(new Date(`${date}T00:00:00Z`)));
  }, [language, t]);

  return (
    <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
      <View className="px-5">
        <ScreenHeader
          title={t('expenses.title')}
          onBack={() => router.back()}
          end={syncOverdue ? <PendingSyncLabel align="end" /> : undefined}
        />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-5 pb-28 pt-4"
        refreshControl={
          <RefreshControl refreshing={syncing} onRefresh={() => void refresh()} colors={[theme.colors.primary]} />
        }
      >
        {expenses.length === 0 ? (
          <Text tone="muted" align="center" className="pt-8">
            {t('expenses.empty')}
          </Text>
        ) : (
          expenses.map((expense) => (
            <ListRow
              key={expense.id}
              icon="ellipsis-horizontal"
              title={categoryName(expense.categoryId)}
              subtitle={[dateLabel(expense.date), expense.note].filter(Boolean).join(' · ')}
              end={
                <Text
                  weight="bold"
                  className="text-base"
                  accessibilityLabel={formatMoney(-expense.amount, currency)}
                >
                  {formatMoneyParts(-expense.amount, { language, currency, numberingSystem }).amount}
                </Text>
              }
            />
          ))
        )}
      </ScrollView>
      <Fab accessibilityLabel={t('expenses.add')} onPress={() => router.push('/expenses/new')} />
    </SafeAreaView>
  );
}
