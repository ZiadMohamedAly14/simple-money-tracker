# 19: Tester release

**What to build:** A tester installs a preview APK and completes both the Personal and Kid experiences end to end, in both languages.

**Blocked by:** 08, 10, 15, 16, 17, 18.

**Status:** ready-for-agent

- [ ] EAS builds a preview APK, with over-the-air updates through expo-updates switched on.
- [ ] Right-to-left visual pass and basic accessibility pass (touch target sizes, screen-reader labels).
- [ ] A nightly `mongodump` backup job is running.
- [ ] A manual end-to-end checklist is run in English and in Arabic, offline and online, across two devices plus a Kid-Mode device.
