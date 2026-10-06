/**
 * v1.20.1 (H-6) — concurrent-write race regression.
 *
 * Pre-v1.20.1 pattern in tracker.mjs / pipeline.mjs / auto-pipeline.mjs:
 *
 *   const content = readFileSync(...);
 *   const existing = parse(content);
 *   const nextNum = max(existing.map(r => parseInt(r.num))) + 1;
 *   writeFileSync(..., content + buildRow(nextNum, ...));
 *
 * Two concurrent POSTs each read num=42, each write num=43 — the later
 * write clobbers the earlier row. The fix: serialize through
 * `withFileLock(PATHS.applications, ...)` so the read-modify-write
 * runs atomically per process.
 *
 * This file holds:
 *   1. A unit test of the withFileLock primitive (proves serialization
 *      regardless of which route uses it).
 *   2. An integration test firing 20 concurrent POST /api/tracker with
 *      distinct companies, asserting 001..020 all land. This is the
 *      regression canary for the actual race in production code.
 *
 * The pipeline-side races (POST /api/pipeline, DELETE /api/pipeline)
 * use the same withFileLock helper — covered transitively by the unit
 * test plus the API tests that already exercise those routes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { withFileLock } from '../server/lib/file-lock.mjs';

// ─── Unit: withFileLock serializes per-path critical sections ─────

test('withFileLock: two concurrent appends to the same path run sequentially', async () => {
  const trace = [];
  const path = '/fake/path-A';
  const a = withFileLock(path, async () => {
    trace.push('A:start');
    await new Promise((r) => setTimeout(r, 20));
    trace.push('A:end');
    return 'a';
  });
  const b = withFileLock(path, async () => {
    trace.push('B:start');
    await new Promise((r) => setTimeout(r, 5));
    trace.push('B:end');
    return 'b';
  });
  const [ra, rb] = await Promise.all([a, b]);
  assert.equal(ra, 'a');
  assert.equal(rb, 'b');
  // B must not start until A ends — the lock serializes them.
  assert.deepStrictEqual(trace, ['A:start', 'A:end', 'B:start', 'B:end']);
});

test('withFileLock: different paths run in parallel', async () => {
  const trace = [];
  const a = withFileLock('/fake/path-A', async () => {
    trace.push('A:start');
    await new Promise((r) => setTimeout(r, 25));
    trace.push('A:end');
  });
  const b = withFileLock('/fake/path-B', async () => {
    trace.push('B:start');
    await new Promise((r) => setTimeout(r, 5));
    trace.push('B:end');
  });
  await Promise.all([a, b]);
  // Independent paths: B should finish before A even though A started first.
  assert.deepStrictEqual(trace, ['A:start', 'B:start', 'B:end', 'A:end']);
});

test('withFileLock: thrown error releases the lock for next caller', async () => {
  const path = '/fake/path-C';
  await assert.rejects(
    () => withFileLock(path, async () => { throw new Error('boom'); }),
    /boom/
  );
  // The lock must be released even though the critical section threw,
  // otherwise the next caller would deadlock waiting on a promise that
  // never settles.
  let secondRan = false;
  await withFileLock(path, async () => { secondRan = true; });
  assert.equal(secondRan, true);
});

test('withFileLock: nested same-path call from inside fn blocks until the outer section ends', async () => {
  // The invariant callers must respect: never recurse into the same path
  // lock from inside its own critical section. Prove WHY without hanging
  // the suite: the inner call cannot start while the outer one holds the
  // lock (it would deadlock if the outer awaited it), and it runs only
  // once the outer section has returned and released.
  const p = '/virtual/nested-lock-' + Date.now();
  let inner;
  const order = [];
  const seenInside = await withFileLock(p, async () => {
    inner = withFileLock(p, async () => { order.push('inner'); });
    const state = await Promise.race([
      inner.then(() => 'ran'),
      new Promise((r) => setTimeout(() => r('blocked'), 50)),
    ]);
    order.push('outer-end');
    return state;
  });
  assert.equal(seenInside, 'blocked', 'the nested same-path call must wait for the outer section');
  await inner;
  assert.deepEqual(order, ['outer-end', 'inner'], 'inner runs only after the outer section releases');
});

// ─── Integration: 20 concurrent POST /api/tracker land all rows ───

test('20 concurrent POST /api/tracker — every row lands, nums are 001..020', async (t) => {
  const dir = mkdtempSync(resolve(tmpdir(), 'concur-tracker-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  process.env.CAREER_OPS_ROOT = dir;

  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  let server;
  let baseUrl;
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });

  t.after(() => {
    delete process.env.CAREER_OPS_ROOT;
    return new Promise((r) => server.close(r));
  });

  const N = 20;
  const requests = Array.from({ length: N }, (_, i) =>
    fetch(baseUrl + '/api/tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: `Acme-${String(i + 1).padStart(3, '0')}`,
        role: `Engineer ${i + 1}`,
        score: '4.5',
        status: 'Evaluated',
      }),
    }).then((r) => r.json())
  );
  const results = await Promise.all(requests);

  for (const r of results) {
    assert.ok(r.ok, `non-ok response: ${JSON.stringify(r)}`);
  }

  const content = readFileSync(resolve(dir, 'data', 'applications.md'), 'utf8');
  const rowNums = [];
  for (const line of content.split('\n')) {
    const m = /^\|\s*(\d{3})\s*\|/.exec(line);
    if (m) rowNums.push(m[1]);
  }

  const expected = Array.from({ length: N }, (_, i) => String(i + 1).padStart(3, '0'));
  rowNums.sort();
  assert.deepStrictEqual(
    rowNums,
    expected,
    `expected sequential 001..${String(N).padStart(3, '0')}, got ${rowNums.length} rows: ${rowNums.join(',')}`
  );
});
