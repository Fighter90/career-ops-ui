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
 *
 * CAR-142 rev-2 adds:
 *   9. the beforeExit hook runs ONCE — a persistently failing flush cannot
 *      reschedule work and loop the process instead of exiting,
 *  10. an insert landing during a flush stays pending (generation counter)
 *      and the next flush persists it,
 *  11. the SIGTERM flush is raced against a short budget and the hooks
 *      install at route registration, not at module load,
 *  12. a hit refreshes recency (hot keys survive the trim) and a disk-loaded
 *      map is trimmed at load, and
 *  13. the Nominatim backoff window answers 503 + Retry-After too.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';

// CAR-142 — the geocode module exposes its teardown handlers via
// `_geocodeExitHooks()` (the same test-hook convention as `_resetGeocode`).
// The tests invoke the handlers DIRECTLY — emitting real process events
// would also fire node:test's own internal beforeExit listener, and a real
// SIGTERM delivery would terminate the test process. Since rev-2 the module
// installs nothing at load; registration happens in registerGeocodeRoutes()
// (the HTTP tests below exercise that path).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Finding 6 — stub process.kill so the re-raise branch is observable without
// terminating the test process.
function stubKill() {
  const calls = [];
  const real = process.kill;
  process.kill = (pid, sig) => { calls.push([pid, sig]); return true; };
  return { calls, restore: () => { process.kill = real; } };
}

// Poll for a debounced async flush to land.
async function waitForFile(file, key, ms = 3000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      const stored = JSON.parse(readFileSync(file, 'utf8'));
      if (stored && stored[key]) return stored;
    } catch { /* not written yet */ }
    await sleep(20);
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
  if (nominatim.rateLimitNext) {
    nominatim.rateLimitNext = false;         // trips the module's backoff window
    res.statusCode = 429;
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
nominatim.rateLimitNext = false;

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
  process.env.GEOCODE_BUDGET_WINDOW_MS = '5000';   // bound Retry-After by the REAL window (finding 6/nit)
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
      assert.ok(Number.isInteger(retryAfter) && retryAfter >= 1 && retryAfter <= 5,
        'Retry-After is bounded by GEOCODE_BUDGET_WINDOW_MS, not a hardcoded guess');
      assert.deepEqual(await second.json(), { error: 'geocode budget exhausted', retryAfter },
        'the body says "try later", not "provider down"');
      const cached = await fetch(`${base}?q=${encodeURIComponent('НН')}`);
      assert.equal(cached.status, 200, 'a cached key never touches the budget');
      assert.deepEqual(await cached.json(), { lat: 56.32, lon: 44.0, exact: false });
      assert.equal(nominatim.calls, 1, 'exactly one upstream call left the server');
    } finally { srv.close(); }
  } finally {
    delete process.env.GEOCODE_BUDGET;
    delete process.env.GEOCODE_BUDGET_WINDOW_MS;
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
  try {
    const occupied = join(dir2, 'occupied');
    mkdirSync(occupied);                     // the cache path IS a directory → EISDIR (portable)
    mod._resetGeocode({}, occupied);
    const f = mockFetch();
    await mod.geocode('Оренбург', { fetch: f });
    await mod._flushGeocodeCache();          // write fails inside the lock → must stay dirty
    await mod._flushGeocodeCache();          // the pre-fix code had already cleared the flag: no-op
    rmSync(occupied, { recursive: true });   // repair the target, same module state
    writeFileSync(occupied, '{}');
    await mod._flushGeocodeCache();          // the retry must carry the pending insert
    const stored = JSON.parse(readFileSync(occupied, 'utf8'));
    assert.ok(stored['оренбург'], 'pending inserts survive a failed write');
  } finally {
    rmSync(dir2, { recursive: true, force: true });
  }
});

test('CAR-142 rev-2: an insert landing during a flush stays pending — the next flush persists it', async () => {
  process.env.GEOCODE_SAVE_MS = '600000';    // keep the debounce out of the picture
  try {
    mod._resetGeocode({}, file);
    const f = mockFetch();
    await mod.geocode('Рязань', { fetch: f });
    const { withFileLock } = await import('../server/lib/file-lock.mjs');
    let release;
    const held = new Promise((r) => { release = r; });
    void withFileLock(file, async () => { await held; });   // stall the flush's write
    const flushP = mod._flushGeocodeCache(); // snapshot taken at entry, waits on the lock
    await mod.geocode('Липецк', { fetch: f });               // insert DURING the flush
    release();
    await flushP;
    const mid = JSON.parse(readFileSync(file, 'utf8'));
    assert.ok(mid['рязань'], 'flush A persisted its entry-time snapshot');
    assert.ok(!mid['липецк'], 'flush A did not claim the insert that landed during it');
    await mod._flushGeocodeCache();          // the trailing edge must still see dirty
    const stored = JSON.parse(readFileSync(file, 'utf8'));
    assert.ok(stored['липецк'], 'the late insert was not dropped by the trailing flush');
  } finally {
    delete process.env.GEOCODE_SAVE_MS;
  }
});

test("CAR-142: the beforeExit hook flushes the unref'd debounce's pending inserts", async () => {
  process.env.GEOCODE_SAVE_MS = '600000';    // ONLY the hook can persist within the window
  try {
    mod._resetGeocode({}, file);
    const f = mockFetch();
    await mod.geocode('Сочи', { fetch: f });
    mod._geocodeExitHooks().beforeExit();
    assert.ok(await waitForFile(file, 'сочи'), 'a service restart must not lose the last 2 s of inserts');
  } finally {
    delete process.env.GEOCODE_SAVE_MS;
  }
});

test('CAR-142 rev-2: the beforeExit hook runs ONCE — a failing flush cannot loop the process', async () => {
  process.env.GEOCODE_SAVE_MS = '600000';
  try {
    mod._resetGeocode({}, file);
    const f = mockFetch();
    await mod.geocode('Пенза', { fetch: f });
    mod._geocodeExitHooks().beforeExit();    // 1st: flushes, latches
    assert.ok(await waitForFile(file, 'пенза'), 'the first call flushed');
    await mod.geocode('Киров', { fetch: f });                // dirty again, debounce 600 s away
    mod._geocodeExitHooks().beforeExit();    // 2nd: latched → no rescheduling
    await sleep(150);
    let stored = JSON.parse(readFileSync(file, 'utf8'));
    assert.ok(!stored['киров'], 'the second call is a no-op — the process can exit naturally');
    mod._geocodeExitHooks().exit();          // remaining dirty state is the exit hook's job
    stored = JSON.parse(readFileSync(file, 'utf8'));
    assert.ok(stored['киров'], 'the sync exit hook persists what beforeExit left behind');
  } finally {
    delete process.env.GEOCODE_SAVE_MS;
  }
});

test('CAR-142: the exit hook makes one synchronous best-effort write', async () => {
  process.env.GEOCODE_SAVE_MS = '600000';    // only the hook can persist within the window
  try {
    mod._resetGeocode({}, file);
    const f = mockFetch();
    await mod.geocode('Иваново', { fetch: f });
    const hooks = mod._geocodeExitHooks();
    hooks.exit();                            // async work is not allowed in `exit` — must be sync
    const stored = JSON.parse(readFileSync(file, 'utf8'));
    assert.ok(stored['иваново'], 'the exit-time write landed synchronously');
  } finally {
    delete process.env.GEOCODE_SAVE_MS;
  }
});

test('CAR-142 rev-2: the SIGTERM hook flushes and skips the re-raise while another listener owns the signal', async () => {
  process.env.GEOCODE_SAVE_MS = '600000';    // ONLY the hook can persist within the window
  const { calls, restore } = stubKill();
  const noop = () => {};                     // another handler owns termination
  process.on('SIGTERM', noop);
  try {
    mod._resetGeocode({}, file);
    const f = mockFetch();
    await mod.geocode('Тольятти', { fetch: f });
    mod._geocodeExitHooks().signal('SIGTERM')();
    assert.ok(await waitForFile(file, 'тольятти'), 'SIGTERM flushed the pending insert');
    assert.deepEqual(calls, [], 'no re-raise while another listener owns the signal');
  } finally {
    process.off('SIGTERM', noop);            // the test process must stay SIGTERM-killable
    restore();
    delete process.env.GEOCODE_SAVE_MS;
  }
});

test('CAR-142 rev-2: sole SIGTERM owner — the hook re-raises so default termination survives', async () => {
  const { calls, restore } = stubKill();
  process.removeAllListeners('SIGTERM');     // own the signal: listenerCount must reach 0
  try {
    mod._resetGeocode({}, file);
    mod._geocodeExitHooks().signal('SIGTERM')();
    // The re-raise fires in a .then() AFTER this handler returns — let it land
    // while the stub is still active, or the real process.kill self-delivers
    // and the test child dies.
    await sleep(50);
    assert.deepEqual(calls, [[process.pid, 'SIGTERM']],
      'the re-raise preserves the default termination on systemctl stop / Ctrl-C');
  } finally {
    restore();
  }
});

test('over HTTP the Nominatim backoff window answers 503 + Retry-After too', async () => {
  mod._resetGeocode({}, file);
  const { default: express } = await import('express');
  const app = express();
  mod.registerGeocodeRoutes(app);
  const srv = app.listen(0, '127.0.0.1');
  await new Promise((r) => srv.once('listening', r));
  nominatim.rateLimitNext = true;            // the discovering call trips the 429 backoff
  try {
    const base = `http://127.0.0.1:${srv.address().port}/api/geocode`;
    const trip = await fetch(`${base}?q=${encodeURIComponent('Астрахань')}`);
    assert.equal(trip.status, 502, 'the call that DISCOVERS the rate limit is a provider failure');
    const blocked = await fetch(`${base}?q=${encodeURIComponent('Волгоград')}`);
    assert.equal(blocked.status, 503, 'inside the backoff window the answer is try-later');
    const retryAfter = Number(blocked.headers.get('retry-after'));
    assert.ok(Number.isInteger(retryAfter) && retryAfter >= 1 && retryAfter <= 600,
      'Retry-After is bounded by the 10-minute backoff window');
    const body = await blocked.json();
    assert.equal(body.error, 'nominatim backoff');
    assert.equal(body.retryAfter, retryAfter, 'header and body carry the same computed value');
  } finally { srv.close(); }
});

test('CAR-142 rev-2: a hit refreshes recency — the hot key survives the next trim', async () => {
  process.env.GEOCODE_CACHE_MAX = '2';
  try {
    mod._resetGeocode({}, file);
    const f = mockFetch();
    await mod.geocode('Томск', { fetch: f });      // f1
    await mod.geocode('Омск', { fetch: f });       // f2   (order: томск, омск)
    await mod.geocode('Томск', { fetch: f });      // hit  → order: омск, томск
    assert.equal(f.calls, 2);
    await mod.geocode('Красноярск', { fetch: f }); // f3   → trim evicts омск, NOT томск
    assert.equal(f.calls, 3);
    assert.ok((await mod.geocode('Томск', { fetch: f })).lat != null);
    assert.equal(f.calls, 3, 'the hot key survived the trim');
    assert.ok((await mod.geocode('Омск', { fetch: f })).lat != null);
    assert.equal(f.calls, 4, 'the cold key was the one evicted');
  } finally {
    delete process.env.GEOCODE_CACHE_MAX;
  }
});

test('CAR-142 rev-2: a disk-loaded map over the cap is trimmed at load', async () => {
  process.env.GEOCODE_CACHE_MAX = '2';
  try {
    writeFileSync(file, JSON.stringify({
      'пенза': { lat: 53.2, lon: 45.0, rank: 16 },
      'тамбов': { lat: 52.72, lon: 41.45, rank: 16 },
      'орёл': { lat: 52.96, lon: 36.06, rank: 16 },
    }));
    mod._resetGeocode(null, file);           // cache=null → next read loads from disk
    const f = mockFetch();
    assert.ok((await mod.geocode('Тамбов', { fetch: f })).lat != null, 'the 2nd-oldest survived the load trim');
    assert.equal(f.calls, 0);
    assert.ok((await mod.geocode('Пенза', { fetch: f })).lat != null, 'the oldest was dropped at load');
    assert.equal(f.calls, 1, 'the dropped key re-fetches from the provider');
  } finally {
    delete process.env.GEOCODE_CACHE_MAX;
  }
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
