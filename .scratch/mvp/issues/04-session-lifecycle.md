# 04: Session lifecycle

**What to build:** A signed-in adult stays signed in across restarts and long offline stretches, can sign out, and a stolen refresh token gets the session revoked.

**Blocked by:** 03 (Sign in with an email code).

**Status:** ready-for-agent

- [x] Access tokens last 15 minutes and refresh tokens 90 days. They use separate secrets and carry a type marker, so a refresh token is rejected where an access token is expected.
- [x] Sessions store the hashed refresh token, its scope and expiry (deleted automatically), and a rotation family. Each refresh issues a new token atomically.
- [x] Reusing an already-replaced refresh token revokes the whole session.
- [x] Logout revokes the session.
- [x] The app refreshes tokens automatically and never needs a valid token to work offline.
- [x] When the refresh token has expired, local data stays visible and the app asks for a new code before syncing.
- [x] Seam A tests cover rotation, reuse revocation, logout and token-type confusion.

## Comments

Built:
- API: `POST /auth/refresh` `{refreshToken}` returns a new `{accessToken, refreshToken}`. Rotation is one conditional `findOneAndUpdate` on the stored hash; a validly signed refresh token that isn't the current one deletes the Session (reuse revocation). Each refresh extends the Session by 90 days. `POST /auth/logout` (Bearer access token) deletes the Session. `requireAuth(tokens)` middleware checks the access secret, `typ: 'access'` and that the Session is still live, and sets `req.auth = { accountId, sessionId, scope }`. 401s carry `data.reason`: `token_invalid` (refresh and retry) or `session_ended` (a new code is needed).
- The Session document is the rotation family: all its refresh tokens carry its `sid`; `rotations` counts rotations.
- Mobile: `createAuthSession` (`src/auth/authSession.ts`), app singleton `authSession` and `useAuthStatus()` (`src/auth/appSession.ts`). Statuses `signedOut | signedIn | needsSignIn`. The session is read from SecureStore only, so opening the app needs no network. One shared refresh at a time; being offline leaves tokens untouched; a refused refresh keeps the Account, drops the tokens, and the home screen shows a sign-in-again notice (email prefilled). Minimal sign-out button on the home screen.
- Tests: `apps/api/test/session.test.ts` (Seam A), `apps/mobile/src/auth/authSession.test.ts`.

**Human follow-up:**
- Manual device check: sign in, close the app, reopen offline (still signed in); sign out; end a session (e.g. reuse or delete it in the DB) and see the sign-in-again notice.
- If a *different* Account signs in after `needsSignIn`, the old Account's local data must be wiped; that belongs with the local database/sync tickets.
