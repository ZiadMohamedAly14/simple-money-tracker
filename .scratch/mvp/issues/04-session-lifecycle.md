# 04: Session lifecycle

**What to build:** A signed-in adult stays signed in across restarts and long offline stretches, can sign out, and a stolen refresh token gets the session revoked.

**Blocked by:** 03 (Sign in with an email code).

**Status:** ready-for-agent

- [ ] Access tokens last 15 minutes and refresh tokens 90 days. They use separate secrets and carry a type marker, so a refresh token is rejected where an access token is expected.
- [ ] Sessions store the hashed refresh token, its scope and expiry (deleted automatically), and a rotation family. Each refresh issues a new token atomically.
- [ ] Reusing an already-replaced refresh token revokes the whole session.
- [ ] Logout revokes the session.
- [ ] The app refreshes tokens automatically and never needs a valid token to work offline.
- [ ] When the refresh token has expired, local data stays visible and the app asks for a new code before syncing.
- [ ] Seam A tests cover rotation, reuse revocation, logout and token-type confusion.
