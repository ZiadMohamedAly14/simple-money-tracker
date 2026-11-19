# 15: Parent access on a kid's device

**What to build:** A parent reaches the Parent Area on their child's phone by entering the PIN while online. They can also manage and revoke Kid-Mode devices and reset a forgotten PIN.

**Blocked by:** 14 (Kid-Mode device).

**Status:** ready-for-agent

- [ ] PIN elevation: the server checks the PIN with rate limiting and returns a short-lived full access token with no refresh. When offline, the device explains that the Parent Area needs internet.
- [ ] Leaving Kid Mode requires the PIN.
- [ ] Kid-Mode devices can be listed and revoked from the Parent Area. A revoked device is signed out on its next sync.
- [ ] A forgotten PIN can be reset with an email code.
- [ ] Seam A tests cover elevation, its rate limit, revocation and PIN reset.
