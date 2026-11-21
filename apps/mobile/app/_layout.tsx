import '../global.css';
import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { authSession, useElevated, useKidModeProfileId } from '@/auth/appSession';
// Wires the Parent PIN gate to the session (refresh on sign-in, forget on sign-out) before it starts.
import '@/pin/appPinGate';
import { startI18n } from '@/i18n/i18n';
import { kidModeAllows } from '@/kid/kidModeRoutes';
import { startAutoSync } from '@/sync/appSync';
import { FONT_ASSETS } from '@/theme/fontAssets';
import { ThemeProvider } from '@/theme/ThemeProvider';

/**
 * A Kid-Mode device reaches only its kid's screens and Learn (spec, story 60),
 * plus the Parent Area gate; the rest of the Parent Area opens once the Parent
 * PIN has elevated it (`kidModeAllows`). Its Kid Session can't read anything
 * else anyway (ADR-0002); this keeps the other screens out of reach too, deep
 * links included.
 */
function useKidModeRoutes(ready: boolean): void {
  const kidProfileId = useKidModeProfileId();
  const elevated = useElevated();
  const segments = useSegments() as string[];
  // Another kid's `/kid/[id]` finds no records here (the device holds only its own kid's) and goes home.
  const allowed = !kidProfileId || kidModeAllows(segments, elevated);
  useEffect(() => {
    if (ready && !allowed) router.replace('/');
  }, [ready, allowed]);
}

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

  useKidModeRoutes(ready && Boolean(fontsLoaded || fontError));

  // Sync runs on its own once the stored session is loaded (ADR-0007).
  useEffect(() => (ready ? startAutoSync() : undefined), [ready]);

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
