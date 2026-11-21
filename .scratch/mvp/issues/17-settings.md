# 17: Settings

**What to build:** An adult adjusts language, digit style and currency label, and signs out, from one settings screen.

**Blocked by:** 04 (Session lifecycle), 07 (Personal onboarding and Month overview), 11 (Parent PIN and Parent Area gate).

**Status:** resolved

- [x] Language (per device, with the restart flow from 02).
- [x] Numbering system: Western or Arabic-Indic.
- [x] Changing the currency relabels amounts without converting them, and syncs as an Account setting.
- [x] Biometrics for the Parent Area can be turned on or off for this device (from 11), shown only once a Parent PIN exists.
- [x] Signing out revokes the session and clears local data.

## Comments

Built on `ticket/17-settings`:

- **Data (Seam B, `apps/mobile/src/sync/settings.seamB.test.ts`):** `changeAccountSettings(store, db, { currency?, numberingSystem? })` in `src/data/budget.ts` writes the Account settings record (fixed ID `accountSettingsId`) with the other field kept. Tests: changing the currency on one device relabels without touching amounts (expenses, Expected Income, Spending) and reaches a second device; switching to Arabic-Indic digits offline keeps the currency and syncs; signing out deletes the server Session and leaves no Account settings, Month plans or onboarding state on the device. `TestServer.sessionCount()` was added for that last check.
- **Biometrics:** `ParentPinGate.biometricsSetting()` returns `hidden` (no Parent PIN yet, or no biometrics enrolled), `on` or `off`. Tested in `parentPinGate.seamB.test.ts`. The switch uses ticket 11's `enableBiometrics` (one successful scan first) and `disableBiometrics`.
- **Screens:** `app/settings/index.tsx` has language (segmented control, using 02's `switchLanguage` and its restart notice), digits (Western / Arabic-Indic segmented control), a currency row leading to `app/settings/currency.tsx` (the onboarding currency list, with a note that amounts aren't converted), the biometrics switch (re-checked on focus, so it shows up right after a PIN is set), a Connection row to `/health`, and Sign out. Sign out asks first and warns when unsynced changes would be lost (`localStore.pendingCount()`). The home screen's settings button now opens `/settings`. `/health` no longer holds language or sign-out. EN/AR strings are under `settings`.
- Screens already format with `useAccountSettings().numberingSystem`, so a digits change shows everywhere at once.

Left over / notes:
- Language stays a device setting (AsyncStorage) and isn't cleared by sign-out.
- Account deletion (ticket 18) and any Kid-Profile settings (ticket 12) are not here. Ticket 18 should add its "Delete account" row to `app/settings/index.tsx`.
- Changing the currency on a device that hasn't received the Account settings yet writes the fallback numbering system (Western). Last edit wins (ADR-0001), so this can only overwrite a digits choice made elsewhere that hasn't synced yet.
- The seams used are the spec's Seam B (simulated devices with the real API). Screens are checked by hand, as the spec says.

**Human follow-up:**
- Manual device check in English and Arabic: open Settings from home; switch language (restart notice when the direction changes); switch digits and see home amounts change; change the currency and see the label change on a second device after sync, with amounts the same; with no PIN the biometrics row is hidden, after setting a PIN it shows up, turning it on needs a scan; sign out with and without unsynced changes (warning text), and confirm the device shows sign-in with no data left.
