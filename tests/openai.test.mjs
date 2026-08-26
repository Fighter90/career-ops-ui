/**
 * v1.55.0 — server/lib/openai.mjs: zero-dep OpenAI-compatible Chat
 * Completions client backing the two new headless live-eval
 * providers the user asked to run "via OR": OpenAI and Qwen
 * (DashScope OpenAI-compatible mode). Same secure pattern as
 * anthropic.mjs — direct fetch, AbortController timeout, key never
 * logged, effectiveEnv() key resolution (process.env ∨ parent .env).
 *
 * CI-isolated: CAREER_OPS_ROOT → temp dir BEFORE import so
 * PATHS.envFile is controllable (CLAUDE.md hard rule #8). fakeFetch
 * everywhere — never burns real API credits.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let runOpenAI, runQwen, hasOpenAIKey, hasQwenKey, runOpenAICompatible;
let runOpenRouter, hasOpenRouterKey, fetchOpenRouterModels, OPENROUTER_FALLBACK_MODELS;
// v1.216.0 — extended OpenAI-compatible roster.
let compatChatUrl, runDeepSeek, runZai, runKimi, runGrok, runTogether, runOllama, hasOllamaKey, hasGrokKey;
let runArk, runArkCn, hasArkKey, hasArkCnKey;
let ROOT, ENV_FILE;
const savedRoot = process.env.CAREER_OPS_ROOT;

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'openai-'));
  ENV_FILE = resolve(ROOT, '.env');
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  process.env.CAREER_OPS_ROOT = ROOT;
  ({ runOpenAI, runQwen, hasOpenAIKey, hasQwenKey, runOpenAICompatible,
     runOpenRouter, hasOpenRouterKey, fetchOpenRouterModels,
     OPENROUTER_FALLBACK_MODELS,
     compatChatUrl, runDeepSeek, runZai, runKimi, runGrok, runTogether, runOllama,
     hasOllamaKey, hasGrokKey,
     runArk, runArkCn, hasArkKey, hasArkCnKey } =
    await import('../server/lib/openai.mjs'));
});

after(() => {
  if (savedRoot === undefined) delete process.env.CAREER_OPS_ROOT;
  else process.env.CAREER_OPS_ROOT = savedRoot;
  try { rmSync(ROOT, { recursive: true, force: true }); } catch {}
});

function clearParentEnv() { if (existsSync(ENV_FILE)) rmSync(ENV_FILE); }
function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  });
}
const okChat = (txt) => jsonResponse(200, {
  choices: [{ message: { role: 'assistant', content: txt } }],
  usage: { prompt_tokens: 10, completion_tokens: 20 },
});

test('runOpenAICompatible: no key → error, no markdown', async () => {
  const r = await runOpenAICompatible('hi', { url: 'x', apiKey: '', model: 'm', label: 'OpenAI' });
  assert.equal(r.markdown, '');
  assert.match(r.error, /OpenAI key not set/);
});

test('runOpenAI: concatenates string content + sends Bearer auth', async () => {
  let sentAuth, sentModel, sentUrl;
  const fakeFetch = async (url, opts) => {
    sentUrl = url; sentAuth = opts.headers.Authorization;
    sentModel = JSON.parse(opts.body).model;
    return okChat('# Title\nBody.');
  };
  const r = await runOpenAI('say hi', { apiKey: 'sk-test', model: 'gpt-5', fetchImpl: fakeFetch });
  assert.equal(r.error, null);
  assert.equal(r.markdown, '# Title\nBody.');
  assert.equal(r.usage.completion_tokens, 20);
  assert.equal(sentAuth, 'Bearer sk-test');
  assert.equal(sentModel, 'gpt-5');
  assert.equal(sentUrl, 'https://api.openai.com/v1/chat/completions');
});

test('runOpenAI: handles block-array message content', async () => {
  const fakeFetch = async () => jsonResponse(200, {
    choices: [{ message: { content: [
      { type: 'text', text: 'part 1' }, { type: 'text', text: 'part 2' },
    ] } }],
  });
  const r = await runOpenAI('hi', { apiKey: 'sk', fetchImpl: fakeFetch });
  assert.equal(r.markdown, 'part 1\npart 2');
});

test('runQwen: defaults to the DashScope intl OpenAI-compatible endpoint', async () => {
  let sentUrl, sentModel;
  const fakeFetch = async (url, opts) => {
    sentUrl = url; sentModel = JSON.parse(opts.body).model;
    return okChat('ok');
  };
  const r = await runQwen('hi', { apiKey: 'sk-qwen', fetchImpl: fakeFetch });
  assert.equal(r.error, null);
  assert.equal(sentUrl,
    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions');
  assert.equal(sentModel, 'qwen-max', 'default QWEN_MODEL');
});

test('runQwen: QWEN_BASE_URL (parent .env) overrides the endpoint', async () => {
  writeFileSync(ENV_FILE,
    'QWEN_API_KEY=sk-dotenv\nQWEN_MODEL=qwen-plus\nQWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions\n');
  const pa = process.env.QWEN_API_KEY; delete process.env.QWEN_API_KEY;
  let sentUrl, sentModel, sentAuth;
  const fakeFetch = async (url, opts) => {
    sentUrl = url; sentModel = JSON.parse(opts.body).model;
    sentAuth = opts.headers.Authorization;
    return okChat('ok');
  };
  try {
    const r = await runQwen('hi', { fetchImpl: fakeFetch });
    assert.equal(r.error, null);
    assert.equal(sentUrl, 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
    assert.equal(sentModel, 'qwen-plus', 'model from parent .env');
    assert.equal(sentAuth, 'Bearer sk-dotenv', 'key from parent .env');
  } finally {
    if (pa) process.env.QWEN_API_KEY = pa;
    clearParentEnv();
  }
});

// ── v1.57.0 — OpenRouter (OpenAI-compatible aggregator) ──

test('runOpenRouter: posts to the OpenRouter endpoint with Bearer auth + attribution headers', async () => {
  let sentUrl, sentModel, sentAuth, sentHdrs;
  const fakeFetch = async (url, opts) => {
    sentUrl = url;
    sentModel = JSON.parse(opts.body).model;
    sentAuth = opts.headers.Authorization;
    sentHdrs = opts.headers;
    return okChat('routed ok');
  };
  const r = await runOpenRouter('hi', {
    apiKey: 'sk-or-v1-test', model: 'anthropic/claude-sonnet-4', fetchImpl: fakeFetch,
  });
  assert.equal(r.error, null);
  assert.equal(r.markdown, 'routed ok');
  assert.equal(sentUrl, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(sentModel, 'anthropic/claude-sonnet-4');
  assert.equal(sentAuth, 'Bearer sk-or-v1-test');
  // OpenRouter recommends HTTP-Referer + X-Title for app attribution.
  assert.ok(sentHdrs['HTTP-Referer'], 'sends HTTP-Referer');
  assert.ok(sentHdrs['X-Title'], 'sends X-Title');
});

test('runOpenRouter: defaults model from OPENROUTER_MODEL (parent .env)', async () => {
  writeFileSync(ENV_FILE,
    'OPENROUTER_API_KEY=sk-or-v1-dotenv-aaaaaaaaaaaaaaaaaaaa\nOPENROUTER_MODEL=openai/gpt-5\n');
  const prev = process.env.OPENROUTER_API_KEY; delete process.env.OPENROUTER_API_KEY;
  let sentModel, sentAuth;
  const fakeFetch = async (_u, opts) => {
    sentModel = JSON.parse(opts.body).model;
    sentAuth = opts.headers.Authorization;
    return okChat('ok');
  };
  try {
    const r = await runOpenRouter('hi', { fetchImpl: fakeFetch });
    assert.equal(r.error, null);
    assert.equal(sentModel, 'openai/gpt-5', 'model from parent .env');
    assert.equal(sentAuth, 'Bearer sk-or-v1-dotenv-aaaaaaaaaaaaaaaaaaaa', 'key from parent .env');
  } finally {
    if (prev) process.env.OPENROUTER_API_KEY = prev;
    clearParentEnv();
  }
});

test('runOpenRouter: no key → clean error, no markdown', async () => {
  const prev = process.env.OPENROUTER_API_KEY; delete process.env.OPENROUTER_API_KEY;
  clearParentEnv();
  try {
    const r = await runOpenRouter('hi', { fetchImpl: async () => okChat('nope') });
    assert.equal(r.markdown, '');
    assert.match(r.error, /OpenRouter key not set/);
  } finally {
    if (prev) process.env.OPENROUTER_API_KEY = prev;
  }
});

test('hasOpenRouterKey: process.env wins, else parent .env (v1.54.9 contract)', () => {
  const prev = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  clearParentEnv();
  assert.equal(hasOpenRouterKey(), false);
  writeFileSync(ENV_FILE, 'OPENROUTER_API_KEY=sk-or-v1-dotenv-aaaaaaaaaaaaaaaaaaaa\n');
  assert.equal(hasOpenRouterKey(), true, 'OpenRouter key from parent .env');
  // placeholder is rejected by the shared isUsableKey() floor (v1.56.3)
  writeFileSync(ENV_FILE, 'OPENROUTER_API_KEY=your_key_here\n');
  assert.equal(hasOpenRouterKey(), false, 'placeholder rejected');
  clearParentEnv();
  if (prev) process.env.OPENROUTER_API_KEY = prev;
});

// ── v1.57.0 — OpenRouter dynamic model catalogue ──

test('fetchOpenRouterModels: parses the /models payload into sorted id list', async () => {
  let hitUrl;
  const fakeFetch = async (url) => {
    hitUrl = url;
    return jsonResponse(200, { data: [
      { id: 'openai/gpt-5', name: 'GPT-5', context_length: 400000 },
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', context_length: 1000000 },
      { id: 'meta-llama/llama-3.3-70b', name: 'Llama 3.3 70B' },
      { id: '', name: 'junk-no-id' },
    ] });
  };
  const out = await fetchOpenRouterModels({ fetchImpl: fakeFetch });
  assert.equal(hitUrl, 'https://openrouter.ai/api/v1/models');
  assert.ok(Array.isArray(out.models));
  // empty id dropped, sorted alphabetically
  assert.deepEqual(out.models.map((m) => m.id),
    ['anthropic/claude-sonnet-4', 'meta-llama/llama-3.3-70b', 'openai/gpt-5']);
  assert.equal(out.models[0].name, 'Claude Sonnet 4');
  assert.equal(out.fallback, false);
});

test('fetchOpenRouterModels: network failure → curated fallback list (never throws)', async () => {
  const boom = async () => { throw new Error('ECONNREFUSED'); };
  const out = await fetchOpenRouterModels({ fetchImpl: boom });
  assert.equal(out.fallback, true);
  assert.ok(out.models.length > 0, 'serves a non-empty curated fallback');
  assert.ok(out.models.every((m) => typeof m.id === 'string' && m.id.includes('/')),
    'fallback ids are namespaced vendor/model');
});

test('fetchOpenRouterModels: HTTP 500 → fallback, not a throw', async () => {
  const out = await fetchOpenRouterModels({
    fetchImpl: async () => jsonResponse(500, { error: 'server' }),
  });
  assert.equal(out.fallback, true);
  assert.ok(out.models.length > 0);
});

test('OPENROUTER_FALLBACK_MODELS is a non-empty namespaced list', () => {
  assert.ok(Array.isArray(OPENROUTER_FALLBACK_MODELS));
  assert.ok(OPENROUTER_FALLBACK_MODELS.length >= 4);
  assert.ok(OPENROUTER_FALLBACK_MODELS.every((id) => id.includes('/')));
});

test('fetchOpenRouterModels: name falls back to id; context_length only kept when finite', async () => {
  const fakeFetch = async () => jsonResponse(200, { data: [
    { id: 'x/no-name' },                                  // name missing → id
    { id: 'y/blank-name', name: '   ' },                  // blank name → id
    { id: 'z/has-name', name: 'Zed', context_length: 8192 },
    { id: 'w/bad-ctx', name: 'Dub', context_length: 'lots' }, // non-finite → null
  ] });
  const { models } = await fetchOpenRouterModels({ fetchImpl: fakeFetch });
  const by = Object.fromEntries(models.map((m) => [m.id, m]));
  assert.equal(by['x/no-name'].name, 'x/no-name');
  assert.equal(by['y/blank-name'].name, 'y/blank-name');
  assert.equal(by['z/has-name'].name, 'Zed');
  assert.equal(by['z/has-name'].context_length, 8192);
  assert.equal(by['w/bad-ctx'].context_length, null);
});

test('fetchOpenRouterModels: payload present but every id empty → fallback', async () => {
  const out = await fetchOpenRouterModels({
    fetchImpl: async () => jsonResponse(200, { data: [{ id: '' }, { id: '   ' }, { name: 'no id' }] }),
  });
  assert.equal(out.fallback, true);
  assert.ok(out.models.length > 0);
});

test('fetchOpenRouterModels: non-array / missing data field → fallback', async () => {
  const out = await fetchOpenRouterModels({
    fetchImpl: async () => jsonResponse(200, { notData: 1 }),
  });
  assert.equal(out.fallback, true);
});

test('fetchOpenRouterModels: aborts on timeout → fallback (never hangs the dropdown)', async () => {
  const hang = (_u, o) => new Promise((_, rej) =>
    o.signal.addEventListener('abort', () =>
      rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  const out = await fetchOpenRouterModels({ fetchImpl: hang, timeoutMs: 30 });
  assert.equal(out.fallback, true);
  assert.ok(out.models.length > 0);
});

test('runOpenRouter: caller extraHeaders are merged on top of the attribution headers', async () => {
  let hdrs;
  const fakeFetch = async (_u, o) => { hdrs = o.headers; return okChat('ok'); };
  const r = await runOpenRouter('hi', {
    apiKey: 'sk-or-v1-x', fetchImpl: fakeFetch,
    extraHeaders: { 'X-Title': 'custom-title', 'X-Extra': '1' },
  });
  assert.equal(r.error, null);
  assert.equal(hdrs['HTTP-Referer'], 'https://career-ops.org', 'default referer kept');
  assert.equal(hdrs['X-Title'], 'custom-title', 'caller overrides X-Title');
  assert.equal(hdrs['X-Extra'], '1', 'caller can add headers');
  assert.equal(hdrs.Authorization, 'Bearer sk-or-v1-x', 'auth still wins regardless of order');
});

test('4xx / 5xx / malformed → error, no markdown', async () => {
  let r = await runOpenAI('hi', { apiKey: 'sk-bad', fetchImpl: async () =>
    jsonResponse(401, { error: { message: 'invalid api key' } }) });
  assert.equal(r.markdown, '');
  assert.match(r.error, /OpenAI API: invalid api key|HTTP 401/);
  r = await runQwen('hi', { apiKey: 'sk', fetchImpl: async () =>
    jsonResponse(503, { error: { message: 'overloaded' } }) });
  assert.match(r.error, /Qwen API: overloaded|HTTP 5/);
  r = await runOpenAI('hi', { apiKey: 'sk', fetchImpl: async () =>
    new Response('not json', { status: 500, headers: { 'content-type': 'text/plain' } }) });
  assert.match(r.error, /HTTP 500/);
});

test('clamps max_tokens into [256, 16384]; timeout → "timeout"', async () => {
  let body;
  const cap = async (_u, o) => { body = JSON.parse(o.body); return okChat('ok'); };
  await runOpenAI('hi', { apiKey: 'sk', fetchImpl: cap, maxTokens: 1 });
  assert.equal(body.max_tokens, 256);
  await runOpenAI('hi', { apiKey: 'sk', fetchImpl: cap, maxTokens: 1e6 });
  assert.equal(body.max_tokens, 16384);
  const hang = (_u, o) => new Promise((_, rej) =>
    o.signal.addEventListener('abort', () =>
      rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  const r = await runQwen('hi', { apiKey: 'sk', fetchImpl: hang, timeoutMs: 40 });
  assert.equal(r.error, 'timeout');
});

test('has{OpenAI,Qwen}Key: process.env wins, else parent .env (v1.54.9 contract)', () => {
  const po = process.env.OPENAI_API_KEY, pq = process.env.QWEN_API_KEY;
  delete process.env.OPENAI_API_KEY; delete process.env.QWEN_API_KEY;
  clearParentEnv();
  assert.equal(hasOpenAIKey(), false);
  assert.equal(hasQwenKey(), false);
  writeFileSync(ENV_FILE, 'OPENAI_API_KEY=sk-proj-dotenv-openai-aaaaaaaaaaaaaaaa\nQWEN_API_KEY=sk-dashscope-qwen-aaaaaaaaaaaaaaaa\n');
  assert.equal(hasOpenAIKey(), true, 'OpenAI key from parent .env');
  assert.equal(hasQwenKey(), true, 'Qwen key from parent .env');
  process.env.OPENAI_API_KEY = 'sk-proj-procenv-openai-bbbbbbbbbbbbbbbb';
  assert.equal(hasOpenAIKey(), true); // process.env wins (still true)
  if (po) process.env.OPENAI_API_KEY = po; else delete process.env.OPENAI_API_KEY;
  if (pq) process.env.QWEN_API_KEY = pq; else delete process.env.QWEN_API_KEY;
  clearParentEnv();
});

test('never logs the API key (canary)', async () => {
  const captured = [];
  const orig = {};
  for (const m of ['log', 'info', 'warn', 'error', 'debug']) {
    orig[m] = console[m]; console[m] = (...a) => captured.push(a);
  }
  try {
    await runOpenAI('hi', { apiKey: 'sk-secret-canary-999', fetchImpl: async () => okChat('ok') });
    await runQwen('hi', { apiKey: 'sk-secret-canary-999', fetchImpl: async () =>
      jsonResponse(500, { error: { message: 'boom' } }) });
    assert.equal(captured.length, 0, `console used: ${JSON.stringify(captured)}`);
    assert.equal(JSON.stringify(captured).includes('sk-secret-canary'), false);
  } finally {
    for (const m of ['log', 'info', 'warn', 'error', 'debug']) console[m] = orig[m];
  }
});

// ─── v1.216.0 — extended OpenAI-compatible roster ──────────────────────────

test('compatChatUrl: normalizes bare host, trailing slash, full path, and non-http fallback', () => {
  const FB = 'https://api.z.ai/api/paas/v4';
  // bare host → append /v1/chat/completions
  assert.equal(compatChatUrl('https://api.moonshot.cn', FB), 'https://api.moonshot.cn/v1/chat/completions');
  // a base path (not a bare host) → append /chat/completions
  assert.equal(compatChatUrl('https://api.z.ai/api/paas/v4', FB), 'https://api.z.ai/api/paas/v4/chat/completions');
  // trailing slashes are stripped before appending
  assert.equal(compatChatUrl('https://api.z.ai/api/paas/v4///', FB), 'https://api.z.ai/api/paas/v4/chat/completions');
  // an already-complete endpoint is returned as-is
  assert.equal(compatChatUrl('https://x.example/v1/chat/completions', FB), 'https://x.example/v1/chat/completions');
  // non-http (or empty) input falls back to the provided default (SSRF scheme guard)
  assert.equal(compatChatUrl('file:///etc/passwd', FB), 'https://api.z.ai/api/paas/v4/chat/completions');
  assert.equal(compatChatUrl('', FB), 'https://api.z.ai/api/paas/v4/chat/completions');
  // loopback http is allowed (Ollama)
  assert.equal(compatChatUrl('http://localhost:11434/v1', 'http://localhost:11434/v1'),
    'http://localhost:11434/v1/chat/completions');
});

test('runDeepSeek: default endpoint + Bearer + model, returns markdown', async () => {
  let sentUrl, sentAuth, sentModel;
  const fakeFetch = async (url, opts) => {
    sentUrl = url; sentAuth = opts.headers.Authorization; sentModel = JSON.parse(opts.body).model;
    return okChat('# DS\nok.');
  };
  const r = await runDeepSeek('hi', { apiKey: 'sk-deepseek-canary-0001', fetchImpl: fakeFetch });
  assert.equal(r.error, null);
  assert.equal(r.markdown, '# DS\nok.');
  assert.equal(sentUrl, 'https://api.deepseek.com/v1/chat/completions');
  assert.equal(sentAuth, 'Bearer sk-deepseek-canary-0001');
  assert.equal(sentModel, 'deepseek-chat');
});

test('runGrok: default xAI endpoint + grok-4 default model', async () => {
  let sentUrl, sentModel;
  const fakeFetch = async (url, opts) => { sentUrl = url; sentModel = JSON.parse(opts.body).model; return okChat('ok'); };
  const r = await runGrok('hi', { apiKey: 'xai-secret-canary-00001', fetchImpl: fakeFetch });
  assert.equal(r.error, null);
  assert.equal(sentUrl, 'https://api.x.ai/v1/chat/completions');
  assert.equal(sentModel, 'grok-4');
});

test('runTogether: default endpoint + can select the Together-hosted Inkling model', async () => {
  let sentModel;
  const fakeFetch = async (_url, opts) => { sentModel = JSON.parse(opts.body).model; return okChat('ok'); };
  await runTogether('hi', { apiKey: 'together-canary-000001', model: 'thinkingmachines/Inkling', fetchImpl: fakeFetch });
  assert.equal(sentModel, 'thinkingmachines/Inkling');
});

test('runZai: honors ZAI_BASE_URL override (CN endpoint)', async () => {
  clearParentEnv();
  let sentUrl;
  const fakeFetch = async (url) => { sentUrl = url; return okChat('ok'); };
  await runZai('hi', {
    apiKey: 'zai-secret-canary-00001',
    url: compatChatUrl('https://open.bigmodel.cn/api/paas/v4', 'https://api.z.ai/api/paas/v4'),
    fetchImpl: fakeFetch,
  });
  assert.equal(sentUrl, 'https://open.bigmodel.cn/api/paas/v4/chat/completions');
});

test('runOllama: local, keyless — sends a placeholder Bearer to its base URL', async () => {
  let sentUrl, sentAuth;
  const fakeFetch = async (url, opts) => { sentUrl = url; sentAuth = opts.headers.Authorization; return okChat('ok'); };
  const r = await runOllama('hi', { url: 'http://localhost:11434/v1/chat/completions', fetchImpl: fakeFetch });
  assert.equal(r.error, null);
  assert.equal(sentUrl, 'http://localhost:11434/v1/chat/completions');
  assert.equal(sentAuth, 'Bearer ollama'); // placeholder — Ollama ignores auth
});

test('hasGrokKey / hasOllamaKey: gate on their own env (XAI_API_KEY / OLLAMA_BASE_URL)', () => {
  clearParentEnv();
  // No env set → both false (isUsableKey floor; Ollama gates on the base URL).
  assert.equal(hasGrokKey(), false);
  assert.equal(hasOllamaKey(), false);
  // OLLAMA_BASE_URL uses a relaxed 3-char floor so a short local URL still enables it.
  writeFileSync(ENV_FILE, 'OLLAMA_BASE_URL=http://localhost:11434/v1\nXAI_API_KEY=xai-secret-canary-00001\n');
  assert.equal(hasOllamaKey(), true);
  assert.equal(hasGrokKey(), true);
  clearParentEnv();
});

// ─── v1.217.0 — Ark pair (BytePlus + Volcengine), OpenAI-compatible ────────

test('runArk: default BytePlus endpoint + Bearer + doubao default model', async () => {
  let sentUrl, sentAuth, sentModel;
  const fakeFetch = async (url, opts) => {
    sentUrl = url; sentAuth = opts.headers.Authorization; sentModel = JSON.parse(opts.body).model;
    return okChat('ark ok');
  };
  const r = await runArk('hi', { apiKey: 'ark-canary-000000001', fetchImpl: fakeFetch });
  assert.equal(r.error, null);
  assert.equal(r.markdown, 'ark ok');
  assert.equal(sentUrl, 'https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions');
  assert.equal(sentAuth, 'Bearer ark-canary-000000001');
  assert.equal(sentModel, 'doubao-pro-32k');
});

test('runArkCn: default Volcengine (China) endpoint', async () => {
  let sentUrl;
  const fakeFetch = async (url) => { sentUrl = url; return okChat('ok'); };
  await runArkCn('hi', { apiKey: 'arkcn-canary-00000001', fetchImpl: fakeFetch });
  assert.equal(sentUrl, 'https://ark.cn-beijing.volces.com/api/v3/chat/completions');
});

test('hasArkKey / hasArkCnKey gate on their own env (ARK_API_KEY / ARK_CN_API_KEY)', () => {
  clearParentEnv();
  assert.equal(hasArkKey(), false);
  assert.equal(hasArkCnKey(), false);
  writeFileSync(ENV_FILE, 'ARK_API_KEY=ark-canary-000000001\nARK_CN_API_KEY=arkcn-canary-00000001\n');
  assert.equal(hasArkKey(), true);
  assert.equal(hasArkCnKey(), true);
  clearParentEnv();
});
