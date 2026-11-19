import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiEnvelope } from '@money-tracker/shared';
import { AppError, NotFoundError } from '../utils/AppError';

/** Mounted after all routes: anything unmatched becomes a 404 AppError. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route not found: ${req.method} ${req.path}`));
};

/** The single place errors become HTTP responses. Must be the last middleware. */
export function createErrorHandler(options: { exposeInternals: boolean }): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    if (err instanceof AppError) {
      const body: ApiEnvelope<unknown> = { message: err.message, data: err.data, success: false };
      res.status(err.statusCode).json(body);
      return;
    }

    // Malformed JSON bodies from express.json().
    if (isBodyParserError(err)) {
      const body: ApiEnvelope<null> = { message: 'Malformed request body', data: null, success: false };
      res.status(400).json(body);
      return;
    }

    console.error(err);
    const message = options.exposeInternals && err instanceof Error ? err.message : 'Internal server error';
    const body: ApiEnvelope<null> = { message, data: null, success: false };
    res.status(500).json(body);
  };
}

function isBodyParserError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type: unknown }).type === 'entity.parse.failed'
  );
}
