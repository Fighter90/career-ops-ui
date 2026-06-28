/**
 * v1.29.0 — `GET /api/scan/sources` returns the canonical source registry.
 *
 * Single source of truth for the SPA's #/scan source-filter dropdown.
 * Adding a new adapter = one entry in `server/lib/sources/registry.mjs`,
 * dropdown updates automatically.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'scan-sources-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# x\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'x\n');
  process.env.CAREER_OPS_ROOT = dir;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  return new Promise((r) => server.close(r));
});

test('GET /api/scan/sources returns the registry list with EN + RU sources', async () => {
  const r = await fetch(baseUrl + '/api/scan/sources');
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(Array.isArray(d.sources), 'sources must be array');
  // Sanity: every registry entry has {value, label, region}.
  for (const s of d.sources) {
    assert.ok(typeof s.value === 'string' && s.value.length > 0);
    assert.ok(typeof s.label === 'string' && s.label.length > 0);
    assert.ok(s.region === 'en' || s.region === 'ru', `bad region: ${s.region}`);
  }
});

test('GET /api/scan/sources includes the 5 RU sources (v1.29.0 baseline)', async () => {
  const r = await fetch(baseUrl + '/api/scan/sources');
  const d = await r.json();
  const ruValues = d.sources.filter((s) => s.region === 'ru').map((s) => s.value).sort();
  assert.deepEqual(
    ruValues,
    ['geekjob', 'getmatch', 'habr-career', 'hh.ru', 'trudvsem'],
    `RU sources mismatch: ${ruValues.join(',')}`,
  );
});

test('GET /api/scan/sources includes the EN ATS + aggregator sources', async () => {
  const r = await fetch(baseUrl + '/api/scan/sources');
  const d = await r.json();
  const enValues = d.sources.filter((s) => s.region === 'en').map((s) => s.value).sort();
  assert.deepEqual(
    enValues,
    [
      'arbeitsagentur', 'ashby', 'bamboohr', 'breezy', 'comeet', 'glints',
      'greenhouse', 'ibm', 'jobstreet', 'lever', 'personio', 'recruitee',
      'remoteok', 'remotive', 'rss', 'smartrecruiters', 'solidjobs', 'teamtailor',
      'weworkremotely', 'workable', 'workday', 'workingnomads',
    ],
  );
});

test('GET /api/scan/sources sends a short Cache-Control', async () => {
  const r = await fetch(baseUrl + '/api/scan/sources');
  const cc = r.headers.get('cache-control') || '';
  assert.match(cc, /max-age=\d+/);
});
