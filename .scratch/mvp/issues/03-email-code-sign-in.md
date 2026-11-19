# 03: Sign in with an email code

**What to build:** An adult enters their email, receives a 6-digit code in their language, enters it, and is signed in. Their Account is created on the first verify.

**Blocked by:** 02 (Bilingual shell and right-to-left layout).

**Status:** ready-for-agent

- [ ] Request a code and verify a code. Verifying creates the Account if it doesn't exist (email lowercased and unique) and returns an access token, a refresh token and a new-Account flag. There's no separate registration step.
- [ ] Codes are hashed and expire after 10 minutes. There are separate counters for codes sent and wrong guesses: at most 5 wrong guesses, and resends limited to one a minute and five an hour. Rate limits apply per IP and per email, and there's no hard-coded test code.
- [ ] Emails are sent through Resend's SMTP with nodemailer, in the requesting device's language. Development uses a local email catcher instead.
- [ ] Bilingual email and code screens store the tokens in SecureStore.
- [ ] Seam A tests cover the happy path, a wrong code, an expired code, the limits, and an email entered in mixed case.
