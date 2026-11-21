import { I18nManager, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { APP_ICONS, isAppIconMirrored, type AppIconName } from './appIcons';

export interface AppIconProps {
  name: AppIconName;
  /** Width and height in points. Default 24. */
  size?: number;
  /** Stroke colour of the line icons (their currentColor). Default: the theme's text colour. Coloured illustrations ignore it. */
  color?: string;
  /** Force mirroring in right-to-left. Arrows (back, chevron-forward, move-money) mirror on their own. */
  directional?: boolean;
  /**
   * Point the other way: chevron-forward drawn as a "previous" chevron. It
   * still follows the layout direction, so it points toward the start of the
   * line (left in English, right in Arabic).
   */
  reversed?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** An icon from the custom set in `assets/icon/`. */
export function AppIcon({ name, size = 24, color, directional, reversed = false, style }: AppIconProps) {
  const theme = useTheme();
  const Svg = APP_ICONS[name];
  const mirror = isAppIconMirrored(name, { isRTL: I18nManager.isRTL, directional, reversed });
  return (
    <Svg
      width={size}
      height={size}
      color={color ?? theme.colors.text}
      style={[style, mirror ? { transform: [{ scaleX: -1 }] } : null]}
    />
  );
}
