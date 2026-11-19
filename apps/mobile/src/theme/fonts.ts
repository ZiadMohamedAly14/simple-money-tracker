import type { Language } from '@money-tracker/shared';

/**
 * Mizan type: Inter for English, Alexandria for Arabic, picked by the device
 * language. Custom fonts on Android ignore `fontWeight`, so each weight is its
 * own family; components set `fontFamily` and never use `font-bold` etc.
 * The font files are loaded in app/_layout.tsx (see fontAssets.ts).
 */
export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';

const SUFFIX: Record<FontWeight, string> = {
  regular: '400Regular',
  medium: '500Medium',
  semibold: '600SemiBold',
  bold: '700Bold',
};

const FAMILY: Record<Language, string> = { en: 'Inter', ar: 'Alexandria' };

/** The loaded font family name for a language and weight, e.g. "Inter_700Bold". */
export function fontFamily(language: Language, weight: FontWeight): string {
  return `${FAMILY[language]}_${SUFFIX[weight]}`;
}
