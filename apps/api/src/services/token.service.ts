import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import type { Env } from '../config/env';
import { Session } from '../models/session.model';
import type { Clock } from '../utils/clock';

/** ADR-0005: access 15 minutes, refresh 90 days, separate secrets, a `typ` marker. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60;

export type SessionScope = 'full' | 'kid';

/** Claims inside an access token. `sub` is the Account id, `sid` the Session id. */
export interface AccessTokenClaims {
  typ: 'access';
  sub: string;
  sid: string;
  scope: SessionScope;
}

/** Claims inside a refresh token. `jti` makes every issued token unique. */
export interface RefreshTokenClaims {
  typ: 'refresh';
  sub: string;
  sid: string;
  jti: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

/** Only the hash of a refresh token is stored. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createTokenService(env: Pick<Env, 'jwtAccessSecret' | 'jwtRefreshSecret'>, now: Clock) {
  const seconds = (): number => Math.floor(now().getTime() / 1000);

  function signAccess(accountId: string, sessionId: string, scope: SessionScope): string {
    const claims: Omit<AccessTokenClaims, 'sub'> = { typ: 'access', sid: sessionId, scope };
    return jwt.sign({ ...claims, iat: seconds() }, env.jwtAccessSecret, {
      subject: accountId,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
  }

  function signRefresh(accountId: string, sessionId: string): string {
    const claims: Omit<RefreshTokenClaims, 'sub'> = { typ: 'refresh', sid: sessionId, jti: randomUUID() };
    return jwt.sign({ ...claims, iat: seconds() }, env.jwtRefreshSecret, {
      subject: accountId,
      expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    });
  }

  return {
    signAccess,
    signRefresh,

    /** Starts a new full-scope Session for the Account and returns its first token pair. */
    async startSession(accountId: string, deviceLabel: string | null): Promise<IssuedTokens> {
      const sessionId = new Types.ObjectId();
      const refreshToken = signRefresh(accountId, sessionId.toString());
      await Session.create({
        _id: sessionId,
        accountId,
        scope: 'full',
        deviceLabel,
        refreshTokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(now().getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      });
      return { accessToken: signAccess(accountId, sessionId.toString(), 'full'), refreshToken };
    },
  };
}

export type TokenService = ReturnType<typeof createTokenService>;
