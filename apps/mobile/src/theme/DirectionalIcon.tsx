import { I18nManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IoniconsProps = ComponentProps<typeof Ionicons>;

/**
 * An icon that points "forward" or "back" (chevrons, arrows). It is drawn for
 * left-to-right and mirrored in right-to-left, so a "next" chevron always
 * points toward the end of the line. Use plain Ionicons for icons with no
 * direction (plus, wallet, settings).
 */
export function DirectionalIcon({ style, ...props }: IoniconsProps) {
  return (
    <Ionicons {...props} style={[style, I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : null]} />
  );
}
