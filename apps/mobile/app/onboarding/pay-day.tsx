import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_NUMBERING_SYSTEM,
  formatMonth,
  intlLocale,
  monthDates,
  monthOf,
  setupPayDayHistory,
  toLocalDate,
} from '@money-tracker/shared';
import { FALLBACK_CURRENCY, PERSONAL_STEPS } from '@/data/currency';
import { useLanguage } from '@/i18n/useLanguage';
import { Button, Chip, ListRow, Screen, ScreenHeader, Text } from '@/ui';

/** Days 2–30 as chips; 1 ("1st / not sure") and 31 ("Last day of the month") are rows of their own. */
const MIDDLE_DAYS = Array.from({ length: 29 }, (_, i) => i + 2);

/**
 * Step 3 on the personal path: "When do you get paid?" (spec decision 5). No
 * mockup yet, so it reuses the currency step's layout. Optional: the default,
 * 1st / not sure, keeps calendar Months. The chosen Pay Day goes on to the
 * Expected Income step, which saves it with the first Month. Account settings
 * aren't written yet, so digits use the default numbering system.
 */
export default function PayDayScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const currency = useLocalSearchParams<{ currency?: string }>().currency ?? FALLBACK_CURRENCY;
  const [payDay, setPayDay] = useState(1);

  const { day, firstMonth } = useMemo(() => {
    const locale = intlLocale(language, DEFAULT_NUMBERING_SYSTEM);
    const number = new Intl.NumberFormat(locale);
    const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
    const formatDate = (localDate: string) => date.format(new Date(`${localDate}T00:00:00Z`));
    const today = toLocalDate(new Date());
    const history = setupPayDayHistory(payDay, today);
    const month = monthOf(today, history);
    const { start, end } = monthDates(month, history);
    return {
      day: (n: number) => number.format(n),
      firstMonth: t('onboarding.payDay.firstMonth', {
        month: formatMonth(month, { language, numberingSystem: DEFAULT_NUMBERING_SYSTEM }),
        start: formatDate(start),
        end: formatDate(end),
      }),
    };
  }, [language, payDay, t]);

  return (
    <Screen
      scroll
      footer={
        <Button
          label={t('onboarding.next')}
          onPress={() => router.push({ pathname: '/onboarding/income', params: { currency, payDay: String(payDay) } })}
        />
      }
    >
      <ScreenHeader onBack={() => router.back()} />
      <View className="gap-1">
        <Text tone="muted" className="text-sm">
          {t('onboarding.step', { step: 3, count: PERSONAL_STEPS })}
        </Text>
        <Text weight="bold" accessibilityRole="header" className="text-2xl">
          {t('onboarding.payDay.title')}
        </Text>
        <Text tone="muted">{t('onboarding.payDay.body')}</Text>
      </View>
      <View className="gap-3">
        <ListRow
          icon="app:income-money"
          title={t('onboarding.payDay.notSure')}
          selected={payDay === 1}
          onPress={() => setPayDay(1)}
        />
        <Text weight="semibold" className="text-sm">
          {t('onboarding.payDay.otherDay')}
        </Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('onboarding.payDay.otherDay')} className="flex-row flex-wrap gap-2">
          {MIDDLE_DAYS.map((n) => (
            <Chip key={n} label={day(n)} selected={payDay === n} onPress={() => setPayDay(n)} />
          ))}
        </View>
        <ListRow
          icon="app:income-money"
          title={t('onboarding.payDay.lastDay')}
          selected={payDay === 31}
          onPress={() => setPayDay(31)}
        />
      </View>
      <Text tone="muted" accessibilityLiveRegion="polite">
        {firstMonth}
      </Text>
    </Screen>
  );
}
