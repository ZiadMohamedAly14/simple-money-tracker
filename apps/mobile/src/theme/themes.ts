import type { ColorScheme } from './appearance';

/**
 * Color tokens for the two experiences (Personal, Kid), each in a light and a
 * dark variant, from the Mizan light and dark palettes. Screens use token
 * classes (bg-background,
 * text-primary, bg-tint, rounded-theme…) from tailwind.config.js, never raw
 * colors, so palette changes mean editing only this file. ThemeProvider
 * passes the active variant to NativeWind as CSS variables.
 */
export type ThemeName = 'personal' | 'kid';

export const COLOR_TOKENS = [
  'background',
  'surface',
  'text',
  /** Secondary text (grey-green): captions, "Pending sync", labels. */
  'muted',
  /** Main buttons, selected chips/segments, FAB, progress fill, the kid "In my wallet" card. */
  'primary',
  'on-primary',
  /** Soft fill: icon circles, round header buttons, secondary buttons, progress track. */
  'tint',
  /** Unselected chip fill (soft fill, but white on the light Kid theme). */
  'chip',
  /** High-emphasis button (kid "I spent money"): near-black in light, near-white in dark. */
  'dark',
  'on-dark',
  /** Warning surface: negative Unallocated, over-plan banner, low Jar, "went below zero". */
  'warning',
  /** Amber text on the warning surface. */
  'on-warning',
  /** Amounts in, "X left". Same green as primary. */
  'positive',
  /** "X over", over-budget bars, negative Jar balances, "Delete account" text. */
  'negative',
  /** Pale red surface behind a danger button. */
  'negative-surface',
  /** Orange highlight (kid avatar). */
  'accent',
  /** Ink (letters, icons) on the orange accent and the Jar colours. */
  'on-accent',
  'border',
  /** Dimmed backdrop behind dialogs; use at reduced opacity (bg-scrim/40). */
  'scrim',
  'jar-save',
  'jar-spend',
  'jar-give',
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];

type Colors = Record<ColorToken, `#${string}`>;

export interface Theme {
  colors: Colors;
  /** Corner radius for cards and buttons. The Kid theme is rounder. */
  radius: number;
  /** Minimum touch height for buttons and keypad keys. The Kid theme has bigger controls. */
  controlHeight: number;
}

const light = {
  background: '#F5F3EC',
  surface: '#FFFFFF',
  text: '#1E2B27',
  muted: '#56655F',
  primary: '#1F7A63',
  'on-primary': '#FFFFFF',
  tint: '#DCEBE4',
  chip: '#DCEBE4',
  // Not in the palette: picked to fit it (see ticket 23's comments).
  dark: '#1E2B27',
  'on-dark': '#FFFFFF',
  warning: '#FBF0D9',
  'on-warning': '#8A5A0B',
  positive: '#1F7A63',
  negative: '#B23E27',
  'negative-surface': '#FBE3DE',
  accent: '#FF9F43',
  'on-accent': '#1E2B27',
  border: '#D5DFD9',
  scrim: '#000000',
  'jar-save': '#3BA776',
  'jar-spend': '#FF9F43',
  'jar-give': '#F26B8A',
} as const satisfies Colors;

const dark = {
  background: '#0F1513',
  surface: '#1B2623',
  text: '#EDEFEA',
  muted: '#9AA7A1',
  primary: '#4FB596',
  'on-primary': '#06201A',
  tint: '#24342F',
  chip: '#24342F',
  // Not in the palette: the "dark" button inverts to near-white so it stands out on Teal.
  dark: '#EDEFEA',
  'on-dark': '#0F1513',
  warning: '#3A2E14',
  'on-warning': '#E8B558',
  positive: '#4FB596',
  negative: '#F08A74',
  'negative-surface': '#3B2420',
  accent: '#FFB05A',
  'on-accent': '#0F1513',
  border: '#2E3D38',
  scrim: '#000000',
  'jar-save': '#4FC08D',
  'jar-spend': '#FFB05A',
  'jar-give': '#FF86A3',
} as const satisfies Colors;

const personal = { radius: 16, controlHeight: 52 };
const kid = { radius: 24, controlHeight: 60 };

export const themes: Record<ThemeName, Record<ColorScheme, Theme>> = {
  personal: {
    light: { ...personal, colors: light },
    dark: { ...personal, colors: dark },
  },
  kid: {
    // Mint / Teal. The light Kid theme keeps white chips on Mint.
    light: { ...kid, colors: { ...light, background: '#D9F2E6', chip: '#FFFFFF' } },
    dark: { ...kid, colors: { ...dark, background: '#12302B' } },
  },
};

/** "#1F6FEB" -> "31 111 235", the form Tailwind's `<alpha-value>` colors need. */
function rgbChannels(hex: string): string {
  const value = parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

/** CSS variables for NativeWind's `vars()`; see ThemeProvider. */
export function themeVariables(name: ThemeName, scheme: ColorScheme): Record<string, string> {
  const theme = themes[name][scheme];
  const variables: Record<string, string> = {
    '--radius': `${theme.radius}px`,
    '--control-height': `${theme.controlHeight}px`,
  };
  for (const [token, hex] of Object.entries(theme.colors)) {
    variables[`--color-${token}`] = rgbChannels(hex);
  }
  return variables;
}
