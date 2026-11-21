/**
 * Whether to ask "Whose phone is this? [Mine] [For a kid]" right after an
 * email-code sign-in (ticket 14). Only an Account that is already onboarded
 * and has a Parent PIN can set up a kid's phone at once; a new Account goes
 * through onboarding, and the Parent Area's "Set up this phone for a kid"
 * stays a second way in.
 */
export function asksWhosePhone({
  isNewAccount,
  onboardingCompleted,
  hasPin,
}: {
  isNewAccount: boolean;
  onboardingCompleted: boolean;
  hasPin: boolean;
}): boolean {
  return !isNewAccount && onboardingCompleted && hasPin;
}
