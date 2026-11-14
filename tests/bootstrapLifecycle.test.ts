import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeDatabaseEngine } from '../server/db/initEngine';
import { getMemoryPrismaClient } from '../server/db/memoryPrismaStore';

test('bootstrap coalesces callers, does not repeat after idle, and retries failed initialization', async () => {
  // Use only the existing in-memory adapter; never initialize the configured live database.
  const previousUrl = process.env.DATABASE_URL;
  const realNow = Date.now;
  process.env.DATABASE_URL = '';
  const folders = getMemoryPrismaClient().workspaceFolder;
  const original = folders.upsert.bind(folders);
  let calls = 0;
  let failOnce = false;
  folders.upsert = ((args: Parameters<typeof original>[0]) => {
    calls++;
    if (failOnce) { failOnce = false; return Promise.reject(new Error('Simulated bootstrap failure')); }
    return original(args);
  }) as unknown as typeof folders.upsert;
  try {
    await Promise.all([initializeDatabaseEngine(true), initializeDatabaseEngine(), initializeDatabaseEngine()]);
    assert.equal(calls, 3, 'one initialization creates/checks three default folders');
    const now = realNow();
    Date.now = () => now + 31_000;
    await initializeDatabaseEngine();
    assert.equal(calls, 3, 'elapsed time alone must not run initialization again');
    process.env.DATABASE_URL = 'isolated-memory-lifecycle-test';
    failOnce = true;
    await assert.rejects(initializeDatabaseEngine(), /Simulated bootstrap failure/);
    const failedAt = calls;
    await initializeDatabaseEngine();
    assert.equal(calls, failedAt + 3, 'failed initialization must not be marked ready');
  } finally {
    folders.upsert = original;
    Date.now = realNow;
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  }
});
