/**
 * CAR-151 — lossless pipeline undo (parser contract).
 *
 * removePipelineUrlExtract is removePipelineUrl's lossless twin: same
 * matching, same updated text, plus the RAW lines that were dropped.
 * restorePipelineLines puts them back byte-faithfully — a checklist row's
 * `| company | title | location | notes` cells survive an undo, which the
 * bare addPipelineUrl re-add loses (the defect CAR-116 shipped with).
 *
 * CI-isolated: pure string functions, no fs, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePipeline,
  parsePipelineRows,
  addPipelineUrl,
  removePipelineUrl,
  removePipelineUrlExtract,
  restorePipelineLines,
} from '../server/lib/parsers.mjs';

const ROW = '- [ ] https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S | Acme GmbH | Head of Platform | Stuttgart | posted: 2026-10-02';

// The target row is LAST in Pending, so a faithful reinsert reproduces the
// whole file byte for byte — the strongest possible round-trip assertion.
const CHECKLIST = [
  '# Pipeline — Pending URLs',
  '',
  'Paste job URLs below as `- [ ] {url}` then run `/career-ops pipeline`.',
  '',
  '## Pending',
  '',
  '- [ ] local:jds/linkedin-4473300731.md | Jobster | Director Engineering | Heidelberg | note: linkedin https://www.linkedin.com/jobs/view/4473300731',
  ROW,
  '',
  '## Processed',
  '',
  '- [x] https://done.example.com/jobs/9 | Done Inc | Old Role',
  '',
].join('\n');

const FENCED = '# Pipeline\n\n```\nhttps://b.example/2 | 200k EUR\nhttps://a.example/1 | 100k EUR\n```\n';

// ── removePipelineUrlExtract: the lossless delete ──

test('removePipelineUrlExtract returns the raw checklist row (cells intact)', () => {
  const { updated, removedLines } = removePipelineUrlExtract(CHECKLIST, 'https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S');
  assert.deepEqual(removedLines, [ROW]);
  assert.equal(updated.includes(ROW), false, 'the row is gone from the text');
  assert.deepEqual(parsePipeline(updated), ['local:jds/linkedin-4473300731.md']);
});

test('removePipelineUrlExtract returns the raw fenced line with its comp cell', () => {
  const { updated, removedLines } = removePipelineUrlExtract(FENCED, 'https://a.example/1');
  assert.deepEqual(removedLines, ['https://a.example/1 | 100k EUR']);
  assert.equal(updated, '# Pipeline\n\n```\nhttps://b.example/2 | 200k EUR\n```\n');
});
test('removePipelineUrlExtract: nothing matched -> text and lines untouched', () => {
  const { updated, removedLines } = removePipelineUrlExtract(CHECKLIST, 'https://zzz.example/');
  assert.equal(updated, CHECKLIST);
  assert.deepEqual(removedLines, []);
});

test('removePipelineUrl is the string twin of removePipelineUrlExtract', () => {
  assert.equal(removePipelineUrl(CHECKLIST, 'https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S'),
    removePipelineUrlExtract(CHECKLIST, 'https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S').updated);
  // the historical contract: a string in, a string out
  assert.equal(typeof removePipelineUrl(FENCED, 'https://a.example/1'), 'string');
});

// ── restorePipelineLines: the lossless undo ──

test('restore round-trips a checklist row byte-faithfully', () => {
  const { removedLines } = removePipelineUrlExtract(CHECKLIST, 'https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S');
  const r = restorePipelineLines(CHECKLIST.replace(ROW + '\n', ''), removedLines);
  assert.equal(r.restored, 1);
  assert.equal(r.deduped, 0);
  assert.equal(r.refused, 0);
  assert.equal(r.updated, CHECKLIST, 'delete + undo = the original file');
});

test('restore round-trips a fenced line byte-faithfully', () => {
  const { updated, removedLines } = removePipelineUrlExtract(FENCED, 'https://a.example/1');
  const r = restorePipelineLines(updated, removedLines);
  assert.equal(r.restored, 1);
  assert.equal(r.updated, FENCED);
});

test('restore appends at the end of ## Pending, after rows added meanwhile', () => {
  const { updated, removedLines } = removePipelineUrlExtract(CHECKLIST, 'https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S');
  const grown = addPipelineUrl(updated, 'https://boards.example.com/jobs/42');
  const r = restorePipelineLines(grown, removedLines);
  assert.equal(r.restored, 1);
  assert.ok(r.updated.includes(ROW), 'the original row (all cells) is back');
  const pending = r.updated.split('## Processed')[0];
  assert.ok(pending.indexOf('- [ ] https://boards.example.com/jobs/42') < pending.indexOf(ROW),
    'the restored row lands after the meanwhile-added one');
  assert.deepEqual(parsePipelineRows(r.updated).find((e) => e.url === 'https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S'), {
    url: 'https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S',
    company: 'Acme GmbH',
    title: 'Head of Platform',
    location: 'Stuttgart',
    href: 'https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S',
  });
});

test('restore dedups on the canonical URL key (pending or processed)', () => {
  const { updated, removedLines } = removePipelineUrlExtract(CHECKLIST, 'https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S');
  // the URL was re-added meanwhile with a tracking param — a canonical match
  const reAdded = addPipelineUrl(updated, 'https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S?utm_source=x');
  const r = restorePipelineLines(reAdded, removedLines);
  assert.equal(r.restored, 0);
  assert.equal(r.deduped, 1);
  assert.equal(r.updated, reAdded, 'nothing is written for a dup');
});

test('restore does not re-queue a posting already processed ([x])', () => {
  const bare = '# Pipeline\n\n## Pending\n\n- [ ] https://a.example/1\n\n## Processed\n\n- [x] https://done.example.com/jobs/9\n';
  const r = restorePipelineLines(bare, ['- [ ] https://done.example.com/jobs/9 | Done Inc | Old Role']);
  assert.equal(r.restored, 0);
  assert.equal(r.deduped, 1);
  assert.equal(r.updated, bare);
});

test('restore keeps intra-batch duplicates (removing them took both lines)', () => {
  // the dedup set is the file BEFORE the restore, so two identical lines in
  // one batch are both reinserted — exactly inverting the deletion.
  const r = restorePipelineLines('# Pipeline\n\n```\n```\n', ['https://a.example/1', 'https://a.example/1']);
  assert.equal(r.restored, 2, 'not collapsed by the intra-batch dedup');
  assert.equal(r.deduped, 0);
  assert.deepEqual(parsePipeline(r.updated), ['https://a.example/1', 'https://a.example/1']);
});

test('restore refuses junk lines without writing anything', () => {
  const junk = [
    'not a url at all',                       // no URL token
    'https://a.example/1\nhttps://b.example/2', // row injection (multi-line)
    'https://a.example/1\n```',               // fence breaker
    '- [ ] javascript:alert(1) | evil',       // not an http/local token
    'https://' + 'x'.repeat(2100),            // over the 2000-char ceiling
    42,                                        // non-string entry
    null,
  ];
  const r = restorePipelineLines(CHECKLIST, junk);
  assert.equal(r.restored, 0);
  assert.equal(r.refused, junk.length);
  assert.equal(r.updated, CHECKLIST);
});

test('restore honours the injected validator (route-level isValidJobUrl)', () => {
  const r = restorePipelineLines(CHECKLIST, ['https://127.0.0.1:4317/jobs/1 | local'], {
    validate: (u) => /^local:/i.test(u) ? false : !/127\.0\.0\.1/.test(u),
  });
  assert.equal(r.restored, 0);
  assert.equal(r.refused, 1);
  assert.equal(r.updated, CHECKLIST);
});

test('restore accepts local: references by default (a legal pipeline row)', () => {
  const r = restorePipelineLines('# Pipeline\n\n```\n```\n', ['local:jds/linkedin-4473300731.md | Jobster']);
  assert.equal(r.restored, 1);
  assert.deepEqual(parsePipeline(r.updated), ['local:jds/linkedin-4473300731.md']);
});

test('restore converts a fenced line to the checklist contract after a format switch', () => {
  // comp rides as a labeled `note:` segment — the parent reads checklist
  // columns positionally, so a bare 2nd cell would be taken for the company.
  const checklistFile = CHECKLIST.replace(ROW + '\n', '');
  const r = restorePipelineLines(checklistFile, ['https://boards.example.com/jobs/43 | 90k EUR']);
  assert.equal(r.restored, 1);
  assert.match(r.updated, /^- \[ \] https:\/\/boards\.example\.com\/jobs\/43 \| note: comp 90k EUR$/m);
});

test('restore converts a checklist row to the fenced shape after a format switch', () => {
  const r = restorePipelineLines(FENCED.replace('https://a.example/1 | 100k EUR\n', ''), [ROW]);
  assert.equal(r.restored, 1);
  assert.match(r.updated, /^https:\/\/www\.arbeitsagentur\.de\/jobsuche\/jobdetail\/1-S \| Acme GmbH \| Head of Platform/m,
    'the cells ride along, the checklist prefix does not enter the fence');
  // the restored row appends at the fence end, after the survivor
  assert.deepEqual(parsePipeline(r.updated), ['https://b.example/2', 'https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S']);
});

test('restore into an empty file creates the fenced skeleton (addPipelineUrl default)', () => {
  const r = restorePipelineLines('', ['https://a.example/1']);
  assert.equal(r.restored, 1);
  assert.ok(r.updated.includes('```\nhttps://a.example/1\n```'));
});
