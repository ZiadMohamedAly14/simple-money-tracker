# 19: Tester release

**What to build:** A tester installs a preview APK and completes both the Personal and Kid experiences end to end, in both languages.

**Blocked by:** 08, 10, 15, 16, 17, 18.

**Status:** ready-for-agent

- [x] EAS builds a preview APK, with over-the-air updates through expo-updates switched on.
- [x] Right-to-left visual pass and basic accessibility pass (touch target sizes, screen-reader labels). The code half is done; the by-eye half is in the checklist.
- [ ] A nightly `mongodump` backup job is running.
- [ ] A manual end-to-end checklist is run in English and in Arabic, offline and online, across two devices plus a Kid-Mode device.

## Comments

- **Preview APK and over-the-air updates:** `expo-updates` is switched on (`c3a1cf8`), with the app version as the runtime version and a channel for each EAS profile. npm overrides pin a single copy of react, reanimated and worklets, and expo-doctor passes 20/20. The adult runs the build (`eas build --profile preview --platform android`).
- **RTL and accessibility code pass (merge `21a590b`):**
  - touch targets reach 44 dp or more (chips, the date pill, calendar days, info icons);
  - rows and amount displays read "label, amount" to screen readers, with the action as a hint;
  - the kid history plus sign and the server URL sit in LTR isolates;
  - Top-up percentages are formatted with `Intl`;
  - Learn scrolls.
- **Checklist:** `.scratch/mvp/e2e-checklist.md`. It includes the Arabic checks that need someone looking at the screen.
- **Nightly `mongodump`:** the user deferred it. Testers use pretend money, so losing data isn't serious. Set up backups before real users.

