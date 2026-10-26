/**
 * CAR-151 — lossless pipeline undo (route contract).
 *
 *   DELETE /api/pipeline?url=…  now answers with `lines` — the RAW removed
 *   pipeline line(s) — so the client's undo can put back what it deleted.
 *   POST   /api/pipeline/restore { lines } reinserts those lines
 *   byte-faithfully (checklist cells included) under withFileLock, deduping
 *   on the canonical URL key and refusing structurally invalid lines.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT with cv.md, no network, 127.0.0.1.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root;
const pipe = () => join(root, 'data', 'pipeline.md');

const ROW = '- [ ] https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S | Acme GmbH | Head of Platform | Stuttgart | posted: 2026-10-02';
const CHECKLIST = [
  '# Pipeline — Pending URLs',
  '',
  '## Pending',
  '',
  '- [ ] local:jds/linkedin-4473300731.md | Jobster | Director Engineering | Heidelberg',
  ROW,
  '',
  '## Processed',
  '',
  '- [x] https://done.example.com/jobs/9 | Done Inc | Old Role',
  '',
].join('\n');

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'pipeline-restore-'));
  mkdirSync(join(root, 'data'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# x\n');
  process.env.CAREER_OPS_ROOT = root;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  if (root) rmSync(root, { recursive: true, force: true });
  return new Promise((r) => server.close(r));
});

const del = (path) => fetch(baseUrl + path, { method: 'DELETE' });
const post = (path, body) => fetch(baseUrl + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

// ── DELETE answers with the removed raw lines ──

test('DELETE answers `lines` with the raw fenced line (comp cell intact)', async () => {
  writeFileSync(pipe(), '# Pipeline\n\n```\nhttps://a.example/1 | 100k EUR\nhttps://b.example/2 | 200k EUR\n```\n');
  const r = await del('/api/pipeline?url=' + encodeURIComponent('https://a.example/1'));
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.ok, true);
  assert.equal(body.removed, 1);
  assert.deepEqual(body.lines, ['https://a.example/1 | 100k EUR']);
  assert.equal(readFileSync(pipe(), 'utf8'), '# Pipeline\n\n```\nhttps://b.example/2 | 200k EUR\n```\n');
});

test('DELETE answers `lines` with the raw checklist row (all cells intact)', async () => {
  writeFileSync(pipe(), CHECKLIST);
  const r = await del('/api/pipeline?url=' + encodeURIComponent('https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S'));
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).lines, [ROW]);
});

test('DELETE 404 stays honest (no lines, file untouched)', async () => {
  writeFileSync(pipe(), CHECKLIST);
  const r = await del('/api/pipeline?url=' + encodeURIComponent('https://zzz.example/'));
  assert.equal(r.status, 404);
  const body = await r.json();
  assert.equal(Array.isArray(body.lines), false);
  assert.equal(readFileSync(pipe(), 'utf8'), CHECKLIST);
});

// ── POST /api/pipeline/restore ──

test('restore round-trips a checklist row byte-faithfully (delete → undo)', async () => {
  writeFileSync(pipe(), CHECKLIST);
  const d = await (await del('/api/pipeline?url=' + encodeURIComponent('https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S'))).json();
  const r = await post('/api/pipeline/restore', { lines: d.lines });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.restored, 1);
  assert.equal(body.deduped, 0);
  assert.equal(body.refused, 0);
  assert.equal(readFileSync(pipe(), 'utf8'), CHECKLIST, 'the file is exactly what it was before the delete');
});

test('restore dedups a URL re-added meanwhile (canonical key)', async () => {
  writeFileSync(pipe(), '# Pipeline\n\n```\nhttps://a.example/1 | 100k\n```\n');
  const d = await (await del('/api/pipeline?url=' + encodeURIComponent('https://a.example/1'))).json();
  // the user re-adds the URL by hand (with a tracking param) before undoing
  await post('/api/pipeline', { url: 'https://a.example/1?utm_source=x' });
  const body = await (await post('/api/pipeline/restore', { lines: d.lines })).json();
  assert.equal(body.restored, 0);
  assert.equal(body.deduped, 1);
  assert.equal((readFileSync(pipe(), 'utf8').match(/a\.example\/1/g) || []).length, 1,
    'the re-added line stays alone; the old comp cell is not duplicated in');
});

test('restore refuses junk lines and leaves the file untouched', async () => {
  writeFileSync(pipe(), CHECKLIST);
  const before = readFileSync(pipe(), 'utf8');
  const r = await post('/api/pipeline/restore', { lines: ['nope', 'https://x.example/1\nhttps://y.example/2', '```', 42] });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.restored, 0);
  assert.equal(body.refused, 4);
  assert.equal(readFileSync(pipe(), 'utf8'), before);
});

test('restore gates http(s) tokens through isValidJobUrl; local: skips it', async () => {
  writeFileSync(pipe(), '# Pipeline\n\n```\n```\n');
  const bad = await (await post('/api/pipeline/restore', { lines: ['http://127.0.0.1:4317/jobs/1 | loopback'] })).json();
  assert.equal(bad.restored, 0);
  assert.equal(bad.refused, 1);
  const good = await (await post('/api/pipeline/restore', { lines: ['local:jds/linkedin-4473300731.md | Jobster'] })).json();
  assert.equal(good.restored, 1);
  assert.deepEqual(good.urls, ['local:jds/linkedin-4473300731.md']);
});

test('restore 400s honestly on a missing / non-array / oversized lines body', async () => {
  assert.equal((await post('/api/pipeline/restore', {})).status, 400);
  assert.equal((await post('/api/pipeline/restore', { lines: 'https://a.example/1' })).status, 400);
  assert.equal((await post('/api/pipeline/restore', { lines: Array.from({ length: 5001 }, (_, i) => `https://a.example/${i}`) })).status, 400);
  const body = await (await post('/api/pipeline/restore', {})).json();
  assert.match(body.error, /lines/);
});

test('restore onto a missing pipeline.md creates it (fenced skeleton)', async () => {
  rmSync(pipe(), { force: true });
  const body = await (await post('/api/pipeline/restore', { lines: ['https://a.example/1'] })).json();
  assert.equal(body.restored, 1);
  assert.equal(readFileSync(pipe(), 'utf8'), '# Pipeline — Pending URLs\n\nDrop job URLs (one per line) here.\n\n```\nhttps://a.example/1\n```\n');
});

test('restore of a mixed batch restores the good lines and counts the refused', async () => {
  writeFileSync(pipe(), '# Pipeline\n\n```\nhttps://keep.example/1\n```\n');
  const body = await (await post('/api/pipeline/restore', {
    lines: ['https://add.example/2 | 100k', 'garbage'],
  })).json();
  assert.equal(body.restored, 1);
  assert.equal(body.refused, 1);
  assert.equal(readFileSync(pipe(), 'utf8'), '# Pipeline\n\n```\nhttps://keep.example/1\nhttps://add.example/2 | 100k\n```\n');
});
