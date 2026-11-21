import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_NUMBERING_SYSTEM,
  formatMoney,
  type CurrencyCode,
  type NumberingSystem,
} from '@money-tracker/shared';

/**
 * Formats stored amounts for the device language. The numbering system is
 * an Account setting: callers pass `useAccountSettings().numberingSystem`
 * (Western digits otherwise).
 */
export function useFormatMoney(numberingSystem: NumberingSystem = DEFAULT_NUMBERING_SYSTEM) {
  const { i18n } = useTranslation();
  const language = i18n.language === 'ar' ? 'ar' : 'en';
  return useCallback(
    (minor: number, currency: CurrencyCode) => formatMoney(minor, { language, currency, numberingSystem }),
    [language, numberingSystem],
  );
}
