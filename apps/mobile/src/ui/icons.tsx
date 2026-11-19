import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DirectionalIcon } from '@/theme/DirectionalIcon';
import { useTheme } from '@/theme/ThemeProvider';

/** Any Ionicons name. Use the outline variants to match the design. */
export type IconName = ComponentProps<typeof Ionicons>['name'];

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
  icon: IconName;
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
  const Icon = directional ? DirectionalIcon : Ionicons;
  return (
    <View className={`items-center justify-center rounded-full ${CIRCLE_CLASS[tone]} ${className}`}>
      <Icon name={icon} size={iconSize} color={color} />
    </View>
  );
}
