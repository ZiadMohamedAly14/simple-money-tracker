/**
 * The adult's Appearance choice (Settings): follow the phone, or always Light
 * or Dark. Kept on this device only, like the language (never synced).
 */
export type Appearance = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

export const APPEARANCES: readonly Appearance[] = ['system', 'light', 'dark'];

/** A choice read back from device storage; anything unknown means System. */
export function parseAppearance(stored: string | null | undefined): Appearance {
  return (APPEARANCES as readonly string[]).includes(stored ?? '') ? (stored as Appearance) : 'system';
}

/** The palette to show for a choice, given what the phone is set to (null when unknown). */
export function activeScheme(appearance: Appearance, phone: ColorScheme | null | undefined): ColorScheme {
  if (appearance !== 'system') return appearance;
  return phone === 'dark' ? 'dark' : 'light';
}
