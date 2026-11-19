/**
 * Color tokens for the two experiences, from the Mizan design (docs/design).
 * Screens use token classes (bg-background, text-primary, bg-tint,
 * rounded-theme…) from tailwind.config.js, never raw colors, so branding
 * changes mean editing only this file.
 */
export type ThemeName = 'personal' | 'kid';

export type ColorToken =
  | 'background'
  | 'surface'
  | 'text'
  /** Secondary text (grey-green): captions, "Pending sync", labels. */
  | 'muted'
  /** Main buttons, selected chips/segments, FAB, progress fill, the kid "In my wallet" card. */
  | 'primary'
  | 'on-primary'
  /** Pale green: icon circles, round header buttons, secondary buttons, progress track. */
  | 'tint'
  /** Unselected chip fill (tint in Personal, white in Kid). */
  | 'chip'
  /** Dark buttons (kid "I spent money"). */
  | 'dark'
  | 'on-dark'
  /** Warning surface: negative Unallocated, over-plan banner, low Jar, "went below zero". */
  | 'warning'
  /** Dark amber text on the warning surface. */
  | 'on-warning'
  /** Amounts in, "X left". Same green as primary. */
  | 'positive'
  /** "X over", over-budget bars, negative Jar balances, "Delete account" text. */
  | 'negative'
  /** Pale red surface behind a danger button. */
  | 'negative-surface'
  /** Orange highlight (kid avatar). */
  | 'accent'
  | 'border'
  | 'jar-save'
  | 'jar-spend'
  | 'jar-give';

export interface Theme {
  colors: Record<ColorToken, `#${string}`>;
  /** Corner radius for cards and buttons. The Kid theme is rounder. */
  radius: number;
  /** Minimum touch height for buttons and keypad keys. The Kid theme has bigger controls. */
  controlHeight: number;
}

const shared = {
  surface: '#FFFFFF',
  text: '#1E2A26',
  muted: '#5E6B66',
  primary: '#1D7962',
  'on-primary': '#FFFFFF',
  tint: '#DBEAE3',
  dark: '#1E2A26',
  'on-dark': '#FFFFFF',
  warning: '#FAEFD9',
  'on-warning': '#7A4E06',
  positive: '#1D7962',
  negative: '#B23D27',
  'negative-surface': '#FBE3DE',
  accent: '#FD9E42',
  border: '#D3DED8',
  'jar-save': '#3AA675',
  'jar-spend': '#FD9E42',
  'jar-give': '#F16A8A',
} as const;

export const themes: Record<ThemeName, Theme> = {
  personal: {
    colors: { ...shared, background: '#F5F2EB', chip: '#DBEAE3' },
    radius: 16,
    controlHeight: 52,
  },
  kid: {
    colors: { ...shared, background: '#FEF0CB', chip: '#FFFFFF' },
    radius: 24,
    controlHeight: 60,
  },
};

/** "#1F6FEB" -> "31 111 235", the form Tailwind's `<alpha-value>` colors need. */
function rgbChannels(hex: string): string {
  const value = parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

/** CSS variables for NativeWind's `vars()`; see ThemeProvider. */
export function themeVariables(name: ThemeName): Record<string, string> {
  const theme = themes[name];
  const variables: Record<string, string> = {
    '--radius': `${theme.radius}px`,
    '--control-height': `${theme.controlHeight}px`,
  };
  for (const [token, hex] of Object.entries(theme.colors)) {
    variables[`--color-${token}`] = rgbChannels(hex);
  }
  return variables;
}
