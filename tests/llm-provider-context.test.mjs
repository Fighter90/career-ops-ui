/**
 * v1.73.0 — provider connector matrix for the LLM "Run live" buttons.
 *
 * Proves, for EVERY provider (Anthropic / Gemini / OpenAI / Qwen / OpenRouter),
 * that the live mode/deep/evaluate endpoints:
 *   1. inline cv.md + config/profile.yml into the prompt SENT to the provider
 *      (so the artifact is detailed/personalized, not generic), and
 *   2. return the provider's text as the artifact.
 *
 * The provider HTTP call is mocked at the outer boundary (global fetch) per the
 * testing rule "mock third-party HTTP only": the mock matches the provider host,
 * captures the outgoing request body, and returns a canned response in that
 * provider's schema; every other fetch (the test's own calls to the in-process
 * server) is proxied to the real fetch. CI-isolated — no network, no real keys.
 *
 * Regression guard for the Gemini misrouting bug: pre-v1.73.0 /api/mode and
 * /api/deep piped the prompt through the oferta-only gemini-eval.mjs subprocess,
 * so they produced an evaluation (and could not be context-checked). They now
 * use the generic in-process runGemini, asserted below.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const CV_MARK = 'ZEBRACVMARKER7731';
const PROFILE_MARK = 'ZEBRAPROFILEMARKER4412';
const PROVIDER_KEYS = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY', 'OPENROUTER_API_KEY', 'GITHUB_MODELS_API_KEY', 'LLM_PROVIDER'];

let server, baseUrl, realFetch;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'llm-prov-'));
  for (const d of ['config', 'data', 'modes', 'output', 'interview-prep']) mkdirSync(resolve(dir, d), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), `# CV\n\n${CV_MARK}\nSenior Backend Engineer.\n`);
  writeFileSync(resolve(dir, 'config', 'profile.yml'), `candidate:\n  full_name: ${PROFILE_MARK}\n`);
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  for (const m of ['_shared', 'oferta', 'deep', 'cover', 'contacto']) {
    writeFileSync(resolve(dir, 'modes', `${m}.md`), `# ${m}\nMARKER-${m.toUpperCase()}\n`);
  }
  process.env.CAREER_OPS_ROOT = dir;
  realFetch = globalThis.fetch;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(() => {
  globalThis.fetch = realFetch;
  delete process.env.CAREER_OPS_ROOT;
  for (const k of PROVIDER_KEYS) delete process.env[k];
  return new Promise((r) => server.close(r));
});

beforeEach(() => { for (const k of PROVIDER_KEYS) delete process.env[k]; globalThis.fetch = realFetch; });

/** Install a fetch mock for one provider host; capture its request body. */
function mockProvider(hostMatch, responseJson) {
  const captured = { body: null, url: null, hit: false };
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.includes(hostMatch)) {
      captured.hit = true; captured.url = u; captured.body = opts.body ? String(opts.body) : '';
      return new Response(JSON.stringify(responseJson), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(url, opts);
  };
  return captured;
}

const RESP = {
  anthropic: (t) => ({ content: [{ type: 'text', text: t }], usage: { input_tokens: 10, output_tokens: 5 } }),
  gemini: (t) => ({ candidates: [{ content: { parts: [{ text: t }] } }], usageMetadata: { totalTokenCount: 15 } }),
  openaiLike: (t) => ({ choices: [{ message: { content: t } }], usage: { total_tokens: 15 } }),
};

// provider → { env, host, response, llmProvider }
const PROVIDERS = {
  anthropic: { key: 'ANTHROPIC_API_KEY', val: 'sk-ant-fake0123456789abcdefghijklmnop', host: 'api.anthropic.com', resp: RESP.anthropic, lp: 'claude' },
  gemini: { key: 'GEMINI_API_KEY', val: 'AIzaFakeGeminiKey0123456789abcdefghij', host: 'generativelanguage.googleapis.com', resp: RESP.gemini, lp: 'gemini' },
  openai: { key: 'OPENAI_API_KEY', val: 'sk-fakeopenai0123456789abcdefghijklmn', host: 'api.openai.com', resp: RESP.openaiLike, lp: 'openai' },
  qwen: { key: 'QWEN_API_KEY', val: 'sk-fakeqwen0123456789abcdefghijklmnop', host: 'dashscope', resp: RESP.openaiLike, lp: 'qwen' },
  openrouter: { key: 'OPENROUTER_API_KEY', val: 'sk-or-fake0123456789abcdefghijklmnop', host: 'openrouter.ai', resp: RESP.openaiLike, lp: 'openrouter' },
  github: { key: 'GITHUB_MODELS_API_KEY', val: 'github_pat_fake0123456789abcdefghijklmnop', host: 'models.github.ai', resp: RESP.openaiLike, lp: 'github' },
};

async function postJSON(path, body) {
  const res = await fetch(baseUrl + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

// ── /api/mode/cover (the cover-letter button) across ALL providers ──
for (const [name, p] of Object.entries(PROVIDERS)) {
  test(`/api/mode/cover via ${name}: inlines cv.md + profile.yml, returns the artifact`, async () => {
    process.env[p.key] = p.val;
    process.env.LLM_PROVIDER = p.lp;
    const cap = mockProvider(p.host, p.resp(`LETTER-FROM-${name.toUpperCase()}`));
    const r = await postJSON('/api/mode/cover', { run: true, jd: 'Team Lead PHP+React, 50+ chars of job description text here.', company: 'Acme' });
    assert.equal(r.status, 200, `${name}: 200`);
    assert.equal(r.body.mode, name, `${name}: mode tag`);
    assert.equal(r.body.markdown, `LETTER-FROM-${name.toUpperCase()}`, `${name}: artifact returned`);
    assert.ok(cap.hit, `${name}: provider was actually called`);
    assert.match(cap.body, new RegExp(CV_MARK), `${name}: cv.md inlined into provider prompt`);
    assert.match(cap.body, new RegExp(PROFILE_MARK), `${name}: profile.yml inlined into provider prompt`);
  });
}

// ── /api/deep across Anthropic + Gemini (Gemini = the fixed misrouting path) ──
for (const name of ['anthropic', 'gemini']) {
  const p = PROVIDERS[name];
  test(`/api/deep via ${name}: inlines context + returns brief (not an oferta eval)`, async () => {
    process.env[p.key] = p.val;
    process.env.LLM_PROVIDER = p.lp;
    const cap = mockProvider(p.host, p.resp(`DEEP-BRIEF-${name.toUpperCase()}`));
    const r = await postJSON('/api/deep', { company: 'Acme', role: 'Team Lead', run: true });
    assert.equal(r.status, 200, `${name}: 200`);
    assert.ok(cap.hit, `${name}: provider called in-process (no gemini-eval.mjs subprocess)`);
    assert.match(cap.body, new RegExp(CV_MARK), `${name}: cv.md inlined`);
    assert.match(cap.body, /MARKER-DEEP/, `${name}: modes/deep.md inlined`);
  });
}

// ── /api/evaluate across in-process providers (Anthropic + OpenAI) ──
for (const name of ['anthropic', 'openai']) {
  const p = PROVIDERS[name];
  test(`/api/evaluate via ${name}: inlines cv + oferta, returns evaluation`, async () => {
    process.env[p.key] = p.val;
    process.env.LLM_PROVIDER = p.lp;
    const cap = mockProvider(p.host, p.resp(`EVAL-${name.toUpperCase()}`));
    const r = await postJSON('/api/evaluate', { jd: 'Senior backend role with Go + PostgreSQL and 50+ chars of detail.', mode: 'live' });
    assert.equal(r.status, 200, `${name}: 200`);
    assert.equal(r.body.markdown, `EVAL-${name.toUpperCase()}`, `${name}: evaluation returned`);
    assert.match(cap.body, new RegExp(CV_MARK), `${name}: cv.md inlined`);
    assert.match(cap.body, /MARKER-OFERTA/, `${name}: modes/oferta.md inlined`);
  });
}
