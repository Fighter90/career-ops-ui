/**
 * Opus 5-5 review round on CAR-91/92 — snapshot carry-over findings.
 *
 *   R7. keepFailedSourcesSnapshot matched the failed set against company OR
 *       source, and the EN failed set holds portals ENTRY names — so a failed
 *       entry named "Lever" kept every successfully-rescanned company's
 *       lever-source rows, and a failed company name matched rows that came
 *       from a succeeded aggregator. EN now matches the ENTRY the row was
 *       fetched for (`_entry`, stamped at fetch time; `company` for rows an
 *       older build saved) and never the source; RU matches `source` only.
 *   R8. Carried rows bypassed the current run's filters: old `fresh` rows were
 *       re-flagged as fresh (re-appearing "new" and re-appended to
 *       pipeline/history) and neither cooldown nor the current title/location
 *       filters were re-applied. Carried rows are history now — `filtered`
 *       only, re-checked against the current filters.
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
let runRuScan;

const PORTALS = [
  'tracked_companies:',
  '  - name: Lever',
  '    api: https://boards-api.greenhouse.io/v1/boards/lever/jobs',
  '  - name: Acme',
  '    api: https://boards-api.greenhouse.io/v1/boards/acme/jobs',
  '  - name: OtherCorp',
  '    api: https://boards-api.greenhouse.io/v1/boards/othercorp/jobs',
  'russian_portals:',
  '  sources: [hh, trudvsem]',
  '  queries: ["Go"]',
].join('\n');

const lastScanPath = () => resolve(dir, 'data', 'last-scan.json');
const readSnap = () => JSON.parse(readFileSync(lastScanPath(), 'utf8'));

function seed(enFresh, enFiltered, ruRows = []) {
  writeFileSync(lastScanPath(), JSON.stringify({
    en: { kind: 'en', when: '2026-01-01T00:00:00Z', fresh: enFresh, filtered: enFiltered, errors: [] },
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
        id: i + 1, title,
        absolute_url: `https://jobs.example.com/${slug}/${i + 1}`,
        location: { name: 'Remote' },
      })),
    });
  };
}

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'scan-carryover-opus-'));
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# cv\n');
  writeFileSync(resolve(dir, 'portals.yml'), PORTALS);
  process.env.CAREER_OPS_ROOT = dir;
  ({ runEnScan } = await import('../server/lib/en-scanner.mjs'));
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
  rmSync(resolve(dir, 'config', 'profile.yml'), { force: true });
});

// ── R7 — carry-over matches the ENTRY (EN) / the source (RU) ─────────────────

test('R7 EN: a failed entry named "Lever" does NOT keep other companies\' lever-source rows', async () => {
  seed([], [
    // Old rows fetched for OtherCorp (stamped by the new build) whose SOURCE
    // is lever: OtherCorp answers this run, so its rows must be replaced —
    // whatever their source field says.
    { company: 'OtherCorp', source: 'lever', title: 'Platform Engineer', _entry: 'OtherCorp', url: 'https://jobs.lever.co/othercorp/1' },
    { company: 'OtherCorp', source: 'lever', title: 'Staff Engineer', _entry: 'OtherCorp', url: 'https://jobs.lever.co/othercorp/2' },
  ]);
  const r = await runEnScan({ fetchImpl: greenhouseFetch({ acme: [], othercorp: ['Lead Engineer'] }) });
  assert.ok(r.errors.some((e) => e.startsWith('Lever:')), 'the Lever entry failed this run');
  const urls = readSnap().en.filtered.map((j) => j.url);
  assert.deepEqual(urls, ['https://jobs.example.com/othercorp/1'],
    'successfully-rescanned OtherCorp rows must be replaced wholesale — source:"lever" must not carry them');
});

test('R7 EN: a failed entry "Acme" still keeps Acme\'s stamped rows (and legacy unstamped ones)', async () => {
  seed([], [
    { company: 'Acme', source: 'ashby', title: 'Backend Engineer', _entry: 'Acme', url: 'https://jobs.acme.com/1' },
    // A row saved by a build without the _entry stamp — falls back to company.
    { company: 'Acme', source: 'greenhouse', title: 'SRE', url: 'https://jobs.acme.com/2' },
  ]);
  const r = await runEnScan({ fetchImpl: greenhouseFetch({ othercorp: ['Engineer'] }) });
  assert.ok(r.errors.some((e) => e.startsWith('Acme:')), 'the Acme entry failed this run');
  const urls = readSnap().en.filtered.map((j) => j.url).sort();
  assert.deepEqual(urls, ['https://jobs.acme.com/1', 'https://jobs.acme.com/2', 'https://jobs.example.com/othercorp/1'],
    'a failed source contributes nothing, so its previous rows survive');
});

test('R7 RU: carry-over matches `source` only — a company that merely NAMED the source is replaced', async () => {
  seed([], [], [
    // hh.ru fails this run (451); trudvsem answers. A trudvsem row whose
    // company field happens to read "hh.ru" must NOT be carried by that name.
    { source: 'trudvsem', company: 'hh.ru', title: 'Go dev', url: 'https://trudvsem.ru/vacancy/old' },
    { source: 'hh.ru', company: 'HH Co', title: 'Go dev', url: 'https://hh.ru/vacancy/1' },
  ]);
  const fetchImpl = async (url) => {
    if (String(url).includes('hh.ru')) return new Response('blocked', { status: 451 });
    return json({
      results: { vacancies: [{ vacancy: { id: 'v2', 'job-name': 'Go developer', vac_url: 'https://trudvsem.ru/vacancy/v2', company: { name: 'X' } } }] },
    });
  };
  await runRuScan({ fetchImpl });
  const urls = readSnap().ru.filtered.map((j) => j.url).sort();
  assert.deepEqual(urls, ['https://hh.ru/vacancy/1', 'https://trudvsem.ru/vacancy/v2'],
    'hh.ru rows survive via source; the trudvsem row is replaced even though its company read "hh.ru"');
});

// ── R8 — carried rows re-run the CURRENT filters, never re-enter fresh ───────

test('R8: a carried row is history — it never re-appears as fresh', async () => {
  seed(
    [{ company: 'Acme', source: 'ashby', title: 'Backend Engineer', _entry: 'Acme', url: 'https://jobs.acme.com/1' }],
    [{ company: 'Acme', source: 'ashby', title: 'Backend Engineer', _entry: 'Acme', url: 'https://jobs.acme.com/1' }],
  );
  const r = await runEnScan({ fetchImpl: greenhouseFetch({ othercorp: ['Engineer'] }) });
  assert.ok(r.errors.some((e) => e.startsWith('Acme:')));
  const snap = readSnap().en;
  assert.ok(!snap.fresh.some((j) => j.url === 'https://jobs.acme.com/1'),
    'carried rows are not new offers — fresh holds only this run\'s rows');
  assert.ok(snap.filtered.some((j) => j.url === 'https://jobs.acme.com/1'), 'the row is still browsable under filtered');
});

test('R8: an already-applied (cooldown) job carried from a failed source does not reappear', async () => {
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400_000).toISOString().slice(0, 10);
  writeFileSync(resolve(dir, 'config', 'profile.yml'), [
    'candidate:',
    '  full_name: T',
    're_apply_windows:',
    '  Acme:',
    `    last_apply_date: ${fiveDaysAgo}`,
    '    same_role_days: 30',
    '    applied_to: ["Engineer"]',
  ].join('\n'));
  seed(
    [{ company: 'Acme', source: 'ashby', title: 'Backend Engineer', _entry: 'Acme', url: 'https://jobs.acme.com/applied' }],
    [{ company: 'Acme', source: 'ashby', title: 'Backend Engineer', _entry: 'Acme', url: 'https://jobs.acme.com/applied' }],
  );
  const r = await runEnScan({ fetchImpl: greenhouseFetch({ othercorp: ['Engineer'] }) });
  assert.ok(r.errors.some((e) => e.startsWith('Acme:')));
  const snap = readSnap().en;
  assert.ok(!snap.fresh.some((j) => j.url === 'https://jobs.acme.com/applied'), 'never re-flagged fresh');
  assert.ok(!snap.filtered.some((j) => j.url === 'https://jobs.acme.com/applied'),
    'the re-apply cooldown applies to carried rows too — an applied role must not resurface');
});

test('R8: a carried row that fails the CURRENT title filter is dropped', async () => {
  writeFileSync(resolve(dir, 'portals.yml'), [
    'title_filter:',
    '  negative: ["intern"]',
    ...PORTALS.split('\n'),
  ].join('\n'));
  seed([], [
    { company: 'Acme', source: 'ashby', title: 'Intern Engineer', _entry: 'Acme', url: 'https://jobs.acme.com/intern' },
    { company: 'Acme', source: 'ashby', title: 'Backend Engineer', _entry: 'Acme', url: 'https://jobs.acme.com/senior' },
  ]);
  try {
    const r = await runEnScan({ fetchImpl: greenhouseFetch({ othercorp: ['Engineer'] }) });
    assert.ok(r.errors.some((e) => e.startsWith('Acme:')));
    const urls = readSnap().en.filtered.map((j) => j.url);
    assert.ok(!urls.includes('https://jobs.acme.com/intern'), 'the current negative filter applies to carried rows');
    assert.ok(urls.includes('https://jobs.acme.com/senior'), 'rows that still pass the filters are carried');
  } finally {
    writeFileSync(resolve(dir, 'portals.yml'), PORTALS);
  }
});
