import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

/** Cursor heights (dp) matching the amount text sizes. */
const HEIGHT = { xl: 46, lg: 38, md: 28, sm: 18 } as const;

/**
 * A blinking text cursor after an amount typed on the app's own keypad, so the
 * amount reads as the field that typing goes into (there is no TextInput and
 * so no system cursor). Steady when the phone asks for reduced motion.
 * Hidden from screen readers.
 */
export function Caret({ size = 'lg' }: { size?: keyof typeof HEIGHT }) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let blink: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      blink = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 0, delay: 530, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 0, delay: 530, useNativeDriver: true }),
        ]),
      );
      blink.start();
    });
    return () => {
      cancelled = true;
      blink?.stop();
    };
  }, [opacity]);
  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ opacity, width: 2, height: HEIGHT[size], marginStart: 3, alignSelf: 'center', borderRadius: 1, backgroundColor: theme.colors.primary }}
    />
  );
}
