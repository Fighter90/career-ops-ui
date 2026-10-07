/**
 * routes-2 hardening — user-save routes.
 *
 *   - interview.mjs normalizeHistory keeps the LAST MAX_TURNS turns.
 *   - /api/mock-interview/save and /api/networking/save never overwrite a
 *     same-day save of the same role/company (-2, -3… suffix); non-Latin
 *     company names get a distinct slug instead of colliding.
 *   - POST /api/jds: type check, sanitizeJobDescription, length cap, no silent
 *     overwrite (409 unless overwrite:true).
 *
 * CI-isolated mkdtemp root; provider keys removed so nothing calls an LLM.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root, normalizeHistory, writeExclusive;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'routes-saves-'));
  for (const d of ['config', 'data', 'interview-prep']) mkdirSync(join(root, d), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# x\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY', 'OPENROUTER_API_KEY', 'GITHUB_MODELS_TOKEN', 'LLM_PROVIDER']) delete process.env[k];
  process.env.CAREER_OPS_ROOT = root;
  ({ normalizeHistory, writeExclusive } = await import('../server/lib/routes/interview.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  if (root) rmSync(root, { recursive: true, force: true });
  return new Promise((r) => server.close(r));
});

const post = (p, b) => fetch(baseUrl + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

test('normalizeHistory keeps the newest 40 turns, not the first 40', () => {
  const raw = Array.from({ length: 45 }, (_, i) => ({ speaker: i % 2 ? 'candidate' : 'interviewer', text: `t${i}` }));
  const h = normalizeHistory(raw);
  assert.equal(h.length, 40);
  assert.equal(h[0].text, 't5');
  assert.equal(h[39].text, 't44');
});

test('mock-interview save: a same-day re-save gets a suffix instead of overwriting', async () => {
  const a = await (await post('/api/mock-interview/save', { role: 'Dev', company: 'Acme', transcript: 'first' })).json();
  const b = await (await post('/api/mock-interview/save', { role: 'Dev', company: 'Acme', transcript: 'second' })).json();
  assert.match(a.name, /^mock-acme-dev-\d{4}-\d{2}-\d{2}\.md$/);
  assert.equal(b.name, a.name.replace(/\.md$/, '-2.md'));
  assert.match(readFileSync(join(root, 'interview-prep', a.name), 'utf8'), /first/);
  assert.match(readFileSync(join(root, 'interview-prep', b.name), 'utf8'), /second/);
});

test('mock-interview save: two Cyrillic companies do not collide', async () => {
  const a = await (await post('/api/mock-interview/save', { company: 'Яндекс', transcript: 'x' })).json();
  const b = await (await post('/api/mock-interview/save', { company: 'Сбербанк', transcript: 'y' })).json();
  assert.ok(a.ok && b.ok);
  assert.notEqual(a.name.replace(/-\d+\.md$/, ''), b.name.replace(/-\d+\.md$/, ''));
  assert.match(a.name, /^mock-[0-9a-f]{8}-\d{4}-\d{2}-\d{2}\.md$/);
});

test('networking save: same-day re-save gets a suffix', async () => {
  const a = await (await post('/api/networking/save', { company: 'Acme', plan: 'p1' })).json();
  const b = await (await post('/api/networking/save', { company: 'Acme', plan: 'p2' })).json();
  assert.equal(b.name, a.name.replace(/\.md$/, '-2.md'));
  assert.equal(readdirSync(join(root, 'networking')).length, 2);
});

test('writeExclusive: null when every suffix is taken or the guard refuses', () => {
  const dir = join(root, 'wx');
  mkdirSync(dir);
  const at = (n) => join(dir, n);
  assert.equal(writeExclusive('f', 'a', at, 2), 'f.md');
  assert.equal(writeExclusive('f', 'b', at, 2), 'f-2.md');
  assert.equal(writeExclusive('f', 'c', at, 2), null);
  assert.equal(writeExclusive('f', 'c', () => null), null);
  // A non-EEXIST error propagates (caller answers 500).
  assert.throws(() => writeExclusive('g', 'x', (n) => join(dir, 'missing-dir', n)), /ENOENT/);
});

test('POST /api/jds: non-string text / slug -> 400', async () => {
  assert.equal((await post('/api/jds', { text: { a: 1 } })).status, 400);
  assert.equal((await post('/api/jds', { text: ['x'] })).status, 400);
  assert.equal((await post('/api/jds', { text: '   ' })).status, 400);
  assert.equal((await post('/api/jds', { text: 'ok', slug: 5 })).status, 400);
});

test('POST /api/jds: over-cap text -> 413', async () => {
  assert.equal((await post('/api/jds', { text: 'x'.repeat(50_001), slug: 'big' })).status, 413);
});

test('POST /api/jds: text is sanitized (control bytes, <script>)', async () => {
  const r = await (await post('/api/jds', { text: 'Role\u0000 A <script>alert(1)</script> done', slug: 'clean' })).json();
  assert.equal(r.name, 'clean.txt');
  const saved = readFileSync(join(root, 'jds', 'clean.txt'), 'utf8');
  assert.equal(saved, 'Role A  done');
});

test('POST /api/jds: an existing name is a 409 unless overwrite:true', async () => {
  assert.equal((await post('/api/jds', { text: 'one', slug: 'dup' })).status, 200);
  const r = await post('/api/jds', { text: 'two', slug: 'dup' });
  assert.equal(r.status, 409);
  assert.equal(readFileSync(join(root, 'jds', 'dup.txt'), 'utf8'), 'one');
  assert.equal((await post('/api/jds', { text: 'three', slug: 'dup', overwrite: true })).status, 200);
  assert.equal(readFileSync(join(root, 'jds', 'dup.txt'), 'utf8'), 'three');
});
