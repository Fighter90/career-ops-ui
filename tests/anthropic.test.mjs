/**
 * server/lib/anthropic.mjs — direct fetch client for the Anthropic
 * Messages API. Covers the response-shape contract plus error paths,
 * with a fakeFetch so we never burn real API credits.
 *
 * v1.54.9 — key/model lookups now resolve through effectiveEnv()
 * (live process.env OR the parent `.env`). To keep these tests
 * deterministic and CI-isolated (CLAUDE.md hard rule #8), CAREER_OPS_
 * ROOT is pointed at a fresh temp dir BEFORE the module is imported,
 * so PATHS.envFile resolves into that controllable dir and the
 * parent-.env branch is exercised explicitly rather than depending on
 * whatever .env happens to exist on the host.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let runAnthropic, hasAnthropicKey, hasGeminiKey;
let ROOT, ENV_FILE;
const savedRoot = process.env.CAREER_OPS_ROOT;

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'anthropic-'));
  ENV_FILE = resolve(ROOT, '.env');
  // Recognisable career-ops layout so resolveProjectRoot() picks ROOT.
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  process.env.CAREER_OPS_ROOT = ROOT;
  ({ runAnthropic, hasAnthropicKey, hasGeminiKey } =
    await import('../server/lib/anthropic.mjs'));
});

after(() => {
  if (savedRoot === undefined) delete process.env.CAREER_OPS_ROOT;
  else process.env.CAREER_OPS_ROOT = savedRoot;
  try { rmSync(ROOT, { recursive: true, force: true }); } catch {}
});

// Keep the temp .env clean between key-resolution tests.
function clearParentEnv() { if (existsSync(ENV_FILE)) rmSync(ENV_FILE); }

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('runAnthropic: returns 400 when no API key anywhere (env nor .env)', async () => {
  const prev = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  clearParentEnv();
  try {
    const r = await runAnthropic('hello');
    assert.equal(r.markdown, '');
    assert.match(r.error, /ANTHROPIC_API_KEY/);
  } finally {
    if (prev) process.env.ANTHROPIC_API_KEY = prev;
  }
});

test('runAnthropic: concatenates text blocks from a successful response', async () => {
  const fakeFetch = async () =>
    jsonResponse(200, {
      content: [
        { type: 'text', text: '# Title\n' },
        { type: 'text', text: 'Body line.' },
        { type: 'tool_use', id: 't1', name: 'x', input: {} }, // ignored
      ],
      usage: { input_tokens: 10, output_tokens: 20 },
    });
  const r = await runAnthropic('say hi', { apiKey: 'sk-test', fetchImpl: fakeFetch });
  assert.equal(r.error, null);
  assert.equal(r.markdown, '# Title\n\nBody line.');
  assert.equal(r.usage.input_tokens, 10);
});

test('runAnthropic: 4xx → error, no markdown', async () => {
  const fakeFetch = async () =>
    jsonResponse(401, { error: { type: 'authentication_error', message: 'invalid x-api-key' } });
  const r = await runAnthropic('hi', { apiKey: 'sk-bad', fetchImpl: fakeFetch });
  assert.equal(r.markdown, '');
  assert.match(r.error, /authentication_error|invalid|HTTP 401/);
});

test('runAnthropic: 5xx → error', async () => {
  const fakeFetch = async () => jsonResponse(503, { error: { message: 'overloaded' } });
  const r = await runAnthropic('hi', { apiKey: 'sk-test', fetchImpl: fakeFetch });
  assert.equal(r.markdown, '');
  assert.match(r.error, /overloaded|HTTP 5/);
});

test('runAnthropic: clamps maxTokens into [256, 32768] (CAR-174 ceiling)', async () => {
  let body;
  const fakeFetch = async (_url, opts) => {
    body = JSON.parse(opts.body);
    return jsonResponse(200, { content: [{ type: 'text', text: 'ok' }] });
  };
  await runAnthropic('hi', { apiKey: 'sk', fetchImpl: fakeFetch, maxTokens: 10 });
  assert.equal(body.max_tokens, 256, 'lower clamp');
  await runAnthropic('hi', { apiKey: 'sk', fetchImpl: fakeFetch, maxTokens: 99999 });
  assert.equal(body.max_tokens, 32768, 'upper clamp');
});

test('runAnthropic: timeout returns "timeout" error', async () => {
  const fakeFetch = (_url, opts) => new Promise((_, rej) => {
    opts.signal.addEventListener('abort', () =>
      rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  const r = await runAnthropic('hi', { apiKey: 'sk', fetchImpl: fakeFetch, timeoutMs: 50 });
  assert.equal(r.markdown, '');
  assert.equal(r.error, 'timeout');
});

test('runAnthropic: malformed JSON body still produces a useful error', async () => {
  const fakeFetch = async () =>
    new Response('not json', { status: 500, headers: { 'content-type': 'text/plain' } });
  const r = await runAnthropic('hi', { apiKey: 'sk', fetchImpl: fakeFetch });
  assert.equal(r.markdown, '');
  assert.match(r.error, /HTTP 500/);
});

test('hasAnthropicKey: live process.env wins', () => {
  const prev = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  clearParentEnv();
  assert.equal(hasAnthropicKey(), false);
  process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-live-key-aaaaaaaaaaaaaaaaaaaa';
  assert.equal(hasAnthropicKey(), true);
  if (prev) process.env.ANTHROPIC_API_KEY = prev; else delete process.env.ANTHROPIC_API_KEY;
});

test('hasGeminiKey: live process.env wins (REVIEW-B2)', () => {
  const prev = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  clearParentEnv();
  assert.equal(hasGeminiKey(), false);
  process.env.GEMINI_API_KEY = 'AIzaSyLIVEgeminikeyvalue0123456789abcd';
  assert.equal(hasGeminiKey(), true);
  if (prev) process.env.GEMINI_API_KEY = prev; else delete process.env.GEMINI_API_KEY;
});

test('v1.54.9: a key only in the parent .env is detected (the reported bug)', () => {
  // Reproduces the exact failure: ANTHROPIC_API_KEY is in the parent
  // .env but NOT in the boot-time process.env. Pre-v1.54.9
  // hasAnthropicKey() was false → evaluation mis-routed to a stale
  // Gemini key. It must now be true (and Gemini, absent everywhere,
  // false) so routing prefers Anthropic.
  const pa = process.env.ANTHROPIC_API_KEY;
  const pg = process.env.GEMINI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  writeFileSync(ENV_FILE, 'ANTHROPIC_API_KEY=sk-ant-from-dotenv-key-aaaaaaaaaaaaaaaa\n');
  try {
    assert.equal(hasAnthropicKey(), true, 'parent .env key must be detected');
    assert.equal(hasGeminiKey(), false, 'Gemini set nowhere → false');
  } finally {
    if (pa) process.env.ANTHROPIC_API_KEY = pa;
    if (pg) process.env.GEMINI_API_KEY = pg;
    clearParentEnv();
  }
});

test('v1.54.9: runAnthropic uses the parent-.env key + model when env unset', async () => {
  const pa = process.env.ANTHROPIC_API_KEY;
  const pm = process.env.ANTHROPIC_MODEL;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_MODEL;
  writeFileSync(ENV_FILE,
    'ANTHROPIC_API_KEY=sk-dotenv-key\nANTHROPIC_MODEL=claude-opus-4-7\n');
  let sentKey, sentModel;
  const fakeFetch = async (_url, opts) => {
    sentKey = opts.headers['x-api-key'];
    sentModel = JSON.parse(opts.body).model;
    return jsonResponse(200, { content: [{ type: 'text', text: 'ok' }] });
  };
  try {
    const r = await runAnthropic('hi', { fetchImpl: fakeFetch });
    assert.equal(r.error, null);
    assert.equal(sentKey, 'sk-dotenv-key', 'must send the parent-.env key');
    assert.equal(sentModel, 'claude-opus-4-7', 'must use the parent-.env model');
  } finally {
    if (pa) process.env.ANTHROPIC_API_KEY = pa;
    if (pm) process.env.ANTHROPIC_MODEL = pm;
    clearParentEnv();
  }
});

test('runAnthropic: never logs the API key on stdout (REVIEW-B4)', async () => {
  const captured = [];
  const orig = {};
  for (const m of ['log', 'info', 'warn', 'error', 'debug']) {
    orig[m] = console[m];
    console[m] = (...args) => captured.push({ level: m, args });
  }
  try {
    const fakeFetch = async () =>
      jsonResponse(200, { content: [{ type: 'text', text: 'ok' }] });
    const r = await runAnthropic('hi', { apiKey: 'sk-secret-canary-12345', fetchImpl: fakeFetch });
    assert.equal(r.error, null);
    assert.equal(captured.length, 0,
      `console used during runAnthropic; output: ${JSON.stringify(captured)}`);
    const fakeFail = async () => jsonResponse(500, { error: { message: 'boom' } });
    captured.length = 0;
    await runAnthropic('hi', { apiKey: 'sk-secret-canary-12345', fetchImpl: fakeFail });
    assert.equal(captured.length, 0, 'console used during runAnthropic error path');
    assert.equal(JSON.stringify(captured).includes('sk-secret-canary'), false);
  } finally {
    for (const m of ['log', 'info', 'warn', 'error', 'debug']) console[m] = orig[m];
  }
});
