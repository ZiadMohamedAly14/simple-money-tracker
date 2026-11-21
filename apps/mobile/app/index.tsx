import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatMonth, formatMoneyParts, ltrIsolate } from '@money-tracker/shared';
import { useAuthStatus } from '@/auth/appSession';
import { categoryIconFor } from '@/data/categoryIcons';
import { useAccountSettings, useOnboardingState } from '@/data/useAccountSettings';
import { useMonthBudget } from '@/data/useMonthBudget';
import { useMonthSwitcher } from '@/data/useMonthSwitcher';
import { localStore } from '@/db/appDatabase';
import { useFormatMoney } from '@/i18n/useFormatMoney';
import { useLanguage } from '@/i18n/useLanguage';
import { syncTriggers } from '@/sync/appSync';
import { useSyncOverdue } from '@/sync/useSyncOverdue';
import { useTheme } from '@/theme/ThemeProvider';
import { AmountDisplay, Button, Card, Fab, Glyph, IconButton, IconCircle, Notice, PendingSyncLabel, ProgressRow, Text } from '@/ui';
import type { GlyphName } from '@/ui';

/**
 * Home: signed-out devices go to sign-in and new Accounts to onboarding. A
 * device whose session ended keeps showing its data, with a sign-in-again notice.
 */
export default function HomeRoute() {
  const status = useAuthStatus();
  const onboarding = useOnboardingState();
  if (status === 'loading' || onboarding === null) return null;
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  if (onboarding === 'not_started') return <Redirect href="/onboarding" />;
  return <MonthOverview />;
}

/**
 * A Month's Remaining, Income, Spending and Unallocated (PDF pages 1 and 13),
 * and each Category's budget, spent and remaining, all worked out from the
 * local database by `monthFigures` and `categoryBreakdown`. The arrows beside
 * the Month's name go back to earlier Months and forward to the current one;
 * a past Month also lists the Archived Categories it used.
 */
function MonthOverview() {
  const { t } = useTranslation();
  const theme = useTheme();
  const language = useLanguage();
  const needsSignIn = useAuthStatus() === 'needsSignIn';
  const { currency, numberingSystem } = useAccountSettings();
  const formatMoney = useFormatMoney(numberingSystem);
  const { month, canGoBack, canGoForward, goBack, goForward } = useMonthSwitcher();
  const { figures, rows, transactionCount } = useMonthBudget(month);
  const iconOf = useMemo(() => categoryIconFor(localStore.accountId()), []);
  const syncOverdue = useSyncOverdue();
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setSyncing(true);
    await syncTriggers.refresh().catch(() => undefined);
    setSyncing(false);
  }, []);

  const parts = (minor: number) => formatMoneyParts(minor, { language, currency, numberingSystem });
  const number = (minor: number) => parts(minor).amount;
  const remaining = parts(figures.remaining);

  return (
    <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 pb-28 pt-2"
        refreshControl={
          <RefreshControl refreshing={syncing} onRefresh={() => void refresh()} colors={[theme.colors.primary]} />
        }
      >
        <View className="min-h-11 flex-row items-center gap-2">
          <IconButton
            icon="app:chevron-forward"
            reversed
            accessibilityLabel={t('home.previousMonth')}
            disabled={!canGoBack}
            onPress={goBack}
          />
          <Text
            weight="bold"
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            numberOfLines={1}
            adjustsFontSizeToFit
            align="center"
            className="flex-1 text-xl"
          >
            {formatMonth(month, { language, numberingSystem })}
          </Text>
          <IconButton
            icon="app:chevron-forward"
            accessibilityLabel={t('home.nextMonth')}
            disabled={!canGoForward}
            onPress={goForward}
          />
          {syncOverdue ? <PendingSyncLabel align="end" /> : null}
          <IconButton icon="app:settings" accessibilityLabel={t('home.settings')} onPress={() => router.push('/settings')} />
        </View>

        {needsSignIn ? (
          <Card className="gap-3 p-4">
            <Text>{t('session.needsSignInBody')}</Text>
            <Button label={t('session.signInAgain')} onPress={() => router.push('/sign-in')} />
          </Card>
        ) : null}

        <View className="gap-1">
          <Text tone="muted" className="text-sm">
            {t('home.remaining')}
          </Text>
          <AmountDisplay
            amount={remaining.amount}
            currency={remaining.currency}
            size="md"
            align="start"
            accessibilityLabel={`${t('home.remaining')}: ${formatMoney(figures.remaining, currency)}`}
          />
        </View>

        <View className="flex-row gap-3">
          <FigureTile icon="app:income-money" label={t('home.income')} value={number(figures.income)} />
          <FigureTile icon="app:spending" label={t('home.spending')} value={number(figures.spending)} />
          <FigureTile
            icon={figures.unallocated < 0 ? 'app:gentle-warning' : 'app:unallocated'}
            label={t('home.unallocated')}
            value={number(figures.unallocated)}
            warning={figures.unallocated < 0}
          />
        </View>

        <Text tone="muted" className="text-sm">
          {t('home.incomeOfExpected', {
            income: ltrIsolate(number(figures.income)),
            expected: ltrIsolate(number(figures.expectedIncome)),
          })}
        </Text>

        {figures.unallocated < 0 ? (
          <Notice icon="app:gentle-warning" text={t('home.overPlan', { amount: formatMoney(-figures.unallocated, currency) })} />
        ) : null}

        {transactionCount === 0 ? (
          <Card className="items-center gap-3 px-6 py-12">
            <IconCircle icon="app:wallet" size="lg" />
            <Text weight="bold" align="center" className="text-xl">
              {t(canGoForward ? 'home.emptyPastTitle' : 'home.freshTitle')}
            </Text>
            <Text tone="muted" align="center">
              {t(canGoForward ? 'home.emptyPastBody' : 'home.freshBody')}
            </Text>
          </Card>
        ) : null}

        <View className="gap-2">
          <View className="min-h-11 flex-row items-center justify-between gap-2">
            <Text weight="bold" accessibilityRole="header" className="text-lg">
              {t('home.categories')}
            </Text>
            <IconButton icon="app:edit" accessibilityLabel={t('categories.manage')} onPress={() => router.push({ pathname: '/categories', params: { month } })} />
          </View>
          <Card className="gap-4 p-4">
            {rows.map((row) => {
              const over = row.remaining < 0;
              return (
                <ProgressRow
                  key={row.categoryId}
                  icon={iconOf(row.category)}
                  title={row.category.isOther ? t('categories.other') : row.category.name}
                  progress={row.budget > 0 ? row.spent / row.budget : row.spent > 0 ? 1 : 0}
                  barTone={over ? 'negative' : 'primary'}
                  end={t(over ? 'categories.over' : 'categories.left', { amount: number(Math.abs(row.remaining)) })}
                  endTone={over ? 'negative' : 'positive'}
                  caption={ltrIsolate(`${number(row.spent)} / ${number(row.budget)}`)}
                />
              );
            })}
          </Card>
        </View>

        {/* Sync tracer bullet (ticket 05) until the Transactions screen (ticket 08). */}
        <Button label={t('expenses.open')} variant="secondary" onPress={() => router.push('/expenses')} />
        {/* PIN-gated Parent Area (ticket 11); the kid wallet entry point (ticket 12) will lead here. */}
        <Button label={t('parentArea.open')} variant="secondary" icon="app:lock-pin" onPress={() => router.push('/parent')} />
      </ScrollView>
      <Fab accessibilityLabel={t('expenses.add')} onPress={() => router.push('/expenses/new')} />
    </SafeAreaView>
  );
}

interface FigureTileProps {
  icon: GlyphName;
  label: string;
  value: string;
  /** Warning surface: Unallocated below zero. */
  warning?: boolean;
}

function FigureTile({ icon, label, value, warning }: FigureTileProps) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className={`flex-1 gap-1 rounded-theme p-3 ${warning ? 'bg-warning' : 'bg-surface'}`}
    >
      <View className="flex-row items-center gap-1">
        <Glyph name={icon} size={14} color={warning ? theme.colors['on-warning'] : theme.colors.primary} />
        <Text tone={warning ? 'on-warning' : 'muted'} numberOfLines={1} className="flex-1 text-xs">
          {label}
        </Text>
      </View>
      <Text weight="bold" tone={warning ? 'on-warning' : 'text'} numberOfLines={1} adjustsFontSizeToFit className="text-lg">
        {value}
      </Text>
    </View>
  );
}
