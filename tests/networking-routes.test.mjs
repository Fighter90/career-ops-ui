/**
 * Networking & deep company research routes (v1.91.0, Epic 16).
 *
 * CI-isolated: createApp() against a mktemp CAREER_OPS_ROOT; paths carriers
 * imported dynamically AFTER the env is set. No provider keys → /plan always
 * falls to the honest manual prompt.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server; let baseUrl; let netDir;
let buildNetworkingPrompt;

before(async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'net-'));
  mkdirSync(resolve(root, 'config'), { recursive: true });
  writeFileSync(resolve(root, 'cv.md'), '# Jane Dev\nSenior Backend Engineer, Go + PostgreSQL. Ex-Stripe.\n');
  writeFileSync(resolve(root, 'config', 'profile.yml'), 'candidate:\n  full_name: Jane\n');
  writeFileSync(resolve(root, 'portals.yml'), 'tracked_companies: []\n');
  for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY', 'OPENROUTER_API_KEY', 'GITHUB_MODELS_TOKEN', 'LLM_PROVIDER']) delete process.env[k];
  process.env.CAREER_OPS_ROOT = root;
  netDir = resolve(root, 'networking');
  ({ buildNetworkingPrompt } = await import('../server/lib/routes/networking.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});
beforeEach(() => { if (existsSync(netDir)) for (const f of readdirSync(netDir)) rmSync(resolve(netDir, f)); });
after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

const post = (p, b) => fetch(`${baseUrl}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

test('buildNetworkingPrompt covers dossier / who-to-contact / intro / drafts and grounds in materials', () => {
  const p = buildNetworkingPrompt('CTX-INLINE', { company: 'Acme', role: 'Backend Engineer' });
  assert.match(p, /### Company dossier/);
  assert.match(p, /### Who to contact/);
  assert.match(p, /### Warmest intro path/);
  assert.match(p, /### Outreach drafts/);
  assert.match(p, /Acme/);
  assert.match(p, /Backend Engineer/);
  assert.match(p, /never invent connections/);
  assert.match(p, /CTX-INLINE/);
});

test('POST /plan with no key returns an honest manual prompt (cv inlined, no answer)', async () => {
  const r = await post('/api/networking/plan', { company: 'Acme', role: 'Backend Engineer' });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.mode, 'manual');
  assert.match(j.prompt, /networking plan/);
  assert.match(j.prompt, /Jane Dev/);       // cv inlined
  assert.equal(j.markdown, undefined);      // nothing fabricated
});

test('POST /plan requires a company', async () => {
  const r = await post('/api/networking/plan', { role: 'Backend Engineer' });
  assert.equal(r.status, 400);
});

test('save → list → fetch → delete round-trips a plan', async () => {
  const save = await post('/api/networking/save', { company: 'Acme', role: 'Backend Engineer', plan: '### Company dossier\n- does X' });
  assert.equal(save.status, 200);
  const { name } = await save.json();
  assert.match(name, /^net-acme-backend-engineer-\d{4}-\d{2}-\d{2}\.md$/);
  assert.ok(existsSync(resolve(netDir, name)));

  const list = await (await fetch(`${baseUrl}/api/networking/plans`)).json();
  assert.ok(list.plans.some((s) => s.name === name));

  const one = await (await fetch(`${baseUrl}/api/networking/plans/${name}`)).json();
  assert.match(one.markdown, /Company dossier/);

  const del = await fetch(`${baseUrl}/api/networking/plans/${name}`, { method: 'DELETE' });
  assert.equal(del.status, 200);
  assert.ok(!existsSync(resolve(netDir, name)));
});

test('plan name is path-traversal safe', async () => {
  const r = await fetch(`${baseUrl}/api/networking/plans/${encodeURIComponent('../../etc/passwd')}`);
  assert.equal(r.status, 400);
});

test('save requires company + plan', async () => {
  assert.equal((await post('/api/networking/save', { plan: 'x' })).status, 400);
  assert.equal((await post('/api/networking/save', { company: 'Acme', plan: '  ' })).status, 400);
});
