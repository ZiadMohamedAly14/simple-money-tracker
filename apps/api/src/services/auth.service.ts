import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { secondsUntil, type AuthErrorData, type Language, type RequestCodeData, type VerifyCodeData } from '@money-tracker/shared';
import type { Env } from '../config/env';
import type { Mailer } from '../email/mailer';
import { accountDeletionCodeEmail } from '../email/accountDeletionCodeEmail';
import { signInCodeEmail } from '../email/signInCodeEmail';
import { Account } from '../models/account.model';
import { SignInCode } from '../models/signInCode.model';
import { BadRequestError, ServiceUnavailableError, TooManyRequestsError } from '../utils/AppError';
import type { Clock } from '../utils/clock';
import type { TokenService } from './token.service';

/** Sign-in code rules (spec: Authentication and authorization). */
export const CODE_TTL_MS = 10 * 60 * 1000;
export const RESEND_INTERVAL_MS = 60 * 1000;
export const CODES_PER_WINDOW = 5;
export const CODE_WINDOW_MS = 60 * 60 * 1000;
export const MAX_WRONG_GUESSES = 5;

const DUPLICATE_KEY = 11000;

function authError(status: 400 | 429, message: string, data: AuthErrorData): Error {
  return status === 400 ? new BadRequestError(message, data) : new TooManyRequestsError(message, data);
}

/**
 * What an emailed one-time code proves: signing in, resetting a forgotten
 * Parent PIN, or confirming Account deletion. The purpose is part of the code's
 * hash, so a code only works for what it was sent for.
 */
export type CodePurpose = 'signIn' | 'pinReset' | 'deleteAccount';

interface Deps {
  env: Pick<Env, 'codeHashSecret'>;
  mailer: Mailer;
  now: Clock;
  tokens: TokenService;
}

/** `email` arguments are already normalized (trimmed, lowercased) by the route's validation. */
export function createAuthService({ env, mailer, now, tokens }: Deps) {
  const hashCode = (email: string, code: string, purpose: CodePurpose): string =>
    createHmac('sha256', env.codeHashSecret)
      .update(purpose === 'signIn' ? `${email}:${code}` : `${purpose}:${email}:${code}`)
      .digest('hex');

  const sameHash = (a: string, b: string): boolean => {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    return left.length === right.length && timingSafeEqual(left, right);
  };

  /** Finds the Account by email or creates it; tells which. Safe against two first verifies racing. */
  async function findOrCreateAccount(
    email: string,
  ): Promise<{ id: string; email: string; isNew: boolean; onboardingCompleted: boolean }> {
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await Account.findOneAndUpdate(
          { email },
          { $setOnInsert: { email } },
          { upsert: true, new: true, includeResultMetadata: true },
        );
        const account = result.value!;
        return {
          id: account.id as string,
          email: account.email,
          isNew: !result.lastErrorObject?.updatedExisting,
          onboardingCompleted: account.onboardingCompletedAt != null,
        };
      } catch (error) {
        if ((error as { code?: number }).code === DUPLICATE_KEY && attempt === 0) continue;
        throw error;
      }
    }
  }

  /**
   * Checks a one-time code sent for `purpose` and uses it up, or throws why not
   * (wrong, expired, too many guesses). A code sent for another purpose is wrong.
   */
  async function useCode(email: string, code: string, purpose: CodePurpose = 'signIn'): Promise<void> {
    const current = now();
    const expired = authError(400, 'This code has expired. Request a new one', { reason: 'code_expired' });
    const exhausted = authError(429, 'Too many wrong codes. Request a new one', { reason: 'too_many_guesses' });

    const stored = await SignInCode.findOne({ email, purpose }).lean();
    if (!stored?.codeHash || stored.expiresAt <= current) throw expired;
    if (stored.wrongGuesses >= MAX_WRONG_GUESSES) throw exhausted;

    // Count the guess atomically before comparing, so parallel guesses can't exceed the limit.
    const claimed = await SignInCode.findOneAndUpdate(
      { _id: stored._id, codeHash: stored.codeHash, wrongGuesses: { $lt: MAX_WRONG_GUESSES } },
      { $inc: { wrongGuesses: 1 } },
      { new: true },
    ).lean();
    if (!claimed) throw exhausted;

    if (!sameHash(stored.codeHash, hashCode(email, code, purpose))) {
      throw authError(400, 'That code is not right', {
        reason: 'invalid_code',
        attemptsRemaining: MAX_WRONG_GUESSES - claimed.wrongGuesses,
      });
    }

    // One-time: only the first verify of this code gets through.
    const used = await SignInCode.updateOne(
      { _id: stored._id, codeHash: stored.codeHash },
      { $set: { codeHash: null } },
    );
    if (used.modifiedCount === 0) throw expired;
  }

  return {
    /**
     * Sends a new code, within the per-email resend limits. PIN reset and
     * Account deletion codes are the same one-time code (proof of the email),
     * with the same limits, in their own emails. Each purpose keeps its own
     * code and counters, so a new code replaces only an earlier one for the
     * same purpose.
     */
    async requestCode(email: string, language: Language, purpose: CodePurpose = 'signIn'): Promise<RequestCodeData> {
      const current = now();
      const existing = await SignInCode.findOne({ email, purpose }).lean();

      if (existing) {
        const resendAt = new Date(existing.lastSentAt.getTime() + RESEND_INTERVAL_MS);
        if (current < resendAt) {
          throw authError(429, 'Please wait before requesting another code', {
            reason: 'resend_too_soon',
            retryAfterSeconds: secondsUntil(current, resendAt),
          });
        }
      }

      const windowEnd = existing && new Date(existing.windowStartedAt.getTime() + CODE_WINDOW_MS);
      const sameWindow = !!windowEnd && current < windowEnd;
      if (sameWindow && existing.sentInWindow >= CODES_PER_WINDOW) {
        throw authError(429, 'Too many codes requested. Try again later', {
          reason: 'too_many_codes',
          retryAfterSeconds: secondsUntil(current, windowEnd),
        });
      }

      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const expiresAt = new Date(current.getTime() + CODE_TTL_MS);
      const windowStartedAt = sameWindow ? existing.windowStartedAt : current;
      const fields = {
        codeHash: hashCode(email, code, purpose),
        expiresAt,
        wrongGuesses: 0,
        lastSentAt: current,
        windowStartedAt,
        sentInWindow: sameWindow ? existing.sentInWindow + 1 : 1,
        purgeAt: new Date(Math.max(expiresAt.getTime(), windowStartedAt.getTime() + CODE_WINDOW_MS)),
      };

      // Conditional write so two simultaneous requests can't both pass the resend check.
      const tooSoon = authError(429, 'Please wait before requesting another code', {
        reason: 'resend_too_soon',
        retryAfterSeconds: Math.ceil(RESEND_INTERVAL_MS / 1000),
      });
      if (existing) {
        const { modifiedCount } = await SignInCode.updateOne(
          { _id: existing._id, lastSentAt: existing.lastSentAt },
          { $set: fields },
        );
        if (modifiedCount === 0) throw tooSoon;
      } else {
        try {
          await SignInCode.create({ email, purpose, ...fields });
        } catch (error) {
          if ((error as { code?: number }).code === DUPLICATE_KEY) throw tooSoon;
          throw error;
        }
      }

      try {
        const minutes = CODE_TTL_MS / 60_000;
        await mailer.send(
          purpose === 'deleteAccount'
            ? accountDeletionCodeEmail(email, code, language, minutes)
            : signInCodeEmail(email, code, language, minutes, purpose),
        );
      } catch {
        throw new ServiceUnavailableError('Could not send the code email');
      }

      return { expiresInSeconds: CODE_TTL_MS / 1000, resendAfterSeconds: RESEND_INTERVAL_MS / 1000 };
    },

    useCode,

    /** Checks the code; on success uses it up, creates the Account if needed and starts a Session. */
    async verifyCode(email: string, code: string, deviceLabel: string | null): Promise<VerifyCodeData> {
      await useCode(email, code);
      const account = await findOrCreateAccount(email);
      const issued = await tokens.startSession(account.id, deviceLabel);
      return {
        ...issued,
        isNewAccount: account.isNew,
        onboardingCompleted: account.onboardingCompleted,
        account: { id: account.id, email: account.email },
      };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
