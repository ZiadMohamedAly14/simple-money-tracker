import { Redirect, Stack, usePathname } from 'expo-router';
import { useAuthStatus } from '@/auth/appSession';
import { useOnboardingState } from '@/data/useAccountSettings';

/**
 * Onboarding: purpose, then (personal path) currency, Expected Income and an
 * optional split across Categories, or (kid path) currency, Kid Profile,
 * Parent PIN and an optional first Top-up. Once onboarding is done only the
 * optional last steps stay reachable, so going back can't onboard twice.
 */
/** Optional steps that come after onboarding is recorded. */
const AFTER_ONBOARDING = ['/onboarding/split', '/onboarding/kid-top-up'];

export default function OnboardingLayout() {
  const status = useAuthStatus();
  const onboarding = useOnboardingState();
  const pathname = usePathname();
  if (status === 'loading' || onboarding === null) return null;
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  if (onboarding !== 'not_started' && !AFTER_ONBOARDING.includes(pathname)) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />;
}
