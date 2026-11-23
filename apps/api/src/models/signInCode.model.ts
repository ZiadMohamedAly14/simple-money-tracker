import { Schema, model } from 'mongoose';

/**
 * The one-time code for an email, plus its counters. One document per email
 * and purpose (signing in, PIN reset, Account deletion), so each has its own
 * resend wait and a deletion code asked for right after signing in isn't
 * held back. A resend replaces the code but keeps the hourly "codes sent"
 * window. Wrong guesses count against the current code only.
 */
const signInCodeSchema = new Schema({
  email: { type: String, required: true },
  purpose: { type: String, required: true, default: 'signIn' },
  /** HMAC of email + code; unset once the code is used. */
  codeHash: { type: String, default: null },
  expiresAt: { type: Date, required: true },
  wrongGuesses: { type: Number, required: true, default: 0 },
  lastSentAt: { type: Date, required: true },
  windowStartedAt: { type: Date, required: true },
  sentInWindow: { type: Number, required: true },
  /** Deleted automatically once neither the code nor the hourly window matters any more. */
  purgeAt: { type: Date, required: true, expires: 0 },
});

signInCodeSchema.index({ email: 1, purpose: 1 }, { unique: true });

export const SignInCode = model('SignInCode', signInCodeSchema, 'SignInCodes');
