import { ActivityIndicator, Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { ColorToken } from '@/theme/themes';
import { Glyph, type GlyphName } from './icons';
import { Text, type TextTone } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'danger';

const VARIANT: Record<ButtonVariant, { className: string; tone: TextTone; color: ColorToken }> = {
  primary: { className: 'bg-primary', tone: 'on-primary', color: 'on-primary' },
  /** Tint fill: "Back to wallet", "Sign out". */
  secondary: { className: 'bg-tint', tone: 'text', color: 'text' },
  /** Kid "I spent money". */
  dark: { className: 'bg-dark', tone: 'on-dark', color: 'on-dark' },
  /** "Delete account": red text on a pale red surface. */
  danger: { className: 'bg-negative-surface', tone: 'negative', color: 'negative' },
};

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: GlyphName;
  /** Mirror the icon in right-to-left (arrows). */
  directionalIcon?: boolean;
  disabled?: boolean;
  /** Shows a spinner and blocks presses. */
  loading?: boolean;
  /** Bigger text, as on the kid wallet's main action. */
  large?: boolean;
  accessibilityLabel?: string;
  className?: string;
}

/** Full-width action button, at least the theme's control height. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  directionalIcon,
  disabled,
  loading,
  large,
  accessibilityLabel,
  className = '',
}: ButtonProps) {
  const theme = useTheme();
  const style = VARIANT[variant];
  const color = theme.colors[style.color];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      className={`min-h-control flex-row items-center justify-center gap-3 rounded-theme px-5 active:opacity-80 ${
        style.className
      } ${disabled ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <View className="flex-row items-center gap-3">
          {icon ? <Glyph name={icon} size={large ? 24 : 20} color={color} directional={directionalIcon} /> : null}
          <Text weight="bold" tone={style.tone} align="center" className={large ? 'text-xl' : 'text-base'}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export interface IconButtonProps {
  icon: GlyphName;
  /** Required: the button has no visible text. */
  accessibilityLabel: string;
  onPress?: () => void;
  /** Mirror in right-to-left: back, forward, month arrows. */
  directional?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Round tint button for back, close and month arrows. */
export function IconButton({ icon, accessibilityLabel, onPress, directional, disabled, className = '' }: IconButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      className={`h-11 w-11 items-center justify-center rounded-full bg-tint active:opacity-70 ${
        disabled ? 'opacity-40' : ''
      } ${className}`}
    >
      <Glyph name={icon} size={22} color={theme.colors.text} directional={directional} />
    </Pressable>
  );
}

export interface FabProps {
  accessibilityLabel: string;
  onPress?: () => void;
  icon?: GlyphName;
}

/** Round primary "+" pinned to the bottom end corner of its (relative) parent. */
export function Fab({ accessibilityLabel, onPress, icon = 'app:add' }: FabProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className="absolute bottom-6 end-6 h-16 w-16 items-center justify-center rounded-full bg-primary active:opacity-80"
    >
      <Glyph name={icon} size={32} color={theme.colors['on-primary']} />
    </Pressable>
  );
}
