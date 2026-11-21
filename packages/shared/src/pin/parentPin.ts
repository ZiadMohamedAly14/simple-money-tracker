/**
 * The Parent PIN (see GLOSSARY): 4 to 6 Western digits. The server stores only
 * its hash, and a Personal-Mode device keeps a copy of that hash so it can
 * check the PIN offline (ADR-0002). Both sides use these functions, so the
 * hash is plain PBKDF2-SHA256 in pure JS (no Node or React Native crypto).
 *
 * A 4–6 digit PIN can be brute forced from its hash whatever the work factor,
 * which is why a Kid-Mode device never receives it (ADR-0002). The iteration
 * count only slows that down; it is kept low enough to check quickly on a phone.
 */
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';
import { utf8ToBytes } from '@noble/hashes/utils';
import type { Language } from '../i18n/language';

export const PARENT_PIN_MIN_LENGTH = 4;
export const PARENT_PIN_MAX_LENGTH = 6;
export const PARENT_PIN_SALT_BYTES = 16;

const SCHEME = 'pbkdf2-sha256';
const ITERATIONS = 10_000;
const MAX_ITERATIONS = 1_000_000;
const KEY_BYTES = 32;

export function isValidParentPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^[0-9]{4,6}$/.test(pin);
}

/** `pbkdf2-sha256$<iterations>$<salt>$<hash>`, salt and hash in unpadded base64url. */
export async function hashParentPin(pin: string, salt: Uint8Array): Promise<string> {
  const key = await derive(pin, salt, ITERATIONS);
  return [SCHEME, String(ITERATIONS), toBase64Url(salt), toBase64Url(key)].join('$');
}

/** True only if `pin` is the PIN `stored` was made from. False for anything unreadable. */
export async function verifyParentPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== SCHEME) return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) return false;
  const salt = fromBase64Url(parts[2]!);
  const expected = fromBase64Url(parts[3]!);
  if (!salt || !expected || salt.length === 0 || expected.length !== KEY_BYTES) return false;
  const actual = await derive(pin, salt, iterations);
  let difference = 0;
  for (let i = 0; i < KEY_BYTES; i += 1) difference |= actual[i]! ^ expected[i]!;
  return difference === 0;
}

/**
 * Wrong PIN throttle: how long to wait before the next try after `failures`
 * wrong PINs in a row. The first 5 are free, then 30 s, doubling, up to 15 minutes.
 */
export const PIN_FREE_ATTEMPTS = 5;
const FIRST_WAIT_SECONDS = 30;
const MAX_WAIT_SECONDS = 15 * 60;

export function pinRetryAfterSeconds(failures: number): number {
  if (failures < PIN_FREE_ATTEMPTS) return 0;
  const doublings = failures - PIN_FREE_ATTEMPTS;
  return Math.min(MAX_WAIT_SECONDS, FIRST_WAIT_SECONDS * 2 ** Math.min(doublings, 16));
}

function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  return pbkdf2Async(sha256, utf8ToBytes(pin), salt, { c: iterations, dkLen: KEY_BYTES });
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = Math.min(4, Math.ceil(((bytes.length - i) * 8) / 6));
    for (let c = 0; c < chars; c += 1) out += ALPHABET[(n >> (18 - 6 * c)) & 63];
  }
  return out;
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
  const bytes = new Uint8Array(Math.floor((text.length * 6) / 8));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of text) {
    buffer = ((buffer << 6) | ALPHABET.indexOf(char)) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[index++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}

/** `PUT /account/pin` body. `currentPin` is required once a PIN exists (changing it). */
export interface SetParentPinBody {
  pin: string;
  currentPin?: string;
}

/** `POST /account/pin/reset-code` body: the language of the email. */
export interface RequestPinResetBody {
  language: Language;
}

/**
 * `POST /account/pin/reset` body: a forgotten PIN replaced using the code emailed
 * by `/account/pin/reset-code`. Answers like `PUT /account/pin`; a bad code fails
 * like `POST /auth/verify` (`invalid_code`, `code_expired`, `too_many_guesses`).
 */
export interface ResetParentPinBody {
  code: string;
  pin: string;
}

/**
 * `GET /account/pin` and `PUT /account/pin` success data: the stored hash, or
 * null if no PIN is set. Only full (Personal-Mode) sessions get it (ADR-0002).
 */
export interface ParentPinData {
  pinHash: string | null;
}

/**
 * `data.reason` of a refused `PUT /account/pin`: `wrong_pin` (403, with
 * `attemptsRemaining` before a wait), `pin_locked` (429, `retryAfterSeconds`),
 * `kid_session` (403: a Kid-Mode device can't read or set the PIN).
 */
export interface ParentPinErrorData {
  reason: 'wrong_pin' | 'pin_locked' | 'kid_session';
  attemptsRemaining?: number;
  retryAfterSeconds?: number;
}
