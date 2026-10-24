/**
 * Opus 5-5 review SECOND pass on CAR-91/92 — carried-row lifecycle (M1).
 *
 *   M1. keepFailedSourcesSnapshot carried rows with no bound and no marker:
 *       a source that fails every scan re-carried its rows forever (a closed
 *       vacancy never dropped), carried rows were PREPENDED so #/scan showed
 *       stale rows first, and nothing distinguished them from fresh results.
 *       Now each carried row is stamped (`carried`, `carriedSince` — the
 *       snapshot `when` of the first carry, preserved — and `carriedCount`),
 *       a row is retired after MAX_CARRIED_RUNS carries or when its first
 *       carry stamp ages past MAX_CARRIED_AGE_DAYS, and carried rows are
 *       appended AFTER this run's rows.
 *
 * CI-isolated: CAREER_OPS_ROOT is a mkdtemp dir (cv.md + portals.yml),
 * fetchImpl is a stub, no network, no server.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let dir;
let runEnScan;

const PORTALS = [
  'tracked_companies:',
  '  - name: Acme',
  '    api: https://boards-api.greenhouse.io/v1/boards/acme/jobs',
  '  - name: OtherCorp',
  '    api: https://boards-api.greenhouse.io/v1/boards/othercorp/jobs',
].join('\n');

const lastScanPath = () => resolve(dir, 'data', 'last-scan.json');
const readSnap = () => JSON.parse(readFileSync(lastScanPath(), 'utf8'));
const daysAgo = (n) => new Date(Date.now() - n * 86400_000).toISOString();

function seed(enFresh, enFiltered, when = '2026-01-01T00:00:00Z') {
  writeFileSync(lastScanPath(), JSON.stringify({
    en: { kind: 'en', when, fresh: enFresh, filtered: enFiltered, errors: [] },
    ru: { kind: 'ru', when, fresh: [], filtered: [], errors: [] },
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
        id: i + 1, title,
        absolute_url: `https://jobs.example.com/${slug}/${i + 1}`,
        location: { name: 'Remote' },
      })),
    });
  };
}

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'scan-carryover-r2-'));
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# cv\n');
  writeFileSync(resolve(dir, 'portals.yml'), PORTALS);
  process.env.CAREER_OPS_ROOT = dir;
  ({ runEnScan } = await import('../server/lib/en-scanner.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  for (const f of ['pipeline.md', 'scan-history.tsv', 'last-scan.json']) {
    rmSync(resolve(dir, 'data', f), { force: true });
  }
  rmSync(resolve(dir, 'config', 'profile.yml'), { force: true });
});

// Acme fails this run (500) in every test below; OtherCorp answers.

test('M1: a row already carried MAX_CARRIED_RUNS times is retired, not carried again', async () => {
  seed([], [
    { company: 'Acme', source: 'ashby', title: 'Backend Engineer', _entry: 'Acme', url: 'https://jobs.acme.com/1', carried: true, carriedCount: 5, carriedSince: daysAgo(1) },
  ]);
  const r = await runEnScan({ fetchImpl: greenhouseFetch({ othercorp: ['Engineer'] }) });
  assert.ok(r.errors.some((e) => e.startsWith('Acme:')), 'the Acme entry failed this run');
  const urls = readSnap().en.filtered.map((j) => j.url);
  assert.ok(!urls.includes('https://jobs.acme.com/1'),
    'a 6th carry exceeds the run limit — the row is retired');
});

test('M1: a row under the limit survives with an incremented carriedCount', async () => {
  seed([], [
    { company: 'Acme', source: 'ashby', title: 'Backend Engineer', _entry: 'Acme', url: 'https://jobs.acme.com/2', carried: true, carriedCount: 4, carriedSince: daysAgo(1) },
  ]);
  await runEnScan({ fetchImpl: greenhouseFetch({ othercorp: ['Engineer'] }) });
  const row = readSnap().en.filtered.find((j) => j.url === 'https://jobs.acme.com/2');
  assert.ok(row, 'still carried');
  assert.equal(row.carriedCount, 5, 'the count is the number of carries including this one');
  assert.equal(row.carried, true);
});

test('M1: a row whose first carry stamp is older than MAX_CARRIED_AGE_DAYS is dropped', async () => {
  seed([], [
    { company: 'Acme', source: 'ashby', title: 'Ancient', _entry: 'Acme', url: 'https://jobs.acme.com/old', carried: true, carriedCount: 1, carriedSince: daysAgo(31) },
    { company: 'Acme', source: 'ashby', title: 'Recent', _entry: 'Acme', url: 'https://jobs.acme.com/new', carried: true, carriedCount: 1, carriedSince: daysAgo(3) },
  ]);
  await runEnScan({ fetchImpl: greenhouseFetch({ othercorp: ['Engineer'] }) });
  const urls = readSnap().en.filtered.map((j) => j.url);
  assert.ok(!urls.includes('https://jobs.acme.com/old'), '31 days carried — retired by age');
  assert.ok(urls.includes('https://jobs.acme.com/new'), '3 days carried — kept');
});

test('M1: first carry stamps the row and appends it AFTER this run\'s rows', async () => {
  seed([], [
    { company: 'Acme', source: 'ashby', title: 'Backend Engineer', _entry: 'Acme', url: 'https://jobs.acme.com/carried' },
  ]);
  await runEnScan({ fetchImpl: greenhouseFetch({ othercorp: ['Lead Engineer'] }) });
  const snap = readSnap().en;
  const urls = snap.filtered.map((j) => j.url);
  assert.deepEqual(urls, ['https://jobs.example.com/othercorp/1', 'https://jobs.acme.com/carried'],
    'carried rows are history — they come after this run\'s rows');
  const row = snap.filtered.find((j) => j.url === 'https://jobs.acme.com/carried');
  assert.equal(row.carried, true, 'the flag is exposed so the UI can badge carried rows');
  assert.equal(row.carriedCount, 1);
  assert.equal(row.carriedSince, '2026-01-01T00:00:00Z', 'first carry stamps the snapshot when');
});

test('M1: an existing carriedSince is preserved across further carries', async () => {
  const stamp = daysAgo(2);
  seed([], [
    { company: 'Acme', source: 'ashby', title: 'Backend Engineer', _entry: 'Acme', url: 'https://jobs.acme.com/3', carried: true, carriedCount: 2, carriedSince: stamp },
  ]);
  await runEnScan({ fetchImpl: greenhouseFetch({ othercorp: ['Engineer'] }) });
  const row = readSnap().en.filtered.find((j) => j.url === 'https://jobs.acme.com/3');
  assert.ok(row, 'still carried');
  assert.equal(row.carriedSince, stamp, 'the FIRST-carry stamp never moves');
  assert.equal(row.carriedCount, 3);
});
