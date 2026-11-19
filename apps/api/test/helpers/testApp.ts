import type { Express } from 'express';
import { createApp } from '../../src/app';
import type { Env } from '../../src/config/env';

/** A valid Env for tests. Override fields as needed. */
export function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    nodeEnv: 'test',
    port: 0,
    mongodbUri: 'mongodb://unused-in-tests',
    ...overrides,
  };
}

/** The real Express app, built in process (no listen). Pass it to supertest's `request(app)`. */
export function buildTestApp(overrides: Partial<Env> = {}): Express {
  return createApp(testEnv(overrides));
}
