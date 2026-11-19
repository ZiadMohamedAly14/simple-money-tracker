import type { en } from './locales/en';

/** Typed translation keys: t('health.ok') checks against the English strings. */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}
