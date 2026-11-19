/**
 * The sign-in contract shared by the API and the app: request a code, then
 * verify it. Verifying creates the Account on first use (no registration step).
 */
import { toWesternDigits } from '../i18n/digits';
import type { Language } from '../i18n/language';

export const SIGN_IN_CODE_LENGTH = 6;

/** `POST /auth/code` body. `language` picks the email's language (the device's language). */
export interface RequestCodeBody {
  email: string;
  language: Language;
}

/** `POST /auth/code` success data. */
export interface RequestCodeData {
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

/** `POST /auth/verify` body. */
export interface VerifyCodeBody {
  email: string;
  code: string;
  /** Optional human label for the session, e.g. the phone model. */
  deviceLabel?: string;
}

/** `POST /auth/verify` success data. */
export interface VerifyCodeData {
  accessToken: string;
  refreshToken: string;
  isNewAccount: boolean;
  account: { id: string; email: string };
}

/**
 * Machine-readable reason in `data.reason` of a failed auth request, so the app
 * can show its own translated message instead of the API's English one.
 */
export type AuthErrorReason =
  | 'invalid_code' // 400, data.attemptsRemaining
  | 'code_expired' // 400: expired, already used, or never requested
  | 'too_many_guesses' // 429: request a new code
  | 'resend_too_soon' // 429, data.retryAfterSeconds
  | 'too_many_codes' // 429, data.retryAfterSeconds
  | 'too_many_requests'; // 429 per-IP limit, data.retryAfterSeconds

export interface AuthErrorData {
  reason: AuthErrorReason;
  attemptsRemaining?: number;
  retryAfterSeconds?: number;
}

/** The emails `a@x.com` and ` A@X.com` are the same Account. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** What the user typed as the code, as six Western digits, or null if it isn't a code. */
export function normalizeSignInCode(input: string): string | null {
  const code = toWesternDigits(input).replace(/\s/g, '');
  return new RegExp(`^\\d{${SIGN_IN_CODE_LENGTH}}$`).test(code) ? code : null;
}
