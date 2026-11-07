/**
 * report-save.test.mjs — BEHAVIORAL contract of saveReportExclusive
 * (v1.269.1 review follow-up: the source-string pin proved the text, not
 * the behavior).
 *
 * Contract:
 *   1. a fresh slug writes at `<slug>.md` and returns the slug;
 *   2. a pre-existing `<slug>.md` is NEVER clobbered — the save returns an
 *      epoch-suffixed alt slug carrying the new content;
 *   3. two saves against the same taken slug return DISTINCT slugs and all
 *      files keep their own content (the concurrent-pipeline guarantee —
 *      the old plain-`w` fallback could overwrite an epoch-suffixed report);
 *   4. content is bounded at 512 KB.
 *
 * CI-isolated: mkdtemp dir, no network, no keys.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveReportExclusive, REPORT_MAX_BYTES } from '../server/lib/report-save.mjs';

let dir;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'report-save-'));
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

const read = (name) => readFileSync(join(dir, name), 'utf8');

test('fresh slug: writes at <slug>.md, returns the slug', () => {
  const slug = saveReportExclusive(dir, 'acme-backend', '# Evaluation: Acme — Backend\n\nbody');
  assert.equal(slug, 'acme-backend');
  assert.equal(read('acme-backend.md'), '# Evaluation: Acme — Backend\n\nbody');
});

test('pre-existing slug is never clobbered — alt slug carries the new content', () => {
  writeFileSync(join(dir, 'acme-backend.md'), 'SENTINEL-ORIGINAL', 'utf8');
  const slug = saveReportExclusive(dir, 'acme-backend', '# NEW REPORT');
  assert.notEqual(slug, 'acme-backend', 'the slug must move to the epoch-suffixed alt');
  assert.match(slug, /^acme-backend-\d+$/);
  assert.equal(read('acme-backend.md'), 'SENTINEL-ORIGINAL', 'the original file must be untouched');
  assert.equal(read(`${slug}.md`), '# NEW REPORT');
});

test('two saves against the same taken slug — DISTINCT slugs, no clobber (concurrent pipelines)', () => {
  writeFileSync(join(dir, 'globex-frontend.md'), 'TAKEN', 'utf8');
  const a = saveReportExclusive(dir, 'globex-frontend', 'REPORT-A');
  const b = saveReportExclusive(dir, 'globex-frontend', 'REPORT-B');
  assert.notEqual(a, b, 'each pipeline gets its own file');
  assert.notEqual(a, 'globex-frontend');
  assert.notEqual(b, 'globex-frontend');
  assert.equal(read('globex-frontend.md'), 'TAKEN');
  assert.equal(read(`${a}.md`), 'REPORT-A');
  assert.equal(read(`${b}.md`), 'REPORT-B');
});

test('content is bounded at 512 KB', () => {
  const slug = saveReportExclusive(dir, 'initech-huge', 'x'.repeat(REPORT_MAX_BYTES + 4096));
  const got = read(`${slug}.md`);
  assert.equal(got.length, REPORT_MAX_BYTES, 'the write is sliced to the bound');
});

test('the helper file inventory: every returned slug exists on disk', () => {
  const slugs = ['a-one', 'b-two'].map((s) => saveReportExclusive(dir, s, 'c'));
  const onDisk = new Set(readdirSync(dir).map((f) => f.replace(/\.md$/, '')));
  for (const s of slugs) assert.ok(onDisk.has(s), `${s}.md must exist`);
});
