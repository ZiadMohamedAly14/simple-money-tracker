/**
 * Environment variables, checked once at start-up (ADR-0005).
 * Add new variables here: to the Env type, the parser and `.env.example`.
 */
export interface Env {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  mongodbUri: string;
  /** Database to use on the cluster; overrides any name in the URI. */
  dbName: string;
  /** Signs access tokens. Must differ from the refresh secret (ADR-0005). */
  jwtAccessSecret: string;
  /** Signs refresh tokens. */
  jwtRefreshSecret: string;
  /** HMAC key for storing one-time sign-in codes hashed. */
  codeHashSecret: string;
  /** Outgoing email: Resend's SMTP in production, a local catcher (Mailpit) in development. */
  smtp: { host: string; port: number; user?: string; pass?: string };
  /** The From address of every email, e.g. `Money Tracker <no-reply@example.com>`. */
  emailFrom: string;
}

export class EnvError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid environment:\n  - ${problems.join('\n  - ')}`);
    this.name = 'EnvError';
  }
}

const NODE_ENVS: readonly Env['nodeEnv'][] = ['development', 'test', 'production'];
const MIN_SECRET_LENGTH = 32;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const problems: string[] = [];

  const nodeEnv = (source.NODE_ENV ?? 'development') as Env['nodeEnv'];
  if (!NODE_ENVS.includes(nodeEnv)) {
    problems.push(`NODE_ENV must be one of ${NODE_ENVS.join(', ')}`);
  }

  const portText = source.PORT ?? '4000';
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    problems.push('PORT must be an integer between 0 and 65535');
  }

  const mongodbUri = source.MONGODB_URI ?? '';
  if (!/^mongodb(\+srv)?:\/\//.test(mongodbUri)) {
    problems.push('MONGODB_URI is required and must start with mongodb:// or mongodb+srv://');
  }

  const dbName = (source.DB_NAME ?? '').trim() || 'money-tracker';
  if (!/^[^/\\. "$*<>:|?]{1,63}$/.test(dbName)) {
    problems.push('DB_NAME must be 1-63 characters without spaces or any of / \\ . " $ * < > : | ?');
  }

  const secret = (name: string): string => {
    const value = source[name] ?? '';
    if (value.length < MIN_SECRET_LENGTH) {
      problems.push(`${name} is required and must be at least ${MIN_SECRET_LENGTH} characters`);
    }
    return value;
  };
  const jwtAccessSecret = secret('JWT_ACCESS_SECRET');
  const jwtRefreshSecret = secret('JWT_REFRESH_SECRET');
  const codeHashSecret = secret('CODE_HASH_SECRET');
  if (jwtAccessSecret && jwtAccessSecret === jwtRefreshSecret) {
    problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  }

  const smtpHost = source.SMTP_HOST ?? '';
  if (!smtpHost) problems.push('SMTP_HOST is required');
  const smtpPort = Number(source.SMTP_PORT ?? '');
  if (!Number.isInteger(smtpPort) || smtpPort <= 0 || smtpPort > 65535) {
    problems.push('SMTP_PORT is required and must be an integer between 1 and 65535');
  }
  const smtpUser = source.SMTP_USER || undefined;
  const smtpPass = source.SMTP_PASS || undefined;
  if (nodeEnv === 'production' && (!smtpUser || !smtpPass)) {
    problems.push('SMTP_USER and SMTP_PASS are required in production');
  }

  const emailFrom = source.EMAIL_FROM ?? '';
  if (!emailFrom.includes('@')) problems.push('EMAIL_FROM is required and must contain an email address');

  if (problems.length > 0) throw new EnvError(problems);
  return {
    nodeEnv,
    port,
    mongodbUri,
    dbName,
    jwtAccessSecret,
    jwtRefreshSecret,
    codeHashSecret,
    smtp: { host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass },
    emailFrom,
  };
}
