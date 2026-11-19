/** English strings. The source of truth for keys; ar.ts must match its shape. */
export const en = {
  common: {
    appName: 'Money Tracker',
    ok: 'OK',
    cancel: 'Cancel',
  },
  health: {
    title: 'Connection',
    ok: 'API: ok',
    error: 'API: {{message}}',
    unexpected: 'API: unexpected response',
    unreachable: 'API: unreachable',
    sampleAmount: 'Sample amount',
    details: 'Details',
  },
  language: {
    label: 'Language',
    en: 'English',
    ar: 'العربية',
    restartTitle: 'The app will restart',
    restartBody: 'The app needs to restart to switch the layout direction.',
    restart: 'Restart',
  },
};

/** Same keys as English, with every value a string. */
type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };
export type Translations = Shape<typeof en>;
