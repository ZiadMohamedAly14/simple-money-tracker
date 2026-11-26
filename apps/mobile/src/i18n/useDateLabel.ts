import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { dateLocale, toLocalDate, type NumberingSystem } from '@money-tracker/shared';
import { useLanguage } from './useLanguage';

/**
 * A Transaction's local date (`YYYY-MM-DD`) for display: "Today",
 * "Yesterday", "5 Mar", or "5 Mar 2025" outside the current year. Formatted
 * in UTC so the device's zone never shifts the date.
 */
export function useDateLabel(numberingSystem?: NumberingSystem) {
  const { t } = useTranslation();
  const language = useLanguage();
  return useMemo(() => {
    const locale = dateLocale(language, numberingSystem);
    const short = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
    const long = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const now = new Date();
    const today = toLocalDate(now);
    const yesterday = toLocalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    return (date: string): string => {
      if (date === today) return t('transactions.today');
      if (date === yesterday) return t('transactions.yesterday');
      const moment = new Date(`${date}T00:00:00Z`);
      return (date.slice(0, 4) === today.slice(0, 4) ? short : long).format(moment);
    };
  }, [language, numberingSystem, t]);
}
