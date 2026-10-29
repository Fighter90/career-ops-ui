/**
 * CAR-181 — POST /api/tracker/import-csv: bring the applications in another
 * tracker's CSV export (Teal / Huntr / Simplify / a spreadsheet) into
 * data/applications.md.
 *
 *   • dry run by default — plans the import and writes NOTHING;
 *   • statuses map onto the canonical states (templates/states.yml via
 *     states.mjs); an unknown stage → Evaluated + a "source stage" note;
 *   • dedup by normalized posting URL (url-key) — the same posting reached
 *     through a tracking-param variant is still the same posting — with the
 *     company+role fallback;
 *   • { commit: true } writes through the existing append path under
 *     withFileLock (+ temp-then-rename).
 *
 * CI-isolated: CAREER_OPS_ROOT is a mkdtemp root with cv.md, no network,
 * server bound to 127.0.0.1:0.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server;
let baseUrl;
let projectRoot;

const TRACKER = [
  '# Applications Tracker',
  '',
  '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
  '|---|------|---------|------|-------|--------|-----|--------|-------|',
  '| 001 | 2026-06-01 | Northwind Grocers | Data Analyst | 4.2/5 | Responded | ✅ | [001](reports/001-northwind-grocers-2026-06-01.md) | Remote |',
  '| 002 | 2026-06-02 | Bramblewood Bank | BI Developer | 3.9/5 | Evaluated | ❌ | [002](reports/002-bramblewood-bank-2026-06-02.md) | via Hays; https://jobs.example.com/bramblewood/77 |',
  '',
].join('\n');

// The parent's merge path writes a URL COLUMN whose cell is a markdown link
// (#3516) — that layout must dedup through the extracted href instead.
const TRACKER_WITH_URL_COL = [
  '# Applications Tracker',
  '',
  '| # | Date | Company | Role | Score | Status | PDF | Report | Notes | URL |',
  '|---|------|---------|------|-------|--------|-----|--------|-------|-----|',
  '| 001 | 2026-06-01 | Northwind Grocers | Data Analyst | 4.2/5 | Responded | ✅ | [001](reports/001-northwind-grocers-2026-06-01.md) | Remote | |',
  '| 002 | 2026-06-02 | Bramblewood Bank | BI Developer | 3.9/5 | Evaluated | ❌ | [002](reports/002-bramblewood-bank-2026-06-02.md) | via Hays | [example.com](https://jobs.example.com/bramblewood/77) |',
  '',
].join('\n');

// 3 data rows: 1 to import · 1 URL duplicate of tracked row 002 (with a
// tracking-param suffix that must normalize to the same key) · 1 unknown
// stage that maps to Evaluated + a note.
const CSV = [
  'Company,Job Position,Stage,Date Applied,Job URL',
  'Larkspur Analytics,"Analytics Engineer, Platform",Applied,2026-07-03,https://jobs.example.com/larkspur/1',
  'Granite Hollow Bank,BI Developer,Interviewing,2026-07-10,https://jobs.example.com/bramblewood/77?utm_source=csv',
  'Marrowfield Foods,Data Analyst,Hold for later review,2026-07-12,',
  '',
].join('\n');

before(async () => {
  projectRoot = mkdtempSync(join(tmpdir(), 'tracker-import-csv-'));
  mkdirSync(join(projectRoot, 'config'), { recursive: true });
  mkdirSync(join(projectRoot, 'data'), { recursive: true });
  mkdirSync(join(projectRoot, 'reports'), { recursive: true });
  writeFileSync(join(projectRoot, 'cv.md'), '# placeholder\n');
  writeFileSync(join(projectRoot, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(join(projectRoot, 'portals.yml'), 'tracked_companies: []\n');
  process.env.CAREER_OPS_ROOT = projectRoot;
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
  rmSync(projectRoot, { recursive: true, force: true });
  return new Promise((r) => server.close(r));
});

function seedTracker(text = TRACKER) {
  writeFileSync(join(projectRoot, 'data', 'applications.md'), text);
}

function trackerText() {
  return readFileSync(join(projectRoot, 'data', 'applications.md'), 'utf8');
}

async function post(body) {
  const res = await fetch(`${baseUrl}/api/tracker/import-csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

function rowCells(text, company) {
  return text.split('\n').filter((l) => l.includes(`| ${company} |`))
    .map((l) => {
      const parts = l.split(/(?<!\\)\|/);
      if (parts.length && parts[parts.length - 1] === '' && l.trimEnd().endsWith('|')) parts.pop();
      return parts.map((c) => c.trim());
    });
}

test('dry run (default) plans the import and writes nothing', async () => {
  seedTracker();
  const before = trackerText();
  const { status, body } = await post({ csv: CSV });
  assert.equal(status, 200);
  assert.equal(body.imported, 2, 'Larkspur + Marrowfield (unknown stage → Evaluated)');
  assert.equal(body.skipped, 0);
  assert.equal(body.duplicates.length, 1, 'Granite Hollow Bank dedups against tracked row 002');
  assert.equal(body.duplicates[0].company, 'Granite Hollow Bank');
  assert.equal(body.duplicates[0].role, 'BI Developer');
  assert.match(body.duplicates[0].reason, /already in the tracker/i);
  // the dedup fired through URL NORMALIZATION: the CSV row carries
  // ?utm_source=csv and the tracker cell is the #3516 markdown-link form.
  assert.match(body.duplicates[0].reason, /posting URL/i);
  const importedRow = body.rows.find((r) => r.company === 'Larkspur Analytics');
  assert.equal(importedRow.status, 'Applied');
  assert.equal(importedRow.date, '2026-07-03');
  assert.equal(importedRow.outcome, 'import');
  const unknownRow = body.rows.find((r) => r.company === 'Marrowfield Foods');
  assert.equal(unknownRow.status, 'Evaluated', 'unknown stage → Evaluated');
  assert.equal(trackerText(), before, 'dry run must leave the file byte-identical');
});

test('a tracker written without the URL header still dedups the second import', async () => {
  // The existing layout above has no URL column (the web writer puts the
  // posting URL in Notes), so plan-time dedup must also read it from Notes.
  seedTracker();
  const first = await post({ csv: CSV, commit: true });
  assert.equal(first.status, 200);
  assert.equal(first.body.imported, 2);
  const text = trackerText();
  assert.equal(rowCells(text, 'Larkspur Analytics').length, 1);
  assert.match(
    rowCells(text, 'Larkspur Analytics')[0].join('|'),
    /jobs\.example\.com\/larkspur\/1/,
    'the posting URL is kept in Notes when the tracker has no URL column',
  );

  const second = await post({ csv: CSV });
  assert.equal(second.status, 200);
  assert.equal(second.body.imported, 0, 'the same file imports nothing the second time');
  assert.equal(second.body.duplicates.length, 3, 'all three rows dedup (2 by URL, Marrowfield by company+role)');
  assert.equal(trackerText(), text, 'the commit added no rows on top of the first import');
});

test('commit: true writes mapped canonical rows under the lock', async () => {
  seedTracker();
  const { status, body } = await post({ csv: CSV, commit: true, source: 'teal-export.csv' });
  assert.equal(status, 200);
  assert.equal(body.imported, 2);
  assert.ok(body.written === 2, 'commit reports how many rows it wrote');

  const text = trackerText();
  const larkspur = rowCells(text, 'Larkspur Analytics')[0];
  assert.match(larkspur.join('|'), /\|003\|/, 'next # continues after the tracked rows');
  assert.match(larkspur.join('|'), /\|Applied\|/);
  assert.match(larkspur.join('|'), /\|N\/A\|/, 'imported rows carry the N/A score sentinel');
  assert.match(larkspur.join('|'), /imported from teal-export\.csv/, 'provenance note');

  const marrow = rowCells(text, 'Marrowfield Foods')[0].join('|');
  assert.match(marrow, /\|Evaluated\|/, 'unknown stage becomes Evaluated');
  assert.match(marrow, /source stage: Hold for later review/, 'the original stage stays readable in Notes');

  const before = text;
  const again = await post({ csv: CSV, commit: true });
  assert.equal(again.status, 200);
  assert.equal(again.body.imported, 0);
  assert.equal(again.body.written, 0, 'a fully-duplicate commit writes nothing');
  assert.equal(trackerText(), before, 'idempotent commit leaves the file unchanged');
});

test('a CSV larger than 512KB is rejected with 413', async () => {
  seedTracker();
  const fat = [
    'Company,Job Position,Stage,Date Applied',
    ...Array.from({ length: 900 }, (_, i) => `Bulk Company ${i},Analyst,Applied,2026-07-03,${'x'.repeat(600)}`),
  ].join('\n');
  assert.ok(Buffer.byteLength(fat, 'utf8') > 512 * 1024, 'fixture is over the limit');
  const before = trackerText();
  const { status, body } = await post({ csv: fat });
  assert.equal(status, 413);
  assert.match(body.error, /512|too large/i);
  assert.equal(trackerText(), before);
});

test('a malformed CSV is a 400 with a human-readable error', async () => {
  seedTracker();
  const before = trackerText();
  // no company / role column at all
  const noCols = await post({ csv: 'Employer,Salary\nAcme Example,100\n' });
  assert.equal(noCols.status, 400);
  assert.match(noCols.body.error, /company|role/i);
  assert.match(noCols.body.error, /Employer/, 'the error names the headers the file actually has');
  // empty file
  const empty = await post({ csv: '   \n  ' });
  assert.equal(empty.status, 400);
  assert.match(empty.body.error, /empty|company|role|required/i);
  // missing csv field entirely
  const missing = await post({ commit: true });
  assert.equal(missing.status, 400);
  assert.equal(trackerText(), before);
});

test('a tracker WITH a URL column dedups through the markdown-link href and writes the URL cell', async () => {
  seedTracker(TRACKER_WITH_URL_COL);
  const { status, body } = await post({ csv: CSV, commit: true });
  assert.equal(status, 200);
  assert.equal(body.imported, 2);
  assert.equal(body.duplicates.length, 1);
  assert.match(body.duplicates[0].reason, /posting URL/i);

  const cells = rowCells(trackerText(), 'Larkspur Analytics')[0];
  assert.match(cells.join('|'), /jobs\.example\.com\/larkspur\/1/, 'posting URL kept');
  assert.ok(/https?:\/\/jobs\.example\.com\/larkspur\/1$/.test(cells[cells.length - 1]),
    'the URL lands in the trailing URL cell when the tracker has one');
});

test('more than 2000 data rows are rejected', async () => {
  seedTracker();
  const big = [
    'Company,Job Position,Stage',
    ...Array.from({ length: 2001 }, (_, i) => `Company ${i},Analyst,Applied`),
  ].join('\n');
  const { status, body } = await post({ csv: big });
  assert.equal(status, 400);
  assert.match(body.error, /2000/);
});
