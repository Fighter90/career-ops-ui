/**
 * POST /api/cv-studio/voice-check (CAR-188) — zero-LLM stock-phrase lint.
 *
 * CI-isolated: CAREER_OPS_ROOT is a temp dir with cv.md, no provider keys,
 * server bound to 127.0.0.1:0. The route's read-only contract is pinned by
 * hashing the whole data root before and after a run of checks.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';

let server; let baseUrl; let root;

function snapshotTree(dir) {
  const out = {};
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[relative(dir, p)] = createHash('sha256').update(readFileSync(p)).digest('hex');
    }
  };
  walk(dir);
  return out;
}

before(async () => {
  root = mkdtempSync(resolve(tmpdir(), 'voice-check-'));
  mkdirSync(resolve(root, 'writing-samples'), { recursive: true });
  writeFileSync(resolve(root, 'cv.md'), '# Jane Dev\nSenior Backend Engineer.\n');
  writeFileSync(resolve(root, 'portals.yml'), 'tracked_companies: []\n');
  for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY', 'OPENROUTER_API_KEY', 'GITHUB_MODELS_TOKEN', 'LLM_PROVIDER']) delete process.env[k];
  process.env.CAREER_OPS_ROOT = root;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});
after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

const post = (p, b) => fetch(`${baseUrl}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

test('200 happy: stock phrases with line numbers, date-range dash stays out', async () => {
  const text = [
    'Results-driven engineer with a proven track record.',
    'Spearheaded the migration while leveraging synergies.',
    'Northwind Payments 2022\u20132024',
  ].join('\n');
  const r = await post('/api/cv-studio/voice-check', { text });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(typeof j.count, 'number');
  assert.ok(Array.isArray(j.phrases));
  assert.equal(j.count, j.phrases.length);
  assert.ok(j.count >= 5, `expected >= 5 findings, got ${j.count}`);
  const names = new Set(j.phrases.map((p) => p.phrase));
  for (const want of ['results-driven', 'proven track record', 'spearheaded', 'leveraging', 'synergies']) {
    assert.ok(names.has(want), `missing finding: ${want}`);
  }
  assert.ok(!names.has('em dash') && !names.has('en dash'), 'a 2022–2024 range must not be flagged');
  for (const p of j.phrases) {
    assert.equal(typeof p.line, 'number');
    assert.equal(typeof p.match, 'string');
  }
  assert.equal(j.phrases.find((p) => p.phrase === 'results-driven').line, 1);
  assert.equal(j.phrases.find((p) => p.phrase === 'spearheaded').line, 2);
});

test('400 on missing / empty text', async () => {
  assert.equal((await post('/api/cv-studio/voice-check', {})).status, 400);
  assert.equal((await post('/api/cv-studio/voice-check', { text: '   ' })).status, 400);
});

test('clean text → count 0', async () => {
  const r = await post('/api/cv-studio/voice-check', { text: 'Built the release train; cut deploys from two weeks to four hours.' });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.count, 0);
  assert.deepEqual(j.phrases, []);
});

test('read-only: the data root is byte-identical after a run of checks', async () => {
  const beforeTree = snapshotTree(root);
  await post('/api/cv-studio/voice-check', { text: 'Passionate about synergies \u2014 every single day.' });
  await post('/api/cv-studio/voice-check', { text: 'Clean text with no stock wording at all.' });
  await post('/api/cv-studio/voice-check', {});
  assert.deepEqual(snapshotTree(root), beforeTree);
});
