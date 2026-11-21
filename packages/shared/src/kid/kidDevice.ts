/**
 * The Kid-Mode device contract (ADR-0002). A parent signed in on the kid's
 * phone (a full session) confirms the Parent PIN and picks a Kid Profile; the
 * server ends that full session and starts a Kid Session in its place.
 */

/** `POST /kid-devices` body. */
export interface StartKidSessionBody {
  kidProfileId: string;
  pin: string;
  /** Optional human label for the device, e.g. "Omar's phone"; ticket 15 lists devices by it. */
  deviceLabel?: string;
}

/** `POST /kid-devices` success data: the Kid Session's tokens. The full session's tokens no longer work. */
export interface KidSessionData {
  accessToken: string;
  refreshToken: string;
  kidProfileId: string;
}

/**
 * `data.reason` of a refused `POST /kid-devices`:
 * - `wrong_pin` (403, `attemptsRemaining`) and `pin_locked` (429, `retryAfterSeconds`), as for the PIN gate;
 * - `no_pin` (409): set a Parent PIN first;
 * - `kid_not_found` (404): not this Account's Kid Profile, or deleted or archived;
 * - `kid_session` (403): only a full session can set up a Kid-Mode device. `POST /sync`
 *   uses the same reason for a change a Kid Session may not make.
 */
export interface KidSessionErrorData {
  reason: 'wrong_pin' | 'pin_locked' | 'no_pin' | 'kid_not_found' | 'kid_session';
  attemptsRemaining?: number;
  retryAfterSeconds?: number;
}

/** `POST /kid-devices/elevate` body: a Kid Session asks for full access with the Parent PIN (ticket 15). */
export interface ElevateBody {
  pin: string;
}

/**
 * `POST /kid-devices/elevate` success data: a short-lived full access token for
 * the Parent Area on a Kid-Mode device. There is no refresh token; the device
 * keeps it in memory only and asks for the PIN again once it expires (ADR-0002).
 */
export interface ElevatedAccessData {
  accessToken: string;
  expiresInSeconds: number;
}

/**
 * `data.reason` of a refused `POST /kid-devices/elevate`:
 * - `wrong_pin` (403) and `pin_locked` (429), throttled with the PIN gate's rule;
 * - `no_pin` (409): no Parent PIN is set;
 * - `not_kid_session` (403): only a Kid Session elevates; a full session already has full access.
 */
export interface ElevateErrorData {
  reason: 'wrong_pin' | 'pin_locked' | 'no_pin' | 'not_kid_session';
  attemptsRemaining?: number;
  retryAfterSeconds?: number;
}

/** One Kid-Mode device in `GET /kid-devices`. */
export interface KidDeviceSummary {
  /** The Kid Session's id; `DELETE /kid-devices/:id` revokes it. */
  id: string;
  kidProfileId: string;
  /** Set to the kid's name when the device was set up. */
  deviceLabel: string | null;
  /** When the device was set up, and when it last refreshed its sign-in (epoch ms). */
  createdAt: number;
  lastActiveAt: number;
  /** The device asking: a Kid-Mode device elevated with the PIN. */
  current: boolean;
}

/** `GET /kid-devices` success data, newest first. */
export interface KidDevicesData {
  devices: KidDeviceSummary[];
}
