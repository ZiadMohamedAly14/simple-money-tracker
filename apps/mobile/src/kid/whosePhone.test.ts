import { asksWhosePhone } from './whosePhone';

describe('asksWhosePhone (after a successful email-code sign-in)', () => {
  it('asks when the Account is already onboarded and has a Parent PIN', () => {
    expect(asksWhosePhone({ isNewAccount: false, onboardingCompleted: true, hasPin: true })).toBe(true);
  });

  it('sends a brand-new or not yet onboarded Account through onboarding instead', () => {
    expect(asksWhosePhone({ isNewAccount: true, onboardingCompleted: false, hasPin: false })).toBe(false);
    expect(asksWhosePhone({ isNewAccount: false, onboardingCompleted: false, hasPin: true })).toBe(false);
  });

  it('does not ask without a Parent PIN: a kid phone needs one', () => {
    expect(asksWhosePhone({ isNewAccount: false, onboardingCompleted: true, hasPin: false })).toBe(false);
  });
});
