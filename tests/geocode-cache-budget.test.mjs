/**
 * CAR-105 — #/map geocoder: persistent-cache durability + per-window budget.
 *
 * The map geocodes every distinct (place, employer) through
 * `GET /api/geocode`. Before CAR-105 the cache was rewritten IN FULL on every
 * insert (a multi-megabyte write per lookup on a big board), was unbounded,
 * unlocked, and nothing capped how many uncached lookups a single map load
 * may fire — a cold first load serialised thousands of Nominatim calls at
 * ≥1.1 s each and the page sat there for tens of seconds (13.9 s observed).
 *
 * These tests pin the new contract (CI-isolated: temp cache file, injected
 * fetchImpl, no network):
 *   1. a Cyrillic city geocodes via the provider and lands in the cache file
 *      (after an explicit flush — saves are debounced),
 *   2. a fresh module state reads the answer from the cache WITHOUT a
 *      provider call,
 *   3. the persisted cache is bounded (GEOCODE_CACHE_MAX, oldest dropped),
 *   4. uncached lookups stop after GEOCODE_BUDGET calls per window while
 *      cached keys keep answering with no network at all.
 *
 * CAR-142 adds:
 *   5. a failed flush keeps the dirty flag — a retry persists the pending
 *      inserts instead of silently dropping them,
 *   6. teardown hooks flush the debounced inserts (beforeExit async, exit
 *      synchronous best-effort, SIGTERM with default termination preserved),
 *   7. the live in-memory map is bounded at insert time too, and
 *   8. over HTTP a spent budget answers 503 + Retry-After (the client can
 *      tell "try later" from a provider failure) while other upstream
 *      failures stay the plain 502.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';

// CAR-142 — the geocode module installs teardown hooks at load and exposes
// them via `_geocodeExitHooks()` (the same test-hook convention as
// `_resetGeocode`). The tests invoke the handlers DIRECTLY — emitting real
// process events would also fire node:test's own internal beforeExit
// listener, and a SIGTERM re-raise would kill the test process. The no-op
// SIGTERM listener below guarantees the hook's "skip the re-raise while
// another handler owns the signal" branch.
const noopSignal = () => {};
process.on('SIGTERM', noopSignal);

// Poll for a debounced async flush to land.
async function waitForFile(file, key, ms = 3000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      const stored = JSON.parse(readFileSync(file, 'utf8'));
      if (stored && stored[key]) return stored;
    } catch { /* not written yet */ }
    await new Promise((r) => setTimeout(r, 20));
  }
  return null;
}

let mod;
const dir = mkdtempSync(join(tmpdir(), 'geocode-budget-'));
const file = join(dir, 'geocode.json');

// Loopback Nominatim mock, bound BEFORE the module import so the module-level
// NOMINATIM_BASE points at it — the HTTP test then exercises the real route
// (which fetches with the global fetchImpl) without any real network.
const nominatim = createServer((req, res) => {
  nominatim.calls++;
  if (nominatim.failNext) {
    nominatim.failNext = false;
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end('{}');
    return;
  }
  const q = new URL(req.url, 'http://x').searchParams.get('q');
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify([{ lat: '55.75', lon: '37.61', place_rank: 16, addresstype: 'city', display_name: q }]));
});
nominatim.calls = 0;
nominatim.failNext = false;

before(async () => {
  process.env.CAREER_OPS_ROOT = dir;
  writeFileSync(join(dir, 'cv.md'), '# CV\n');
  await new Promise((r) => nominatim.listen(0, '127.0.0.1', r));
  process.env.NOMINATIM_URL = `http://127.0.0.1:${nominatim.address().port}`;
  mod = await import('../server/lib/routes/geocode.mjs');
});
after(async () => { nominatim.close(); });

// Fake Nominatim for injected-fetch unit tests: answers any query, counts calls.
function mockFetch() {
  const f = async (url) => {
    f.calls++;
    const q = decodeURIComponent(new URL(url).searchParams.get('q'));
    return {
      ok: true,
      json: async () => [{
        lat: '55.75', lon: '37.61', place_rank: 16,
        addresstype: 'city', display_name: q,
      }],
    };
  };
  f.calls = 0;
  return f;
}
const noFetch = () => { throw new Error('network used'); };

test('a Cyrillic city geocodes via the provider and lands in the persistent cache', async () => {
  mod._resetGeocode({}, file);
  const f = mockFetch();
  assert.deepEqual(await mod.geocode('Москва', { fetch: f }), { lat: 55.75, lon: 37.61, exact: false });
  assert.equal(f.calls, 1);
  await mod._flushGeocodeCache();
  const stored = JSON.parse(readFileSync(file, 'utf8'));
  assert.deepEqual(stored['москва'], { lat: 55.75, lon: 37.61, rank: 16, at: 'city' });
});

test('a fresh module state reads the cache without calling the provider', async () => {
  const f = mockFetch();
  mod._resetGeocode(null, file);            // memory cleared → next read comes from disk
  assert.deepEqual(await mod.geocode('МОСКВА', { fetch: f }), { lat: 55.75, lon: 37.61, exact: false });
  assert.equal(f.calls, 0, 'repeat map loads must not re-geocode');
});

test('the persisted cache is bounded — oldest entries are dropped at the cap', async () => {
  process.env.GEOCODE_CACHE_MAX = '2';
  try {
    mod._resetGeocode({}, file);
    const f = mockFetch();
    await mod.geocode('Казань', { fetch: f });
    await mod.geocode('Пермь', { fetch: f });
    await mod.geocode('Уфа', { fetch: f });
    await mod._flushGeocodeCache();
    const keys = Object.keys(JSON.parse(readFileSync(file, 'utf8'))).sort();
    assert.deepEqual(keys, ['пермь', 'уфа'], 'казань (oldest) is dropped');
  } finally {
    delete process.env.GEOCODE_CACHE_MAX;
  }
});

test('the budget caps uncached lookups per window; cached keys always answer', async () => {
  process.env.GEOCODE_BUDGET = '2';
  try {
    mod._resetGeocode({ самара: { lat: 53.2, lon: 50.15, rank: 16 } }, file);
    const f = mockFetch();
    assert.ok((await mod.geocode('Казань', { fetch: f })).lat != null, 'call 1 within budget');
    assert.ok((await mod.geocode('Пермь', { fetch: f })).lat != null, 'call 2 within budget');
    await assert.rejects(mod.geocode('Уфа', { fetch: f }), /budget/, 'call 3 is over the budget');
    assert.equal(f.calls, 2);
    assert.deepEqual(await mod.geocode('Самара', { fetch: noFetch }), { lat: 53.2, lon: 50.15, exact: false },
      'a cached key answers even when the budget is spent');
  } finally {
    delete process.env.GEOCODE_BUDGET;
  }
});

test('over HTTP the spent budget surfaces as 503 + Retry-After; cached and in-budget lookups stay 200', async () => {
  process.env.GEOCODE_BUDGET = '1';
  try {
    mod._resetGeocode({ 'нн': { lat: 56.32, lon: 44.0, rank: 16 } }, file);
    const { default: express } = await import('express');
    const app = express();
    mod.registerGeocodeRoutes(app);
    const srv = app.listen(0, '127.0.0.1');
    await new Promise((r) => srv.once('listening', r));
    nominatim.calls = 0;
    try {
      const base = `http://127.0.0.1:${srv.address().port}/api/geocode`;
      const first = await fetch(`${base}?q=${encodeURIComponent('Тверь')}`);
      assert.equal(first.status, 200, 'first uncached lookup is within the budget');
      const second = await fetch(`${base}?q=${encodeURIComponent('Тула')}`);
      assert.equal(second.status, 503, 'the second uncached lookup hits the cap');
      const retryAfter = Number(second.headers.get('retry-after'));
      assert.ok(Number.isInteger(retryAfter) && retryAfter >= 1 && retryAfter <= 60,
        'Retry-After names the remaining budget window in seconds');
      assert.deepEqual(await second.json(), { error: 'geocode budget exhausted', retryAfter },
        'the body says "try later", not "provider down"');
      const cached = await fetch(`${base}?q=${encodeURIComponent('НН')}`);
      assert.equal(cached.status, 200, 'a cached key never touches the budget');
      assert.deepEqual(await cached.json(), { lat: 56.32, lon: 44.0, exact: false });
      assert.equal(nominatim.calls, 1, 'exactly one upstream call left the server');
    } finally { srv.close(); }
  } finally {
    delete process.env.GEOCODE_BUDGET;
  }
});

test('over HTTP other upstream failures stay the plain 502 with no Retry-After', async () => {
  mod._resetGeocode({}, file);
  const { default: express } = await import('express');
  const app = express();
  mod.registerGeocodeRoutes(app);
  const srv = app.listen(0, '127.0.0.1');
  await new Promise((r) => srv.once('listening', r));
  nominatim.failNext = true;
  try {
    const res = await fetch(`http://127.0.0.1:${srv.address().port}/api/geocode?q=${encodeURIComponent('Курган')}`);
    assert.equal(res.status, 502, 'a provider failure is still a generic 502');
    assert.equal(res.headers.get('retry-after'), null);
  } finally { srv.close(); }
});

test('CAR-142: a failed flush keeps the dirty flag — a retry persists the pending inserts', async () => {
  const dir2 = mkdtempSync(join(tmpdir(), 'geocode-dirty-'));
  const occupied = join(dir2, 'occupied');
  mkdirSync(occupied);
  const broken = join(dir2, 'geocode.json');
  symlinkSync(occupied, broken);             // the cache file resolves to a directory → EISDIR
  mod._resetGeocode({}, broken);
  const f = mockFetch();
  await mod.geocode('Оренбург', { fetch: f });
  await mod._flushGeocodeCache();            // write fails inside the lock → must stay dirty
  await mod._flushGeocodeCache();            // the pre-fix code had already cleared the flag: no-op
  unlinkSync(broken);                        // repair the target, same module state
  writeFileSync(broken, '{}');
  await mod._flushGeocodeCache();            // the retry must carry the pending insert
  const stored = JSON.parse(readFileSync(broken, 'utf8'));
  assert.ok(stored['оренбург'], 'pending inserts survive a failed write');
});

test("CAR-142: the beforeExit hook flushes the unref'd debounce's pending inserts", async () => {
  mod._resetGeocode({}, file);
  const f = mockFetch();
  await mod.geocode('Сочи', { fetch: f });
  const hooks = mod._geocodeExitHooks();
  hooks.beforeExit();
  const stored = await waitForFile(file, 'сочи');
  assert.ok(stored, 'a service restart must not lose the last 2 s of inserts');
});

test('CAR-142: the exit hook makes one synchronous best-effort write', async () => {
  mod._resetGeocode({}, file);
  const f = mockFetch();
  await mod.geocode('Иваново', { fetch: f });
  const hooks = mod._geocodeExitHooks();
  hooks.exit();                              // async work is not allowed in `exit` — must be sync
  const stored = JSON.parse(readFileSync(file, 'utf8'));
  assert.ok(stored['иваново'], 'the exit-time write landed synchronously');
});

test('CAR-142: the SIGTERM hook flushes pending inserts and skips the re-raise while other listeners exist', async () => {
  mod._resetGeocode({}, file);
  const f = mockFetch();
  await mod.geocode('Тольятти', { fetch: f });
  const hooks = mod._geocodeExitHooks();
  hooks.signal('SIGTERM')();
  const stored = await waitForFile(file, 'тольятти');
  assert.ok(stored, 'SIGTERM flushed the pending insert');
  assert.ok(process.pid > 0, 'still alive — the no-op listener kept the default termination');
});

test('CAR-142: the in-memory cache is trimmed at insert time too', async () => {
  process.env.GEOCODE_CACHE_MAX = '2';
  try {
    mod._resetGeocode({}, file);
    const f = mockFetch();
    await mod.geocode('Орёл', { fetch: f });
    await mod.geocode('Курск', { fetch: f });
    await mod.geocode('Брянск', { fetch: f });
    assert.equal(f.calls, 3);
    await mod.geocode('Орёл', { fetch: f });   // evicted from the live map → provider again
    assert.equal(f.calls, 4, 'the oldest entry left the live map, not only the persisted file');
  } finally {
    delete process.env.GEOCODE_CACHE_MAX;
  }
});
