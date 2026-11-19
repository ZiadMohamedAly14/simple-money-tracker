import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { loadEnv } from './config/env';

async function main(): Promise<void> {
  const env = loadEnv();
  await connectDatabase(env.mongodbUri, env.dbName);

  const server = createApp(env).listen(env.port, () => {
    console.log(`API listening on port ${env.port} (${env.nodeEnv})`);
  });

  const shutdown = (signal: string): void => {
    console.log(`${signal} received, shutting down`);
    server.close(() => {
      disconnectDatabase().finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
