import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DEFAULT_NUMBERING_SYSTEM, formatMonth, monthDates, monthOf, setupPayDayHistory, toLocalDate } from '@money-tracker/shared';
import { FALLBACK_CURRENCY, PERSONAL_STEPS } from '@/data/currency';
import { formatDayMonth } from '@/i18n/payDayPreview';
import { useLanguage } from '@/i18n/useLanguage';
import { Button, PayDayPicker, Screen, ScreenHeader, Text } from '@/ui';

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

  const firstMonth = useMemo(() => {
    const formatDate = (localDate: string) => formatDayMonth(localDate, { t, language, numberingSystem: DEFAULT_NUMBERING_SYSTEM });
    const today = toLocalDate(new Date());
    const history = setupPayDayHistory(payDay, today);
    const month = monthOf(today, history);
    const { start, end } = monthDates(month, history);
    return t('onboarding.payDay.firstMonth', {
      month: formatMonth(month, { language, numberingSystem: DEFAULT_NUMBERING_SYSTEM }),
      start: formatDate(start),
      end: formatDate(end),
    });
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
      <PayDayPicker
        value={payDay}
        onChange={setPayDay}
        numberingSystem={DEFAULT_NUMBERING_SYSTEM}
        firstDayLabel={t('onboarding.payDay.notSure')}
        showAdvice={false}
      />
      <Text tone="muted" accessibilityLiveRegion="polite">
        {firstMonth}
      </Text>
    </Screen>
  );
}
