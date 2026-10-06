/**
 * Deep Research browser flow:
 *   - GET  /api/interview-prep         → list of saved files
 *   - GET  /api/interview-prep/:name   → markdown body
 *   - DELETE /api/interview-prep/:name → remove
 *   - POST /api/deep                   → backwards-compat manual mode
 *
 * Gemini-driven `run: true` mode is exercised against the live API and
 * therefore not covered here — it would require a network round-trip
 * with a real key. The `mode: 'manual'` path stays the deterministic
 * default we can pin in CI.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let projectRoot;

before(async () => {
  projectRoot = mkdtempSync(resolve(tmpdir(), 'deep-arch-'));
  mkdirSync(resolve(projectRoot, 'config'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'data'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'modes'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'interview-prep'), { recursive: true });
  writeFileSync(resolve(projectRoot, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(projectRoot, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(projectRoot, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(projectRoot, 'data', 'applications.md'), '');
  writeFileSync(resolve(projectRoot, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(projectRoot, 'modes', 'oferta.md'), 'oferta\n');
  writeFileSync(resolve(projectRoot, 'interview-prep', 'wheely-senior-backend.md'), '# Wheely\n\nBig file\n');
  writeFileSync(resolve(projectRoot, 'interview-prep', 'stripe-general.md'), '# Stripe\n\nNotes\n');
  // v1.241.0 — the deep page lists/deletes only its own deep-*.md briefs.
  writeFileSync(resolve(projectRoot, 'interview-prep', 'deep-wheely-senior-backend.md'), '# Wheely deep\n');
  writeFileSync(resolve(projectRoot, 'interview-prep', 'deep-stripe-general.md'), '# Stripe deep\n');
  process.env.CAREER_OPS_ROOT = projectRoot;
  delete process.env.GEMINI_API_KEY;
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
  return new Promise((r) => server.close(r));
});

async function get(path) {
  const res = await fetch(baseUrl + path);
  return { status: res.status, body: res.status < 400 ? await res.json() : null };
}
async function del(path) {
  const res = await fetch(baseUrl + path, { method: 'DELETE' });
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function post(path, body) {
  const res = await fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('GET /api/interview-prep lists the saved deep-*.md briefs only', async () => {
  const r = await get('/api/interview-prep');
  assert.equal(r.status, 200);
  assert.equal(r.body.files.length, 2);
  const names = r.body.files.map((f) => f.name);
  assert.ok(names.includes('deep-wheely-senior-backend.md'));
  assert.ok(names.includes('deep-stripe-general.md'));
  // The parent's own interview-prep reports are not the deep page's.
  assert.ok(!names.includes('stripe-general.md'));
});

test('GET /api/interview-prep/:name returns markdown body', async () => {
  const r = await get('/api/interview-prep/stripe-general.md');
  assert.equal(r.status, 200);
  assert.equal(r.body.name, 'stripe-general.md');
  assert.match(r.body.markdown, /Stripe/);
});

test('GET /api/interview-prep/:name strips path traversal', async () => {
  const r = await get('/api/interview-prep/' + encodeURIComponent('../../etc/passwd'));
  assert.ok(r.status >= 400);
});

test('DELETE /api/interview-prep/:name removes the file', async () => {
  const target = 'deep-tobe-deleted-' + Date.now() + '.md';
  writeFileSync(resolve(projectRoot, 'interview-prep', target), '# tmp\n');
  const r = await del('/api/interview-prep/' + target);
  assert.equal(r.status, 200);
  assert.equal(r.body.deleted, target);
  assert.ok(!existsSync(resolve(projectRoot, 'interview-prep', target)));
});

test('DELETE /api/interview-prep/:name refuses a non-deep file', async () => {
  const r = await del('/api/interview-prep/stripe-general.md');
  assert.equal(r.status, 400);
  assert.ok(existsSync(resolve(projectRoot, 'interview-prep', 'stripe-general.md')));
});

test('POST /api/deep without run:true returns manual prompt unchanged', async () => {
  const r = await post('/api/deep', { company: 'Wheely', role: 'Senior Backend' });
  assert.equal(r.status, 200);
  assert.equal(r.body.mode, 'manual');
  assert.match(r.body.prompt, /Wheely/);
  assert.match(r.body.prompt, /interview-prep\//);
});

test('POST /api/deep with run:true but no GEMINI_API_KEY → still manual', async () => {
  // Without the key, requesting `run: true` cannot actually execute,
  // so we fall back to manual rather than 500-ing.
  const r = await post('/api/deep', { company: 'Stripe', run: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.mode, 'manual');
});

test('POST /api/deep rejects missing company', async () => {
  const r = await post('/api/deep', {});
  assert.equal(r.status, 400);
});
