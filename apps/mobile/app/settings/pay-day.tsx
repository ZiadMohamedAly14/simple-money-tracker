import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { cancelPendingPayDay, payDayOptions, payDayState, toLocalDate } from '@money-tracker/shared';
import { savePayDayHistory } from '@/data/budget';
import { useAccountSettings, usePayDayHistory } from '@/data/useAccountSettings';
import { localDb, localStore } from '@/db/appDatabase';
import { payDayLabel } from '@/i18n/payDayLabel';
import { changeoverPreview, type PreviewLine } from '@/i18n/payDayPreview';
import { useLanguage } from '@/i18n/useLanguage';
import { useTheme } from '@/theme/ThemeProvider';
import { AppIcon, Button, Card, Notice, PayDayPicker, Screen, ScreenHeader, Text } from '@/ui';
import { showDialog } from '@/ui/dialogStore';

type Changeover = 'startAfterThisMonth' | 'startNow';

/**
 * Changes the Account's Pay Day (spec decisions 6–8, ADR-0009). Before saving,
 * each changeover option previews the current and next Months; "Start after
 * this Month" is preselected and "Start now" shows only when it skips no
 * Month name. Picking the Pay Day the Account is on while a change is pending
 * cancels it; picking it with nothing pending changes nothing, so Save stays
 * disabled. No mockup yet: it reuses the currency screen's layout and Settings'
 * cards.
 */
export default function SettingsPayDayScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { numberingSystem } = useAccountSettings();
  const history = usePayDayHistory();
  const today = toLocalDate(new Date());
  const { payDay: current, pending } = payDayState(history, today);
  // Until the adult picks, show the Pay Day the Account is heading to.
  const [picked, setPicked] = useState<number | null>(null);
  const [changeover, setChangeover] = useState<Changeover>('startAfterThisMonth');
  const payDay = picked ?? pending?.payDay ?? current;
  const text = { t, language, numberingSystem };

  const cancelsPending = pending !== null && payDay === current;
  const unchanged = pending === null && payDay === current;
  const preview = unchanged || cancelsPending ? null : changeoverPreview(history, payDay, today, text);
  // "Start now" may stop being offered when the day changes.
  const chosen: Changeover = changeover === 'startNow' && preview?.startNow ? 'startNow' : 'startAfterThisMonth';

  function save() {
    let next = cancelPendingPayDay(history, today);
    if (!cancelsPending) {
      const options = payDayOptions(history, payDay, today);
      next = chosen === 'startNow' && options.startNow ? options.startNow.history : options.startAfterThisMonth.history;
    }
    if (savePayDayHistory(localStore, localDb, next) === 'not_ready') {
      showDialog(t('settings.settingsNotReady'));
      return;
    }
    router.back();
  }

  return (
    <Screen scroll className="pt-4" footer={<Button label={t('payDay.save')} disabled={unchanged} onPress={save} />}>
      <ScreenHeader title={t('payDay.title')} onBack={() => router.back()} />
      <PayDayPicker value={payDay} onChange={setPicked} numberingSystem={numberingSystem} />

      {cancelsPending ? <Notice text={t('payDay.cancelPending', { to: payDayLabel(pending.payDay, text) })} icon="app:info" /> : null}

      {preview ? (
        <View className="gap-3">
          <Text weight="semibold" accessibilityRole="header">
            {t('payDay.whenTitle')}
          </Text>
          <ChangeoverCard
            title={t('payDay.startAfterThisMonth')}
            lines={preview.startAfterThisMonth}
            selected={chosen === 'startAfterThisMonth'}
            onPress={() => setChangeover('startAfterThisMonth')}
          />
          {preview.startNow ? (
            <ChangeoverCard
              title={t('payDay.startNow')}
              lines={preview.startNow}
              selected={chosen === 'startNow'}
              onPress={() => setChangeover('startNow')}
            />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

/** A changeover option: its name, then each Month it gives with its dates; primary outline and check when chosen. */
function ChangeoverCard({ title, lines, selected, onPress }: { title: string; lines: PreviewLine[]; selected: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const spoken = [title, ...lines.map((line) => `${line.title} ${line.dates}`)].join(t('common.listSeparator'));
  return (
    <Card selected={selected} onPress={onPress} accessibilityLabel={spoken} className="gap-2 p-4">
      <View className="flex-row items-center gap-2">
        <AppIcon name="calendar" size={18} color={theme.colors.muted} />
        <Text weight="semibold" className="flex-1 text-base">
          {title}
        </Text>
        {selected ? <AppIcon name="selected" size={20} color={theme.colors.primary} /> : null}
      </View>
      {lines.map((line) => (
        <View key={line.title} className="flex-row items-center justify-between gap-3">
          <Text className="shrink text-sm">{line.title}</Text>
          <Text tone="muted" className="text-sm">
            {line.dates}
          </Text>
        </View>
      ))}
    </Card>
  );
}
