import { useTranslation } from 'react-i18next';
import type { Language } from '@money-tracker/shared';

/** The device language; re-renders when it changes. */
export function useLanguage(): Language {
  const { i18n } = useTranslation();
  return i18n.language === 'ar' ? 'ar' : 'en';
}
