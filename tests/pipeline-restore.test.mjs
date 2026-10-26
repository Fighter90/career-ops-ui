/**
 * CAR-151 — lossless pipeline undo (route contract).
 *
 * Review round 2 (finding 1, PREFERRED design): the removed RAW lines are
 * kept SERVER-SIDE under an opaque restoreToken that DELETE returns. The
 * client never sends content — POST /api/pipeline/restore takes
 * { tokens: [...] } and reinserts the stored lines content-faithfully
 * (checklist cells included) under withFileLock, deduping on the canonical
 * URL key. Unknown tokens (server restart / store eviction) are reported,
 * never written. The token store is in-process and bounded: undo is a
 * seconds-scale interaction, and a restart between delete and undo
 * degrades to the client's bare re-add fallback — never to data loss (the
 * URL itself is still known to the caller).
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

// ── DELETE answers an opaque restore token (never content to the client) ──

test('DELETE answers a restoreToken; the raw lines stay server-side', async () => {
  writeFileSync(pipe(), '# Pipeline\n\n```\nhttps://b.example/2 | 200k EUR\nhttps://a.example/1 | 100k EUR\n```\n');
  const r = await del('/api/pipeline?url=' + encodeURIComponent('https://a.example/1'));
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.ok, true);
  assert.equal(body.removed, 1);
  assert.equal(typeof body.restoreToken, 'string');
  assert.match(body.restoreToken, /^[0-9a-f-]{36}$/, 'an opaque UUID, not content');
  assert.equal(Array.isArray(body.lines), false, 'the client is not the content carrier');
  assert.equal(readFileSync(pipe(), 'utf8'), '# Pipeline\n\n```\nhttps://b.example/2 | 200k EUR\n```\n');
});

test('DELETE on a checklist row hands out a token too; removed counts raw lines', async () => {
  writeFileSync(pipe(), CHECKLIST);
  const body = await (await del('/api/pipeline?url=' + encodeURIComponent('https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S'))).json();
  assert.equal(body.removed, 1);
  assert.match(body.restoreToken, /^[0-9a-f-]{36}$/);
});

test('a duplicated row takes both lines under ONE token (removed = raw lines)', async () => {
  writeFileSync(pipe(), '# Pipeline\n\n```\nhttps://a.example/1\nhttps://a.example/1\n```\n');
  const body = await (await del('/api/pipeline?url=' + encodeURIComponent('https://a.example/1'))).json();
  assert.equal(body.removed, 2, 'both raw lines');
  assert.match(body.restoreToken, /^[0-9a-f-]{36}$/);
});

test('DELETE 404 stays honest (no token, file untouched)', async () => {
  writeFileSync(pipe(), CHECKLIST);
  const r = await del('/api/pipeline?url=' + encodeURIComponent('https://zzz.example/'));
  assert.equal(r.status, 404);
  const body = await r.json();
  assert.equal(body.restoreToken, undefined);
  assert.equal(readFileSync(pipe(), 'utf8'), CHECKLIST);
});

// ── POST /api/pipeline/restore { tokens } ──

test('restore by token round-trips a checklist row content-faithfully', async () => {
  writeFileSync(pipe(), CHECKLIST);
  const { restoreToken } = await (await del('/api/pipeline?url=' + encodeURIComponent('https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S'))).json();
  const r = await post('/api/pipeline/restore', { tokens: [restoreToken] });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.restored, 1);
  assert.equal(body.deduped, 0);
  assert.deepEqual(body.unknown, []);
  // the deleted row was last in Pending, so the file is exactly what it was
  assert.equal(readFileSync(pipe(), 'utf8'), CHECKLIST);
});

test('restore keeps every cell of a MIDDLE row (cells, not whole-file equality)', async () => {
  writeFileSync(pipe(), CHECKLIST);
  const { restoreToken } = await (await del('/api/pipeline?url=' + encodeURIComponent('https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S'))).json();
  await post('/api/pipeline/restore', { tokens: [restoreToken] });
  const { parsePipelineRows } = await import('../server/lib/parsers.mjs');
  const row = parsePipelineRows(readFileSync(pipe(), 'utf8'))
    .find((e) => e.url === 'https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S');
  assert.deepEqual(row, {
    url: 'https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S',
    company: 'Acme GmbH',
    title: 'Head of Platform',
    location: 'Stuttgart',
    href: 'https://www.arbeitsagentur.de/jobsuche/jobdetail/1-S',
  });
});

test('restore is idempotent: the same token again dedups (lines are back)', async () => {
  writeFileSync(pipe(), '# Pipeline\n\n```\nhttps://a.example/1 | 100k\n```\n');
  const { restoreToken } = await (await del('/api/pipeline?url=' + encodeURIComponent('https://a.example/1'))).json();
  const first = await (await post('/api/pipeline/restore', { tokens: [restoreToken] })).json();
  assert.equal(first.restored, 1);
  const second = await (await post('/api/pipeline/restore', { tokens: [restoreToken] })).json();
  assert.equal(second.restored, 0);
  assert.equal(second.deduped, 1);
  assert.equal((readFileSync(pipe(), 'utf8').match(/a\.example\/1/g) || []).length, 1);
});

test('restore dedups a URL re-added meanwhile (canonical key)', async () => {
  writeFileSync(pipe(), '# Pipeline\n\n```\nhttps://a.example/1 | 100k\n```\n');
  const { restoreToken } = await (await del('/api/pipeline?url=' + encodeURIComponent('https://a.example/1'))).json();
  await post('/api/pipeline', { url: 'https://a.example/1?utm_source=x' });
  const body = await (await post('/api/pipeline/restore', { tokens: [restoreToken] })).json();
  assert.equal(body.restored, 0);
  assert.equal(body.deduped, 1);
  assert.equal((readFileSync(pipe(), 'utf8').match(/a\.example\/1/g) || []).length, 1,
    'the re-added line stays alone; the old comp cell is not duplicated in');
});

test('unknown tokens are reported, never written; client content is not accepted', async () => {
  writeFileSync(pipe(), CHECKLIST);
  const before = readFileSync(pipe(), 'utf8');
  const r = await post('/api/pipeline/restore', { tokens: ['not-a-token', 42] });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.restored, 0);
  assert.deepEqual(body.unknown, ['not-a-token', '42']);
  assert.equal(readFileSync(pipe(), 'utf8'), before);
  // finding 1 — the old content-carrying shape is gone: `lines` is not a
  // restore input, so an injected "row" is just an unknown token.
  const smuggle = await (await post('/api/pipeline/restore', {
    tokens: [],
    lines: ['- [ ] https://x.example/1 | injected | cells'],
  })).json();
  assert.equal(smuggle.restored, 0);
  assert.equal(readFileSync(pipe(), 'utf8'), before);
});

test('a mixed batch restores the known tokens and reports the unknown ones', async () => {
  writeFileSync(pipe(), '# Pipeline\n\n```\nhttps://keep.example/1\n```\n');
  const delBody = await (await del('/api/pipeline?url=' + encodeURIComponent('https://keep.example/1'))).json();
  // a second, unrelated URL queued then removed — its token is valid too
  writeFileSync(pipe(), '# Pipeline\n\n```\nhttps://gone.example/2\n```\n');
  const gone = await (await del('/api/pipeline?url=' + encodeURIComponent('https://gone.example/2'))).json();
  writeFileSync(pipe(), '# Pipeline\n\n```\nhttps://keep.example/1\n```\n');
  // keep.example/1 is present again (the fixture re-added it), so its
  // restore dedups; only gone.example/2 comes back.
  const body = await (await post('/api/pipeline/restore', { tokens: [delBody.restoreToken, 'stale', gone.restoreToken] })).json();
  assert.equal(body.restored, 1);
  assert.equal(body.deduped, 1);
  assert.deepEqual(body.unknown, ['stale']);
  assert.equal(readFileSync(pipe(), 'utf8'), '# Pipeline\n\n```\nhttps://keep.example/1\nhttps://gone.example/2\n```\n');
});

test('server-originated content needs no URL gate: a local: line restores as-is', async () => {
  writeFileSync(pipe(), CHECKLIST);
  const { restoreToken } = await (await del('/api/pipeline?url=' + encodeURIComponent('local:jds/linkedin-4473300731.md'))).json();
  const body = await (await post('/api/pipeline/restore', { tokens: [restoreToken] })).json();
  assert.equal(body.restored, 1);
  assert.match(readFileSync(pipe(), 'utf8'), /local:jds\/linkedin-4473300731\.md \| Jobster \| Director Engineering \| Heidelberg/);
});

test('restore 400s honestly on a missing / non-array / oversized tokens body', async () => {
  assert.equal((await post('/api/pipeline/restore', {})).status, 400);
  assert.equal((await post('/api/pipeline/restore', { tokens: 'x' })).status, 400);
  assert.equal((await post('/api/pipeline/restore', { tokens: Array.from({ length: 10001 }, () => 't') })).status, 400);
  const body = await (await post('/api/pipeline/restore', {})).json();
  assert.match(body.error, /tokens/);
});

test('restore onto a missing pipeline.md creates it (fenced skeleton)', async () => {
  rmSync(pipe(), { force: true });
  writeFileSync(pipe(), '# Pipeline\n\n```\nhttps://a.example/1\n```\n');
  const { restoreToken } = await (await del('/api/pipeline?url=' + encodeURIComponent('https://a.example/1'))).json();
  rmSync(pipe(), { force: true });
  const body = await (await post('/api/pipeline/restore', { tokens: [restoreToken] })).json();
  assert.equal(body.restored, 1);
  assert.equal(readFileSync(pipe(), 'utf8'), '# Pipeline — Pending URLs\n\nDrop job URLs (one per line) here.\n\n```\nhttps://a.example/1\n```\n');
});
