import { sha256Hex } from './sha256';

/** `n` cryptographically random bytes. The device passes expo-crypto's; Node tests pass node:crypto's. */
export type RandomBytes = (n: number) => Uint8Array;

const hex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

const hyphenate = (h: string): string =>
  `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;

/**
 * A UUIDv7 (RFC 9562): 48 bits of Unix milliseconds, then random bits. Every
 * synced record gets one on the device that creates it (ADR-0006), so IDs sort
 * by creation time and need no coordination between devices.
 */
export function uuidv7(nowMs: number, randomBytes: RandomBytes): string {
  const bytes = new Uint8Array(16);
  let time = Math.floor(nowMs);
  for (let i = 5; i >= 0; i -= 1) {
    bytes[i] = time % 256;
    time = Math.floor(time / 256);
  }
  bytes.set(randomBytes(10).subarray(0, 10), 6);
  bytes[6] = 0x70 | (bytes[6]! & 0x0f); // version 7
  bytes[8] = 0x80 | (bytes[8]! & 0x3f); // RFC 9562 variant
  return hyphenate(hex(bytes));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A lowercase, hyphenated UUID: the only ID shape synced records accept. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** Record kinds with one fixed ID per Account. Never renumber: the IDs are stored. */
const FIXED_KIND = { otherCategory: '000001', accountSettings: '000002' } as const;

/**
 * A UUID (version 8, "custom") made from an Account's 24-hex ObjectId and a
 * fixed record kind, so every device and the server agree on it offline.
 */
function fixedId(accountId: string, kind: string): string {
  if (!/^[0-9a-f]{24}$/.test(accountId)) throw new Error(`Not an Account id: ${accountId}`);
  const a = accountId;
  return hyphenate(`${a.slice(0, 12)}8${a.slice(12, 15)}8${a.slice(15, 24)}${kind}`);
}

/**
 * The ID of an Account's Other Category. It is fixed so that a device that has
 * never synced can record an Expense against Other, and the server's copy
 * (created on first sync) is the same record.
 */
export function otherCategoryId(accountId: string): string {
  return fixedId(accountId, FIXED_KIND.otherCategory);
}

/** The ID of an Account's settings record (currency, numbering system): one per Account. */
export function accountSettingsId(accountId: string): string {
  return fixedId(accountId, FIXED_KIND.accountSettings);
}

/**
 * A UUID (version 8) from the SHA-256 of the given parts. Two devices that
 * create "the same" record offline (the same Month, say) derive the same ID,
 * so after sync there is one record, not two (spec, Data model).
 */
function derivedId(kind: string, accountId: string, ...parts: string[]): string {
  if (!/^[0-9a-f]{24}$/.test(accountId)) throw new Error(`Not an Account id: ${accountId}`);
  const h = sha256Hex([kind, accountId, ...parts].join('\n'));
  const variant = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  return hyphenate(`${h.slice(0, 12)}8${h.slice(13, 16)}${variant}${h.slice(17, 32)}`);
}

/** The ID of an Account's plan for a Month (`YYYY-MM`). */
export function monthPlanId(accountId: string, month: string): string {
  return derivedId('monthPlan', accountId, month);
}

/** The ID of an Account's budget for one Category in one Month. */
export function categoryBudgetId(accountId: string, month: string, categoryId: string): string {
  return derivedId('categoryBudget', accountId, month, categoryId);
}

/** The ID of one of the default Categories made at onboarding (`key` from `DEFAULT_CATEGORY_KEYS`). */
export function defaultCategoryId(accountId: string, key: string): string {
  return derivedId('defaultCategory', accountId, key);
}

/**
 * The ID of one of a Kid Profile's default Jars (`key` from `DEFAULT_JAR_KEYS`).
 * Fixed so the app can tell which Jar is Spend (the default split, and where
 * rounding remainders go) even after the parent renames it.
 */
export function defaultJarId(accountId: string, kidProfileId: string, key: string): string {
  return derivedId('defaultJar', accountId, kidProfileId, key);
}
