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
 * an Account setting; until Account settings exist (ticket 17) callers pass
 * it or get Western digits.
 */
export function useFormatMoney(numberingSystem: NumberingSystem = DEFAULT_NUMBERING_SYSTEM) {
  const { i18n } = useTranslation();
  const language = i18n.language === 'ar' ? 'ar' : 'en';
  return useCallback(
    (minor: number, currency: CurrencyCode) => formatMoney(minor, { language, currency, numberingSystem }),
    [language, numberingSystem],
  );
}
