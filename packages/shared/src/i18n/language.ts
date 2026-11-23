/** App languages. Language is per device and never synced. */
export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';

function isLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * The app language for a device: the first of the phone's preferred
 * languages (BCP 47 tags, most preferred first) that the app supports.
 */
export function resolveLanguage(deviceLanguages: readonly string[]): Language {
  for (const tag of deviceLanguages) {
    const base = tag.split('-')[0]?.toLowerCase() ?? '';
    if (isLanguage(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

export function isRtl(language: Language): boolean {
  return language === 'ar';
}

/** Whether switching languages flips the layout direction (the app must restart). */
export function directionChanges(from: Language, to: Language): boolean {
  return isRtl(from) !== isRtl(to);
}

/**
 * Digit style for numbers. An Account setting; Western by default. It only
 * applies in Arabic: English always shows Western digits.
 */
export type NumberingSystem = 'western' | 'arabic-indic';
export const DEFAULT_NUMBERING_SYSTEM: NumberingSystem = 'western';

/** Unicode locale extension value (`-u-nu-…`) for a numbering system. */
const NU: Record<NumberingSystem, string> = { western: 'latn', 'arabic-indic': 'arab' };

/** BCP 47 tag for Intl formatting, e.g. "ar-u-nu-arab". English always gets Western digits. */
export function intlLocale(language: Language, numberingSystem: NumberingSystem = DEFAULT_NUMBERING_SYSTEM): string {
  const shown = language === 'ar' ? numberingSystem : 'western';
  return `${language}-u-nu-${NU[shown]}`;
}
