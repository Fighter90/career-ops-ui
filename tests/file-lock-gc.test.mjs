/**
 * FULL-M6 (CAR-165) — withFileLock's finally-block GC was dead code: it built
 * two FRESH promise chains per call (`prev.then(() => next).catch(() => {})`
 * inside the comparison) and compared them against the stored tail — different
 * promise identities can never be equal, so the (empty-bodied) branch never
 * fired and every locked path kept its slot for the process lifetime.
 *
 * The fix drops the dead branch and clears the slot for real: the stored tail
 * deletes itself once it settles, unless a newer caller has already replaced
 * the entry (the identity check — only the truly-last holder cleans up).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let lock;
let seq = 0;

before(async () => {
  lock = await import('../server/lib/file-lock.mjs');
});

const nextPath = () => `/tmp/m6-lock-${++seq}`;
const settle = () => new Promise((r) => setImmediate(r)); // drains the cleanup microtasks

test('_pendingLocks exposes the live slot count', () => {
  assert.equal(typeof lock._pendingLocks(), 'number');
});

test('lock slots are dropped once the tail settles', async () => {
  lock._resetLocks();
  await lock.withFileLock(nextPath(), async () => 1);
  await lock.withFileLock(nextPath(), async () => 2);
  await settle();
  assert.equal(lock._pendingLocks(), 0, 'no entries may outlive their critical sections');
});

test('a queued waiter keeps the lock serialized; the slot drops after the last section', async () => {
  lock._resetLocks();
  const path = nextPath();
  const order = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const a = lock.withFileLock(path, async () => {
    order.push('a:start');
    await sleep(20);
    order.push('a:end');
  });
  const b = lock.withFileLock(path, async () => {
    order.push('b:start');
  });
  await Promise.all([a, b]);
  assert.deepEqual(order, ['a:start', 'a:end', 'b:start'], 'critical sections stay serialized');
  await settle();
  assert.equal(lock._pendingLocks(), 0, 'slot dropped only after the queued section settles');
});

test('a throwing critical section still releases and cleans up', async () => {
  lock._resetLocks();
  const path = nextPath();
  await assert.rejects(
    lock.withFileLock(path, async () => { throw new Error('boom'); }),
    /boom/,
  );
  // A follow-up caller on the same path must not deadlock or inherit the throw.
  await assert.doesNotReject(lock.withFileLock(path, async () => 'recovered'));
  await settle();
  assert.equal(lock._pendingLocks(), 0);
});
