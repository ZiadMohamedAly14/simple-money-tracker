import type { TFunction } from 'i18next';
import type { AuthResult } from '@/api/auth';

/** The translated message for a failed sign-in call. */
export function authErrorMessage(t: TFunction, result: Exclude<AuthResult<unknown>, { status: 'ok' }>): string {
  if (result.status === 'unreachable') return t('auth.errors.unreachable');
  const seconds = result.retryAfterSeconds ?? 60;
  switch (result.reason) {
    case 'invalid_code':
      return t('auth.errors.invalid_code', { count: result.attemptsRemaining ?? 0 });
    case 'resend_too_soon':
      return t('auth.errors.resend_too_soon', { seconds });
    case 'too_many_codes':
    case 'too_many_requests':
      return t(`auth.errors.${result.reason}`, { minutes: Math.ceil(seconds / 60) });
    default:
      return t(`auth.errors.${result.reason}`);
  }
}
