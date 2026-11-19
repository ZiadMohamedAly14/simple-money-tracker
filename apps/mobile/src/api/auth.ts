import type { AxiosInstance } from 'axios';
import {
  isApiEnvelope,
  type AuthErrorData,
  type AuthErrorReason,
  type Language,
  type RequestCodeBody,
  type RequestCodeData,
  type VerifyCodeBody,
  type VerifyCodeData,
} from '@money-tracker/shared';

/**
 * What a sign-in call ended with. `rejected` carries a reason the screen turns into
 * a translated message; `invalid_input` is a 422 (bad email or code format) and
 * `unknown` anything else the API refused.
 */
export type AuthResult<T> =
  | { status: 'ok'; data: T }
  | {
      status: 'rejected';
      reason: AuthErrorReason | 'invalid_input' | 'unknown';
      retryAfterSeconds?: number;
      attemptsRemaining?: number;
    }
  | { status: 'unreachable' };

function isAuthErrorData(value: unknown): value is AuthErrorData {
  return typeof value === 'object' && value !== null && typeof (value as AuthErrorData).reason === 'string';
}

async function post<T>(client: AxiosInstance, path: string, body: object): Promise<AuthResult<T>> {
  let status: number;
  let payload: unknown;
  try {
    ({ status, data: payload } = await client.post<unknown>(path, body));
  } catch {
    return { status: 'unreachable' };
  }
  if (!isApiEnvelope(payload)) return { status: 'rejected', reason: 'unknown' };
  if (payload.success) return { status: 'ok', data: payload.data as T };
  if (status === 422) return { status: 'rejected', reason: 'invalid_input' };
  if (isAuthErrorData(payload.data)) {
    const { reason, retryAfterSeconds, attemptsRemaining } = payload.data;
    return { status: 'rejected', reason, retryAfterSeconds, attemptsRemaining };
  }
  return { status: 'rejected', reason: 'unknown' };
}

/** `POST /auth/code`: emails a 6-digit code in the device's language. */
export function requestCode(client: AxiosInstance, email: string, language: Language): Promise<AuthResult<RequestCodeData>> {
  const body: RequestCodeBody = { email, language };
  return post(client, '/auth/code', body);
}

/** `POST /auth/verify`: signs in (creating the Account the first time) and returns tokens. */
export function verifyCode(client: AxiosInstance, body: VerifyCodeBody): Promise<AuthResult<VerifyCodeData>> {
  return post(client, '/auth/verify', body);
}
