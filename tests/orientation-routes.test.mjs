/**
 * Career-orientation route (v1.96.0, Epic 27). CI-isolated. Verifies the prompt
 * is built from the candidate's own CV/profile, is framed as a reflection (not a
 * psychometric test / no fabricated scores), and the no-key path returns a
 * copy-paste prompt rather than a fabricated profile. No file writes.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server; let baseUrl; let buildOrientationPrompt;

before(async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'orient-'));
  mkdirSync(resolve(root, 'config'), { recursive: true });
  writeFileSync(resolve(root, 'cv.md'), '# Jane Dev\nSenior Backend Engineer; led a small team.\n');
  writeFileSync(resolve(root, 'config', 'profile.yml'), 'summary:\n  target_roles:\n    - Engineering Manager\n');
  writeFileSync(resolve(root, 'portals.yml'), 'tracked_companies: []\n');
  for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY', 'OPENROUTER_API_KEY', 'GITHUB_MODELS_TOKEN', 'LLM_PROVIDER']) delete process.env[k];
  process.env.CAREER_OPS_ROOT = root;
  ({ buildOrientationPrompt } = await import('../server/lib/routes/orientation.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});
after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

test('buildOrientationPrompt frames a reflection (not a test) and inlines context', () => {
  const p = buildOrientationPrompt('<project_context>CV…</project_context>', 'en');
  assert.match(p, /NOT a psychometric test/i);
  assert.match(p, /Best-fit career vectors/);
  assert.match(p, /fabricate measured scores/i);
  assert.match(p, /<project_context>/);
});

test('buildOrientationPrompt constrains the vectors — no "Unknown" archetype (v1.142.0)', () => {
  const p = buildOrientationPrompt('<project_context>CV…</project_context>', 'en');
  // the eight named vectors must be present…
  for (const v of ['Functionalist', 'Administrator', 'Communicator', 'Specialist', 'Analyst', 'Innovator', 'Manager', 'Entrepreneur']) {
    assert.match(p, new RegExp(v), `orientation prompt must name the ${v} vector`);
  }
  // …and the model must be told to never answer "Unknown"/"N/A" or decline.
  assert.match(p, /NEVER answer/i);
  assert.match(p, /"Unknown"/);
  assert.match(p, /do not decline to choose/i);
});

test('POST /api/orientation/generate returns a manual prompt seeded from CV/profile (no key)', async () => {
  const r = await fetch(`${baseUrl}/api/orientation/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 200);
  const { mode, prompt } = await r.json();
  assert.equal(mode, 'manual');
  assert.match(prompt, /Engineering Manager/);   // target role from profile
  assert.match(prompt, /career-orientation analyst/);
});
