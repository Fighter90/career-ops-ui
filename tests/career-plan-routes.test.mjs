/**
 * Career-plan routes (v1.95.0, Epic 26). CI-isolated. Verifies bounding, the
 * GET/PUT round-trip into config/career-plan.md, and that the generate prompt is
 * seeded from the candidate's own CV/profile with a horizon (no fabrication).
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server; let baseUrl; let planPath;
let normalizePlan; let normalizeHorizon; let buildPlanPrompt;

before(async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'plan-'));
  mkdirSync(resolve(root, 'config'), { recursive: true });
  writeFileSync(resolve(root, 'cv.md'), '# Jane Dev\nSenior Backend Engineer, 8y Go.\n');
  writeFileSync(resolve(root, 'config', 'profile.yml'), 'summary:\n  target_roles:\n    - Staff Engineer\n');
  writeFileSync(resolve(root, 'portals.yml'), 'tracked_companies: []\n');
  for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY', 'OPENROUTER_API_KEY', 'GITHUB_MODELS_TOKEN', 'LLM_PROVIDER']) delete process.env[k];
  process.env.CAREER_OPS_ROOT = root;
  planPath = resolve(root, 'config', 'career-plan.md');
  ({ normalizePlan, normalizeHorizon, buildPlanPrompt } = await import('../server/lib/routes/career-plan.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});
beforeEach(() => { if (existsSync(planPath)) rmSync(planPath); });
after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

const put = (b) => fetch(`${baseUrl}/api/career-plan`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

test('normalizePlan / normalizeHorizon bound + type', () => {
  assert.equal(normalizePlan({ markdown: 'x'.repeat(200000) }).length, 128 * 1024);
  assert.equal(normalizePlan(42), '');
  assert.equal(normalizeHorizon('24'), '24');
  assert.equal(normalizeHorizon('99'), '12');
  assert.equal(normalizeHorizon(null), '12');
});

test('GET empty, then PUT/GET round-trips into config/career-plan.md', async () => {
  assert.equal((await (await fetch(`${baseUrl}/api/career-plan`)).json()).markdown, '');
  const r = await put({ markdown: '# My plan\n- ship v1' });
  assert.equal(r.status, 200);
  assert.ok(existsSync(planPath));
  assert.match((await (await fetch(`${baseUrl}/api/career-plan`)).json()).markdown, /My plan/);
});

test('buildPlanPrompt carries horizon, focus, and context', () => {
  const p = buildPlanPrompt('<project_context>CV…</project_context>', '24', 'move into management', 'en');
  assert.match(p, /PLANNING HORIZON: 24 months/);
  assert.match(p, /24-month roadmap/);
  assert.match(p, /move into management/);
  assert.match(p, /<project_context>/);
});

test('POST /generate returns a manual prompt seeded from CV/profile (no key)', async () => {
  const r = await fetch(`${baseUrl}/api/career-plan/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ horizon: '12' }) });
  assert.equal(r.status, 200);
  const { mode, prompt } = await r.json();
  assert.equal(mode, 'manual');
  assert.match(prompt, /Staff Engineer/);      // target role from profile
  assert.match(prompt, /senior career coach/);
  assert.match(prompt, /do NOT invent/i);
});

test('normalizePlan routes the markdown through stripDangerousMarkdown (SRV-M4)', async () => {
  const { normalizePlan } = await import('../server/lib/routes/career-plan.mjs');
  const out = normalizePlan({ markdown: 'plan<iframe src=x></iframe> body' });
  assert.ok(!/<iframe/i.test(out), out);
  assert.match(out, /plan/);
  assert.match(out, /body/);
});
