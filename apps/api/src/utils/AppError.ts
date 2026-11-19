/**
 * Base class for every expected error. Throw a subclass from services or
 * controllers; the central error handler turns it into the envelope
 * `{ message, data, success: false }` with this status code.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly data: unknown = null,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', data: unknown = null) {
    super(message, 400, data);
  }
}

export class ValidationError extends AppError {
  constructor(data: unknown, message = 'Validation failed') {
    super(message, 422, data);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests', data: unknown = null) {
    super(message, 429, data);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable') {
    super(message, 503);
  }
}
