import { EnvError, loadEnv } from './env';

const valid = {
  MONGODB_URI: 'mongodb+srv://user:pass@cluster.example.net/money',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'r'.repeat(32),
  CODE_HASH_SECRET: 'c'.repeat(32),
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  EMAIL_FROM: 'Money Tracker <no-reply@example.com>',
};

function problemsOf(source: Record<string, string | undefined>): string[] {
  try {
    loadEnv(source);
  } catch (error) {
    expect(error).toBeInstanceOf(EnvError);
    return (error as EnvError).problems;
  }
  return [];
}

describe('loadEnv', () => {
  it('reads a valid environment, defaulting NODE_ENV and PORT', () => {
    expect(loadEnv(valid)).toEqual({
      nodeEnv: 'development',
      port: 4000,
      mongodbUri: 'mongodb+srv://user:pass@cluster.example.net/money',
      dbName: 'money-tracker',
      jwtAccessSecret: 'a'.repeat(32),
      jwtRefreshSecret: 'r'.repeat(32),
      codeHashSecret: 'c'.repeat(32),
      smtp: { host: 'localhost', port: 1025, user: undefined, pass: undefined },
      emailFrom: 'Money Tracker <no-reply@example.com>',
    });
  });

  it('uses DB_NAME to choose the database when given', () => {
    expect(loadEnv({ ...valid, DB_NAME: 'money-tracker-staging' }).dbName).toBe('money-tracker-staging');
  });

  it('rejects a DB_NAME MongoDB would refuse', () => {
    expect(problemsOf({ ...valid, DB_NAME: 'bad/name' })).toHaveLength(1);
  });

  it('uses PORT, NODE_ENV and SMTP credentials when given', () => {
    const env = loadEnv({ ...valid, NODE_ENV: 'production', PORT: '8080', SMTP_USER: 'resend', SMTP_PASS: 're_x' });
    expect(env.port).toBe(8080);
    expect(env.nodeEnv).toBe('production');
    expect(env.smtp).toEqual({ host: 'localhost', port: 1025, user: 'resend', pass: 're_x' });
  });

  it('refuses to start with every problem listed at once', () => {
    expect(problemsOf({ NODE_ENV: 'staging', PORT: 'abc' })).toHaveLength(9);
  });

  it('refuses short secrets and a shared access/refresh secret', () => {
    expect(problemsOf({ ...valid, CODE_HASH_SECRET: 'short' })).toEqual([
      'CODE_HASH_SECRET is required and must be at least 32 characters',
    ]);
    expect(problemsOf({ ...valid, JWT_REFRESH_SECRET: valid.JWT_ACCESS_SECRET })).toEqual([
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different',
    ]);
  });

  it('requires SMTP credentials in production', () => {
    expect(problemsOf({ ...valid, NODE_ENV: 'production' })).toEqual([
      'SMTP_USER and SMTP_PASS are required in production',
    ]);
  });
});
