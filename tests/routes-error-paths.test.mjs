/**
 * Error-path coverage for group-C route files: runners (PDF list / download /
 * validation), stats relays (script-error / empty-tracker fail-soft), reports
 * (validation, 404, 409, 413) and pipeline POST validation. CI-isolated: FAKE
 * parent scripts in a mkdtemp root, no network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root;

const FAIL = "process.stderr.write('Error: boom at ' + process.cwd() + '/x.mjs:1:1\\n'); process.exit(2);\n";
const EMPTY = "console.log(JSON.stringify({ error: 'No applications found in tracker.' }));\n";

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'routes-errpaths-'));
  for (const d of ['config', 'data', 'reports', 'output', 'interview-prep']) mkdirSync(join(root, d), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# x\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'data', 'applications.md'), '');
  writeFileSync(join(root, 'output', 'a.pdf'), '%PDF-1.4 a');
  writeFileSync(join(root, 'output', 'notes.txt'), 'x');
  writeFileSync(join(root, 'reports', 'r1.md'), '# R1\n\n**Score:** 4/5\n');
  writeFileSync(join(root, 'interview-prep', 'plain.txt'), 'x');
  for (const s of ['stats.mjs', 'salary-gap.mjs', 'funnel-velocity.mjs', 'upskill.mjs', 'rejection-latency.mjs', 'company-history.mjs']) {
    writeFileSync(join(root, s), FAIL);
  }
  writeFileSync(join(root, 'analyze-patterns.mjs'), EMPTY);
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

const get = (p) => fetch(baseUrl + p);
const post = (p, b) => fetch(baseUrl + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

test('runners: PDF list shows only .pdf; download / inline / invalid / missing', async () => {
  const list = await (await get('/api/output/pdfs')).json();
  assert.deepEqual(list.files.map((f) => f.name), ['a.pdf']);
  const dl = await get('/api/output/pdfs/a.pdf');
  assert.equal(dl.status, 200);
  assert.match(dl.headers.get('content-disposition'), /^attachment; filename="a.pdf"/);
  const inline = await get('/api/output/pdfs/a.pdf?inline=1');
  assert.match(inline.headers.get('content-disposition'), /^inline/);
  assert.equal((await get('/api/output/pdfs/notes.txt')).status, 400);
  assert.equal((await get('/api/output/pdfs/missing.pdf')).status, 404);
});

test('runners: PDF route validation (slug / name / markdown)', async () => {
  assert.equal((await get('/api/stream/pdf/report')).status, 400);
  assert.equal((await get('/api/stream/pdf/report?slug=nope')).status, 404);
  assert.equal((await get('/api/stream/pdf/deep?name=plain.txt')).status, 400);
  assert.equal((await get('/api/stream/pdf/deep?name=nope.md')).status, 404);
  assert.equal((await post('/api/stream/pdf/inline', { markdown: 5 })).status, 400);
  // Whitespace-only markdown passes the type gate and gets the SSE error frame.
  const ws = await (await post('/api/stream/pdf/inline', { markdown: '   ' })).text();
  assert.match(ws, /empty markdown/);
});

test('stats relays: a crashing script is available:false script-error with a sanitized detail', async () => {
  for (const p of ['lifetime', 'salary-gap', 'funnel', 'upskill', 'rejection-latency', 'company-history']) {
    const d = await (await get(`/api/stats/${p}`)).json();
    assert.equal(d.available, false, p);
    assert.equal(d.reason, 'script-error', p);
    assert.ok(!d.detail.includes(root), `${p} leaks root`);
  }
});

test('stats patterns: structured empty-tracker answer is available:true empty', async () => {
  const d = await (await get('/api/stats/patterns')).json();
  assert.equal(d.available, true);
  assert.equal(d.empty, true);
});

test('reports: GET validation / 404 / parse; POST validation, 409, 413', async () => {
  assert.equal((await get('/api/reports/nope')).status, 404);
  const r1 = await (await get('/api/reports/r1')).json();
  assert.equal(r1.scoreNum, 4);
  assert.equal((await post('/api/reports', { markdown: '# x' })).status, 400);
  assert.equal((await post('/api/reports', { slug: 'ok', markdown: 7 })).status, 400);
  assert.equal((await post('/api/reports', { slug: 'big', markdown: 'x'.repeat(2 * 1024 * 1024) })).status, 413);
  assert.equal((await post('/api/reports', { slug: 'r1', markdown: '# again' })).status, 409);
  const ow = await post('/api/reports', { slug: 'r1', markdown: '# again', overwrite: true });
  assert.equal(ow.status, 200);
});

test('pipeline POST: missing / invalid URL -> 400', async () => {
  assert.equal((await post('/api/pipeline', {})).status, 400);
  assert.equal((await post('/api/pipeline', { url: 'javascript:alert(1)' })).status, 400);
});
