# 11: Parent PIN and Parent Area gate

**What to build:** An adult sets a Parent PIN. On their own Personal-Mode device, the Parent Area opens only after the PIN or the device's biometrics, and this works offline.

**Blocked by:** 05 (Sync tracer bullet).

**Status:** ready-for-agent

- [ ] The PIN can be set and changed. The server stores only its hash on the Account.
- [ ] A Personal-Mode device keeps a copy of the PIN hash so it can check the PIN offline. A Kid-Mode device never receives it (ADR-0002).
- [ ] Biometrics are an optional shortcut on each device, through expo-local-authentication.
- [ ] Right after the PIN is first set (including in kid-path onboarding), a skippable prompt offers to use biometrics instead, shown only if the device has biometrics enrolled. The PIN always works as a fallback.
- [ ] Wrong PIN attempts on the device are throttled.
- [ ] Seam A tests cover setting and changing the PIN.
