import { useLocalSearchParams } from 'expo-router';
import { currentMonth, type Month, type PayDayHistory } from '@money-tracker/shared';
import { usePayDayHistory } from './useAccountSettings';

/**
 * The Month a screen shows: its `month` route param, or the current Month
 * under the Account's Pay Day history. Returns that history too, live, for
 * screens that also need the Month's dates.
 */
export function useMonthParam(): { month: Month; history: PayDayHistory } {
  const params = useLocalSearchParams<{ month?: string }>();
  const history = usePayDayHistory();
  return { month: params.month ?? currentMonth(new Date(), history), history };
}
