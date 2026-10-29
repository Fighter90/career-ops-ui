import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

// CAR-180 — the en-scanner years_min filter (upstream #6154 adaptation).
// CI-isolated: CAREER_OPS_ROOT is a temp dir with cv.md, the fetch is a stub,
// no network. portals.yml sets `years_min: 3`; one Greenhouse board returns
// four postings:
//   A  "2-4 years of experience"  → yearsMin 2 → below 3 → skipped_experience
//   B  "5+ years of experience"   → yearsMin 5 → kept
//   C  no figure in the JD        → yearsMin undefined → kept (never drop when unsure)
//   D  no description at all      → yearsMin undefined → kept

let runEnScan;
let dir;
let scanHistoryPath;
let pipelinePath;

const boardResponse = () => new Response(JSON.stringify({
  jobs: [
    {
      id: 1, title: 'Role A', company_name: 'GH-Co',
      absolute_url: 'https://boards.greenhouse.io/ghco/jobs/1',
      location: { name: 'Berlin' }, first_published: '2026-10-01',
      content: '<p>Requirements: 2-4 years of experience in strategy.</p>',
    },
    {
      id: 2, title: 'Role B', company_name: 'GH-Co',
      absolute_url: 'https://boards.greenhouse.io/ghco/jobs/2',
      location: { name: 'Berlin' }, first_published: '2026-10-02',
      content: '<p>Requirements: 5+ years of experience in strategy.</p>',
    },
    {
      id: 3, title: 'Role C', company_name: 'GH-Co',
      absolute_url: 'https://boards.greenhouse.io/ghco/jobs/3',
      location: { name: 'Berlin' }, first_published: '2026-10-03',
      content: '<p>A great team. No figure here.</p>',
    },
    {
      id: 4, title: 'Role D', company_name: 'GH-Co',
      absolute_url: 'https://boards.greenhouse.io/ghco/jobs/4',
      location: { name: 'Berlin' }, first_published: '2026-10-04',
    },
  ],
}), { status: 200, headers: { 'content-type': 'application/json' } });

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'jd-years-filter-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(dir, 'portals.yml'), [
    'tracked_companies:',
    '  - name: GH-Co',
    '    careers_url: https://job-boards.greenhouse.io/ghco',
    '    api: https://boards-api.greenhouse.io/v1/boards/ghco/jobs',
    '    enabled: true',
    'years_min: 3',
  ].join('\n'));
  scanHistoryPath = resolve(dir, 'data', 'scan-history.tsv');
  pipelinePath = resolve(dir, 'data', 'pipeline.md');
  process.env.CAREER_OPS_ROOT = dir;
  ({ runEnScan } = await import('../server/lib/en-scanner.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
});

const fakeFetch = async () => boardResponse();

test('years_min: 3 cuts the 2-year posting as skipped_experience and keeps the rest', async () => {
  const res = await runEnScan({ writeFiles: true, fetchImpl: fakeFetch });

  // B, C, D survive; A was cut below the threshold.
  assert.deepStrictEqual(res.fresh.map((j) => j.title).sort(), ['Role B', 'Role C', 'Role D']);
  assert.strictEqual(res.counts.yearsSkipped, 1);

  // yearsMin is surfaced on surviving jobs for the #/scan badge; a job with
  // no stated figure carries undefined, never a guess.
  const b = res.fresh.find((j) => j.title === 'Role B');
  assert.strictEqual(b.yearsMin, 5);
  assert.strictEqual(res.fresh.find((j) => j.title === 'Role C').yearsMin, undefined);
  assert.strictEqual(res.fresh.find((j) => j.title === 'Role D').yearsMin, undefined);
});

test('the cut posting is recorded as an observational skipped_experience history row', async () => {
  assert.ok(existsSync(scanHistoryPath), 'scan-history.tsv written');
  const rows = readFileSync(scanHistoryPath, 'utf8').split('\n').filter(Boolean);
  const skipped = rows.filter((l) => l.split('\t')[5] === 'skipped_experience');
  assert.strictEqual(skipped.length, 1, `exactly one skipped row, got: ${JSON.stringify(skipped)}`);
  const cells = skipped[0].split('\t');
  // Parent-format row: url, date, portal, title, company, status.
  assert.match(cells[0], /^https:\/\/boards\.greenhouse\.io\/ghco\/jobs\/1/);
  assert.strictEqual(cells[3], 'Role A');
  assert.strictEqual(cells[5], 'skipped_experience');

  // The kept postings are ordinary history rows (url last, web-ui format).
  const keptRows = rows.filter((l) => l.split('\t')[5] !== 'skipped_experience');
  assert.strictEqual(keptRows.length, 3);

  // The cut URL must not reach pipeline.md.
  const pipeline = readFileSync(pipelinePath, 'utf8');
  assert.ok(!pipeline.includes('ghco/jobs/1'), 'skipped posting absent from pipeline.md');
  assert.ok(pipeline.includes('ghco/jobs/2'), 'kept posting in pipeline.md');
});

test('a skipped_experience row never pins the URL (observational, like skipped_location)', async () => {
  // Second run: B/C/D are now seen; A is re-offered (its history row is
  // observational) and re-cut — but NOT re-recorded (one row per posting).
  const res = await runEnScan({ writeFiles: true, fetchImpl: fakeFetch });
  assert.strictEqual(res.counts.yearsSkipped, 1, 'A is re-offered and re-cut on the second run');
  const skipped = readFileSync(scanHistoryPath, 'utf8').split('\n')
    .filter((l) => l.split('\t')[5] === 'skipped_experience');
  assert.strictEqual(skipped.length, 1, 'no duplicate skipped_experience row for the same posting');
});

test('without years_min the same board keeps every posting (filter off = pass-all)', async () => {
  writeFileSync(resolve(dir, 'portals.yml'), [
    'tracked_companies:',
    '  - name: GH-Co',
    '    careers_url: https://job-boards.greenhouse.io/ghco',
    '    api: https://boards-api.greenhouse.io/v1/boards/ghco/jobs',
    '    enabled: true',
  ].join('\n'));
  const res = await runEnScan({ writeFiles: false, fetchImpl: fakeFetch });
  // B/C/D were recorded by the earlier runs, so only A is fresh — and the
  // filter is off, so it passes.
  assert.deepStrictEqual(res.fresh.map((j) => j.title), ['Role A']);
  assert.strictEqual(res.counts.yearsSkipped, 0);
});
