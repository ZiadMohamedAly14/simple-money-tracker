# 14: Kid-Mode device

**What to build:** A parent sets up their child's own phone. After setup the device shows only that child's wallet and Learn, and the device can't technically reach anything else.

**Blocked by:** 06 (Robust sync), 13 (Kid Expenses, Jar Transfers and history).

**Status:** ready-for-agent

- [ ] Setup flow: sign in with an email code, choose "This device is for a kid", pick or create a Kid Profile, confirm the PIN. The device swaps to a Kid session and deletes the full tokens (ADR-0002).
- [ ] The Kid session's scope covers one Kid Profile. Sync only returns that profile's records and only accepts Kid Expenses for it.
- [ ] Seam A tests: a Kid session can't read Personal data, Top-ups, Jar Transfers or other kids, and can't write them.
- [ ] A Seam B scenario: a Kid-Mode device only ever holds its Kid Profile's records.
