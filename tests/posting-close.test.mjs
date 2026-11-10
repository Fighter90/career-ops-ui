/**
 * CAR-256 (parent-sync #6597) — posting CLOSE dates.
 *
 *  - `closesAtIso` mirrors the parent's lib/posting-close.mjs parser: a close
 *    date is a calendar day (YYYY-MM-DD), or absent. A date-only string stays
 *    that day; a naive datetime keeps its date prefix; an explicit Z / numeric
 *    offset converts to the UTC calendar day; no zone is guessed.
 *  - scan-history rows gain a `closes_at` column (web-ui rows append it as a
 *    7th cell; parent-format rows already carry it as their last column), so
 *    the day is STORED per posting URL.
 *  - GET /api/pipeline joins the stored days onto the queue by URL, so the
 *    #/pipeline UI can show when each posting closes.
 *
 * CI-isolated: CAREER_OPS_ROOT is a temp dir; the only transport is the
 * injected fetchImpl; servers bind 127.0.0.1:0.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let closesAtIso;
let closeDatesByUrl;
let closeDateForUrl;
let runEnScan;
let ALL_ADAPTERS;
let server;
let baseUrl;
let dir;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'car256-close-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'oferta\n');
  process.env.CAREER_OPS_ROOT = dir;
  ({ closesAtIso, closeDatesByUrl, closeDateForUrl } = await import('../server/lib/posting-close.mjs'));
  ({ runEnScan } = await import('../server/lib/en-scanner.mjs'));
  ({ ALL_ADAPTERS } = await import('../server/lib/portals/registry.mjs'));
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

// ── closesAtIso ─────────────────────────────────────────────────────

test('closesAtIso: a date-only string stays that day; invalid calendar days are refused', () => {
  assert.equal(closesAtIso('2026-11-24'), '2026-11-24');
  assert.equal(closesAtIso('2026-11-24  '), '2026-11-24', 'surrounding whitespace is trimmed');
  assert.equal(closesAtIso('2026-13-40'), '');
  assert.equal(closesAtIso('2026-02-30'), '');
  assert.equal(closesAtIso('not a date'), '');
  assert.equal(closesAtIso(''), '');
});

test('closesAtIso: a naive datetime keeps its date prefix', () => {
  assert.equal(closesAtIso('2026-11-24T23:59:59'), '2026-11-24');
  assert.equal(closesAtIso('2026-11-24T23:59'), '2026-11-24');
});

test('closesAtIso: fractional seconds parse (with and without a zone)', () => {
  assert.equal(closesAtIso('2026-11-24T23:30:00.5'), '2026-11-24',
    'a fraction alone never moves the day');
  assert.equal(closesAtIso('2026-11-24T23:30:00.123456Z'), '2026-11-24',
    'a fraction under Z is truncated to milliseconds');
  assert.equal(closesAtIso('2026-11-24T23:30:00.5+01:00'), '2026-11-24',
    'a fraction under a numeric offset converts like the whole-second form');
});

test('closesAtIso: an explicit offset converts to the UTC calendar day', () => {
  assert.equal(closesAtIso('2026-11-24T23:30:00-05:00'), '2026-11-25');
  assert.equal(closesAtIso('2026-11-25T02:30:00+05:00'), '2026-11-24');
  assert.equal(closesAtIso('2026-11-24T23:30:00Z'), '2026-11-24');
  assert.equal(closesAtIso('2026-11-24T23:30:00+0000'), '2026-11-24', 'offset without a colon');
  assert.equal(closesAtIso('2026-11-24T25:00:00'), '', 'hour out of range');
  assert.equal(closesAtIso('2026-11-24T10:99:00'), '', 'minute out of range');
  assert.equal(closesAtIso('2026-11-24T10:00:99'), '', 'second out of range');
  assert.equal(closesAtIso('2026-02-30T10:00:00'), '',
    'a valid time on an impossible calendar day is refused');
  assert.equal(closesAtIso('2026-11-24T10:00:00+05:99'), '', 'offset minutes out of range');
  assert.equal(closesAtIso('2026-11-24T10:00:00+99:00'), '', 'offset hours out of range');
});

test('closesAtIso: an object is read through the CLOSE_FIELDS precedence', () => {
  assert.equal(closesAtIso({ validThrough: '2026-11-24', endDate: '2027-01-01' }), '2026-11-24');
  assert.equal(closesAtIso({ applicationDeadline: '2026-12-01T10:00:00' }), '2026-12-01');
  assert.equal(closesAtIso({ application_deadline: '2026-12-02' }), '2026-12-02');
  assert.equal(closesAtIso({ endDate: '2026-12-03' }), '2026-12-03');
  assert.equal(closesAtIso({ end_date: '2026-12-04' }), '2026-12-04');
  assert.equal(closesAtIso({ closeDate: '2026-12-05' }), '2026-12-05');
  assert.equal(closesAtIso({ close_date: '2026-12-06' }), '2026-12-06');
  assert.equal(closesAtIso({ endDate: 'garbage', closeDate: '2026-12-07' }), '2026-12-07',
    'a non-parsing field falls through to the next one');
  assert.equal(closesAtIso({ nope: '2026-12-08' }), '');
  assert.equal(closesAtIso({ endDate: 12345 }), '', 'non-string fields are skipped');
  assert.equal(closesAtIso(['2026-12-09']), '');
  assert.equal(closesAtIso(null), '');
  assert.equal(closesAtIso(undefined), '');
  assert.equal(closesAtIso(42), '');
});

// ── closeDatesByUrl / closeDateForUrl ───────────────────────────────

test('closeDatesByUrl: web-ui rows (url LAST, closes_at 7th) and parent rows (url FIRST) both index', () => {
  const text = [
    '# header',
    '2026-11-09\ten\t42\tAcme\tEngineer\thttps://jobs.example.com/a?utm_source=x\t2026-12-01',
    'https://jobs.example.com/b\t2026-11-09\tacme-gh\tEngineer B\tAcme\tadded\t\t\t\t\t\t\t\t\t\t2026-12-15',
    '2026-11-09\ten\t43\tAcme\tNo Date\thttps://jobs.example.com/c\t',
  ].join('\n');
  const index = closeDatesByUrl(text);
  assert.equal(index.get('https://jobs.example.com/a'), '2026-12-01',
    'tracking params are normalized away');
  assert.equal(index.get('https://jobs.example.com/b'), '2026-12-15');
  assert.equal(index.has('https://jobs.example.com/c'), false,
    'a row without a close day contributes nothing');
});

test('closeDatesByUrl: a later observational row does not override the added row; a later added row does', () => {
  const url = 'https://jobs.example.com/d';
  const text = [
    `2026-11-09\ten\t44\tAcme\tEngineer\t${url}\t2026-12-01`,
    `${url}\t2026-11-10\tacme-gh\tEngineer\tAcme\tskipped_experience`,
    `${url}\t2026-11-10\tacme-gh\tEngineer\tAcme\tadded\t\t\t\t\t\t\t\t\t\t2026-12-20`,
    `${url}\t2026-11-11\tacme-gh\tEngineer\tAcme\tskipped_location\t\t\t\t\t\t\t\t\t\t2026-01-01`,
  ].join('\n');
  const index = closeDatesByUrl(text);
  assert.equal(index.get(url), '2026-12-20',
    'observational rows are visibility-only: the last ADDED day wins');
});

test('closeDatesByUrl: an unadded URL takes the latest row it has', () => {
  const url = 'https://jobs.example.com/e';
  const text = [
    `${url}\t2026-11-10\tacme-gh\tEngineer\tAcme\tskipped_location\t\t\t\t\t\t\t\t\t\t2026-03-01`,
    `${url}\t2026-11-11\tacme-gh\tEngineer\tAcme\tskipped_age\t\t\t\t\t\t\t\t\t\t2026-03-02`,
  ].join('\n');
  const index = closeDatesByUrl(text);
  assert.equal(index.get(url), '2026-03-02');
  assert.equal(closeDatesByUrl('').size, 0);
});

test('closeDatesByUrl: a later NON-observational status DOES override the added day', () => {
  const url = 'https://jobs.example.com/override';
  const text = [
    `2026-11-09\ten\t46\tAcme\tEngineer\t${url}\t2026-12-01`,
    `${url}\t2026-11-11\tacme-gh\tEngineer\tAcme\tskipped_expired\t\t\t\t\t\t\t\t\t\t2026-12-28`,
  ].join('\n');
  const index = closeDatesByUrl(text);
  assert.equal(index.get(url), '2026-12-28',
    'skipped_expired is not in the visibility-only set: the newer observation wins');
});

test('closeDatesByUrl: a URL that does not normalize still indexes under its raw cell', () => {
  const text = '2026-11-09\ten\t47\tAcme\tEngineer\tnot-a-url\t2026-04-01';
  const index = closeDatesByUrl(text);
  assert.equal(index.get('not-a-url'), '2026-04-01',
    'the canonical key falls back to the raw URL cell when normalization empties it');
});

test('closeDatesByUrl: a row with an EMPTY url cell contributes nothing', () => {
  const text = '2026-11-09\ten\t49\tAcme\tEngineer\t\t2026-05-01';
  const index = closeDatesByUrl(text);
  assert.equal(index.size, 0, 'no key, no entry');
});

test('closeDateForUrl: an empty-string URL is a miss, not a lookup', () => {
  const index = closeDatesByUrl('2026-11-09\ten\t48\tAcme\tEngineer\thttps://jobs.example.com/g\t2026-06-01');
  assert.equal(closeDateForUrl(index, ''), '');
});

test('closeDateForUrl: hit, miss, and non-string input', () => {
  const index = closeDatesByUrl('2026-11-09\ten\t45\tAcme\tEngineer\thttps://jobs.example.com/f\t2026-12-31');
  assert.equal(closeDateForUrl(index, 'https://jobs.example.com/f'), '2026-12-31');
  assert.equal(closeDateForUrl(index, 'https://jobs.example.com/f?utm_campaign=y'), '2026-12-31',
    'lookup normalizes the URL the same way the index does');
  assert.equal(closeDateForUrl(index, 'https://jobs.example.com/missing'), '');
  assert.equal(closeDateForUrl(index, null), '');
  assert.equal(closeDateForUrl(null, 'https://jobs.example.com/f'), '');
});

// ── storage: the scan history row gains closes_at ───────────────────

test('runEnScan writes the closes_at column on scan-history added rows', async () => {
  const fake = {
    id: 'zz-car256-close',
    label: 'CloseT',
    matches: (c) => c.provider === 'zz-car256-close',
    buildEndpoint: () => 'https://example.com/car256-close',
    fetch: async () => [
      { title: 'Senior Platform Engineer', url: 'https://example.com/close/1', closesAt: '2026-12-24' },
      { title: 'Senior Go Engineer', url: 'https://example.com/close/2' },
      { title: 'Senior Rust Engineer', url: 'https://example.com/close/3', endDate: '2026-12-30T23:00:00' },
    ],
  };
  ALL_ADAPTERS.unshift(fake);
  try {
    writeFileSync(resolve(dir, 'portals.yml'), [
      'tracked_companies:',
      '  - name: Close Co',
      '    provider: zz-car256-close',
    ].join('\n'));
    await runEnScan({ writeFiles: true, onLog: () => {} });
  } finally {
    ALL_ADAPTERS.splice(ALL_ADAPTERS.indexOf(fake), 1);
  }
  const history = readFileSync(resolve(dir, 'data', 'scan-history.tsv'), 'utf8');
  const rows = history.split('\n').filter((l) => /https:\/\/example\.com\/close\//.test(l));
  assert.equal(rows.length, 3);
  const withDay = rows.find((l) => /\/close\/1/.test(l));
  const withoutDay = rows.find((l) => /\/close\/2/.test(l));
  const endDateRow = rows.find((l) => /\/close\/3/.test(l));
  assert.equal(withDay.split('\t')[6], '2026-12-24', 'the 7th cell carries the close day');
  assert.equal(withoutDay.split('\t')[6], '', 'a posting without a close day writes an empty cell');
  assert.equal(endDateRow.split('\t')[6], '2026-12-30',
    'an endDate field parses through the same fallback');
});

// ── the pipeline surface joins the stored days ──────────────────────

test('GET /api/pipeline exposes a closesAt map keyed by the queue URL', async () => {
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), [
    '# pipeline',
    '```',
    'https://jobs.example.com/stored-a',
    'https://jobs.example.com/stored-b',
    '```',
  ].join('\n'));
  writeFileSync(resolve(dir, 'data', 'scan-history.tsv'), [
    '2026-11-09\ten\t50\tAcme\tEngineer A\thttps://jobs.example.com/stored-a\t2026-12-05',
    '2026-11-09\ten\t51\tAcme\tEngineer B\thttps://jobs.example.com/stored-b\t',
  ].join('\n'));
  const res = await fetch(`${baseUrl}/api/pipeline`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.urls, ['https://jobs.example.com/stored-a', 'https://jobs.example.com/stored-b']);
  assert.deepEqual(body.closesAt, {
    'https://jobs.example.com/stored-a': '2026-12-05',
  }, 'URLs with no stored day are simply absent from the map');
});
