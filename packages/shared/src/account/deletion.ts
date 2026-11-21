/**
 * The Account deletion contract. An adult asks for a code by email, then
 * confirms with it; the server hard-deletes every collection for the Account
 * (ADR-0005) and ends every session, Kid Sessions included. Refusals carry the
 * sign-in code reasons (`AuthErrorData`): `invalid_code`, `code_expired`,
 * `too_many_guesses`, `resend_too_soon`, or `kid_session` (403) from a Kid-Mode device.
 */
import type { Language } from '../i18n/language';

/** `POST /account/deletion/code` body. `language` picks the email's language. Success data is `RequestCodeData`. */
export interface RequestDeletionCodeBody {
  language: Language;
}

/** `POST /account/deletion` body. Success data is null: the Account is gone. */
export interface ConfirmDeletionBody {
  code: string;
}
