import { Schema, model } from 'mongoose';

/**
 * The emailed code that confirms deleting an Account. One per Account; a
 * resend replaces it. Kept apart from sign-in codes, so neither works as the
 * other. Deleted with the Account, or automatically once it expires.
 */
const accountDeletionCodeSchema = new Schema({
  accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, unique: true },
  /** HMAC of the Account id + code; unset once the code is used up. */
  codeHash: { type: String, default: null },
  wrongGuesses: { type: Number, required: true, default: 0 },
  lastSentAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});

export const AccountDeletionCode = model('AccountDeletionCode', accountDeletionCodeSchema);
