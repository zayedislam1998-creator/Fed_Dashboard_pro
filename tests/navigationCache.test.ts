import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { clearNavigationCache, fetchNavigationData, readNavigationData } from '../src/services/navigationCache';

beforeEach(clearNavigationCache);
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

test('navigation reads share one request and each caller can consume its response', async () => {
  let calls = 0;
  const load = async () => { calls++; return json({ tasks: ['one'] }); };
  const [first, second] = await Promise.all([fetchNavigationData('/tasks', load), fetchNavigationData('/tasks', load)]);
  assert.deepEqual(await first.json(), { tasks: ['one'] });
  assert.deepEqual(await second.json(), { tasks: ['one'] });
  assert.deepEqual(await (await fetchNavigationData('/tasks', load)).json(), { tasks: ['one'] });
  assert.equal(calls, 1);
});

test('invalidation clears old identity data and an older request cannot repopulate it', async () => {
  let complete!: (response: Response) => void;
  const old = fetchNavigationData('/admin', () => new Promise<Response>(resolve => { complete = resolve; }));
  clearNavigationCache();
  await fetchNavigationData('/admin', async () => json({ identity: 'new' }));
  complete(json({ identity: 'old' }));
  await old;
  assert.deepEqual(readNavigationData('/admin'), { identity: 'new' });
  clearNavigationCache();
  assert.equal(readNavigationData('/admin'), undefined);
});

test('a forced refresh wins over an older in-flight response', async () => {
  let complete!: (response: Response) => void;
  const old = fetchNavigationData('/tasks', () => new Promise<Response>(resolve => { complete = resolve; }));
  await fetchNavigationData('/tasks', async () => json({ revision: 2 }), true);
  complete(json({ revision: 1 }));
  await old;
  assert.deepEqual(readNavigationData('/tasks'), { revision: 2 });
});

test('expired data seeds a view while its next fetch revalidates', async () => {
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  try {
    await fetchNavigationData('/tasks', async () => json({ revision: 1 }));
    now += 31_000;
    assert.deepEqual(readNavigationData('/tasks'), { revision: 1 });
    await fetchNavigationData('/tasks', async () => json({ revision: 2 }));
    assert.deepEqual(readNavigationData('/tasks'), { revision: 2 });
    now += 301_000;
    assert.equal(readNavigationData('/tasks'), undefined);
  } finally { Date.now = realNow; }
});

test('authorization failures clear snapshots and errors never become cached successes', async () => {
  await fetchNavigationData('/tasks', async () => json({ private: true }));
  await fetchNavigationData('/admin', async () => json({ error: 'Denied' }, 403));
  assert.equal(readNavigationData('/tasks'), undefined);
  assert.equal(readNavigationData('/admin'), undefined);
  let calls = 0;
  for (let i = 0; i < 2; i++) await fetchNavigationData('/failed', async () => { calls++; return json({}, 500); });
  assert.equal(calls, 2);
});

test('snapshots stay bounded and oversized payloads are not retained', async () => {
  for (let i = 0; i < 40; i++) await fetchNavigationData('/list/' + i, async () => json({ i }));
  assert.equal(readNavigationData('/list/0'), undefined);
  assert.deepEqual(readNavigationData('/list/39'), { i: 39 });
  await fetchNavigationData('/large', async () => json({ text: 'x'.repeat(250_001) }));
  assert.equal(readNavigationData('/large'), undefined);
});

test('cancelling one observer does not cancel another observer or lose deduplication', async () => {
  let complete!: (response: Response) => void;
  let calls = 0;
  const load = () => { calls++; return new Promise<Response>(resolve => { complete = resolve; }); };
  const controller = new AbortController();
  const first = fetchNavigationData('/feed', load, false, controller.signal);
  const rejected = assert.rejects(first, { name: 'AbortError' });
  controller.abort();
  const second = fetchNavigationData('/feed', load);
  complete(json({ items: [1] }));
  await rejected;
  assert.deepEqual(await (await second).json(), { items: [1] });
  assert.equal(calls, 1);
});
