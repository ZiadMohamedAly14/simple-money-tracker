import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import type { AuthErrorData, Language, RequestCodeData } from '@money-tracker/shared';
import type { Env } from '../config/env';
import { accountDeletionCodeEmail } from '../email/accountDeletionCodeEmail';
import type { Mailer } from '../email/mailer';
import { Account } from '../models/account.model';
import { AccountDeletionCode } from '../models/accountDeletionCode.model';
import { Session } from '../models/session.model';
import { SignInCode } from '../models/signInCode.model';
import { BadRequestError, NotFoundError, ServiceUnavailableError, TooManyRequestsError } from '../utils/AppError';
import type { Clock } from '../utils/clock';
import { CODE_TTL_MS, MAX_WRONG_GUESSES, RESEND_INTERVAL_MS } from './auth.service';

interface Deps {
  env: Pick<Env, 'codeHashSecret'>;
  mailer: Mailer;
  now: Clock;
}

const refused = (status: 400 | 429, message: string, data: AuthErrorData): Error =>
  status === 400 ? new BadRequestError(message, data) : new TooManyRequestsError(message, data);

/**
 * Hard-deletes everything stored for an Account (ADR-0005). Sessions go
 * first, so no device can write while the rest is deleted, and the Account
 * last, so a deletion that fails partway can be confirmed again. Every model
 * with an `accountId` field is found by itself, so a new collection is
 * deleted too; sign-in codes are found by email.
 */
export async function deleteAccountData(accountId: string): Promise<void> {
  const account = await Account.findById(accountId).select({ email: 1 }).lean();
  await Session.deleteMany({ accountId });
  const owned = mongoose
    .modelNames()
    .map((name) => mongoose.model(name))
    .filter((model) => model !== Session && model.schema.path('accountId'));
  await Promise.all(owned.map((model) => model.deleteMany({ accountId })));
  if (account) await SignInCode.deleteMany({ email: account.email });
  await Account.deleteOne({ _id: accountId });
}

/** Deleting an Account, confirmed with a code emailed to its address. */
export function createAccountDeletionService({ env, mailer, now }: Deps) {
  const hashCode = (accountId: string, code: string): string =>
    createHmac('sha256', env.codeHashSecret).update(`delete-account:${accountId}:${code}`).digest('hex');

  const sameHash = (a: string, b: string): boolean => {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    return left.length === right.length && timingSafeEqual(left, right);
  };

  return {
    /** Emails a new deletion code, at most once a minute. */
    async requestCode(accountId: string, language: Language): Promise<RequestCodeData> {
      const current = now();
      const account = await Account.findById(accountId).select({ email: 1 }).lean();
      if (!account) throw new NotFoundError('Account not found');

      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const fields = {
        codeHash: hashCode(accountId, code),
        wrongGuesses: 0,
        lastSentAt: current,
        expiresAt: new Date(current.getTime() + CODE_TTL_MS),
      };
      // One conditional upsert, so two requests at once can't both pass the resend check.
      const resendFrom = new Date(current.getTime() - RESEND_INTERVAL_MS);
      try {
        await AccountDeletionCode.updateOne({ accountId, lastSentAt: { $lte: resendFrom } }, { $set: fields }, { upsert: true });
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        const existing = await AccountDeletionCode.findOne({ accountId }).lean();
        const resendAt = new Date((existing?.lastSentAt ?? current).getTime() + RESEND_INTERVAL_MS);
        throw refused(429, 'Please wait before requesting another code', {
          reason: 'resend_too_soon',
          retryAfterSeconds: Math.max(1, Math.ceil((resendAt.getTime() - current.getTime()) / 1000)),
        });
      }

      try {
        await mailer.send(accountDeletionCodeEmail(account.email, code, language, CODE_TTL_MS / 60_000));
      } catch {
        throw new ServiceUnavailableError('Could not send the email');
      }
      return { expiresInSeconds: CODE_TTL_MS / 1000, resendAfterSeconds: RESEND_INTERVAL_MS / 1000 };
    },

    /** Checks the code (counted before comparing, like sign-in), then deletes the Account and all its data. */
    async confirm(accountId: string, code: string): Promise<void> {
      const expired = refused(400, 'This code has expired. Request a new one', { reason: 'code_expired' });
      const exhausted = refused(429, 'Too many wrong codes. Request a new one', { reason: 'too_many_guesses' });

      const stored = await AccountDeletionCode.findOne({ accountId }).lean();
      if (!stored?.codeHash || stored.expiresAt <= now()) throw expired;
      if (stored.wrongGuesses >= MAX_WRONG_GUESSES) throw exhausted;

      const claimed = await AccountDeletionCode.findOneAndUpdate(
        { _id: stored._id, codeHash: stored.codeHash, wrongGuesses: { $lt: MAX_WRONG_GUESSES } },
        { $inc: { wrongGuesses: 1 } },
        { returnDocument: 'after' },
      ).lean();
      if (!claimed) throw exhausted;

      if (!sameHash(stored.codeHash, hashCode(accountId, code))) {
        throw refused(400, 'That code is not right', {
          reason: 'invalid_code',
          attemptsRemaining: MAX_WRONG_GUESSES - claimed.wrongGuesses,
        });
      }
      await deleteAccountData(accountId);
    },
  };
}

export type AccountDeletionService = ReturnType<typeof createAccountDeletionService>;
