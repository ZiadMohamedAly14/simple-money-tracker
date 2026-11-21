import { randomBytes } from 'node:crypto';
import {
  PARENT_PIN_SALT_BYTES,
  PIN_FREE_ATTEMPTS,
  hashParentPin,
  pinRetryAfterSeconds,
  verifyParentPin,
  type ParentPinData,
  type ParentPinErrorData,
  type RequestCodeData,
  type Language,
} from '@money-tracker/shared';
import { Account } from '../models/account.model';
import { ForbiddenError, NotFoundError, TooManyRequestsError } from '../utils/AppError';
import type { Clock } from '../utils/clock';
import type { AuthService } from './auth.service';

interface Deps {
  now: Clock;
  /** The emailed one-time codes, for resetting a forgotten PIN. */
  codes: Pick<AuthService, 'requestCode' | 'useCode'>;
}

const secondsUntil = (from: Date, to: Date): number => Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 1000));

function pinLocked(current: Date, until: Date): Error {
  const data: ParentPinErrorData = { reason: 'pin_locked', retryAfterSeconds: secondsUntil(current, until) };
  return new TooManyRequestsError('Too many wrong PINs. Try again later', data);
}

function wrongPin(failures: number): Error {
  const data: ParentPinErrorData = { reason: 'wrong_pin', attemptsRemaining: Math.max(0, PIN_FREE_ATTEMPTS - failures) };
  return new ForbiddenError('That PIN is not right', data);
}

/**
 * The Parent PIN on the Account. Only its hash is stored and handed out, and only
 * to full sessions (the route checks the scope). Wrong PINs are throttled per
 * Account with `pinRetryAfterSeconds`.
 */
export function createParentPinService({ now, codes }: Deps) {
  const newHash = (pin: string): Promise<string> => hashParentPin(pin, new Uint8Array(randomBytes(PARENT_PIN_SALT_BYTES)));

  /**
   * Checks `pin` against the stored hash. Each try is counted, and the wait for a
   * further wrong try is claimed, before comparing, with a compare-and-set on the
   * failure count, so parallel guesses can't get past the throttle. A right PIN
   * clears the count.
   */
  async function checkPin(accountId: string, pin: string | undefined): Promise<void> {
    for (;;) {
      const current = now();
      const account = await Account.findById(accountId).lean();
      if (!account?.parentPinHash) throw new NotFoundError('No Parent PIN is set');
      if (account.pinLockedUntil && account.pinLockedUntil > current) throw pinLocked(current, account.pinLockedUntil);

      const failures = account.pinFailures + 1;
      const wait = pinRetryAfterSeconds(failures);
      const claimed = await Account.updateOne(
        { _id: accountId, pinFailures: account.pinFailures, parentPinHash: account.parentPinHash },
        { $set: { pinFailures: failures, pinLockedUntil: wait ? new Date(current.getTime() + wait * 1000) : null } },
      );
      if (claimed.modifiedCount === 0) continue; // another try got in first; look again

      if (pin !== undefined && (await verifyParentPin(pin, account.parentPinHash))) {
        await Account.updateOne({ _id: accountId, pinFailures: failures }, { $set: { pinFailures: 0, pinLockedUntil: null } });
        return;
      }
      throw wrongPin(failures);
    }
  }

  async function emailOf(accountId: string): Promise<string> {
    const account = await Account.findById(accountId).select({ email: 1 }).lean();
    if (!account) throw new NotFoundError('No such Account');
    return account.email;
  }

  return {
    checkPin,

    /** Emails a one-time code for resetting a forgotten PIN to the Account's address. */
    async requestReset(accountId: string, language: Language): Promise<RequestCodeData> {
      return codes.requestCode(await emailOf(accountId), language, 'pinReset');
    },

    /** Sets a new PIN with an emailed code instead of the current PIN, and clears any wrong-PIN wait. */
    async reset(accountId: string, code: string, pin: string): Promise<ParentPinData> {
      await codes.useCode(await emailOf(accountId), code);
      const pinHash = await newHash(pin);
      await Account.updateOne({ _id: accountId }, { $set: { parentPinHash: pinHash, pinFailures: 0, pinLockedUntil: null } });
      return { pinHash };
    },

    async get(accountId: string): Promise<ParentPinData> {
      const account = await Account.findById(accountId).lean();
      return { pinHash: account?.parentPinHash ?? null };
    },

    /** Sets the first PIN, or changes it given the current one. */
    async set(accountId: string, pin: string, currentPin: string | undefined): Promise<ParentPinData> {
      const pinHash = await newHash(pin);
      const first = await Account.updateOne({ _id: accountId, parentPinHash: null }, { $set: { parentPinHash: pinHash } });
      if (first.modifiedCount === 1) return { pinHash };

      await checkPin(accountId, currentPin);
      await Account.updateOne({ _id: accountId }, { $set: { parentPinHash: pinHash, pinFailures: 0, pinLockedUntil: null } });
      return { pinHash };
    },
  };
}

export type ParentPinService = ReturnType<typeof createParentPinService>;
