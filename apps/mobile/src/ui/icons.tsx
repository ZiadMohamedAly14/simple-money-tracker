import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DirectionalIcon } from '@/theme/DirectionalIcon';
import { useTheme } from '@/theme/ThemeProvider';
import { AppIcon } from './AppIcon';
import type { AppIconName } from './appIcons';

/** Any Ionicons name. Use the outline variants to match the design. */
export type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * A custom icon from `assets/icon/`, written `app:<file name>`. The prefix keeps
 * it apart from Ionicons names that clash ("add", "wallet").
 */
export type AppIconRef = `app:${AppIconName}`;

/** What icon props across the UI kit take: an Ionicons name or an `app:` custom icon. */
export type GlyphName = IconName | AppIconRef;

export interface GlyphProps {
  name: GlyphName;
  size: number;
  color: string;
  /** Mirror in right-to-left. Custom arrows (app:back, app:chevron-forward) mirror on their own. */
  directional?: boolean;
  /** Custom icons only: point the other way (app:chevron-forward as "previous"). See AppIcon. */
  reversed?: boolean;
}

/** Draws a GlyphName: the custom SVG for `app:` names, Ionicons otherwise. */
export function Glyph({ name, size, color, directional, reversed }: GlyphProps) {
  if (name.startsWith('app:')) {
    return <AppIcon name={name.slice(4) as AppIconName} size={size} color={color} directional={directional} reversed={reversed} />;
  }
  const Icon = directional ? DirectionalIcon : Ionicons;
  return <Icon name={name as IconName} size={size} color={color} />;
}

export type IconCircleTone = 'tint' | 'primary' | 'accent' | 'jar-save' | 'jar-spend' | 'jar-give';

const CIRCLE_CLASS: Record<IconCircleTone, string> = {
  tint: 'bg-tint',
  primary: 'bg-primary',
  accent: 'bg-accent',
  'jar-save': 'bg-jar-save',
  'jar-spend': 'bg-jar-spend',
  'jar-give': 'bg-jar-give',
};

const CIRCLE_SIZE = {
  sm: { className: 'h-8 w-8', icon: 16 },
  md: { className: 'h-11 w-11', icon: 22 },
  lg: { className: 'h-14 w-14', icon: 26 },
} as const;

export interface IconCircleProps {
  /** An Ionicons name or an `app:` custom icon ("app:wallet"). */
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
  const color = tone === 'tint' ? theme.colors.primary : tone === 'primary' ? theme.colors['on-primary'] : theme.colors.text;
  const { className, icon: iconSize } = CIRCLE_SIZE[size];
  return (
    <View className={`items-center justify-center rounded-full ${CIRCLE_CLASS[tone]} ${className}`}>
      <Glyph name={icon} size={iconSize} color={color} directional={directional} />
    </View>
  );
}
