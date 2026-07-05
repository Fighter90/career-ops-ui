/**
 * CV Studio humanize route (v1.92.0, Epic 21). CI-isolated; no provider keys →
 * always the honest manual prompt. Verifies voice grounding + no-fabrication
 * guardrails are present in the prompt.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server; let baseUrl;
let buildHumanizePrompt; let readVoiceContext; let buildTailorPrompt;

before(async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'cvstudio-'));
  mkdirSync(resolve(root, 'writing-samples'), { recursive: true });
  writeFileSync(resolve(root, 'cv.md'), '# Jane Dev\nSenior Backend Engineer.\n');
  writeFileSync(resolve(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(root, 'voice-dna.md'), 'Direct, wry, short sentences. No filler.\n');
  writeFileSync(resolve(root, 'writing-samples', '01-blog.md'), 'I once shipped a migration on a Friday. It held.\n');
  for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY', 'OPENROUTER_API_KEY', 'GITHUB_MODELS_TOKEN', 'LLM_PROVIDER']) delete process.env[k];
  process.env.CAREER_OPS_ROOT = root;
  ({ buildHumanizePrompt, readVoiceContext, buildTailorPrompt } = await import('../server/lib/routes/cv-studio.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});
after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

const post = (p, b) => fetch(`${baseUrl}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

test('readVoiceContext inlines voice-dna + writing samples', () => {
  const ctx = readVoiceContext();
  assert.match(ctx, /voice-dna\.md/);
  assert.match(ctx, /wry/);
  assert.match(ctx, /writing-samples\/01-blog\.md/);
  assert.match(ctx, /Friday/);
});

test('buildHumanizePrompt carries the no-fabrication guardrails + the text', () => {
  const p = buildHumanizePrompt('VOICE', 'Responsible for leveraging synergies across teams.', 'en');
  assert.match(p, /Do NOT add any fact/);
  assert.match(p, /own voice/);
  assert.match(p, /VOICE/);
  assert.match(p, /leveraging synergies/);
});

test('POST /humanize with no key → honest manual prompt (voice grounded, no rewrite)', async () => {
  const r = await post('/api/cv-studio/humanize', { text: 'Responsible for the backend systems and various duties.' });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.mode, 'manual');
  assert.match(j.prompt, /voice-dna/);        // grounding present
  assert.match(j.prompt, /Do NOT add any fact/);
  assert.equal(j.markdown, undefined);        // nothing rewritten/fabricated
});

test('POST /humanize rejects too-short selections', async () => {
  const r = await post('/api/cv-studio/humanize', { text: 'too short' });
  assert.equal(r.status, 400);
});

// ── Tailor to a job (v1.101.0) ──

test('buildTailorPrompt is generic (checklist gate + no-fabrication, no hardcoded company/role)', () => {
  const p = buildTailorPrompt('CTX', 'We need a hands-on backend lead comfortable with Kafka.', 'Team Lead', 'en');
  assert.match(p, /checklist-gate/i);        // the gate mechanism is present
  assert.match(p, /GATE: PASS\|BLOCKED/);    // the gate verdict format
  assert.match(p, /BRIDGE/);                  // the requirement↔fact bridge technique
  assert.match(p, /never fabricate/i);        // source-of-truth guardrail
  assert.match(p, /Kafka/);                   // the JD is inlined
  assert.match(p, /Team Lead/);               // the optional headline hint is inlined
  assert.match(p, /<project_context>\nCTX/);  // the candidate materials are inlined
  // Generic: the distilled instructions must NOT hardcode a specific employer/track.
  assert.doesNotMatch(p, /МТС|WebGuru|Газпромбанк|Авито|Магнит|Мамба/);
});

test('POST /tailor with no key → honest manual prompt seeded from the candidate materials', async () => {
  const r = await post('/api/cv-studio/tailor', { jd: 'Senior Backend Engineer — Go, Postgres, event-driven systems, on a small team.' });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.mode, 'manual');
  assert.match(j.prompt, /Jane Dev|Senior Backend Engineer/); // cv.md inlined via bundleProjectContext
  assert.match(j.prompt, /checklist-gate/i);
  assert.equal(j.markdown, undefined);        // nothing generated/fabricated with no key
});

test('POST /tailor rejects a missing / too-short JD', async () => {
  const r = await post('/api/cv-studio/tailor', { jd: 'too short' });
  assert.equal(r.status, 400);
});
