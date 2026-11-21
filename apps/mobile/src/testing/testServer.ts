/**
 * Seam B: the real API (apps/api) listening on a random local port, backed by
 * an in-memory MongoDB. Test-only; never imported by the app. Mongo in Jest
 * needs the NODE_OPTIONS in this workspace's `test` script.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../../api/src/app';
import { connectDatabase, disconnectDatabase } from '../../../api/src/config/database';
import { Session } from '../../../api/src/models/session.model';
import { MINUTE, createTestClock, createTestMailer, testEnv, type TestMailer } from '../../../api/test/helpers/testApp';
import { clearTestDatabase } from '../../../api/test/helpers/testDatabase';

export interface TestServer {
  url: string;
  mailer: TestMailer;
  /** Moves the API's clock forward a minute, past the per-email code resend limit. */
  nextMinute(): void;
  /** Revokes every Session, as if each refresh token had expired. */
  endAllSessions(): Promise<void>;
  /** Deletes every document and resets the API's in-memory rate limits (between tests). */
  clear(): Promise<void>;
  stop(): Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const mongo = await MongoMemoryServer.create();
  await connectDatabase(mongo.getUri());
  const mailer = createTestMailer();
  const clock = createTestClock(new Date());
  // Rebuilt by `clear()`, so per-IP sign-in limits don't carry over between tests.
  let app = createApp(testEnv(), { mailer, now: clock });
  const http: Server = await new Promise((resolve) => {
    const server = createServer((req, res) => app(req, res)).listen(0, '127.0.0.1', () => resolve(server));
  });
  const { port } = http.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    mailer,
    nextMinute: () => clock.advance(MINUTE),
    async endAllSessions() {
      await Session.deleteMany({});
    },
    async clear() {
      await clearTestDatabase();
      app = createApp(testEnv(), { mailer, now: clock });
    },
    async stop() {
      await new Promise<void>((resolve) => http.close(() => resolve()));
      await disconnectDatabase();
      await mongo.stop();
    },
  };
}
