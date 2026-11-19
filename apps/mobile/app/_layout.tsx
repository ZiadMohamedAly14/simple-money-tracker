import '../global.css';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { startI18n } from '@/i18n/i18n';
import { ThemeProvider } from '@/theme/ThemeProvider';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    startI18n().then((state) => {
      if (state === 'ready') setReady(true);
    });
  }, []);

  // Language and direction must be settled before anything renders.
  if (!ready) return null;

  return (
    <ThemeProvider name="personal">
      {/* Transparent so the theme's background shows through each screen. */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
