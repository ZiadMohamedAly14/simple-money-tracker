import { EnvError, loadEnv } from './env';

describe('loadEnv', () => {
  it('reads a valid environment, defaulting NODE_ENV and PORT', () => {
    expect(loadEnv({ MONGODB_URI: 'mongodb+srv://user:pass@cluster.example.net/money' })).toEqual({
      nodeEnv: 'development',
      port: 4000,
      mongodbUri: 'mongodb+srv://user:pass@cluster.example.net/money',
      dbName: 'money-tracker',
    });
  });

  it('uses DB_NAME to choose the database when given', () => {
    expect(loadEnv({ MONGODB_URI: 'mongodb://localhost', DB_NAME: 'money-tracker-staging' }).dbName).toBe(
      'money-tracker-staging',
    );
  });

  it('rejects a DB_NAME MongoDB would refuse', () => {
    expect(() => loadEnv({ MONGODB_URI: 'mongodb://localhost', DB_NAME: 'bad/name' })).toThrow(EnvError);
  });

  it('uses PORT and NODE_ENV when given', () => {
    const env = loadEnv({ NODE_ENV: 'production', PORT: '8080', MONGODB_URI: 'mongodb://localhost/money' });
    expect(env.port).toBe(8080);
    expect(env.nodeEnv).toBe('production');
  });

  it('refuses to start with every problem listed at once', () => {
    let error: unknown;
    try {
      loadEnv({ NODE_ENV: 'staging', PORT: 'abc' });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(EnvError);
    expect((error as EnvError).problems).toHaveLength(3);
  });
});
