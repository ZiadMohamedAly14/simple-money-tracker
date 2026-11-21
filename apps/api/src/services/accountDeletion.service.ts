import mongoose from 'mongoose';
import type { Language, RequestCodeData } from '@money-tracker/shared';
import { Account } from '../models/account.model';
import { Session } from '../models/session.model';
import { SignInCode } from '../models/signInCode.model';
import { NotFoundError } from '../utils/AppError';
import type { AuthService } from './auth.service';

interface Deps {
  /** The emailed one-time codes, sent and checked with the `deleteAccount` purpose. */
  codes: Pick<AuthService, 'requestCode' | 'useCode'>;
}

/**
 * Hard-deletes everything stored for an Account (ADR-0005). Sessions go
 * first, so no device can write while the rest is deleted, and the Account
 * last, so a deletion that fails partway can be confirmed again. Every model
 * with an `accountId` field is found by itself, so a new collection is
 * deleted too; one-time codes are found by email.
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

/**
 * Deleting an Account, confirmed with a code emailed to its address. The code
 * is auth's one-time code with the `deleteAccount` purpose, so it has the same
 * expiry, resend and guess limits, and a sign-in code never works here.
 */
export function createAccountDeletionService({ codes }: Deps) {
  async function emailOf(accountId: string): Promise<string> {
    const account = await Account.findById(accountId).select({ email: 1 }).lean();
    if (!account) throw new NotFoundError('Account not found');
    return account.email;
  }

  return {
    /** Emails a new deletion code, at most once a minute. */
    async requestCode(accountId: string, language: Language): Promise<RequestCodeData> {
      return codes.requestCode(await emailOf(accountId), language, 'deleteAccount');
    },

    /** Checks the code, then deletes the Account and all its data. */
    async confirm(accountId: string, code: string): Promise<void> {
      await codes.useCode(await emailOf(accountId), code, 'deleteAccount');
      await deleteAccountData(accountId);
    },
  };
}

export type AccountDeletionService = ReturnType<typeof createAccountDeletionService>;
