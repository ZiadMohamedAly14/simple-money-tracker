import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { categoryStatus, formatMonth, formatMoneyParts, ltrIsolate, expectedIncomeGap, type MonthFigures } from '@money-tracker/shared';
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
import { Button, Card, Fab, Glyph, IconButton, IconCircle, joinSpoken, Notice, PendingSyncLabel, ProgressRow, Text } from '@/ui';
import type { GlyphName } from '@/ui';
import { showDialog } from '@/ui/dialogStore';

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
        {/* Above the Month row, in the scrolling content, so it scrolls away with the page. */}
        {syncOverdue ? <PendingSyncLabel /> : null}
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
          <IconButton icon="app:settings" accessibilityLabel={t('home.settings')} onPress={() => router.push('/settings')} />
        </View>

        {needsSignIn ? (
          <Card className="gap-3 p-4">
            <Text>{t('session.needsSignInBody')}</Text>
            <Button label={t('session.signInAgain')} onPress={() => router.push('/sign-in')} />
          </Card>
        ) : null}

        <HeroCard
          figures={figures}
          number={number}
          spoken={(minor) => formatMoney(minor, currency)}
          currencyLabel={parts(0).currency}
          onRecordExpectedIncome={(amount) => router.push({ pathname: '/transactions/new', params: { kind: 'income', month, amount: String(amount), note: t('home.salaryNote') } })}
        />

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
              const kind = categoryStatus({ isOther: row.category.isOther, budget: row.budget, spent: row.spent }, figures.unallocated);
              const over = kind === 'over';
              const covered = kind === 'covered';
              const name = row.category.isOther ? t('categories.other') : row.category.name;
              // A Covered Other reads what it spent, in muted text with no bar (GLOSSARY, Category).
              const status = covered
                ? t('categories.covered', { amount: number(row.spent) })
                : t(over ? 'categories.over' : 'categories.left', { amount: number(Math.abs(row.remaining)) });
              // Tapping a Category opens Add expense with that Category picked (the + button is the other way in).
              // The row reads its figures; what a tap does is the hint.
              return (
                <Pressable
                  key={row.categoryId}
                  accessibilityRole="button"
                  accessibilityLabel={joinSpoken(
                    covered ? [name, status] : [name, status, t('home.spentOfBudget', { spent: number(row.spent), budget: number(row.budget) })],
                    t('common.listSeparator'),
                  )}
                  accessibilityHint={t('home.addExpenseTo', { name })}
                  onPress={() => router.push({ pathname: '/transactions/new', params: { month, categoryId: row.categoryId } })}
                  className="active:opacity-60"
                >
                  <ProgressRow
                    icon={iconOf(row.category)}
                    title={name}
                    progress={covered ? undefined : row.budget > 0 ? row.spent / row.budget : row.spent > 0 ? 1 : 0}
                    barTone={over ? 'negative' : 'primary'}
                    end={status}
                    endTone={over ? 'negative' : covered ? 'muted' : 'positive'}
                    caption={covered ? undefined : ltrIsolate(`${number(row.spent)} / ${number(row.budget)}`)}
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
  /** Opens Add income with the Expected Income still to be recorded (minor units). */
  onRecordExpectedIncome: (amount: number) => void;
}

/**
 * The home "Hero card": Spent large on the primary green with the currency,
 * then a divider and two figure columns, Income and Remaining (the larger of
 * Expected Income and Income, minus Spending), split by a thin rule. Numbers
 * sit in direction isolates so a minus sign stays at the start of the number
 * in RTL. While Income is below Expected Income, a chip under Income offers
 * to record the rest, noted as a salary.
 */
function HeroCard({ figures, number, spoken, currencyLabel, onRecordExpectedIncome }: HeroCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const onPrimary = theme.colors['on-primary'];
  const gap = expectedIncomeGap(figures);
  return (
    <View className="gap-4 rounded-theme bg-primary p-5">
      <View className="flex-row items-start gap-2">
        <View
          accessible
          accessibilityLabel={t('home.figure', { label: t('home.spent'), amount: spoken(figures.spending) })}
          className="flex-1 gap-1"
        >
          <View className="flex-row items-center gap-2">
            <Glyph name="app:spending" size={16} color={onPrimary} />
            <Text tone="on-primary" className="text-sm">
              {t('home.spent')}
            </Text>
          </View>
          <View className="flex-row items-baseline gap-2">
            <Text weight="bold" tone="on-primary" numberOfLines={1} adjustsFontSizeToFit className="shrink text-5xl">
              {ltrIsolate(number(figures.spending))}
            </Text>
            <Text weight="semibold" tone="on-primary" className="text-base">
              {currencyLabel}
            </Text>
          </View>
        </View>
        <InfoButton label={t('home.spent')} info={t('home.spentInfo')} color={onPrimary} />
      </View>

      <View className="h-px bg-on-primary/25" />

      <View className="flex-row">
        <HeroFigure
          icon="app:income-money"
          label={t('home.income')}
          info={t('home.incomeInfo')}
          value={number(figures.income)}
          spoken={spoken(figures.income)}
        >
          {gap === null ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.recordExpectedIncome', { amount: spoken(gap) })}
              accessibilityHint={t('home.recordExpectedIncomeHint')}
              onPress={() => onRecordExpectedIncome(gap)}
              className="min-h-11 justify-center active:opacity-60"
            >
              <View className="flex-row items-center gap-1 self-start rounded-full bg-on-primary/15 px-3 py-1">
                <Glyph name="app:add" size={12} color={onPrimary} />
                <Text weight="semibold" tone="on-primary" numberOfLines={1} className="shrink text-xs">
                  {t('home.recordExpectedIncome', { amount: ltrIsolate(number(gap)) })}
                </Text>
              </View>
            </Pressable>
          )}
        </HeroFigure>
        <View className="mx-4 w-px bg-on-primary/25" />
        <HeroFigure
          icon="app:wallet"
          label={t('home.remaining')}
          info={t('home.remainingInfo')}
          value={number(figures.remaining)}
          spoken={spoken(figures.remaining)}
        />
      </View>
    </View>
  );
}

interface HeroFigureProps {
  icon: GlyphName;
  label: string;
  /** What the figure means, shown from the info button. */
  info: string;
  value: string;
  spoken: string;
  /** Shown under the figure (the record chip under Income). */
  children?: ReactNode;
}

/**
 * One figure column under the hero card's divider. The info button and any
 * child (the record chip) sit outside the grouped figure, so a screen reader
 * reaches each.
 */
function HeroFigure({ icon, label, info, value, spoken, children }: HeroFigureProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View className="flex-1">
      <View className="flex-row items-start gap-1">
        <View accessible accessibilityLabel={t('home.figure', { label, amount: spoken })} className="flex-1 gap-1">
          <View className="flex-row items-center gap-1">
            <Glyph name={icon} size={14} color={theme.colors['on-primary']} />
            <Text tone="on-primary" numberOfLines={1} className="shrink text-xs opacity-90">
              {label}
            </Text>
          </View>
          <Text weight="bold" tone="on-primary" numberOfLines={1} adjustsFontSizeToFit className="text-lg">
            {ltrIsolate(value)}
          </Text>
        </View>
        <InfoButton label={label} info={info} color={theme.colors['on-primary']} />
      </View>
      {children}
    </View>
  );
}

interface InfoButtonProps {
  /** The figure's name: the dialog title and part of the button's spoken label. */
  label: string;
  info: string;
  color: string;
}

/** A small info icon that explains a home figure in a dialog. */
function InfoButton({ label, info, color }: InfoButtonProps) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('home.aboutFigure', { label })}
      // A 16 icon; the slop makes the touch target 44.
      hitSlop={14}
      onPress={() => showDialog(label, info, [{ text: t('common.ok') }])}
      className="active:opacity-60"
    >
      <Glyph name="app:info" size={16} color={color} />
    </Pressable>
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
  const tone = warning ? theme.colors['on-warning'] : theme.colors.muted;
  return (
    <View className={`min-h-14 flex-row items-center gap-3 rounded-theme px-4 py-3 ${warning ? 'bg-warning' : 'bg-surface'}`}>
      <View
        accessible
        accessibilityLabel={t('home.figure', { label: t('home.unallocated'), amount: spoken })}
        className="flex-1 flex-row items-center gap-3"
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
      <InfoButton label={t('home.unallocated')} info={t('home.unallocatedInfo')} color={tone} />
    </View>
  );
}
