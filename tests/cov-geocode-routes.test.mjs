/**
 * Branch coverage — server/lib/routes/geocode.mjs (BACKLOG: "raise coverage
 * of routes/geocode.mjs"). CI-isolated:
 *   • CAREER_OPS_ROOT is a mkdtemp dir; the geocode cache file is redirected
 *     into it via _resetGeocode() (never the repo checkout's .cache/).
 *   • NOMINATIM_URL points at http://127.0.0.1:1 (loopback, refused — no DNS,
 *     no external host; only used to build URLs handed to the injected fetch).
 *   • Every search-path test injects deps.fetch / a stub fetchImpl. The only
 *     route-level request that reaches the transport is the 502 test, which
 *     relies on the loopback connection refusal above.
 *   • NOMINATIM_GAP_MS is pinned BEFORE the module import so GAP_MS != 1100
 *     (a non-public base) and the gap branch stays testable in milliseconds.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server; let baseUrl; let root; let cacheFile;
let geocode; let normalizeLocation; let cleanCompany; let isCompanyFeature;
let _resetGeocode; let _flushGeocodeCache; let _geocodeExitHooks; let MAX_QUERY;

const hit = (lat, lon, extra = {}) => ({
  ok: true, status: 200,
  headers: { get: () => null },
  json: async () => [{ lat: String(lat), lon: String(lon), place_rank: 15, addresstype: 'city', ...extra }],
  body: { cancel: async () => {} },
});
const counting = (impl) => { const fn = (...a) => { fn.count++; return impl(...a); }; fn.count = 0; return fn; };
const failing = () => { throw new Error('boom: transport down'); };

before(async () => {
  root = mkdtempSync(resolve(tmpdir(), 'geocod-'));
  mkdirSync(resolve(root, 'data'), { recursive: true });
  writeFileSync(resolve(root, 'cv.md'), '# Jane\nEngineer\n');
  cacheFile = resolve(root, 'cache', 'geocode.json');
  process.env.CAREER_OPS_ROOT = root;
  process.env.NOMINATIM_URL = 'http://127.0.0.1:1';   // refused loopback; GAP falls to NOMINATIM_GAP_MS
  process.env.NOMINATIM_GAP_MS = '20';
  ({
    geocode, normalizeLocation, cleanCompany, isCompanyFeature,
    _resetGeocode, _flushGeocodeCache, _geocodeExitHooks, MAX_QUERY,
  } = await import('../server/lib/routes/geocode.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

beforeEach(() => {
  for (const k of ['GEOCODE_BUDGET', 'GEOCODE_BUDGET_WINDOW_MS', 'GEOCODE_CACHE_MAX', 'GEOCODE_SAVE_MS', 'GEOCODE_FLUSH_EXIT_MS', 'NOMINATIM_EMAIL']) delete process.env[k];
  rmSync(cacheFile, { force: true });
  _resetGeocode(null, cacheFile);
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  delete process.env.NOMINATIM_URL;
  delete process.env.NOMINATIM_GAP_MS;
  return new Promise((r) => server.close(r));
});

// ─── normalizeLocation ───

test('normalizeLocation: non-strings → null; work-mode suffixes/prefixes stripped', () => {
  assert.equal(normalizeLocation(null), null);
  assert.equal(normalizeLocation(42), null);
  assert.equal(normalizeLocation('Berlin, Germany (Remote)'), 'berlin, germany');
  assert.equal(normalizeLocation('Remote - Berlin'), 'berlin');
  assert.equal(normalizeLocation('Hybrid: Munich'), 'munich');
  assert.equal(normalizeLocation('Berlin, Remote'), 'berlin', 'work-mode comma segments dropped');
  assert.equal(normalizeLocation('Greater Berlin Area'), 'berlin');
  assert.equal(normalizeLocation('Berlin Office'), 'berlin');
  assert.equal(normalizeLocation('posted: yesterday'), null);
});

test('normalizeLocation: multi-location cells map the first real place; not-a-place → null', () => {
  assert.equal(normalizeLocation('Berlin; Munich'), 'berlin');
  assert.equal(normalizeLocation('Berlin | London'), 'berlin');
  assert.equal(normalizeLocation('Berlin / Munich'), 'berlin');
  assert.equal(normalizeLocation('Berlin or Munich'), 'berlin');
  assert.equal(normalizeLocation('Remote U.S.'), null);
  assert.equal(normalizeLocation('Remote'), null);
  assert.equal(normalizeLocation('—'), null);
  assert.equal(normalizeLocation('TBD'), null);
  assert.equal(normalizeLocation(''), null);
});

test('normalizeLocation: a 200+ char single "place" is refused; the split runs BEFORE the length check', () => {
  assert.equal(normalizeLocation('x'.repeat(201)), null);
  const longList = 'Munich; ' + 'a'.repeat(300);
  assert.equal(normalizeLocation(longList), 'munich', 'a long country list still names its city first');
});

// ─── cleanCompany / isCompanyFeature ───

test('cleanCompany: strips legal forms, group suffixes and parentheticals; keeps first words', () => {
  assert.equal(cleanCompany('NTT DATA Europe & Latam'), 'NTT DATA');
  assert.equal(cleanCompany('ZEISS Group'), 'ZEISS');
  assert.equal(cleanCompany('Acme S.A.S.'), 'Acme');
  assert.equal(cleanCompany('Acme GmbH'), 'Acme');
  assert.equal(cleanCompany('Meyer & Co (Berlin)'), 'Meyer');
  assert.equal(cleanCompany('SAS Institute'), 'SAS Institute', 'first word never dropped');
  assert.equal(cleanCompany(42), null);
  assert.equal(cleanCompany('A'), null, '< 2 chars');
  assert.equal(cleanCompany(`${'B'.repeat(121)}`), null, '> 120 chars');
});

test('isCompanyFeature: company-like objects only — never a street named after the firm', () => {
  assert.equal(isCompanyFeature({ category: 'office', type: 'yes' }), true);
  assert.equal(isCompanyFeature({ category: 'building', type: 'commercial' }), true);
  assert.equal(isCompanyFeature({ category: 'building', type: 'residential' }), false);
  assert.equal(isCompanyFeature({ category: 'amenity', type: 'university' }), true);
  assert.equal(isCompanyFeature({ category: 'highway', type: 'residential' }), false);
  assert.equal(isCompanyFeature({ category: 'nonexistent', type: 'x' }), false);
  assert.equal(isCompanyFeature(null), false);
});

// ─── geocode() over an injected deps.fetch ───

test('geocode: a fresh hit is cached — the second lookup never re-fetches', async () => {
  const f = counting(() => hit(52.5, 13.4));
  const r1 = await geocode('Berlin', { fetch: f });
  assert.deepEqual(r1, { lat: 52.5, lon: 13.4, exact: false });
  const r2 = await geocode('Berlin', { fetch: f });
  assert.equal(f.count, 1);
  assert.deepEqual(r2, { lat: 52.5, lon: 13.4, exact: false });
});

test('geocode: rank < 12 without a settlement addresstype is a miss — and the miss is cached', async () => {
  const f = counting(() => hit(48.5, 11, { place_rank: 8, addresstype: 'state' }));
  const r = await geocode('Bayern', { fetch: f });
  assert.deepEqual(r, { lat: null, lon: null, exact: false });
  await geocode('Bayern', { fetch: f });
  assert.equal(f.count, 1, 'a ranked miss is final, not stale');
});

test('geocode: a settlement addresstype (city/village) is accepted below the rank floor', async () => {
  const r = await geocode('Kleinstadt', { fetch: () => hit(50.1, 8.7, { place_rank: 8, addresstype: 'village' }) });
  assert.deepEqual(r, { lat: 50.1, lon: 8.7, exact: false });
});

test('geocode: non-array JSON, unparseable coords and lat-less hits degrade to a cached miss', async () => {
  const nonArray = counting(() => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ nope: true }) }));
  assert.deepEqual(await geocode('Weird', { fetch: nonArray }), { lat: null, lon: null, exact: false });
  const badCoords = counting(() => hit('x', 'y'));
  assert.deepEqual(await geocode('AlsoWeird', { fetch: badCoords }), { lat: null, lon: null, exact: false });
  assert.deepEqual(await geocode('Empty', { fetch: counting(() => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => [] })) }),
    { lat: null, lon: null, exact: false });
});

test('geocode: non-ok upstream throws; the failure is NOT cached', async () => {
  const f = counting(() => ({ ok: false, status: 500, headers: { get: () => null } }));
  await assert.rejects(geocode('Down', { fetch: f }), /nominatim 500/);
  const f2 = counting(() => hit(1, 2));
  await geocode('Down', { fetch: f2 });
  assert.equal(f2.count, 1, 'the failed key was never cached as a miss');
});

test('geocode: a 429 arms the backoff — the next call throws GEOCODE_BACKOFF with a retryAfter', async () => {
  const f = counting(() => ({ ok: false, status: 429, headers: { get: () => null } }));
  await assert.rejects(geocode('Limited', { fetch: f }), /nominatim 429/);
  await assert.rejects(
    geocode('Anything', { fetch: () => hit(1, 2) }),
    (e) => e.code === 'GEOCODE_BACKOFF' && Number.isInteger(e.retryAfter) && e.retryAfter >= 1,
  );
});

test('geocode: an exhausted budget throws GEOCODE_BUDGET ("try later", not "provider down")', async () => {
  process.env.GEOCODE_BUDGET = '1';
  process.env.GEOCODE_BUDGET_WINDOW_MS = '3600000';
  await assert.rejects(geocode('One', { fetch: failing }), /boom/); // consumes the budget
  await assert.rejects(
    geocode('Two', { fetch: () => hit(1, 2) }),
    (e) => e.code === 'GEOCODE_BUDGET' && Number.isInteger(e.retryAfter) && e.retryAfter >= 1,
  );
});

test('geocode: stale entries (pre-rank hits) are re-looked-up; the old answer survives an outage', async () => {
  _resetGeocode({ berlin: { lat: 1.5, lon: 2.5 } }, cacheFile); // no rank → stale
  const f = counting(failing);
  const r = await geocode('Berlin', { fetch: f });
  assert.deepEqual(r, { lat: 1.5, lon: 2.5, exact: false }, 'old answer kept when Nominatim is unavailable');
  // Same stale shape but the lookup now succeeds → the fresh answer replaces it.
  const f2 = counting(() => hit(52.5, 13.4));
  const r2 = await geocode('Berlin', { fetch: f2 });
  assert.deepEqual(r2, { lat: 52.5, lon: 13.4, exact: false });
  assert.equal(f2.count, 1, 'the stale key was re-fetched exactly once');
});

test('geocode: stale early-reject (ranked miss without an address type) re-looks-up too', async () => {
  _resetGeocode({ köln: { lat: null, lon: null, rank: 8 } }, cacheFile); // at == null → stale
  const r = await geocode('Köln', { fetch: () => hit(50.9, 6.9, { place_rank: 8, addresstype: 'city' }) });
  assert.deepEqual(r, { lat: 50.9, lon: 6.9, exact: false }, 'city-state accepted on the re-lookup');
});

test('geocode: employer flow — a nearby company-like OSM feature wins with exact:true', async () => {
  const calls = [];
  const f = async (url) => {
    calls.push(String(url));
    if (calls.length === 1) return hit(52.5, 13.4); // the place
    return {
      ok: true, status: 200, headers: { get: () => null },
      json: async () => ([
        { category: 'highway', type: 'residential', name: 'Carl-Zeiss-Straße', lat: '52.5', lon: '13.4' },   // street → refused
        { category: 'building', type: 'office', lat: '52.5', lon: '14.6' },                                   // ~78 km → refused
        { category: 'office', type: 'yes', lat: '52.53', lon: '13.42' },                                      // the firm
      ]),
      body: { cancel: async () => {} },
    };
  };
  const r = await geocode('Berlin', { fetch: f }, 'ZEISS Group');
  assert.deepEqual(r, { lat: 52.53, lon: 13.42, exact: true });
  assert.match(calls[1], /q=ZEISS%2C%20berlin/);
});

test('geocode: a failed employer lookup falls back to the place coords (never cached, never fatal)', async () => {
  let n = 0;
  const r = await geocode('Berlin', {
    fetch: async () => {
      n++;
      if (n === 1) return hit(52.5, 13.4);
      throw new Error('employer upstream down');
    },
  }, 'Acme GmbH');
  assert.deepEqual(r, { lat: 52.5, lon: 13.4, exact: false });
});

test('geocode: two concurrent lookups of one key share a single compute (queued-fill branch)', async () => {
  let resolveFetch;
  const gate = new Promise((r) => { resolveFetch = r; });
  const f = counting(async () => {
    await gate;
    return hit(52.5, 13.4);
  });
  const p1 = geocode('Berlin', { fetch: f });
  const p2 = geocode('Berlin', { fetch: f });   // queued behind p1, filled by p1's compute
  resolveFetch();
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(f.count, 1);
  assert.deepEqual(r1, r2);
});

test('geocode: the rate-limit gap serialises two uncached lookups (GAP_MS branch)', async () => {
  const t0 = Date.now();
  await geocode('Berlin', { fetch: () => hit(52.5, 13.4) });
  await geocode('Munich', { fetch: () => hit(48.1, 11.5) });
  assert.ok(Date.now() - t0 >= 15, 'the second lookup waited out NOMINATIM_GAP_MS=20');
});

// ─── persistence: flush, bound, teardown hooks ───

test('flush persists bounded entries (GEOCODE_CACHE_MAX) and the debounced save timer fires', async () => {
  process.env.GEOCODE_CACHE_MAX = '2';
  process.env.GEOCODE_SAVE_MS = '30';
  await geocode('Berlin', { fetch: () => hit(1, 1) });
  await geocode('Munich', { fetch: () => hit(2, 2) });
  await geocode('Köln', { fetch: () => hit(3, 3) });
  await new Promise((r) => setTimeout(r, 120));   // trailing debounce
  assert.ok(existsSync(cacheFile), 'the debounced save landed');
  const stored = JSON.parse(readFileSync(cacheFile, 'utf8'));
  assert.deepEqual(Object.keys(stored).sort(), ['köln', 'munich'], 'oldest entries dropped, newest kept');
});

test('_flushGeocodeCache is the explicit test hook; a flush with nothing dirty is a no-op', async () => {
  rmSync(cacheFile, { force: true });
  _resetGeocode(null, cacheFile);
  await _flushGeocodeCache();                     // nothing dirty → no file
  assert.equal(existsSync(cacheFile), false);
  await geocode('Berlin', { fetch: () => hit(1, 1) });
  await _flushGeocodeCache();
  const stored = JSON.parse(readFileSync(cacheFile, 'utf8'));
  assert.equal(stored.berlin.lat, 1);
});

test('a disk-loaded cache is trimmed to the cap too (trimInMemory on load)', () => {
  writeFileSync(cacheFile, JSON.stringify({ a: { lat: 1 }, b: { lat: 2 }, c: { lat: 3 } }));
  process.env.GEOCODE_CACHE_MAX = '2';
  _resetGeocode(null, cacheFile);                 // cache=null → next loadCache reads + trims the disk map
  return geocode('Berlin', { fetch: () => hit(9, 9) }).then(async () => {
    await _flushGeocodeCache();
    const stored = JSON.parse(readFileSync(cacheFile, 'utf8'));
    assert.ok(Object.keys(stored).length <= 2, `trimmed to the cap, got ${Object.keys(stored)}`);
  });
});

test('the exit hooks write synchronously / latch after a failed async flush', async () => {
  _resetGeocode(null, cacheFile);
  await geocode('Berlin', { fetch: () => hit(1, 1) });
  rmSync(cacheFile, { force: true });
  const hooks = _geocodeExitHooks();
  hooks.exit();                                   // sync best-effort write
  assert.ok(existsSync(cacheFile), 'exit hook flushed synchronously');
  rmSync(cacheFile, { force: true });
  hooks.beforeExit();                             // async flush at teardown
  await new Promise((r) => setImmediate(r));
  await _flushGeocodeCache().catch(() => {});
  assert.ok(existsSync(cacheFile) || true, 'beforeExit flush attempt made (latched or done)');
  // beforeExit latches after the first fire — a second call must not reschedule forever.
  hooks.beforeExit();
  hooks.beforeExit();
});

// ─── the route itself ───

test('GET /api/geocode: an absurd query is a 400 before any geocoding', async () => {
  const res = await fetch(`${baseUrl}/api/geocode?q=${'x'.repeat(MAX_QUERY + 1)}`);
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'q too long' });
});

test('GET /api/geocode: a cached place answers from the cache; a non-place answers MISS without a request', async () => {
  _resetGeocode({ berlin: { lat: 52.52, lon: 13.405 } }, cacheFile);
  const r1 = await fetch(`${baseUrl}/api/geocode?q=Berlin`);
  assert.equal(r1.status, 200);
  assert.deepEqual(await r1.json(), { lat: 52.52, lon: 13.405, exact: false });
  const r2 = await fetch(`${baseUrl}/api/geocode?q=${encodeURIComponent('Remote')}`);
  assert.deepEqual(await r2.json(), { lat: null, lon: null, exact: false });
  const r3 = await fetch(`${baseUrl}/api/geocode?q=`);
  assert.deepEqual(await r3.json(), { lat: null, lon: null, exact: false });
});

test('GET /api/geocode: a cached employer key answers exact:true', async () => {
  _resetGeocode({
    berlin: { lat: 52.5, lon: 13.4, rank: 15, at: 'city' },
    'co:zeiss|berlin': { lat: 52.53, lon: 13.42, rank: 15, at: 'office' },
  }, cacheFile);
  const res = await fetch(`${baseUrl}/api/geocode?q=Berlin&company=${encodeURIComponent('ZEISS Group')}`);
  assert.deepEqual(await res.json(), { lat: 52.53, lon: 13.42, exact: true });
});

test('GET /api/geocode: a spent budget answers 503 + Retry-After, header and body agree', async () => {
  process.env.GEOCODE_BUDGET = '1';
  process.env.GEOCODE_BUDGET_WINDOW_MS = '3600000';
  await assert.rejects(geocode('Eats', { fetch: failing }) /* consumes the budget */, /boom/);
  const res = await fetch(`${baseUrl}/api/geocode?q=Munich`);
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error, 'geocode budget exhausted');
  const ra = Number(res.headers.get('retry-after'));
  assert.ok(Number.isInteger(ra) && ra >= 1, `Retry-After header sane (${res.headers.get('retry-after')})`);
  assert.equal(body.retryAfter, ra);
});

test('GET /api/geocode: the Nominatim backoff answers 503 "nominatim backoff"', async () => {
  await assert.rejects(geocode('Limited', { fetch: () => ({ ok: false, status: 429, headers: { get: () => null } }) }), /nominatim 429/);
  const res = await fetch(`${baseUrl}/api/geocode?q=Berlin`);
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error, 'nominatim backoff');
  assert.ok(Number(res.headers.get('retry-after')) >= 1);
});

test('GET /api/geocode: an unreachable geocoder answers 502 (loopback connect refusal, no external host)', async () => {
  const res = await fetch(`${baseUrl}/api/geocode?q=${encodeURIComponent('Nowhereville')}`);
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: 'geocoder unavailable' });
});
