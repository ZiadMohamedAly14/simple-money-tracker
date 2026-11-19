/**
 * Color tokens for the two experiences. Screens use token classes
 * (bg-background, text-primary, rounded-theme…) from tailwind.config.js, never
 * raw colors, so swapping in final branding means editing only this file.
 * Branding is still open (spec "Further Notes"); these are placeholders.
 */
export type ThemeName = 'personal' | 'kid';

export type ColorToken =
  | 'background'
  | 'surface'
  | 'text'
  | 'muted'
  | 'primary'
  | 'on-primary'
  | 'accent'
  | 'positive'
  | 'negative'
  | 'border';

export interface Theme {
  colors: Record<ColorToken, `#${string}`>;
  /** Corner radius for cards and buttons. The Kid theme is rounder. */
  radius: number;
  /** Minimum touch height for buttons. The Kid theme has bigger buttons. */
  controlHeight: number;
}

export const themes: Record<ThemeName, Theme> = {
  personal: {
    colors: {
      background: '#F7F8FA',
      surface: '#FFFFFF',
      text: '#16181D',
      muted: '#6B7280',
      primary: '#1F6FEB',
      'on-primary': '#FFFFFF',
      accent: '#0EA5A4',
      positive: '#15803D',
      negative: '#B91C1C',
      border: '#E5E7EB',
    },
    radius: 8,
    controlHeight: 44,
  },
  kid: {
    colors: {
      background: '#FFF8E7',
      surface: '#FFFFFF',
      text: '#2B2140',
      muted: '#7A6F8F',
      primary: '#7C3AED',
      'on-primary': '#FFFFFF',
      accent: '#F59E0B',
      positive: '#16A34A',
      negative: '#DC2626',
      border: '#F1E3C2',
    },
    radius: 20,
    controlHeight: 56,
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
