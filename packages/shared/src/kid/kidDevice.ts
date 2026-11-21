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
