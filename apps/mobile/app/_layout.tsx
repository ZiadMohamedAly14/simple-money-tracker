import '../global.css';
import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { authSession } from '@/auth/appSession';
import { startI18n } from '@/i18n/i18n';
import { FONT_ASSETS } from '@/theme/fontAssets';
import { ThemeProvider } from '@/theme/ThemeProvider';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  // Inter and Alexandria are bundled; if loading ever fails, carry on with system fonts.
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);

  useEffect(() => {
    // The stored session is read from the device only: no network needed to open the app.
    Promise.all([startI18n(), authSession.start()]).then(([state]) => {
      if (state === 'ready') setReady(true);
    });
  }, []);

  // Language, direction and fonts must be settled before anything renders.
  if (!ready || !(fontsLoaded || fontError)) return null;

  return (
    <ThemeProvider name="personal">
      {/* Transparent so the theme's background shows through each screen. */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
