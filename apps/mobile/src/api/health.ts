import type { AxiosInstance } from 'axios';
import { isApiEnvelope } from '@money-tracker/shared';

/** What the health screen shows; it turns this into text in the device's language. */
export type HealthResult =
  | { status: 'ok' }
  | { status: 'error'; message: string }
  | { status: 'unexpected' }
  | { status: 'unreachable' };

/** Calls `GET /health`. */
export async function checkHealth(client: AxiosInstance): Promise<HealthResult> {
  let body: unknown;
  try {
    ({ data: body } = await client.get<unknown>('/health'));
  } catch {
    return { status: 'unreachable' };
  }
  if (!isApiEnvelope(body)) return { status: 'unexpected' };
  return body.success ? { status: 'ok' } : { status: 'error', message: body.message };
}
