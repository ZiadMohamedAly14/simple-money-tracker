import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useTranslation } from 'react-i18next';
import { currentMonth, formatMoneyParts, intlLocale, ltrIsolate, monthDates } from '@money-tracker/shared';
import { useAuthStatus } from '@/auth/appSession';
import { categoryIconFor } from '@/data/categoryIcons';
import { allCategoriesQuery, shownCategoryOf } from '@/data/categories';
import { deleteTransactions, monthTransactionListQuery } from '@/data/transactions';
import { useAccountSettings, usePayDayHistory } from '@/data/useAccountSettings';
import { localDb, localStore } from '@/db/appDatabase';
import { useDateLabel } from '@/i18n/useDateLabel';
import { useFormatMoney } from '@/i18n/useFormatMoney';
import { useLanguage } from '@/i18n/useLanguage';
import { syncTriggers } from '@/sync/appSync';
import { useSyncOverdue } from '@/sync/useSyncOverdue';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Fab, IconButton, joinSpoken, ListRow, PendingSyncLabel, ScreenHeader, showDialog, Text, type GlyphName } from '@/ui';

/**
 * A Month's Transactions, newest first (PDF pages 7–8), read live from the
 * local database: the Month chosen on home (`month` param), or this one. Tap
 * one to edit or delete it. Adding from here dates it into that Month.
 * Long press one (or the Select button) to select several and delete them
 * together; tap rows to tick them, and Close or Back leaves selection.
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
  const history = usePayDayHistory();
  const month = params.month ?? currentMonth(new Date(), history);
  const { start, end } = monthDates(month, history);
  const { data: transactions } = useLiveQuery(monthTransactionListQuery(localDb, { start, end }), [start, end]);
  const { data: categories } = useLiveQuery(allCategoriesQuery(localDb));
  const syncOverdue = useSyncOverdue();
  const [syncing, setSyncing] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  // Only rows still on screen count (another device may delete one meanwhile).
  const selectedIds = useMemo(() => transactions.filter((tx) => picked.has(tx.id)).map((tx) => tx.id), [transactions, picked]);
  const count = (n: number) => new Intl.NumberFormat(intlLocale(language, numberingSystem)).format(n);

  const stopSelecting = useCallback(() => {
    setSelecting(false);
    setPicked(new Set());
  }, []);
  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Android Back leaves selection before leaving the screen.
  useEffect(() => {
    if (!selecting) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      stopSelecting();
      return true;
    });
    return () => sub.remove();
  }, [selecting, stopSelecting]);

  function confirmDelete() {
    if (selectedIds.length === 0) return;
    showDialog(t('transactions.deleteManyTitle'), t('transactions.deleteManyBody', { count: count(selectedIds.length) }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('transactions.delete'),
        style: 'destructive',
        onPress: () => {
          deleteTransactions(localStore, selectedIds);
          stopSelecting();
        },
      },
    ]);
  }

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
        {selecting ? (
          <ScreenHeader
            title={t('transactions.selectedCount', { count: count(selectedIds.length) })}
            backIcon="close"
            onBack={stopSelecting}
            end={
              <Pressable
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setPicked(new Set(transactions.map((tx) => tx.id)))}
                className="active:opacity-60"
              >
                <Text weight="semibold" tone="positive" className="text-base">
                  {t('transactions.selectAll')}
                </Text>
              </Pressable>
            }
          />
        ) : (
          <ScreenHeader
            title={t('transactions.title')}
            centerTitle
            onBack={() => router.back()}
            end={
              transactions.length > 0 ? (
                <IconButton icon="app:selected" accessibilityLabel={t('transactions.select')} onPress={() => setSelecting(true)} />
              ) : undefined
            }
          />
        )}
        {syncOverdue ? <PendingSyncLabel /> : null}
        {selecting ? null : (
          <Button
            label={t('transactions.addIncome')}
            variant="secondary"
            icon="app:income-money"
            onPress={() => router.push({ pathname: '/transactions/new', params: { kind: 'income', month } })}
          />
        )}
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
                selected={selecting ? picked.has(transaction.id) : undefined}
                onPress={() =>
                  selecting ? toggle(transaction.id) : router.push({ pathname: '/transactions/[id]', params: { id: transaction.id } })
                }
                onLongPress={() => {
                  setSelecting(true);
                  toggle(transaction.id);
                }}
                accessibilityHint={selecting ? undefined : t('transactions.selectHint')}
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
      {selecting ? (
        <View className="px-5 pb-4 pt-2">
          <Button
            label={t('transactions.deleteSelected')}
            variant="danger"
            icon="app:delete"
            disabled={selectedIds.length === 0}
            onPress={confirmDelete}
          />
        </View>
      ) : (
        <Fab
          icon="app:add"
          accessibilityLabel={t('transactions.addExpense')}
          onPress={() => router.push({ pathname: '/transactions/new', params: { month } })}
        />
      )}
    </SafeAreaView>
  );
}
