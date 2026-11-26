import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { intlLocale, type NumberingSystem } from '@money-tracker/shared';
import { LAST_PAY_DAY, payDayLabel } from '@/i18n/payDayLabel';
import { useLanguage } from '@/i18n/useLanguage';
import { Chip, Notice } from './Card';

export interface PayDayPickerProps {
  /** The chosen Pay Day, 1–31. */
  value: number;
  onChange: (payDay: number) => void;
  numberingSystem?: NumberingSystem;
}

const DAYS = Array.from({ length: LAST_PAY_DAY - 1 }, (_, index) => index + 1);

/**
 * Picks a Pay Day (spec decision 2): the advice to choose the earliest day
 * you usually get paid, chips for days 1–30, and a wide "Last day of the
 * month" chip for 31. Used by Settings and the first-run step.
 */
export function PayDayPicker({ value, onChange, numberingSystem }: PayDayPickerProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  const digits = new Intl.NumberFormat(intlLocale(language, numberingSystem), { useGrouping: false });
  const spoken = (day: number) => payDayLabel(day, { t, language, numberingSystem });
  return (
    <View className="gap-3">
      <Notice text={t('payDay.advice')} icon="app:info" />
      <View accessibilityLabel={t('payDay.title')} className="flex-row flex-wrap gap-2">
        {DAYS.map((day) => (
          <Chip
            key={day}
            label={digits.format(day)}
            accessibilityLabel={spoken(day)}
            selected={day === value}
            onPress={() => onChange(day)}
          />
        ))}
        <Chip label={spoken(LAST_PAY_DAY)} selected={value === LAST_PAY_DAY} onPress={() => onChange(LAST_PAY_DAY)} />
      </View>
    </View>
  );
}
