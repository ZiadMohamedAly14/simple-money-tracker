import type { OnboardingData } from '@money-tracker/shared';
import { Account } from '../models/account.model';
import { ForbiddenError, NotFoundError } from '../utils/AppError';
import type { Clock } from '../utils/clock';
import type { AuthContext } from './token.service';

/**
 * Onboarding is recorded on the Account so that a second device signing in
 * skips it (`VerifyCodeData.onboardingCompleted`). What the adult chose
 * (currency, Expected Income, Categories) travels by sync, not through here.
 */
export function createOnboardingService({ now }: { now: Clock }) {
  return {
    /** Marks the caller's Account onboarded. The first time is kept; repeating it is harmless. */
    async complete(auth: AuthContext): Promise<OnboardingData> {
      if (auth.scope !== 'full') throw new ForbiddenError('A Kid Session cannot finish onboarding');
      const account = await Account.findOneAndUpdate(
        { _id: auth.accountId, onboardingCompletedAt: null },
        { $set: { onboardingCompletedAt: now() } },
      );
      if (!account && !(await Account.exists({ _id: auth.accountId }))) throw new NotFoundError('Account not found');
      return { onboardingCompleted: true };
    },
  };
}

export type OnboardingService = ReturnType<typeof createOnboardingService>;
