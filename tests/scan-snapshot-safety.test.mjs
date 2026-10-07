/**
 * R-12 — an aborted, failed or single-company scan never replaces the saved
 * snapshot (data/last-scan.json) with an emptier one.
 *
 * Before: saveLastScan ran unconditionally at the end of both scanners, so a
 * client disconnect mid-scan, a network outage (every source erroring) or a
 * `?company=Acme` rescan overwrote a 100-row snapshot with 0 rows.
 *
 * CI-isolated: CAREER_OPS_ROOT is a mkdtemp dir, fetchImpl is a stub, no network.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let dir;
let runEnScan;
let runRuScan;
let saveLastScan;
let loadLastScan;
let snapshotKeepReason;

const PORTALS = [
  'tracked_companies:',
  '  - name: Alpha',
  '    api: https://boards-api.greenhouse.io/v1/boards/alpha/jobs',
  '  - name: Beta',
  '    api: https://boards-api.greenhouse.io/v1/boards/beta/jobs',
  'russian_portals:',
  '  sources: [trudvsem]',
  '  queries: ["Go"]',
].join('\n');

const lastScanPath = () => resolve(dir, 'data', 'last-scan.json');
const readSnap = () => JSON.parse(readFileSync(lastScanPath(), 'utf8'));
const row = (company, n) => ({ company, title: `Engineer ${n}`, url: `https://example.com/${company}/${n}` });

function seed(enRows, ruRows = []) {
  writeFileSync(lastScanPath(), JSON.stringify({
    en: { kind: 'en', when: '2026-01-01T00:00:00Z', fresh: [], filtered: enRows, errors: [] },
    ru: { kind: 'ru', when: '2026-01-01T00:00:00Z', fresh: [], filtered: ruRows, errors: [] },
  }));
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Greenhouse stub: `boards` maps slug → job titles; a missing slug → 500. */
function greenhouseFetch(boards) {
  return async (url) => {
    const u = String(url);
    if (u.includes('/offices')) return json({ offices: [] });
    const slug = (u.match(/boards\/([^/]+)\//) || [])[1];
    if (!(slug in boards)) return new Response('down', { status: 500 });
    return json({
      jobs: boards[slug].map((title, i) => ({
        id: i + 1, title, company_name: slug === 'alpha' ? 'Alpha' : 'Beta',
        absolute_url: `https://example.com/${slug}/${i + 1}`, location: { name: 'Remote' },
      })),
    });
  };
}

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'scan-snapshot-'));
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# cv\n');
  writeFileSync(resolve(dir, 'portals.yml'), PORTALS);
  process.env.CAREER_OPS_ROOT = dir;
  ({ runEnScan, saveLastScan, loadLastScan, snapshotKeepReason } = await import('../server/lib/en-scanner.mjs'));
  ({ runRuScan } = await import('../server/lib/ru-scanner.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  for (const f of ['pipeline.md', 'scan-history.tsv', 'last-scan.json']) {
    rmSync(resolve(dir, 'data', f), { force: true });
  }
});

test('snapshotKeepReason: aborted / every source failed keep; anything else saves', () => {
  assert.equal(snapshotKeepReason({ aborted: true, attempted: 3, failed: 0 }), 'scan aborted');
  assert.equal(snapshotKeepReason({ aborted: false, attempted: 3, failed: 3 }), 'every source failed');
  assert.equal(snapshotKeepReason({ aborted: false, attempted: 3, failed: 2 }), null);
  // Nothing to scan is not a failure — an empty config legitimately empties it.
  assert.equal(snapshotKeepReason({ aborted: false, attempted: 0, failed: 0 }), null);
});

test('EN: an aborted scan keeps the previous snapshot', async () => {
  seed([row('Alpha', 1), row('Beta', 2)]);
  const ctrl = new AbortController();
  ctrl.abort();
  const logs = [];
  await runEnScan({ signal: ctrl.signal, fetchImpl: greenhouseFetch({ alpha: [], beta: [] }), onLog: (_s, l) => logs.push(l) });
  assert.equal(readSnap().en.filtered.length, 2, 'the 2-row snapshot survives an aborted run');
  assert.ok(logs.some((l) => /snapshot kept \(scan aborted\)/.test(l)), 'the skip is logged');
});

test('EN: a scan where every source errored keeps the previous snapshot', async () => {
  seed([row('Alpha', 1), row('Beta', 2), row('Beta', 3)]);
  const r = await runEnScan({ fetchImpl: greenhouseFetch({}) });
  assert.equal(r.errors.length, 2);
  assert.equal(readSnap().en.filtered.length, 3);
});

test('EN: a partial failure still saves (one source succeeded)', async () => {
  seed([row('Alpha', 1), row('Beta', 2), row('Beta', 3)]);
  const r = await runEnScan({ fetchImpl: greenhouseFetch({ alpha: ['Lead Engineer'] }) });
  assert.equal(r.errors.length, 1);
  const snap = readSnap().en;
  assert.deepEqual(snap.filtered.map((j) => j.url), ['https://example.com/alpha/1']);
});

test('EN: a single-company scan MERGES — other companies keep their rows, the scanned one is replaced', async () => {
  seed([row('Alpha', 1), row('Alpha', 9), row('Beta', 2), row('Beta', 3)]);
  await runEnScan({ companyName: 'alpha', fetchImpl: greenhouseFetch({ alpha: ['Staff Engineer'] }) });
  const urls = readSnap().en.filtered.map((j) => j.url).sort();
  assert.deepEqual(urls, [
    'https://example.com/Beta/2',
    'https://example.com/Beta/3',
    'https://example.com/alpha/1', // the fresh Alpha row
  ], 'stale Alpha rows (Alpha/1, Alpha/9) are replaced; Beta rows survive');
});

test('EN: the RU half of the snapshot is never touched by an EN save', async () => {
  seed([], [row('Ru', 1)]);
  await runEnScan({ fetchImpl: greenhouseFetch({ alpha: ['Engineer'], beta: [] }) });
  assert.equal(readSnap().ru.filtered.length, 1);
});

test('RU: an aborted scan keeps the previous snapshot', async () => {
  seed([], [row('Ru', 1), row('Ru', 2)]);
  const ctrl = new AbortController();
  ctrl.abort();
  await runRuScan({ signal: ctrl.signal, fetchImpl: async () => { throw new Error('must not fetch'); } });
  assert.equal(readSnap().ru.filtered.length, 2);
});

test('RU: every source call failing keeps the previous snapshot', async () => {
  seed([], [row('Ru', 1), row('Ru', 2)]);
  const r = await runRuScan({ fetchImpl: async () => { throw new Error('ECONNRESET'); } });
  assert.ok(r.errors.length >= 1);
  assert.equal(readSnap().ru.filtered.length, 2);
});

test('RU: a successful scan replaces the snapshot', async () => {
  seed([], [row('Ru', 1), row('Ru', 2)]);
  const fetchImpl = async () => json({
    results: { vacancies: [{ vacancy: { id: 'v1', 'job-name': 'Go developer', vac_url: 'https://trudvsem.ru/vacancy/v1', company: { name: 'X' } } }] },
  });
  await runRuScan({ fetchImpl });
  assert.deepEqual(readSnap().ru.filtered.map((j) => j.url), ['https://trudvsem.ru/vacancy/v1']);
});

test('saveLastScan: a file holding JSON `null` (or an array) is treated as empty, not a crash', () => {
  writeFileSync(lastScanPath(), 'null');
  saveLastScan({ kind: 'en', fresh: [], filtered: [row('A', 1)], errors: [] });
  assert.equal(readSnap().en.filtered.length, 1);
  writeFileSync(lastScanPath(), '[]');
  assert.deepEqual(loadLastScan(), { en: null, ru: null });
  writeFileSync(lastScanPath(), 'null');
  assert.deepEqual(loadLastScan(), { en: null, ru: null }, 'loadLastScan never returns null');
});

test('saveLastScan: merge with no previous snapshot just saves the payload', () => {
  saveLastScan({ kind: 'en', fresh: [row('A', 1)], filtered: [row('A', 1)], errors: [] }, { mergeCompanies: ['A'] });
  assert.equal(readSnap().en.filtered.length, 1);
});

test('saveLastScan: merge drops non-object junk rows and dedups by canonical URL', () => {
  writeFileSync(lastScanPath(), JSON.stringify({
    en: { kind: 'en', fresh: 'junk', filtered: [null, 7, { company: 'B', url: 'https://example.com/x?utm_source=a' }, row('B', 2)] },
  }));
  saveLastScan({ kind: 'en', fresh: [], filtered: [{ company: 'A', url: 'https://example.com/x' }], errors: [] }, { mergeCompanies: ['A'] });
  const snap = readSnap().en;
  assert.deepEqual(snap.filtered.map((j) => j.url).sort(), ['https://example.com/B/2', 'https://example.com/x']);
  assert.deepEqual(snap.fresh, []);
});

test('saveLastScan: atomic — no temp file is left next to last-scan.json', () => {
  saveLastScan({ kind: 'ru', fresh: [], filtered: [], errors: [] });
  const leftovers = readdirSync(resolve(dir, 'data')).filter((f) => f.endsWith('.tmp'));
  assert.deepEqual(leftovers, []);
  assert.ok(existsSync(lastScanPath()));
});
