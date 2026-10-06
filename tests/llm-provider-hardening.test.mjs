/**
 * v1.241.0 review hardening — the provider clients and the shared dispatch.
 *
 *   - Anthropic / OpenAI-compatible: an HTTP 200 with no text is an error, not
 *     an empty "success" that writes an empty report.
 *   - OpenAI: api.openai.com takes `max_completion_tokens` (gpt-5 / o-series
 *     reject `max_tokens`); the default model is a Chat Completions model.
 *   - Gemini: finishReason MAX_TOKENS marks the answer truncated.
 *   - llm-dispatch: `truncated` reaches the caller; run options pass through.
 *   - llm-usage: Gemini thinking tokens are billed output and are counted.
 *
 * CI-isolated: CAREER_OPS_ROOT → mkdtemp before import; provider HTTP is an
 * injected fetchImpl or a host-matched global fetch stub. No network.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let runAnthropic, runOpenAI, runOpenAICompatible, runQwen, runGemini;
let runActiveProvider, providerAvailable, normalizeUsage, recordUsage;
let ROOT;
const realFetch = globalThis.fetch;
const KEYS = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY',
  'OPENROUTER_API_KEY', 'GITHUB_MODELS_API_KEY', 'GITHUB_MODELS_TOKEN', 'LLM_PROVIDER', 'OPENAI_MODEL'];
const saved = {};

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'llm-prov-hard-'));
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  process.env.CAREER_OPS_ROOT = ROOT;
  ({ runAnthropic } = await import('../server/lib/anthropic.mjs'));
  ({ runOpenAI, runOpenAICompatible, runQwen } = await import('../server/lib/openai.mjs'));
  ({ runGemini } = await import('../server/lib/gemini.mjs'));
  ({ runActiveProvider, providerAvailable } = await import('../server/lib/llm-dispatch.mjs'));
  ({ normalizeUsage, recordUsage } = await import('../server/lib/llm-usage.mjs'));
});

after(() => {
  globalThis.fetch = realFetch;
  for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  delete process.env.CAREER_OPS_ROOT;
  try { rmSync(ROOT, { recursive: true, force: true }); } catch {}
});

beforeEach(() => {
  globalThis.fetch = realFetch;
  for (const k of KEYS) delete process.env[k];
});

const reply = (json, status = 200) => async () =>
  new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });

// ── empty 200 ───────────────────────────────────────────────────────────────

test('Anthropic: HTTP 200 with no text block is an error, not an empty success', async () => {
  const r = await runAnthropic('p', { apiKey: 'k', fetchImpl: reply({ content: [], stop_reason: 'end_turn', usage: { input_tokens: 3, output_tokens: 0 } }) });
  assert.equal(r.markdown, '');
  assert.match(r.error || '', /no text/i);
  assert.match(r.error, /end_turn/);
  const tools = await runAnthropic('p', { apiKey: 'k', fetchImpl: reply({ content: [{ type: 'tool_use', id: 'x' }] }) });
  assert.match(tools.error || '', /no text/i);
  // A real answer is still a success.
  const ok = await runAnthropic('p', { apiKey: 'k', fetchImpl: reply({ content: [{ type: 'text', text: 'hi' }], stop_reason: 'end_turn' }) });
  assert.equal(ok.error, null);
  assert.equal(ok.markdown, 'hi');
});

test('OpenAI-compatible: HTTP 200 with empty content is an error naming the finish reason', async () => {
  const base = { url: 'https://x.invalid/v1/chat/completions', apiKey: 'k', model: 'm', label: 'T' };
  const r = await runOpenAICompatible('p', { ...base, fetchImpl: reply({ choices: [{ message: { content: '' }, finish_reason: 'length' }] }) });
  assert.equal(r.markdown, '');
  assert.match(r.error || '', /T returned no text/);
  assert.match(r.error, /length/);
  assert.equal(r.truncated, true);
  const none = await runOpenAICompatible('p', { ...base, fetchImpl: reply({ choices: [] }) });
  assert.match(none.error || '', /no text/);
  const nullContent = await runOpenAICompatible('p', { ...base, fetchImpl: reply({ choices: [{ message: { content: null }, finish_reason: 'stop' }] }) });
  assert.match(nullContent.error || '', /no text \(stop\)/);
});

// ── OpenAI token parameter + default model ─────────────────────────────────

test('OpenAI (api.openai.com): sends max_completion_tokens, never max_tokens', async () => {
  let body; let url;
  const cap = async (u, o) => { url = String(u); body = JSON.parse(o.body); return reply({ choices: [{ message: { content: 'ok' } }] })(); };
  await runOpenAI('hi', { apiKey: 'sk', fetchImpl: cap, maxTokens: 1000 });
  assert.match(url, /^https:\/\/api\.openai\.com\//);
  assert.equal(body.max_completion_tokens, 1000);
  assert.equal('max_tokens' in body, false);
});

test('OpenAI-compatible third parties keep max_tokens (their documented parameter)', async () => {
  let body;
  const cap = async (_u, o) => { body = JSON.parse(o.body); return reply({ choices: [{ message: { content: 'ok' } }] })(); };
  await runQwen('hi', { apiKey: 'sk', fetchImpl: cap, maxTokens: 1000 });
  assert.equal(body.max_tokens, 1000);
  assert.equal('max_completion_tokens' in body, false);
});

test('OpenAI default model is a Chat Completions model, not the Responses-only gpt-5-codex', async () => {
  let body;
  const cap = async (_u, o) => { body = JSON.parse(o.body); return reply({ choices: [{ message: { content: 'ok' } }] })(); };
  await runOpenAI('hi', { apiKey: 'sk', fetchImpl: cap });
  assert.notEqual(body.model, 'gpt-5-codex');
  assert.match(body.model, /^gpt-/);
  // An explicit OPENAI_MODEL still wins.
  process.env.OPENAI_MODEL = 'gpt-4.1';
  await runOpenAI('hi', { apiKey: 'sk', fetchImpl: cap });
  assert.equal(body.model, 'gpt-4.1');
});

// ── Gemini truncation ───────────────────────────────────────────────────────

test('Gemini: finishReason MAX_TOKENS with text marks the answer truncated', async () => {
  const cut = await runGemini('p', { apiKey: 'k', fetchImpl: reply({ candidates: [{ content: { parts: [{ text: 'half' }] }, finishReason: 'MAX_TOKENS' }] }) });
  assert.equal(cut.error, null);
  assert.equal(cut.markdown, 'half');
  assert.equal(cut.truncated, true);
  const whole = await runGemini('p', { apiKey: 'k', fetchImpl: reply({ candidates: [{ content: { parts: [{ text: 'all' }] }, finishReason: 'STOP' }] }) });
  assert.equal(whole.truncated, false);
});

// ── llm-dispatch ────────────────────────────────────────────────────────────

function stubHost(host, json, capture = {}) {
  globalThis.fetch = async (u, o = {}) => {
    if (String(u).includes(host)) {
      capture.body = JSON.parse(o.body);
      return reply(json)();
    }
    return realFetch(u, o);
  };
  return capture;
}

test('runActiveProvider passes `truncated` through (Anthropic, Gemini, tail)', async () => {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-fake0123456789abcdefghijklmnop';
  stubHost('api.anthropic.com', { content: [{ type: 'text', text: 'cut' }], stop_reason: 'max_tokens', usage: { input_tokens: 1, output_tokens: 1 } });
  let r = await runActiveProvider('prompt');
  assert.equal(r.mode, 'anthropic');
  assert.equal(r.truncated, true);

  delete process.env.ANTHROPIC_API_KEY;
  process.env.GEMINI_API_KEY = 'AIzaFakeGeminiKey0123456789abcdefghij';
  stubHost('generativelanguage.googleapis.com', { candidates: [{ content: { parts: [{ text: 'cut' }] }, finishReason: 'MAX_TOKENS' }] });
  r = await runActiveProvider('prompt');
  assert.equal(r.mode, 'gemini');
  assert.equal(r.truncated, true);

  delete process.env.GEMINI_API_KEY;
  process.env.OPENAI_API_KEY = 'sk-fakeopenai0123456789abcdefghijklmn';
  stubHost('api.openai.com', { choices: [{ message: { content: 'cut' }, finish_reason: 'length' }] });
  r = await runActiveProvider('prompt');
  assert.equal(r.mode, 'openai');
  assert.equal(r.truncated, true);
  stubHost('api.openai.com', { choices: [{ message: { content: 'whole' }, finish_reason: 'stop' }] });
  r = await runActiveProvider('prompt');
  assert.equal(r.truncated, false);
});

test('runActiveProvider forwards maxTokens / timeoutMs to the provider', async () => {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-fake0123456789abcdefghijklmnop';
  const cap = stubHost('api.anthropic.com', { content: [{ type: 'text', text: 'ok' }] });
  await runActiveProvider('prompt', { maxTokens: 16384 });
  assert.equal(cap.body.max_tokens, 16384);
});

test('runActiveProvider: manual / too-large / provider error shapes', async () => {
  assert.deepEqual(await runActiveProvider(''), { mode: 'manual' });
  assert.deepEqual(await runActiveProvider('x'), { mode: 'manual' });
  assert.equal(providerAvailable(), false);
  const big = await runActiveProvider('x'.repeat(20), { sizeCap: 10 });
  assert.equal(big.mode, 'too-large');
  assert.equal(big.size, 20);
  process.env.OPENAI_API_KEY = 'sk-fakeopenai0123456789abcdefghijklmn';
  globalThis.fetch = async () => reply({ error: { message: 'boom' } }, 500)();
  const err = await runActiveProvider('x');
  assert.equal(err.mode, 'openai');
  assert.match(err.error, /boom/);
});

// ── llm-usage ───────────────────────────────────────────────────────────────

test('normalizeUsage counts Gemini thoughtsTokenCount as output', () => {
  assert.deepEqual(normalizeUsage({ promptTokenCount: 100, candidatesTokenCount: 50, thoughtsTokenCount: 700 }), { in: 100, out: 750 });
  // Only thoughts (no visible candidates) still counts.
  assert.deepEqual(normalizeUsage({ promptTokenCount: 10, thoughtsTokenCount: 5 }), { in: 10, out: 5 });
  // Anthropic / OpenAI shapes unchanged.
  assert.deepEqual(normalizeUsage({ input_tokens: 3, output_tokens: 4 }), { in: 3, out: 4 });
  assert.deepEqual(normalizeUsage({ prompt_tokens: 3, completion_tokens: 4 }), { in: 3, out: 4 });
  assert.deepEqual(normalizeUsage(null), { in: 0, out: 0 });
});

test('recordUsage writes a Gemini call with thinking tokens', () => {
  const file = resolve(ROOT, 'data', 'usage-test.jsonl');
  recordUsage('gemini', { promptTokenCount: 1, candidatesTokenCount: 2, thoughtsTokenCount: 3 }, 1000, file);
  assert.ok(existsSync(file));
  const row = JSON.parse(readFileSync(file, 'utf8').trim());
  assert.deepEqual([row.provider, row.in, row.out], ['gemini', 1, 5]);
});
