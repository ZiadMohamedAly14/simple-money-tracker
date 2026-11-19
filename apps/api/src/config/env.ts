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
}

export class EnvError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid environment:\n  - ${problems.join('\n  - ')}`);
    this.name = 'EnvError';
  }
}

const NODE_ENVS: readonly Env['nodeEnv'][] = ['development', 'test', 'production'];

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

  if (problems.length > 0) throw new EnvError(problems);
  return { nodeEnv, port, mongodbUri, dbName };
}
