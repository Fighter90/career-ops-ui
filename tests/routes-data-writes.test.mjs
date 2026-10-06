/**
 * routes-3 hardening — tracker / portals / pipeline write routes.
 *
 *   - POST /api/tracker: non-string company/role (or a non-string optional
 *     field) is a 400, not a crash inside the file lock; dedup compares the
 *     cell-normalised value ('Acme ' == 'Acme').
 *   - POST /api/portals/health: a null / scalar list entry in portals.yml is
 *     skipped instead of throwing on `c.name`.
 *   - DELETE /api/pipeline: keeps other rows' `| comp`, works on a bare-URL
 *     file, and 404s honestly when nothing was removed.
 *   - POST /api/pipeline: `deduped` reflects "nothing written".
 *
 * CI-isolated mkdtemp root; no network (portals health probes nothing because
 * every remaining entry is disabled or URL-less).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root;
const apps = () => join(root, 'data', 'applications.md');
const pipe = () => join(root, 'data', 'pipeline.md');

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'routes-data-writes-'));
  for (const d of ['config', 'data']) mkdirSync(join(root, d), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# x\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(apps(), '');
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

const post = (path, body) => fetch(baseUrl + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const del = (path) => fetch(baseUrl + path, { method: 'DELETE' });

// ── tracker ──
test('tracker POST: non-string company / role -> 400 (server keeps serving)', async () => {
  for (const body of [{ company: ['a'], role: 'r' }, { company: 'c', role: { x: 1 } }, { company: 1, role: 2 }, { company: '  ', role: 'r' }]) {
    const r = await post('/api/tracker', body);
    assert.equal(r.status, 400, JSON.stringify(body));
  }
  const ok = await post('/api/tracker', { company: 'Acme', role: 'Engineer', score: 4.2 });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).num, '001');
});

test('tracker POST: non-string optional field -> 400 naming the field', async () => {
  const r = await post('/api/tracker', { company: 'X', role: 'Y', notes: { a: 1 } });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /notes/);
  const s = await post('/api/tracker', { company: 'X', role: 'Y', score: [4] });
  assert.equal(s.status, 400);
  assert.match((await s.json()).error, /score/);
});

test('tracker POST: dedup is trimmed / whitespace / case normalised', async () => {
  const r = await post('/api/tracker', { company: ' acme  ', role: 'ENGINEER\n' });
  const d = await r.json();
  assert.equal(d.deduped, true);
  assert.equal(d.existingNum, '001');
  // A pipe-bearing company round-trips through the escaped cell and still dedups.
  const p1 = await (await post('/api/tracker', { company: 'Foo | Bar', role: 'Dev' })).json();
  assert.equal(p1.num, '002');
  const p2 = await (await post('/api/tracker', { company: 'foo | bar ', role: 'dev' })).json();
  assert.equal(p2.deduped, true);
  const rows = readFileSync(apps(), 'utf8').split('\n').filter((l) => /^\| \d{3} /.test(l));
  assert.equal(rows.length, 2);
});

// ── portals ──
test('portals health: null / scalar list entries are skipped, not a crash', async () => {
  writeFileSync(join(root, 'portals.yml'), [
    'tracked_companies:',
    '  -',
    '  - just-a-string',
    '  - name: Disabled Co',
    '    careers_url: https://example.invalid/jobs',
    '    enabled: false',
    '  - name: No Url Co',
    '',
  ].join('\n'));
  const r = await post('/api/portals/health', {});
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { probed: 0, dead: 0, results: [] });
});

test('portals health: a scalar document is treated as an empty list', async () => {
  writeFileSync(join(root, 'portals.yml'), 'just text\n');
  const r = await post('/api/portals/health', {});
  assert.equal(r.status, 200);
  assert.equal((await r.json()).probed, 0);
});

// ── pipeline ──
test('pipeline DELETE on a fenced file keeps the other rows\' | comp', async () => {
  writeFileSync(pipe(), '# Pipeline\n\n```\nhttps://a.example/1 | 100k\nhttps://b.example/2 | 200k\n```\n');
  const r = await del('/api/pipeline?url=' + encodeURIComponent('https://a.example/1'));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).removed, 1);
  assert.equal(readFileSync(pipe(), 'utf8'), '# Pipeline\n\n```\nhttps://b.example/2 | 200k\n```\n');
});

test('pipeline DELETE on a bare-URL file really removes the line', async () => {
  writeFileSync(pipe(), 'https://a.example/1\nhttps://b.example/2\n');
  const r = await del('/api/pipeline?url=' + encodeURIComponent('https://b.example/2'));
  assert.equal(r.status, 200);
  assert.equal(readFileSync(pipe(), 'utf8'), 'https://a.example/1\n');
});

test('pipeline DELETE of an absent URL -> 404, file untouched; missing file -> 404', async () => {
  writeFileSync(pipe(), '```\nhttps://a.example/1\n```\n');
  const r = await del('/api/pipeline?url=' + encodeURIComponent('https://zzz.example/'));
  assert.equal(r.status, 404);
  assert.equal(readFileSync(pipe(), 'utf8'), '```\nhttps://a.example/1\n```\n');
  assert.equal((await del('/api/pipeline')).status, 400);
  unlinkSync(pipe());
  assert.equal((await del('/api/pipeline?url=https://a.example/1')).status, 404);
});

test('pipeline POST: deduped reflects canonical dedup (nothing written)', async () => {
  writeFileSync(pipe(), '```\nhttps://a.example/job\n```\n');
  const a = await (await post('/api/pipeline', { url: 'https://a.example/job?utm_source=x' })).json();
  assert.equal(a.deduped, true, 'tracking-param variant is a dup');
  assert.equal(readFileSync(pipe(), 'utf8'), '```\nhttps://a.example/job\n```\n');
  const b = await (await post('/api/pipeline', { url: 'https://b.example/job' })).json();
  assert.equal(b.deduped, false);
  assert.deepEqual(b.urls, ['https://a.example/job', 'https://b.example/job']);
});
