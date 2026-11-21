import { useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatMonth, intlLocale, toLocalDate, type NumberingSystem } from '@money-tracker/shared';
import { useDateLabel } from '@/i18n/useDateLabel';
import { useLanguage } from '@/i18n/useLanguage';
import { useTheme } from '@/theme/ThemeProvider';
import { AppIcon } from './AppIcon';
import { IconButton } from './Button';
import { Text } from './Text';

export interface DateFieldProps {
  /** Local date `YYYY-MM-DD`. */
  value: string;
  onChange: (date: string) => void;
  numberingSystem?: NumberingSystem;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM` moved by `delta` months. */
function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const moved = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}`;
}

/**
 * A Transaction's date: a pill showing "Today" (or the date) that opens a
 * month calendar. Any date can be picked, including in earlier Months. Pure
 * JS, so no native date picker module is needed.
 */
export function DateField({ value, onChange, numberingSystem }: DateFieldProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const dateLabel = useDateLabel(numberingSystem);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('transactions.date')}: ${dateLabel(value)}`}
        accessibilityHint={t('transactions.changeDate')}
        onPress={() => setOpen(true)}
        className="min-h-10 flex-row items-center gap-2 rounded-full bg-tint px-4 active:opacity-80"
      >
        <AppIcon name="calendar" size={18} color={theme.colors.text} />
        <Text weight="semibold" className="text-sm">
          {dateLabel(value)}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-center bg-black/40 px-5" onPress={() => setOpen(false)}>
          {/* Inner Pressable swallows taps so they don't close the sheet. */}
          <Pressable className="rounded-theme bg-surface p-4" onPress={() => undefined}>
            <Calendar
              value={value}
              numberingSystem={numberingSystem}
              onPick={(date) => {
                onChange(date);
                setOpen(false);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Calendar({ value, onPick, numberingSystem }: { value: string; onPick: (date: string) => void; numberingSystem?: NumberingSystem }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [month, setMonth] = useState(value.slice(0, 7));
  const today = toLocalDate(new Date());

  const { weekdays, digit, weeks } = useMemo(() => {
    const locale = intlLocale(language, numberingSystem);
    // Weeks start on Saturday in Arabic-speaking countries, Sunday otherwise.
    const firstDay = language === 'ar' ? 6 : 0;
    const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
    // 2023-01-01 was a Sunday.
    const names = Array.from({ length: 7 }, (_, i) =>
      weekdayFormat.format(new Date(Date.UTC(2023, 0, 1 + ((firstDay + i) % 7)))),
    );
    const [year, monthNumber] = month.split('-').map(Number) as [number, number];
    const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const lead = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() - firstDay + 7) % 7;
    const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
    while (cells.length % 7 !== 0) cells.push(null);
    const rows = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
    const numberFormat = new Intl.NumberFormat(locale, { useGrouping: false });
    return { weekdays: names, digit: (n: number) => numberFormat.format(n), weeks: rows };
  }, [language, numberingSystem, month]);

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        <IconButton icon="app:chevron-forward" reversed accessibilityLabel={t('transactions.previousMonth')} onPress={() => setMonth(shiftMonth(month, -1))} />
        <Text weight="bold" align="center" className="flex-1 text-lg">
          {formatMonth(month, { language, numberingSystem })}
        </Text>
        <IconButton icon="app:chevron-forward" accessibilityLabel={t('transactions.nextMonth')} onPress={() => setMonth(shiftMonth(month, 1))} />
      </View>
      <View className="flex-row">
        {weekdays.map((name, i) => (
          <Text key={i} tone="muted" align="center" className="flex-1 text-xs">
            {name}
          </Text>
        ))}
      </View>
      {weeks.map((week, row) => (
        <View key={row} className="flex-row">
          {week.map((day, col) => {
            if (day === null) return <View key={col} className="h-10 flex-1" />;
            const date = `${month}-${pad(day)}`;
            const selected = date === value;
            return (
              <Pressable
                key={col}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={date}
                onPress={() => onPick(date)}
                className="h-10 flex-1 items-center justify-center"
              >
                <View
                  className={`h-9 w-9 items-center justify-center rounded-full ${
                    selected ? 'bg-primary' : date === today ? 'border border-primary' : ''
                  }`}
                >
                  <Text weight={selected ? 'bold' : 'regular'} tone={selected ? 'on-primary' : 'text'} align="center">
                    {digit(day)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
