# 03: Sign in with an email code

**What to build:** An adult enters their email, receives a 6-digit code in their language, enters it, and is signed in. Their Account is created on the first verify.

**Blocked by:** 02 (Bilingual shell and right-to-left layout).

**Status:** ready-for-agent

- [x] Request a code and verify a code. Verifying creates the Account if it doesn't exist (email lowercased and unique) and returns an access token, a refresh token and a new-Account flag. There's no separate registration step.
- [x] Codes are hashed and expire after 10 minutes. There are separate counters for codes sent and wrong guesses: at most 5 wrong guesses, and resends limited to one a minute and five an hour. Rate limits apply per IP and per email, and there's no hard-coded test code.
- [x] Emails are sent through Resend's SMTP with nodemailer, in the requesting device's language. Development uses a local email catcher instead.
- [x] Bilingual email and code screens store the tokens in SecureStore.
- [x] Seam A tests cover the happy path, a wrong code, an expired code, the limits, and an email entered in mixed case.

## Comments

Built on branch `ticket/03-email-code-sign-in`:

- **API:** `POST /auth/code` `{ email, language }` and `POST /auth/verify` `{ email, code, deviceLabel? }` (contract types in `@money-tracker/shared` `auth/signIn.ts`). One `SignInCode` document per email holds the HMAC-hashed code (`CODE_HASH_SECRET`), expiry, wrong-guess counter, resend counters and a TTL `purgeAt`. Guesses are counted atomically before comparing; a code is single-use. Per-IP limits via express-rate-limit (in memory; 20 code requests/hour, 50 verifies/15 min). Failures carry `data.reason` (`invalid_code`, `code_expired`, `too_many_guesses`, `resend_too_soon`, `too_many_codes`, `too_many_requests`) plus `attemptsRemaining` / `retryAfterSeconds`. Verify upserts the `Account` (lowercased unique email) and starts a `Session` (hashed refresh token, scope `full`, TTL expiry) via `services/token.service.ts`: access JWT 15 min / refresh JWT 90 days, separate secrets, `typ` marker, `sid` claim. Ticket 04 adds rotation, reuse revocation, logout and the auth middleware on top.
- **Email:** nodemailer SMTP (`SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM`), English/Arabic templates; Mailpit locally (README). `createApp(env, { mailer, now })` lets tests swap the mailer and clock.
- **Mobile:** `app/(auth)/sign-in.tsx` and `verify.tsx`, `src/api/auth.ts`, `src/auth/tokenStore.ts` (SecureStore). Home redirects to sign-in when no session is stored.
- **Tests:** `apps/api/test/auth.test.ts` (Seam A), shared `normalizeSignInCode`/`normalizeEmail`, mobile client error mapping.

**Human follow-up:**
- Create the Resend account, verify a sending domain, and set the SMTP/secret variables on Railway (README "Deployment").
- Manually check on a device: both screens in English and Arabic (RTL), real emails arrive in both languages, and the code keyboard/autofill works.
