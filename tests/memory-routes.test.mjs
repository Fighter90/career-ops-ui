/**
 * Memory layer routes (v1.93.0, Epic 24). CI-isolated. Verifies the note
 * round-trips, bounds input, seeds a suggestion from the tracker, and — the
 * whole point — that the saved note flows into bundleProjectContext so it
 * reaches every AI request.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server; let baseUrl; let memPath;
let normalizeMemory; let bundleProjectContext;

before(async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'memory-'));
  mkdirSync(resolve(root, 'config'), { recursive: true });
  mkdirSync(resolve(root, 'data'), { recursive: true });
  writeFileSync(resolve(root, 'cv.md'), '# Jane Dev\nSenior Backend Engineer.\n');
  writeFileSync(resolve(root, 'config', 'profile.yml'), 'candidate:\n  full_name: Jane\n');
  writeFileSync(resolve(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(root, 'data', 'applications.md'), '# Applications\n| 1 | Acme | Backend | 4.2/5 | Applied |\n');
  for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY', 'OPENROUTER_API_KEY', 'GITHUB_MODELS_TOKEN', 'LLM_PROVIDER']) delete process.env[k];
  process.env.CAREER_OPS_ROOT = root;
  memPath = resolve(root, 'config', 'memory.md');
  ({ normalizeMemory } = await import('../server/lib/routes/memory.mjs'));
  ({ bundleProjectContext } = await import('../server/lib/prompts.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});
beforeEach(() => { if (existsSync(memPath)) rmSync(memPath); });
after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

const put = (b) => fetch(`${baseUrl}/api/memory`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

test('normalizeMemory bounds + types', () => {
  assert.equal(normalizeMemory({ markdown: 'x'.repeat(9000) }).length, 8 * 1024);
  assert.equal(normalizeMemory('plain string'), 'plain string');
  assert.equal(normalizeMemory({ markdown: 42 }), '');
  assert.equal(normalizeMemory(null), '');
});

test('GET returns empty before any save', async () => {
  const { markdown } = await (await fetch(`${baseUrl}/api/memory`)).json();
  assert.equal(markdown, '');
});

test('PUT then GET round-trips the note', async () => {
  const r = await put({ markdown: '- Prefer remote, Series A–B.\n- No on-call.' });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
  assert.ok(existsSync(memPath));
  const { markdown } = await (await fetch(`${baseUrl}/api/memory`)).json();
  assert.match(markdown, /Prefer remote/);
});

test('the saved memory is inlined into bundleProjectContext (reaches every AI request)', async () => {
  await put({ markdown: '- Always answer in a terse, senior tone.' });
  const ctx = bundleProjectContext({});
  assert.match(ctx, /config\/memory\.md/);
  assert.match(ctx, /terse, senior tone/);
  assert.match(ctx, /NOT new factual claims/); // the steering framing label
});

test('POST /suggest seeds a behavioural prompt from the tracker (no live call)', async () => {
  const r = await fetch(`${baseUrl}/api/memory/suggest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 200);
  const { prompt } = await r.json();
  assert.match(prompt, /BEHAVIOURAL and PREFERENCE patterns/);
  assert.match(prompt, /Do NOT invent/);
  assert.match(prompt, /Acme/);               // tracker mined in
  assert.match(prompt, /APPLICATION TRACKER/);
});

test('normalizeMemory routes the markdown through stripDangerousMarkdown (SRV-M4)', async () => {
  const { normalizeMemory } = await import('../server/lib/routes/memory.mjs');
  const out = normalizeMemory({ markdown: 'note<script>alert(1)</script> ok' });
  assert.ok(!/<script/i.test(out), out);
  assert.match(out, /note/);
  assert.match(out, /ok/);
});
