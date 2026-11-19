import type { AxiosInstance } from 'axios';
import { isApiEnvelope } from '@money-tracker/shared';

/** Calls `GET /health` and returns the line the health screen shows. */
export async function checkHealth(client: AxiosInstance): Promise<string> {
  let body: unknown;
  try {
    ({ data: body } = await client.get<unknown>('/health'));
  } catch {
    return 'API: unreachable';
  }
  if (!isApiEnvelope(body)) return 'API: unexpected response';
  return body.success ? 'API: ok' : `API: ${body.message}`;
}
