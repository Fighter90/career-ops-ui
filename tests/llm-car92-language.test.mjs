/**
 * CAR-92 — findings 1 & 4: the language directive was missing at the top AND
 * bottom of /api/deep and /api/mode/:slug (the buildLocaleDirective output
 * landed after ~150 KB of English context, and no buildLanguageReminder
 * closed the prompt), and /api/mode dropped truncation + context warnings.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT (cv.md, portals.yml, modes), provider
 * HTTP mocked at the host boundary (no network), server bound to 127.0.0.1.
 */
import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const KEYS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'LLM_PROVIDER'];
const ANT = 'sk-ant-fake0123456789abcdefghijklmnop';
const OAI = 'sk-fakeopenai0123456789abcdefghijklmn';
const DIRECTIVE = '# Output language';
const REMINDER_TAIL = 'Once more, briefly: the whole report below is written in';
const reminderEnds = (langName) => `${REMINDER_TAIL} ${langName}, tables included.`;

let server; let baseUrl; let ROOT;
const realFetch = globalThis.fetch;
const saved = {};

let buildDeepPrompt, buildModePrompt;

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'llm-car92-lang-'));
  for (const d of ['config', 'data', 'modes', 'output', 'reports', 'interview-prep']) mkdirSync(resolve(ROOT, d), { recursive: true });
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\nSenior backend engineer.\n');
  writeFileSync(resolve(ROOT, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(ROOT, 'data', 'applications.md'), '');
  for (const m of ['_shared', 'oferta', 'deep', 'cover']) writeFileSync(resolve(ROOT, 'modes', `${m}.md`), `# ${m}\nMode body.\n`);
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  process.env.CAREER_OPS_ROOT = ROOT;
  ({ buildDeepPrompt, buildModePrompt } = await import('../server/lib/prompts.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(async () => {
  globalThis.fetch = realFetch;
  for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  delete process.env.CAREER_OPS_ROOT;
  await new Promise((r) => server.close(r));
  try { rmSync(ROOT, { recursive: true, force: true }); } catch { /* temp dir */ }
});

beforeEach(() => { for (const k of KEYS) delete process.env[k]; globalThis.fetch = realFetch; });
afterEach(() => { globalThis.fetch = realFetch; });

const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
const anthropicReply = (text) => () => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 11, output_tokens: 7 } });
const openaiReply = (text, finish = 'stop') => () => ({ choices: [{ message: { content: text }, finish_reason: finish }], usage: { prompt_tokens: 5, completion_tokens: 3 } });

/** Mock a provider host; capture the exact prompt string the server sent. */
function captureProvider(host, reply) {
  const seen = [];
  globalThis.fetch = async (u, o = {}) => {
    if (String(u).includes(host)) {
      seen.push(JSON.parse(o.body).messages ? JSON.parse(o.body).messages[0].content : JSON.parse(o.body).contents?.[0]?.parts?.[0]?.text ?? JSON.parse(o.body));
      return json(reply());
    }
    return realFetch(u, o);
  };
  return seen;
}

async function post(path, body, lang) {
  const r = await fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(lang ? { 'accept-language': lang } : {}) },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

// ── Finding 1 — the builders carry the directive at the top AND the reminder at the bottom ──

test('CAR-92.1: buildDeepPrompt(ru) starts with the directive and ends with the reminder; en does neither', () => {
  const ru = buildDeepPrompt('Acme', 'Engineer', 'ru', { headless: true });
  assert.ok(ru.startsWith(DIRECTIVE), 'must open with the locale directive block');
  assert.ok(ru.trimEnd().endsWith(`${reminderEnds('Russian')}`), `must close with the language reminder, got: …${ru.slice(-120)}`);
  const en = buildDeepPrompt('Acme', 'Engineer', 'en', { headless: true });
  assert.ok(!en.includes(DIRECTIVE), 'en prompt must not carry the directive');
  assert.ok(!en.includes(REMINDER_TAIL), 'en prompt must not carry the reminder');
});

test('CAR-92.1: buildModePrompt(ru) starts with the directive and ends with the reminder; en does neither', () => {
  const ru = buildModePrompt('# cover template\n', 'cover', { company: 'Acme' }, 'ru');
  assert.ok(ru.startsWith(DIRECTIVE));
  assert.ok(ru.trimEnd().endsWith(`${reminderEnds('Russian')}`));
  const en = buildModePrompt('# cover template\n', 'cover', { company: 'Acme' }, 'en');
  assert.ok(!en.includes(DIRECTIVE));
  assert.ok(!en.includes(REMINDER_TAIL));
});

test('CAR-92.1: /api/deep run (ru) sends the provider a prompt that OPENS with the directive and CLOSES with the reminder', async () => {
  process.env.ANTHROPIC_API_KEY = ANT;
  const prompts = captureProvider('api.anthropic.com', anthropicReply('# Acme brief\n'));
  const r = await post('/api/deep', { company: 'Acme', run: true }, 'ru');
  assert.equal(r.status, 200);
  assert.equal(r.body.mode, 'anthropic');
  assert.equal(prompts.length, 1);
  assert.ok(prompts[0].startsWith(DIRECTIVE), 'the bundled context must lead with the locale directive');
  assert.ok(prompts[0].trimEnd().endsWith(`${reminderEnds('Russian')}`), 'the reminder must be the prompt’s last line');
});

test('CAR-92.1: /api/deep run (en) is not polluted by directive or reminder', async () => {
  process.env.ANTHROPIC_API_KEY = ANT;
  const prompts = captureProvider('api.anthropic.com', anthropicReply('# brief\n'));
  const r = await post('/api/deep', { company: 'Acme', run: true }, 'en');
  assert.equal(r.status, 200);
  assert.ok(!prompts[0].includes(DIRECTIVE));
  assert.ok(!prompts[0].includes(REMINDER_TAIL));
});

test('CAR-92.1: /api/mode run (ru) reaches the provider with directive-first, reminder-last', async () => {
  process.env.ANTHROPIC_API_KEY = ANT;
  const prompts = captureProvider('api.anthropic.com', anthropicReply('# Письмо\n'));
  const r = await post('/api/mode/cover', { company: 'Acme', jd: 'We are hiring…', run: true }, 'ru');
  assert.equal(r.status, 200);
  assert.equal(r.body.mode, 'anthropic');
  assert.equal(prompts.length, 1);
  assert.ok(prompts[0].startsWith(DIRECTIVE));
  assert.ok(prompts[0].trimEnd().endsWith(`${reminderEnds('Russian')}`));
  // The route's own copy-paste prompt ends with the reminder too.
  assert.ok(r.body.prompt.trimEnd().endsWith(`${reminderEnds('Russian')}`));
});

test('CAR-92.1: /api/mode run (en) is not polluted', async () => {
  process.env.ANTHROPIC_API_KEY = ANT;
  const prompts = captureProvider('api.anthropic.com', anthropicReply('# Letter\n'));
  const r = await post('/api/mode/cover', { company: 'Acme', run: true }, 'en');
  assert.equal(r.status, 200);
  assert.ok(!prompts[0].includes(DIRECTIVE));
  assert.ok(!prompts[0].includes(REMINDER_TAIL));
});

// ── Finding 4 — truncation + context warnings surface on /api/mode ─────────

test('CAR-92.4: a cut-off answer on /api/mode surfaces the truncation warning', async () => {
  process.env.OPENAI_API_KEY = OAI;
  captureProvider('api.openai.com', openaiReply('# partial', 'length'));
  const r = await post('/api/mode/cover', { company: 'Acme', run: true }, 'en');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.warnings), 'response must carry a warnings array');
  assert.ok(r.body.warnings.some((w) => /cut off at the output-token limit/.test(w)), JSON.stringify(r.body.warnings));
});

test('CAR-92.4: a complete /api/mode answer carries no truncation warning', async () => {
  process.env.OPENAI_API_KEY = OAI;
  captureProvider('api.openai.com', openaiReply('# whole letter'));
  const r = await post('/api/mode/cover', { company: 'Acme', run: true }, 'en');
  assert.equal(r.status, 200);
  const trunc = (r.body.warnings || []).filter((w) => /cut off/.test(w));
  assert.deepEqual(trunc, []);
});
