import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import type { AuthErrorData } from '@money-tracker/shared';
import type { Env } from '../config/env';
import { Account } from '../models/account.model';
import { Session } from '../models/session.model';
import { AppError } from '../utils/AppError';
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

/** Who a request with a valid access token comes from. */
export interface AuthContext {
  accountId: string;
  sessionId: string;
  scope: SessionScope;
  /**
   * The one Kid Profile a Kid-Mode device holds (ADR-0002): set for a Kid
   * Session and for a full session elevated from one; null on a Personal-Mode device.
   */
  kidProfileId: string | null;
  /** For a full session elevated with the Parent PIN on a Kid-Mode device: the Kid Session it came from. */
  elevatedFrom: string | null;
}

/** 401 with a reason the app acts on: `token_invalid` = refresh and retry; `session_ended` = sign in again. */
export function authFailure(reason: Extract<AuthErrorData['reason'], 'token_invalid' | 'session_ended' | 'account_deleted'>): AppError {
  const message =
    reason === 'token_invalid'
      ? 'Access token is missing or invalid'
      : reason === 'account_deleted'
        ? 'This account was deleted'
        : 'Session has ended. Sign in again';
  const data: AuthErrorData = { reason };
  return new AppError(message, 401, data);
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

  async function start(
    accountId: string,
    fields: { scope: SessionScope; kidProfileId: string | null; deviceLabel: string | null },
  ): Promise<IssuedTokens> {
    const sessionId = new Types.ObjectId();
    const refreshToken = signRefresh(accountId, sessionId.toString());
    await Session.create({
      _id: sessionId,
      accountId,
      ...fields,
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiry(),
    });
    return { accessToken: signAccess(accountId, sessionId.toString(), fields.scope), refreshToken };
  }

  /**
   * Ends a Session (logout, reuse, revoking a Kid-Mode device): deletes it and any
   * full session elevated from it, so all their tokens stop working at once.
   */
  async function endSession(sessionId: string): Promise<void> {
    await Session.deleteMany({ $or: [{ _id: sessionId }, { elevatedFrom: sessionId }] });
  }

  /**
   * Why a validly signed token's Session is gone: `account_deleted` when its
   * Account no longer exists (deleted from another device), so the device
   * wipes its copy; otherwise `session_ended`, and the device keeps its data
   * until a new code (spec story 5).
   */
  async function sessionGone(accountId: string): Promise<AppError> {
    const exists = Types.ObjectId.isValid(accountId) && (await Account.exists({ _id: accountId }));
    return authFailure(exists ? 'session_ended' : 'account_deleted');
  }

  const refreshExpiry = (): Date => new Date(now().getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  /** Checks signature, expiry (against the injected clock) and the `typ` marker. */
  function verify<T extends { typ: string }>(token: string, secret: string, typ: T['typ']): T | null {
    try {
      const claims = jwt.verify(token, secret, { clockTimestamp: seconds(), algorithms: ['HS256'] });
      if (typeof claims !== 'object' || claims.typ !== typ || typeof claims.sub !== 'string' || typeof claims.sid !== 'string') {
        return null;
      }
      return claims as unknown as T;
    } catch {
      return null;
    }
  }

  return {
    signAccess,
    signRefresh,

    /**
     * The caller behind an access token. Throws `token_invalid` for a bad or expired
     * token, or `session_ended` if its Session was revoked (so logout and reuse take
     * effect at once, not 15 minutes later).
     */
    async authenticate(accessToken: string): Promise<AuthContext> {
      const claims = verify<AccessTokenClaims>(accessToken, env.jwtAccessSecret, 'access');
      if (!claims || !Types.ObjectId.isValid(claims.sid)) throw authFailure('token_invalid');
      // The scope comes from the stored Session, not the token, so it can't be widened by a token claim.
      const live = await Session.findOne({ _id: claims.sid, accountId: claims.sub, expiresAt: { $gt: now() } })
        .select({ scope: 1, kidProfileId: 1, elevatedFrom: 1 })
        .lean();
      if (!live) throw await sessionGone(claims.sub);
      if (live.scope === 'kid' && !live.kidProfileId) throw authFailure('session_ended');
      return {
        accountId: claims.sub,
        sessionId: claims.sid,
        scope: live.scope,
        kidProfileId: live.kidProfileId ?? null,
        elevatedFrom: live.elevatedFrom ? String(live.elevatedFrom) : null,
      };
    },

    /**
     * Swaps a refresh token for a new pair, atomically: only the request that finds
     * the stored hash still equal to this token's wins. Any other validly signed
     * token for the Session is a replaced one, so the Session is revoked.
     */
    async rotate(refreshToken: string): Promise<IssuedTokens> {
      const claims = verify<RefreshTokenClaims>(refreshToken, env.jwtRefreshSecret, 'refresh');
      if (!claims || !Types.ObjectId.isValid(claims.sid)) throw authFailure('session_ended');

      const next = signRefresh(claims.sub, claims.sid);
      const session = await Session.findOneAndUpdate(
        {
          _id: claims.sid,
          accountId: claims.sub,
          refreshTokenHash: hashRefreshToken(refreshToken),
          expiresAt: { $gt: now() },
        },
        { $set: { refreshTokenHash: hashRefreshToken(next), expiresAt: refreshExpiry() }, $inc: { rotations: 1 } },
        { returnDocument: 'after' },
      ).lean();

      if (!session) {
        if (await Session.exists({ _id: claims.sid, accountId: claims.sub })) await endSession(claims.sid);
        throw await sessionGone(claims.sub);
      }
      return { accessToken: signAccess(claims.sub, claims.sid, session.scope), refreshToken: next };
    },

    endSession,

    /**
     * Signs out every Kid-Mode device of a Kid Profile: deletes its Kid Sessions
     * and any PIN elevation from them, which carry the same Kid Profile
     * (archiving or deleting the profile). Personal-Mode sessions have none.
     */
    async endKidSessions(accountId: string, kidProfileId: string): Promise<void> {
      await Session.deleteMany({ accountId, kidProfileId });
    },

    /** Starts a new full-scope Session for the Account and returns its first token pair. */
    startSession(accountId: string, deviceLabel: string | null): Promise<IssuedTokens> {
      return start(accountId, { scope: 'full', kidProfileId: null, deviceLabel });
    },

    /**
     * PIN elevation on a Kid-Mode device (ADR-0002): a full session that lasts as
     * long as one access token and has no refresh token. It keeps the Kid Profile
     * and label of the Kid Session it came from, and ends with it.
     */
    async startElevatedSession(kidSession: AuthContext): Promise<{ accessToken: string; expiresInSeconds: number }> {
      const kid = await Session.findById(kidSession.sessionId).select({ deviceLabel: 1 }).lean();
      const sessionId = new Types.ObjectId();
      await Session.create({
        _id: sessionId,
        accountId: kidSession.accountId,
        scope: 'full',
        kidProfileId: kidSession.kidProfileId,
        elevatedFrom: kidSession.sessionId,
        deviceLabel: kid?.deviceLabel ?? null,
        refreshTokenHash: hashRefreshToken(randomUUID()), // no refresh token is ever issued for it
        expiresAt: new Date(now().getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000),
      });
      return {
        accessToken: signAccess(kidSession.accountId, sessionId.toString(), 'full'),
        expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
      };
    },

    /** Starts a Kid Session limited to one Kid Profile (ADR-0002) and returns its first token pair. */
    startKidSession(accountId: string, kidProfileId: string, deviceLabel: string | null): Promise<IssuedTokens> {
      return start(accountId, { scope: 'kid', kidProfileId, deviceLabel });
    },
  };
}

export type TokenService = ReturnType<typeof createTokenService>;
