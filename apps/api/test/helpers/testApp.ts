import type { Express } from 'express';
import { createApp, type AppDeps } from '../../src/app';
import type { Env } from '../../src/config/env';
import type { Mailer, OutgoingEmail } from '../../src/email/mailer';

/** A valid Env for tests. Override fields as needed. */
export function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    nodeEnv: 'test',
    port: 0,
    mongodbUri: 'mongodb://unused-in-tests',
    dbName: 'money-tracker-test',
    jwtAccessSecret: 'test-access-secret-0123456789abcdef',
    jwtRefreshSecret: 'test-refresh-secret-0123456789abcdef',
    codeHashSecret: 'test-code-hash-secret-0123456789abcdef',
    email: { transport: 'smtp', host: 'unused-in-tests', port: 1025 },
    emailFrom: 'Mizan <no-reply@example.test>',
    ...overrides,
  };
}

/**
 * The real Express app, built in process (no listen). Pass it to supertest's `request(app)`.
 * Tests swap the outside world through `deps`: a `TestMailer` instead of SMTP, a `TestClock`
 * instead of the system time.
 */
export function buildTestApp(overrides: Partial<Env> = {}, deps: Partial<AppDeps> = {}): Express {
  return createApp(testEnv(overrides), { mailer: createTestMailer(), ...deps });
}

/** Records every email instead of sending it; the inbox is what a person would see. */
export interface TestMailer extends Mailer {
  readonly sent: OutgoingEmail[];
  /** The newest email sent to `to` (case-insensitive), or throws. */
  lastTo(to: string): OutgoingEmail;
  /** The 6-digit code in the newest email sent to `to`. */
  lastCodeFor(to: string): string;
}

export function createTestMailer(): TestMailer {
  const sent: OutgoingEmail[] = [];
  const lastTo = (to: string): OutgoingEmail => {
    const email = [...sent].reverse().find((e) => e.to.toLowerCase() === to.toLowerCase());
    if (!email) throw new Error(`No email was sent to ${to}`);
    return email;
  };
  return {
    sent,
    async send(email) {
      sent.push(email);
    },
    lastTo,
    lastCodeFor(to) {
      const match = /\b(\d{6})\b/.exec(lastTo(to).text);
      if (!match) throw new Error(`No 6-digit code in the email to ${to}`);
      return match[1]!;
    },
  };
}

/** A settable clock. Starts at a fixed instant; `advance` moves it forward. */
export interface TestClock {
  (): Date;
  advance(ms: number): void;
}

export function createTestClock(start = new Date('2026-03-01T09:00:00Z')): TestClock {
  let now = start.getTime();
  const clock = (() => new Date(now)) as TestClock;
  clock.advance = (ms) => {
    now += ms;
  };
  return clock;
}

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
