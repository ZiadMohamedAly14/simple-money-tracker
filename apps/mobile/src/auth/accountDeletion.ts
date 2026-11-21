import type { AxiosRequestConfig } from 'axios';
import {
  isApiEnvelope,
  type AuthErrorData,
  type AuthErrorReason,
  type ConfirmDeletionBody,
  type Language,
  type RequestDeletionCodeBody,
} from '@money-tracker/shared';
import type { AuthSession, AuthedResult } from './authSession';

/**
 * How a deletion step ended. `rejected` carries the code's problem for the
 * screen to translate; `unreachable` means offline (deletion needs internet);
 * `session_ended` means sign in again first.
 */
export type DeletionResult =
  | { status: 'ok' }
  | {
      status: 'rejected';
      reason: AuthErrorReason | 'invalid_input' | 'unknown';
      attemptsRemaining?: number;
      retryAfterSeconds?: number;
    }
  | { status: 'unreachable' | 'session_ended' };

export interface AccountDeletionDeps {
  /** An authenticated API call (`authSession.request`). */
  request: (config: AxiosRequestConfig) => Promise<AuthedResult>;
  auth: Pick<AuthSession, 'forget'>;
}

function toResult(result: AuthedResult): DeletionResult {
  if (result.status !== 'ok') return { status: result.status };
  const { body, httpStatus } = result;
  if (!isApiEnvelope(body)) return { status: 'rejected', reason: 'unknown' };
  if (body.success) return { status: 'ok' };
  if (httpStatus === 422) return { status: 'rejected', reason: 'invalid_input' };
  const data = body.data as Partial<AuthErrorData> | null;
  if (typeof data?.reason !== 'string') return { status: 'rejected', reason: 'unknown' };
  const rejected: DeletionResult = { status: 'rejected', reason: data.reason as AuthErrorReason };
  if (data.attemptsRemaining !== undefined) rejected.attemptsRemaining = data.attemptsRemaining;
  if (data.retryAfterSeconds !== undefined) rejected.retryAfterSeconds = data.retryAfterSeconds;
  return rejected;
}

/**
 * Deleting the Account (Settings → Delete account): ask for a code by email,
 * then confirm with it. Once the server has deleted everything, this device
 * forgets the session and wipes its local data, unsynced changes included.
 */
export function createAccountDeletion({ request, auth }: AccountDeletionDeps) {
  return {
    async requestCode(language: Language): Promise<DeletionResult> {
      const body: RequestDeletionCodeBody = { language };
      return toResult(await request({ method: 'POST', url: '/account/deletion/code', data: body }));
    },

    async confirm(code: string): Promise<DeletionResult> {
      const body: ConfirmDeletionBody = { code };
      const result = toResult(await request({ method: 'POST', url: '/account/deletion', data: body }));
      if (result.status === 'ok') await auth.forget();
      return result;
    },
  };
}

export type AccountDeletion = ReturnType<typeof createAccountDeletion>;
