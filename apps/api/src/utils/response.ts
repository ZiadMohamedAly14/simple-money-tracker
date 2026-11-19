import type { Response } from 'express';
import type { ApiEnvelope } from '@money-tracker/shared';

/** Sends a success envelope. Controllers respond only through this. */
export function sendSuccess<T>(res: Response, data: T, message = 'ok', statusCode = 200): void {
  const body: ApiEnvelope<T> = { message, data, success: true };
  res.status(statusCode).json(body);
}
