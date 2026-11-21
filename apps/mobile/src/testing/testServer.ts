/**
 * Seam B: the real API (apps/api) listening on a random local port, backed by
 * an in-memory MongoDB. Test-only; never imported by the app. Mongo in Jest
 * needs the NODE_OPTIONS in this workspace's `test` script.
 */
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../../api/src/app';
import { connectDatabase, disconnectDatabase } from '../../../api/src/config/database';
import { Session } from '../../../api/src/models/session.model';
import { MINUTE, createTestClock, createTestMailer, testEnv, type TestMailer } from '../../../api/test/helpers/testApp';
import { clearTestDatabase } from '../../../api/test/helpers/testDatabase';

export interface TestServer {
  /** Changes on `clear()`: create devices after it. */
  readonly url: string;
  mailer: TestMailer;
  /** Moves the API's clock forward a minute, past the per-email code resend limit. */
  nextMinute(): void;
  /** Revokes every Session, as if each refresh token had expired. */
  endAllSessions(): Promise<void>;
  /** How many Sessions are live (signed-in devices). */
  sessionCount(): Promise<number>;
  /** Deletes every document and restarts the app, so per-IP rate limits start again (between tests). */
  clear(): Promise<void>;
  stop(): Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const mongo = await MongoMemoryServer.create();
  await connectDatabase(mongo.getUri());
  const mailer = createTestMailer();
  const clock = createTestClock(new Date());

  async function listen(): Promise<{ http: Server; url: string }> {
    const app = createApp(testEnv(), { mailer, now: clock });
    const http: Server = await new Promise((resolve) => {
      const server = app.listen(0, '127.0.0.1', () => resolve(server));
    });
    const { port } = http.address() as AddressInfo;
    return { http, url: `http://127.0.0.1:${port}` };
  }
  const close = (http: Server) => new Promise<void>((resolve) => http.close(() => resolve()));
  let running = await listen();

  return {
    get url() {
      return running.url;
    },
    mailer,
    nextMinute: () => clock.advance(MINUTE),
    async endAllSessions() {
      await Session.deleteMany({});
    },
    sessionCount: () => Session.countDocuments({}),
    async clear() {
      await clearTestDatabase();
      await close(running.http);
      running = await listen();
    },
    async stop() {
      await close(running.http);
      await disconnectDatabase();
      await mongo.stop();
    },
  };
}
