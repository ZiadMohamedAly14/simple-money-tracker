import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatMonth, formatMoneyParts, incomeProgress, ltrIsolate, type MonthFigures } from '@money-tracker/shared';
import { useAuthStatus, useKidModeProfileId } from '@/auth/appSession';
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
import { Button, Card, Fab, Glyph, IconButton, IconCircle, Notice, PendingSyncLabel, ProgressBar, ProgressRow, Text } from '@/ui';
import type { GlyphName } from '@/ui';

/**
 * Home: a Kid-Mode device goes to its kid's wallet, signed-out devices to
 * sign-in and new Accounts to onboarding. A device whose session ended keeps
 * showing its data, with a sign-in-again notice.
 */
export default function HomeRoute() {
  const status = useAuthStatus();
  const kidProfileId = useKidModeProfileId();
  const onboarding = useOnboardingState();
  if (status === 'loading' || onboarding === null) return null;
  if (kidProfileId) return <Redirect href={{ pathname: '/kid/[id]', params: { id: kidProfileId } }} />;
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

  return (
    <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 pb-28 pt-2"
        refreshControl={
          <RefreshControl refreshing={syncing} onRefresh={() => void refresh()} colors={[theme.colors.primary]} progressBackgroundColor={theme.colors.surface} />
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

        <HeroCard figures={figures} number={number} spoken={(minor) => formatMoney(minor, currency)} currencyLabel={parts(0).currency} />

        <UnallocatedRow
          value={number(figures.unallocated)}
          spoken={formatMoney(figures.unallocated, currency)}
          warning={figures.unallocated < 0}
        />

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
              const name = row.category.isOther ? t('categories.other') : row.category.name;
              // Tapping a Category opens Add expense with that Category picked (the + button is the other way in).
              return (
                <Pressable
                  key={row.categoryId}
                  accessibilityRole="button"
                  accessibilityLabel={t('home.addExpenseTo', { name })}
                  onPress={() => router.push({ pathname: '/transactions/new', params: { month, categoryId: row.categoryId } })}
                  className="active:opacity-60"
                >
                  <ProgressRow
                    icon={iconOf(row.category)}
                    title={name}
                    progress={row.budget > 0 ? row.spent / row.budget : row.spent > 0 ? 1 : 0}
                    barTone={over ? 'negative' : 'primary'}
                    end={t(over ? 'categories.over' : 'categories.left', { amount: number(Math.abs(row.remaining)) })}
                    endTone={over ? 'negative' : 'positive'}
                    caption={ltrIsolate(`${number(row.spent)} / ${number(row.budget)}`)}
                  />
                </Pressable>
              );
            })}
          </Card>
        </View>

        <View className="flex-row gap-3">
          <Button
            label={t('transactions.addIncome')}
            variant="secondary"
            icon="app:income-money"
            className="flex-1"
            onPress={() => router.push({ pathname: '/transactions/new', params: { kind: 'income', month } })}
          />
          <Button label={t('transactions.open')} variant="secondary" icon="app:reorder-history" className="flex-1" onPress={() => router.push({ pathname: '/transactions', params: { month } })} />
        </View>
        {/* PIN-gated Parent Area (ticket 11); the kid wallet entry point (ticket 12) will lead here. */}
        <Button label={t('parentArea.open')} variant="secondary" icon="app:lock-pin" onPress={() => router.push('/parent')} />
      </ScrollView>
      <Fab
        icon="app:add"
        accessibilityLabel={t('transactions.addExpense')}
        onPress={() => router.push({ pathname: '/transactions/new', params: { month } })}
      />
    </SafeAreaView>
  );
}

interface HeroCardProps {
  figures: MonthFigures;
  /** A stored amount as the number only ("1,870.00"), in the Account's numbering system. */
  number: (minor: number) => string;
  /** A stored amount with its currency, for screen readers ("1,870.00 EGP"). */
  spoken: (minor: number) => string;
  /** The Account currency as the language shows it ("EGP"). */
  currencyLabel: string;
}

/**
 * The home "Hero card" (docs/design/mockups/home-hero-card.png): Remaining
 * (Expected Income − Spending) large on the primary green, the income
 * progress bar with "X of Y expected" (recorded Income against the plan),
 * and Income and Spending in translucent tiles. Numbers sit in
 * direction isolates so a minus sign stays at the start of the number in RTL.
 */
function HeroCard({ figures, number, spoken, currencyLabel }: HeroCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const progress = incomeProgress(figures);
  return (
    <View className="gap-4 rounded-theme bg-primary p-5">
      <View
        accessible
        accessibilityLabel={t('home.figure', { label: t('home.remaining'), amount: spoken(figures.remaining) })}
        className="gap-1"
      >
        <View className="flex-row items-center gap-2">
          <Glyph name="app:wallet" size={16} color={theme.colors['on-primary']} />
          <Text tone="on-primary" className="text-sm">
            {t('home.remaining')}
          </Text>
        </View>
        <View className="flex-row items-baseline gap-2">
          <Text weight="bold" tone="on-primary" numberOfLines={1} adjustsFontSizeToFit className="shrink text-5xl">
            {ltrIsolate(number(figures.remaining))}
          </Text>
          <Text weight="semibold" tone="on-primary" className="text-base">
            {currencyLabel}
          </Text>
        </View>
      </View>

      {progress === null ? (
        <Text tone="on-primary" className="text-sm opacity-80">
          {t('home.noExpectedIncome')}
        </Text>
      ) : (
        <View className="gap-2">
          <ProgressBar progress={progress} onPrimary />
          <Text tone="on-primary" className="text-sm opacity-80">
            {t('home.incomeOfExpected', {
              income: ltrIsolate(number(figures.income)),
              expected: ltrIsolate(number(figures.expectedIncome)),
            })}
          </Text>
        </View>
      )}

      <View className="flex-row gap-3">
        <HeroTile icon="app:income-money" label={t('home.income')} value={number(figures.income)} spoken={spoken(figures.income)} />
        <HeroTile icon="app:spending" label={t('home.spending')} value={number(figures.spending)} spoken={spoken(figures.spending)} />
      </View>
    </View>
  );
}

interface HeroTileProps {
  icon: GlyphName;
  label: string;
  value: string;
  spoken: string;
}

/** A translucent figure tile inside the hero card. */
function HeroTile({ icon, label, value, spoken }: HeroTileProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View accessible accessibilityLabel={t('home.figure', { label, amount: spoken })} className="flex-1 gap-1 rounded-theme bg-on-primary/15 p-3">
      <View className="flex-row items-center gap-1">
        <Glyph name={icon} size={14} color={theme.colors['on-primary']} />
        <Text tone="on-primary" numberOfLines={1} className="flex-1 text-xs">
          {label}
        </Text>
      </View>
      <Text weight="bold" tone="on-primary" numberOfLines={1} adjustsFontSizeToFit className="text-lg">
        {ltrIsolate(value)}
      </Text>
    </View>
  );
}

interface UnallocatedRowProps {
  value: string;
  spoken: string;
  /** Unallocated below zero: warning surface and the gentle-warning icon. */
  warning: boolean;
}

/** The white Unallocated row under the hero card, amount at the end. */
function UnallocatedRow({ value, spoken, warning }: UnallocatedRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={t('home.figure', { label: t('home.unallocated'), amount: spoken })}
      className={`min-h-14 flex-row items-center gap-3 rounded-theme px-4 py-3 ${warning ? 'bg-warning' : 'bg-surface'}`}
    >
      <Glyph
        name={warning ? 'app:gentle-warning' : 'app:pie-chart'}
        size={18}
        color={warning ? theme.colors['on-warning'] : theme.colors.primary}
      />
      <Text tone={warning ? 'on-warning' : 'text'} numberOfLines={1} className="flex-1 text-base">
        {t('home.unallocated')}
      </Text>
      <Text weight="bold" tone={warning ? 'on-warning' : 'text'} numberOfLines={1} className="text-lg">
        {ltrIsolate(value)}
      </Text>
    </View>
  );
}
