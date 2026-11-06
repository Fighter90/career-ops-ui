/**
 * CAR-236 (P1 perf) — the mtime-keyed single-entry cache helper.
 *
 * Contract: `cachedByMtime(file, compute)` memoizes compute(file) keyed on
 * (path, mtimeMs, size); ONE entry per file; any error (stat failure,
 * compute throw) degrades to a plain recompute — a cache bug must never
 * become an endpoint bug, so the helper itself never swallows or caches
 * errors. Callers keep their own fail-open behavior.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let dir, cachedByMtime, __mtimedCache;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'mtimed-cache-'));
  ({ cachedByMtime, __mtimedCache } = await import('../server/lib/mtimed-cache.mjs'));
});

const file = (...p) => resolve(dir, ...p);
const calls = () => n;
let n = 0;
const counter = () => ++n;

test('fresh file: compute runs once, the second call is a memo hit', () => {
  __mtimedCache.reset();
  const f = file('a.txt');
  writeFileSync(f, 'one');
  const v1 = cachedByMtime(f, counter);
  const v2 = cachedByMtime(f, counter);
  assert.equal(v1, 1);
  assert.equal(v2, 1, 'same mtime+size → memo hit, compute not re-run');
  assert.equal(n, 1);
  assert.equal(__mtimedCache.misses, 1);
  assert.equal(__mtimedCache.hits, 1);
});

test('a rewrite (mtime+size change) recomputes; each distinct file keeps its own entry', () => {
  __mtimedCache.reset();
  n = 0;
  const f = file('b.txt');
  const g = file('c.txt');
  writeFileSync(f, 'one');
  writeFileSync(g, 'uno');
  cachedByMtime(f, counter);
  cachedByMtime(g, counter);
  assert.equal(n, 2);
  assert.equal(__mtimedCache.size, 2, 'one entry per file, not one entry global');
  // Rewrite f with new content → new mtime+size → recompute.
  writeFileSync(f, 'one-two-three');
  assert.equal(cachedByMtime(f, counter), 3);
  assert.equal(cachedByMtime(f, counter), 3, 'and the new value is now the memo');
  assert.equal(cachedByMtime(g, counter), 2, "f's rewrite never disturbs g's entry");
  assert.equal(n, 3);
});

test('same mtime+size after a same-size rewrite → memo hit (the documented key)', () => {
  __mtimedCache.reset();
  n = 0;
  const f = file('d.txt');
  writeFileSync(f, 'AAAA');
  const past = new Date(Date.now() - 60_000);
  utimesSync(f, past, past); // pin a stable mtime
  assert.equal(cachedByMtime(f, counter), 1);
  // Same byte length, different content, mtime pinned back to the SAME value:
  writeFileSync(f, 'BBBB');
  utimesSync(f, past, past);
  assert.equal(cachedByMtime(f, counter), 1, 'keyed on (mtime,size) — an mtime-identical rewrite is a hit');
  assert.equal(n, 1);
});

test('a compute error propagates and is never cached; the next call recomputes', () => {
  __mtimedCache.reset();
  n = 0;
  const f = file('e.txt');
  writeFileSync(f, 'payload');
  let attempt = 0;
  const flaky = () => { n += 1; if (attempt++ === 0) throw new Error('compute failed'); return 'ok'; };
  assert.throws(() => cachedByMtime(f, flaky), /compute failed/);
  assert.equal(cachedByMtime(f, flaky), 'ok', 'the failed attempt was not cached');
  assert.equal(n, 2, 'error → recompute on the next call');
  assert.equal(__mtimedCache.size, 1, 'only the successful computation is cached');
});

test('a missing file fails open: compute still runs, nothing is cached, no throw', () => {
  __mtimedCache.reset();
  n = 0;
  const missing = file('never-written.txt');
  assert.equal(cachedByMtime(missing, counter), 1, 'stat failure → plain recompute');
  assert.equal(cachedByMtime(missing, counter), 2, 'and nothing was cached (compute runs again)');
  assert.equal(__mtimedCache.size, 0);
  assert.equal(__mtimedCache.misses, 2);
});
