import { Redirect, Stack, usePathname } from 'expo-router';
import { useAuthStatus } from '@/auth/appSession';
import { useOnboardingState } from '@/data/useAccountSettings';

/**
 * Onboarding: purpose, then (personal path) currency, Expected Income and an
 * optional split across Categories. Once onboarding is done only the split
 * step stays reachable, so going back can't onboard twice.
 */
export default function OnboardingLayout() {
  const status = useAuthStatus();
  const onboarding = useOnboardingState();
  const pathname = usePathname();
  if (status === 'loading' || onboarding === null) return null;
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  if (onboarding !== 'not_started' && pathname !== '/onboarding/split') return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />;
}
