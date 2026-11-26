import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { DEFAULT_NUMBERING_SYSTEM, type CurrencyCode, type NumberingSystem, type PayDayHistory } from '@money-tracker/shared';
import { localDb } from '@/db/appDatabase';
import type { OnboardingState } from '@/db/localStore';
import { accountSettingsQuery, onboardingQuery, payDayHistoryOf, payDayHistoryQuery } from './budget';
import { FALLBACK_CURRENCY } from './currency';

export interface AccountSettings {
  currency: CurrencyCode;
  numberingSystem: NumberingSystem;
}

/** The Account's currency and numbering system, live from the local database. */
export function useAccountSettings(): AccountSettings {
  const { data } = useLiveQuery(accountSettingsQuery(localDb));
  const row = data[0];
  return {
    currency: row?.currency ?? FALLBACK_CURRENCY,
    numberingSystem: row?.numberingSystem ?? DEFAULT_NUMBERING_SYSTEM,
  };
}

/** The Account's Pay Day history, live; empty (Pay Day 1) until the Pay Day is first changed. Pass it to every Month lookup. */
export function usePayDayHistory(): PayDayHistory {
  const { data } = useLiveQuery(payDayHistoryQuery(localDb));
  return payDayHistoryOf(data);
}

/** This device's onboarding state, live; null until the first read finishes. */
export function useOnboardingState(): OnboardingState | null {
  const { data, updatedAt } = useLiveQuery(onboardingQuery(localDb));
  if (!updatedAt) return null;
  return (data[0]?.value as OnboardingState | undefined) ?? 'not_started';
}
