import { Stack } from 'expo-router';
import { useTheme } from './ThemeProvider';

/**
 * A screen stack whose screens get the palette's solid Background, so during
 * a transition the screen underneath never shows through (a see-through
 * screen made both pages overlap, then the old one vanish in one frame).
 * Every layout uses it, nested ones too. Kid screens paint their own
 * Mint/Teal Background over it.
 */
export function ThemedStack() {
  const theme = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }} />;
}
