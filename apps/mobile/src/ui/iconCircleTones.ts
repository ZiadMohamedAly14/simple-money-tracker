import type { ColorToken } from '@/theme/themes';

export type IconCircleTone = 'tint' | 'primary' | 'accent' | 'jar-save' | 'jar-spend' | 'jar-give';

/**
 * Fill and icon colour of each IconCircle tone. Kept apart from the component
 * so the contrast test can check every pair in all four palettes.
 */
export const ICON_CIRCLE_TONES: Record<IconCircleTone, { className: string; fill: ColorToken; icon: ColorToken }> = {
  tint: { className: 'bg-tint', fill: 'tint', icon: 'primary' },
  primary: { className: 'bg-primary', fill: 'primary', icon: 'on-primary' },
  accent: { className: 'bg-accent', fill: 'accent', icon: 'on-accent' },
  'jar-save': { className: 'bg-jar-save', fill: 'jar-save', icon: 'on-accent' },
  'jar-spend': { className: 'bg-jar-spend', fill: 'jar-spend', icon: 'on-accent' },
  'jar-give': { className: 'bg-jar-give', fill: 'jar-give', icon: 'on-accent' },
};
