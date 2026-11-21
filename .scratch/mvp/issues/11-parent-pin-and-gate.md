# 11: Parent PIN and Parent Area gate

**What to build:** An adult sets a Parent PIN. On their own Personal-Mode device, the Parent Area opens only after the PIN or the device's biometrics, and this works offline.

**Blocked by:** 05 (Sync tracer bullet).

**Status:** ready-for-agent

- [x] The PIN can be set and changed. The server stores only its hash on the Account.
- [x] A Personal-Mode device keeps a copy of the PIN hash so it can check the PIN offline. A Kid-Mode device never receives it (ADR-0002).
- [x] Biometrics are an optional shortcut on each device, through expo-local-authentication.
- [x] Right after the PIN is first set (including in kid-path onboarding), a skippable prompt offers to use biometrics instead, shown only if the device has biometrics enrolled. The PIN always works as a fallback.
- [x] Wrong PIN attempts on the device are throttled.
- [x] Seam A tests cover setting and changing the PIN.

## Comments

Built on `ticket/11-parent-pin-and-gate`:

- **Shared** (`src/pin/parentPin.ts`): `isValidParentPin` (4–6 Western digits), `hashParentPin`/`verifyParentPin` as PBKDF2-SHA256 in pure JS (`@noble/hashes@1.8`, the last CJS-compatible line), stored as `pbkdf2-sha256$10000$<salt>$<hash>` so server and device check the same value; `pinRetryAfterSeconds` (5 free wrong tries, then 30 s doubling to a 15 min cap), used by both server and device. Contract types `SetParentPinBody`, `ParentPinData`, `ParentPinErrorData`. Seam C tests include a known-answer check against Node's `pbkdf2Sync`.
- **API:** `GET /account/pin` → `{ pinHash }` and `PUT /account/pin { pin, currentPin? }` → `{ pinHash }`, behind `requireAuth` + new `requireFullScope` (Kid Session gets 403 `kid_session`, ADR-0002). Account gains `parentPinHash`, `pinFailures`, `pinLockedUntil`. Setting the first PIN is a conditional write on `parentPinHash: null`; changing needs `currentPin`, checked with a compare-and-set on the failure count before comparing, so parallel guesses can't skip the throttle (403 `wrong_pin` + `attemptsRemaining`, 429 `pin_locked` + `retryAfterSeconds`). `ParentPinService.checkPin` is the piece ticket 15's elevation can reuse. Seam A: `apps/api/test/parentPin.test.ts` (set, change, validation, throttle, kid scope refused).
- **Mobile:** `src/pin/parentPinGate.ts` (`createParentPinGate`): fetches and keeps the hash copy (SecureStore, tagged with the Account id so another Account's leftovers are never used; forgotten on sign-out), checks the PIN offline, persists the wrong-PIN throttle across restarts, optional biometrics (`enableBiometrics` needs one successful scan; not used once the device has no biometrics enrolled; a successful scan clears the wrong count). `src/pin/appPinGate.ts` wires it to the app (expo-local-authentication with `disableDeviceFallback`, refresh on every sign-in/app start, Parent Area unlock state that locks on background and sign-out). Tested at Seam B against the real API: `src/pin/parentPinGate.seamB.test.ts`.
- **Screens:** `app/parent/_layout.tsx` (gate: PIN dots + digits-only keypad, lock countdown, biometrics button and auto-prompt; no PIN yet → `/pin/set?next=/parent`), `app/parent/index.tsx` (placeholder Parent Area with Change PIN and Lock), `app/pin/set.tsx` (first set: new + confirm; change: current + new + confirm; takes `next` so kid onboarding in ticket 12 can reuse it), `app/pin/biometrics.tsx` (skippable offer, shown only with biometrics enrolled). New `PinDots` UI component; Parent Area button on the home screen; EN/AR strings.
- **Test infra:** Seam B `TestServer.clear()` now also restarts the Express app so per-IP code limits reset between tests (the PIN tests sign in more than 20 times per file).

Left over / notes:
- Setting or changing the PIN needs the internet (the server holds it); the screen says so. Checking it doesn't.
- The device throttle uses the device clock, so changing the phone's clock can shorten a wait. Acceptable for the parent's own phone; the Kid-Mode path checks on the server (ticket 15).
- A PIN changed on another device reaches this one on the next sign-in, app start, or opening the gate while online; until then the old PIN still opens the gate offline.
- The Settings switch for biometrics is ticket 17 (`enableBiometrics`/`disableBiometrics`/`biometricsEnabled` are ready). PIN reset by email code is ticket 15.

**Human follow-up:**
- Rebuild the dev client / EAS build: `expo-local-authentication` is a new native module with a config plugin (adds `USE_BIOMETRIC` and the iOS Face ID string).
- Deploy the API so `/account/pin` exists on Railway.
- Manual device check in English and Arabic: set a PIN from the home screen's Parent Area button, accept/skip the biometrics offer, reopen the Parent Area in airplane mode with PIN and with fingerprint, enter 5 wrong PINs and see the countdown, change the PIN, background the app and see the area lock again.
