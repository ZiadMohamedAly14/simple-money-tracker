import type { CurrencyCode } from '@money-tracker/shared';

/** The currencies offered at onboarding, in this order. Each has a name in the `currencies` strings. */
export const ONBOARDING_CURRENCIES = ['EGP', 'USD', 'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'EUR', 'GBP'] as const;

export type OnboardingCurrency = (typeof ONBOARDING_CURRENCIES)[number];

/**
 * Shown only while the Account settings aren't on this device yet (a device
 * that signed in to an onboarded Account and hasn't synced). Amounts are
 * stored in minor units either way.
 */
export const FALLBACK_CURRENCY: CurrencyCode = 'EGP';

/** Onboarding steps on the personal path: purpose, currency, Pay Day (optional), Expected Income, split. The kid path counts its own (design flaw 9). */
export const PERSONAL_STEPS = 5;

/** Onboarding steps on the kid path: purpose, currency, Kid Profile, Parent PIN, first Top-up (optional). */
export const KID_STEPS = 5;
