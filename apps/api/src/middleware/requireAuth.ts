import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ParentPinErrorData } from '@money-tracker/shared';
import { authFailure, type AuthContext, type TokenService } from '../services/token.service';
import { ForbiddenError } from '../utils/AppError';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by `requireAuth`: the Account, Session and scope behind the access token. */
    auth?: AuthContext;
  }
}

/**
 * Accepts only a valid access token (`Authorization: Bearer <token>`) whose
 * Session is still live, and puts the caller on `req.auth`.
 */
export function requireAuth(tokens: TokenService): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const match = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '');
    if (!match) {
      next(authFailure('token_invalid'));
      return;
    }
    tokens.authenticate(match[1]!).then((auth) => {
      req.auth = auth;
      next();
    }, next);
  };
}

/** The caller on a route behind `requireAuth`. */
export function authOf(req: Request): AuthContext {
  if (!req.auth) throw new Error('requireAuth must run before this handler');
  return req.auth;
}

/**
 * After `requireAuth`: lets only full (Personal-Mode) sessions through. A Kid
 * Session gets 403 `kid_session` (ADR-0002).
 */
export const requireFullScope: RequestHandler = (req, _res, next) => {
  const data: ParentPinErrorData = { reason: 'kid_session' };
  next(authOf(req).scope === 'full' ? undefined : new ForbiddenError('Not available on a Kid-Mode device', data));
};
