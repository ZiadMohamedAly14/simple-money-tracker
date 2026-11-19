/** English strings. The source of truth for keys; ar.ts must match its shape. */
export const en = {
  common: {
    appName: 'Money Tracker',
    ok: 'OK',
    cancel: 'Cancel',
  },
  health: {
    title: 'Connection',
    ok: 'API: ok',
    error: 'API: {{message}}',
    unexpected: 'API: unexpected response',
    unreachable: 'API: unreachable',
    sampleAmount: 'Sample amount',
    details: 'Details',
  },
  auth: {
    signInTitle: 'Sign in',
    signInIntro: "Enter your email and we'll send you a 6-digit code. No password needed.",
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    sendCode: 'Send code',
    verifyTitle: 'Enter your code',
    verifyIntro: 'We sent a 6-digit code to {{email}}. It expires in 10 minutes.',
    codeLabel: 'Code',
    verify: 'Sign in',
    resend: 'Send a new code',
    resendIn: 'Send a new code in {{seconds}} s',
    changeEmail: 'Use a different email',
    errors: {
      invalidEmail: 'Enter a valid email address.',
      invalidCode: 'Enter the 6-digit code from the email.',
      invalid_code: 'That code is not right. {{count}} tries left.',
      code_expired: 'This code has expired or was already used. Send a new code.',
      too_many_guesses: 'Too many wrong codes. Send a new code.',
      resend_too_soon: 'Please wait {{seconds}} s before asking for another code.',
      too_many_codes: "You've asked for too many codes. Try again in {{minutes}} min.",
      too_many_requests: 'Too many attempts from this network. Try again in {{minutes}} min.',
      invalid_input: 'Check what you entered and try again.',
      unknown: 'Something went wrong. Please try again.',
      unreachable: "Can't reach the server. Check your connection.",
      token_invalid: 'Your sign-in needs refreshing. Please try again.',
      session_ended: 'Your session has ended. Sign in again.',
    },
  },
  session: {
    needsSignInBody: 'Your data is still here. Sign in again to keep syncing it.',
    signInAgain: 'Sign in again',
    signOut: 'Sign out',
  },
  language: {
    label: 'Language',
    en: 'English',
    ar: 'العربية',
    restartTitle: 'The app will restart',
    restartBody: 'The app needs to restart to switch the layout direction.',
    restart: 'Restart',
  },
};

/** Same keys as English, with every value a string. */
type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };
export type Translations = Shape<typeof en>;
