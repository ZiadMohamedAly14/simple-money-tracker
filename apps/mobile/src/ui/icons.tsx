import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { AppIcon } from './AppIcon';
import type { AppIconName } from './appIcons';
import { ICON_CIRCLE_TONES, type IconCircleTone } from './iconCircleTones';

/** A custom icon from `assets/icon/`, written `app:<file name>`. */
export type AppIconRef = `app:${AppIconName}`;

/** What icon props across the UI kit take: an `app:` icon. The app draws only its own icon set. */
export type GlyphName = AppIconRef;

export interface GlyphProps {
  name: GlyphName;
  size: number;
  color: string;
  /** Mirror in right-to-left. Arrows (app:back, app:chevron-forward) mirror on their own. */
  directional?: boolean;
  /** Point the other way (app:chevron-forward as "previous"). See AppIcon. */
  reversed?: boolean;
}

/** Draws a GlyphName: the custom SVG named after `app:`. */
export function Glyph({ name, size, color, directional, reversed }: GlyphProps) {
  return <AppIcon name={name.slice(4) as AppIconName} size={size} color={color} directional={directional} reversed={reversed} />;
}

export type { IconCircleTone };

const CIRCLE_SIZE = {
  sm: { className: 'h-8 w-8', icon: 16 },
  md: { className: 'h-11 w-11', icon: 22 },
  lg: { className: 'h-14 w-14', icon: 26 },
} as const;

export interface IconCircleProps {
  /** An `app:` icon ("app:wallet"). */
  icon: GlyphName;
  /** tint (default) for list and category rows; jar-* for the kid's Jars. */
  tone?: IconCircleTone;
  size?: keyof typeof CIRCLE_SIZE;
  /** Mirror in right-to-left (arrows, chevrons). */
  directional?: boolean;
}

/** An icon in a filled circle: list rows, category rows, Jar rows, empty states. */
export function IconCircle({ icon, tone = 'tint', size = 'md', directional }: IconCircleProps) {
  const theme = useTheme();
  const { className: fillClass, icon: iconToken } = ICON_CIRCLE_TONES[tone];
  const { className, icon: iconSize } = CIRCLE_SIZE[size];
  return (
    <View className={`items-center justify-center rounded-full ${fillClass} ${className}`}>
      <Glyph name={icon} size={iconSize} color={theme.colors[iconToken]} directional={directional} />
    </View>
  );
}
