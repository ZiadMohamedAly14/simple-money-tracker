import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useColorScheme } from './appearanceStore';
import { themes } from './themes';

/**
 * Keeps the system UI on the active palette: status bar icons (dark on light,
 * light on dark) and the root view behind the app, so screen transitions and
 * the keyboard never show a white edge in dark mode. The Android navigation
 * bar buttons follow the night mode set by appearanceStore.
 */
export function SystemBars() {
  const scheme = useColorScheme();
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(themes.personal[scheme].colors.background).catch(() => undefined);
  }, [scheme]);
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}
