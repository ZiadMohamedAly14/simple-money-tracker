/**
 * Every API response body uses this envelope (ADR-0005).
 * Errors carry `success: false` and `data: null` unless an error adds details.
 */
export interface ApiEnvelope<T> {
  message: string;
  data: T;
  success: boolean;
}

export function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.message === 'string' &&
    typeof candidate.success === 'boolean' &&
    'data' in candidate
  );
}
