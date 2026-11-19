# 12: Kid Profiles, Jars and Top-ups

**What to build:** A parent creates a Kid Profile (during the kid onboarding path or later from Personal), gets Save, Spend and Give Jars, and tops up the Kid Wallet with a split across Jars. They can see the wallet from their own phone.

**Blocked by:** 07 (Personal onboarding and Month overview), 11 (Parent PIN and Parent Area gate).

**Status:** ready-for-agent

- [ ] Kid onboarding path: currency, create a Kid Profile (name, optional avatar), set the Parent PIN, then an optional first Top-up.
- [ ] Several Kid Profiles can be added from the Personal experience's Parent Area.
- [ ] Default Jars are created. In the Parent Area, Jars can be added, renamed and archived.
- [ ] Top-up with a split across Jars. The split must add up to the total, checked on the server too, and the last split is remembered (defaulting to all Spend).
- [ ] Parents can edit and delete Top-ups.
- [ ] The Kid wallet view (Jar balances) uses the Kid theme. Balances are worked out by a shared function with Seam C tests.
- [ ] Everything works offline on the parent's device.
