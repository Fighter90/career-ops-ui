/**
 * Pipeline in the parent's checklist format.
 *
 * Upstream career-ops (career-ops-hq, v1.35.0) writes data/pipeline.md as
 * `## Pending` / `## Processed` sections of `- [ ] url | company | title | …`
 * rows (scan.mjs PIPELINE_SKELETON + appendToPipeline) — no code fence. The UI
 * only read URLs from a fence, so on such a project it showed 0 pending, and an
 * added URL landed in a new fence at the end of the file, where the parent's
 * `/career-ops pipeline` never looks. The fenced format must keep working.
 *
 * CI-isolated: pure string functions, no fs, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePipeline, addPipelineUrl, removePipelineUrl } from '../server/lib/parsers.mjs';

const CHECKLIST = [
  '# Pipeline — Pending URLs',
  '',
  'Paste job URLs below as `- [ ] {url}` then run `/career-ops pipeline`.',
  '',
  '## Pending',
  '',
  '- [ ] https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S | Acme GmbH | Head of Platform | Stuttgart | posted: 2026-10-02',
  '- [ ] local:jds/linkedin-4473300731.md | Jobster | Director Engineering | Heidelberg | note: linkedin https://www.linkedin.com/jobs/view/4473300731',
  '',
  '## Processed',
  '',
  '- [x] https://done.example.com/jobs/9 | Done Inc | Old Role',
  '',
].join('\n');

test('parsePipeline reads the pending rows of a checklist pipeline', () => {
  assert.deepEqual(parsePipeline(CHECKLIST), [
    'https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S',
    'local:jds/linkedin-4473300731.md',
  ]);
});

test('parsePipeline ignores processed ([x]) rows and prose', () => {
  assert.equal(parsePipeline(CHECKLIST).some((u) => u === 'https://done.example.com/jobs/9'), false);
});

test('addPipelineUrl appends a checklist row at the end of ## Pending, not a fence', () => {
  const after = addPipelineUrl(CHECKLIST, 'https://boards.example.com/jobs/42');
  assert.ok(!after.includes('```'), 'no code fence is created');
  const pending = after.split('## Processed')[0];
  assert.match(pending, /^- \[ \] https:\/\/boards\.example\.com\/jobs\/42$/m);
  assert.deepEqual(parsePipeline(after).at(-1), 'https://boards.example.com/jobs/42');
  // the existing rows (with their columns) and the Processed section survive untouched
  assert.ok(after.includes(CHECKLIST.split('\n')[6]));
  assert.ok(after.includes('- [x] https://done.example.com/jobs/9 | Done Inc | Old Role'));
});

test('addPipelineUrl dedups against checklist rows (canonical key)', () => {
  const after = addPipelineUrl(CHECKLIST, 'https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S?utm_source=x');
  assert.equal(after, CHECKLIST);
});

test('addPipelineUrl does not re-queue a posting already processed ([x])', () => {
  const after = addPipelineUrl(CHECKLIST, 'https://done.example.com/jobs/9');
  assert.equal(after, CHECKLIST);
});

test('addPipelineUrl writes compensation as a labeled note: segment in checklist rows', () => {
  // The parent reads checklist columns positionally (url | company | title |
  // location | comp), so a bare 2nd column would be taken for the company.
  const after = addPipelineUrl(CHECKLIST, 'https://boards.example.com/jobs/43', { comp: '90k EUR' });
  assert.match(after, /^- \[ \] https:\/\/boards\.example\.com\/jobs\/43 \| note: comp 90k EUR$/m);
});

test('addPipelineUrl adds a ## Pending section to a checklist file that lost it', () => {
  const noPending = '# Pipeline\n\n## Processed\n\n- [x] https://done.example.com/jobs/9\n';
  const after = addPipelineUrl(noPending, 'https://boards.example.com/jobs/44');
  assert.ok(!after.includes('```'), 'no code fence is created');
  assert.ok(after.includes('## Pending'));
  assert.ok(after.indexOf('## Pending') < after.indexOf('## Processed'));
  assert.deepEqual(parsePipeline(after), ['https://boards.example.com/jobs/44']);
});

test('removePipelineUrl drops only the matching pending row', () => {
  const after = removePipelineUrl(CHECKLIST, 'https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S');
  assert.deepEqual(parsePipeline(after), ['local:jds/linkedin-4473300731.md']);
  assert.ok(after.includes('## Processed'));
  assert.ok(after.includes('- [x] https://done.example.com/jobs/9 | Done Inc | Old Role'));
});

test('the fenced format is unchanged', () => {
  const fenced = '# Pipeline\n\n```\nhttps://a.com/1\n```\n';
  const after = addPipelineUrl(fenced, 'https://b.com/2');
  assert.equal(after, '# Pipeline\n\n```\nhttps://a.com/1\nhttps://b.com/2\n```\n');
  assert.deepEqual(parsePipeline(removePipelineUrl(after, 'https://a.com/1')), ['https://b.com/2']);
});

test('an empty file still gets the fenced skeleton (format default unchanged)', () => {
  const after = addPipelineUrl('', 'https://a.com/1');
  assert.ok(after.includes('```\nhttps://a.com/1\n```'));
});
