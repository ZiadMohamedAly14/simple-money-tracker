import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDatabase, disconnectDatabase } from '../../src/config/database';
import mongoose from 'mongoose';

/**
 * One in-memory MongoDB per test file. Use in a test file as:
 *
 *   const db = useTestDatabase();   // registers beforeAll / afterEach / afterAll
 *   ... db.uri is available inside tests
 */
export function useTestDatabase(): { readonly uri: string } {
  let server: MongoMemoryServer | undefined;
  const handle = {
    get uri(): string {
      if (!server) throw new Error('Test database not started yet');
      return server.getUri();
    },
  };

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await connectDatabase(server.getUri());
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
    await server?.stop();
  });

  return handle;
}

/** Deletes every document in every collection, keeping indexes. */
export async function clearTestDatabase(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;
  const collections = await db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}
