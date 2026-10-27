/**
 * FULL-M5 — provider cascade consolidation.
 *
 * routes/llm.mjs re-implemented the cascade (its own _provGate / _tailProvider)
 * WITHOUT abort signals: a client that hung up mid-evaluation left the provider
 * request running to completion — burning tokens for nobody (evaluate budgets
 * 16384 output tokens / 300 s). The consolidation routes evaluate/mode/deep
 * through the shared `runActiveProvider` (llm-dispatch.mjs) with
 * `{ signal, cachePrefix }`, wires `res.on('close')` to an AbortController once
 * per request, and deletes the local gate so provider choice is decided in
 * exactly ONE place.
 *
 * What is locked here:
 *   - RED (a): a client disconnect mid-call reaches the provider as an abort
 *     signal on /api/evaluate, /api/mode/:slug and /api/deep (hang-until-
 *     aborted provider mock records whether a signal was passed and whether
 *     it fired).
 *   - RED (b): ONE gate, behaviourally — under every provider-order
 *     permutation (auto, priority, tail order, forced pin, forced-without-key
 *     fallback, no key) all three surfaces pick the SAME provider.
 *   - Contract guards: usage recorded exactly once per live run (route must
 *     not double-record what the dispatch already records); evaluate 502 /
 *     success shapes byte-identical through the consolidated path.
 *
 * The evaluate Gemini branch stays the gemini-eval.mjs SUBPROCESS (CAR-92
 * contract: --lang first, --no-save unless `save`, stdout passthrough, usage
 * from stdout) — it is intercepted via the shared gate, never re-implemented.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT (cv.md present before import), provider
 * HTTP mocked by host on the global fetch, fake gemini-eval.mjs, server bound
 * to 127.0.0.1. No network, no real keys.
 */
import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const KEYS = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY',
  'QWEN_API_KEY', 'OPENROUTER_API_KEY', 'GITHUB_MODELS_API_KEY', 'GITHUB_MODELS_TOKEN',
  'HERMES_API_KEY', 'DEEPSEEK_API_KEY', 'LLM_PROVIDER'];
const ANT = 'sk-ant-fake0123456789abcdefghijklmnop';
const GEM = 'AIzaFakeGeminiKey0123456789abcdefghij';
const OAI = 'sk-fakeopenai0123456789abcdefghijklmn';
const HER = 'sk-fakehermes0123456789abcdefghijklm';
const DSK = 'sk-fakedeepseek0123456789abcdefghijkl';

let server; let baseUrl; let ROOT;
const realFetch = globalThis.fetch;
const saved = {};

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'full-m5-cascade-'));
  for (const d of ['config', 'data', 'modes', 'output', 'reports', 'interview-prep']) mkdirSync(resolve(ROOT, d), { recursive: true });
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\nSenior backend engineer.\n');
  writeFileSync(resolve(ROOT, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(ROOT, 'data', 'applications.md'), '');
  for (const m of ['_shared', 'oferta', 'deep', 'cover']) writeFileSync(resolve(ROOT, 'modes', `${m}.md`), `# ${m}\n`);
  // Fake gemini-eval.mjs: records argv, prints a well-formed A–G report.
  writeFileSync(resolve(ROOT, 'gemini-eval.mjs'), [
    "import { appendFileSync } from 'node:fs';",
    "const a = process.argv.slice(2);",
    "appendFileSync('gemini-argv.jsonl', JSON.stringify({ args: a }) + '\\n');",
    "console.log(['## A) Context', '## B) Fit', '## C) Risks', '## D) Salary', '## E) Questions', '## F) Legitimacy: high', '## G) Verdict: proceed', '---SCORE_SUMMARY---', 'COMPANY: Vandelay', 'ROLE: Engineer', 'ARCHETYPE: backend', 'LEGITIMACY: high', 'SCORE: 4.0/5', '---END_SUMMARY---'].join('\\n'));",
    '',
  ].join('\n'));
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  process.env.CAREER_OPS_ROOT = ROOT;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(async () => {
  globalThis.fetch = realFetch;
  for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  delete process.env.CAREER_OPS_ROOT;
  await new Promise((r) => server.close(r));
  try { rmSync(ROOT, { recursive: true, force: true }); } catch {}
});

beforeEach(() => { for (const k of KEYS) delete process.env[k]; globalThis.fetch = realFetch; });
afterEach(() => { globalThis.fetch = realFetch; });

const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
const JD = 'Senior Backend Engineer at Acme. Go, PostgreSQL, Kubernetes, on-call rotation, code review.';

/** Provider mocks in each provider's own response schema, matched by host. */
function mockProviders() {
  const calls = [];
  globalThis.fetch = async (u, o = {}) => {
    const s = String(u);
    if (s.includes('api.anthropic.com')) {
      calls.push({ host: 'anthropic', signal: o.signal || null });
      return json({ content: [{ type: 'text', text: '# anthropic brief' }], stop_reason: 'end_turn', usage: { input_tokens: 3, output_tokens: 2 } });
    }
    if (s.includes('generativelanguage.googleapis.com')) {
      calls.push({ host: 'gemini', signal: o.signal || null });
      return json({ candidates: [{ content: { parts: [{ text: '# gemini brief' }] } }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 } });
    }
    for (const [host, name] of [['api.openai.com', 'openai'], ['api.deepseek.com', 'deepseek'], ['127.0.0.1:8642', 'hermes']]) {
      if (s.includes(host)) {
        calls.push({ host: name, signal: o.signal || null });
        return json({ choices: [{ message: { content: `# ${name} brief` }, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 2 } });
      }
    }
    return realFetch(u, o);
  };
  return calls;
}

async function post(path, body, { signal } = {}) {
  const r = await fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch { /* empty body after abort */ }
  return { status: r.status, body: j, text };
}

const usageLines = () => {
  const f = resolve(ROOT, 'data', 'llm-usage.jsonl');
  return existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
};
const geminiCalls = () => {
  const f = resolve(ROOT, 'gemini-argv.jsonl');
  return existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
};

/** Hang until the injected signal aborts; record whether a signal ever came. */
function hangUntilAborted(recorder) {
  globalThis.fetch = async (u, o = {}) => {
    if (!String(u).includes('api.anthropic.com')) return realFetch(u, o);
    const sig = o.signal || null;
    const entry = { hasSignal: !!sig, abortedAtStart: !!sig?.aborted, abortObserved: null };
    recorder.push(entry);
    await new Promise((done) => {
      if (!sig) { entry.abortObserved = false; setTimeout(done, 200); return; }
      // Must stay WELL under postAndHangUp's waitFor budget: a RED run only
      // sees abortObserved=false after this timeout fires (the runner's
      // internal ctrl.signal is always present — the caller's signal is what
      // makes it FIRE before the timeout).
      const t = setTimeout(() => { entry.abortObserved = false; done(); }, 1200);
      sig.addEventListener('abort', () => { clearTimeout(t); entry.abortObserved = true; done(); }, { once: true });
    });
    return json({ content: [{ type: 'text', text: '# late brief' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
  };
}

async function waitFor(fn, ms = 3000) {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > ms) return false;
    await new Promise((r) => setTimeout(r, 10));
  }
  return true;
}

/** POST then abort the client connection once the provider call has started. */
async function postAndHangUp(path, body) {
  const ac = new AbortController();
  const p = post(path, body, { signal: ac.signal }).catch(() => null);
  assert.ok(await waitFor(() => hangRecorder.length > 0), 'provider call never started');
  await new Promise((r) => setTimeout(r, 50));
  ac.abort();
  await p;
  assert.ok(await waitFor(() => hangRecorder[0].abortObserved !== null), 'provider mock never finished');
  return hangRecorder[0];
}
let hangRecorder = [];

// ── (a) client disconnect → abort reaches the provider ──────────────────────

test('FULL-M5a /api/evaluate: client hang-up aborts the in-flight provider call', async () => {
  process.env.ANTHROPIC_API_KEY = ANT;
  hangRecorder = [];
  hangUntilAborted(hangRecorder);
  const rec = await postAndHangUp('/api/evaluate', { jd: JD });
  assert.equal(rec.hasSignal, true, 'no abort signal reached the provider — generation keeps burning tokens after the client is gone');
  assert.equal(rec.abortObserved, true, 'the signal was passed but never fired on res close');
});

test('FULL-M5a /api/mode: client hang-up aborts the in-flight provider call', async () => {
  process.env.ANTHROPIC_API_KEY = ANT;
  hangRecorder = [];
  hangUntilAborted(hangRecorder);
  const rec = await postAndHangUp('/api/mode/cover', { run: true });
  assert.equal(rec.hasSignal, true, 'no abort signal reached the provider');
  assert.equal(rec.abortObserved, true, 'the signal was passed but never fired on res close');
});

test('FULL-M5a /api/deep: client hang-up aborts the in-flight provider call', async () => {
  process.env.ANTHROPIC_API_KEY = ANT;
  hangRecorder = [];
  hangUntilAborted(hangRecorder);
  const rec = await postAndHangUp('/api/deep', { company: 'Acme', run: true });
  assert.equal(rec.hasSignal, true, 'no abort signal reached the provider');
  assert.equal(rec.abortObserved, true, 'the signal was passed but never fired on res close');
});

// ── (b) ONE gate: all three surfaces pick the same provider, always ─────────

test('FULL-M5b one gate: evaluate + mode + deep always agree on the provider', async () => {
  // [env, expected mode] — the order-sensitive cases are the ones two copies
  // of the gate can drift on: Anthropic-over-Gemini priority, tail order,
  // forced pin, and the v1.157.0 forced-without-key fallback.
  const cases = [
    [{ ANTHROPIC_API_KEY: ANT }, 'anthropic'],
    [{ ANTHROPIC_API_KEY: ANT, GEMINI_API_KEY: GEM }, 'anthropic'],
    [{ GEMINI_API_KEY: GEM }, 'gemini'],
    [{ OPENAI_API_KEY: OAI }, 'openai'],
    [{ OPENAI_API_KEY: OAI, HERMES_API_KEY: HER }, 'openai'],
    [{ LLM_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: DSK }, 'deepseek'],
    [{ LLM_PROVIDER: 'claude', OPENAI_API_KEY: OAI }, 'openai'],
    [{}, 'manual'],
  ];
  for (const [env, expected] of cases) {
    for (const k of KEYS) delete process.env[k]; // cases never accumulate keys
    for (const [k, v] of Object.entries(env)) process.env[k] = v;
    const calls = mockProviders();
    const nGem = geminiCalls().length;
    const [ev, md, dp] = await Promise.all([
      post('/api/evaluate', { jd: JD }),
      post('/api/mode/cover', { run: true }),
      post('/api/deep', { company: 'Acme', run: true }),
    ]);
    assert.equal(ev.status, 200, `evaluate ${JSON.stringify(env)}: ${JSON.stringify(ev.body).slice(0, 200)}`);
    assert.equal(md.status, 200, `mode ${JSON.stringify(env)}: ${JSON.stringify(md.body).slice(0, 200)}`);
    assert.equal(dp.status, 200, `deep ${JSON.stringify(env)}: ${JSON.stringify(dp.body).slice(0, 200)}`);
    const modes = [ev.body.mode, md.body.mode, dp.body.mode];
    assert.deepEqual(modes, [expected, expected, expected],
      `gate drift under ${JSON.stringify(env)}: evaluate=${modes[0]} mode=${modes[1]} deep=${modes[2]}`);
    if (expected === 'anthropic') {
      assert.equal(geminiCalls().length, nGem,
        `evaluate must NOT shell out to gemini-eval.mjs while Anthropic wins the cascade (${JSON.stringify(env)})`);
    }
    if (expected !== 'manual') {
      assert.ok(calls.length >= 2, `expected live provider calls for ${JSON.stringify(env)}`);
    }
  }
});

// ── contract guards: usage once, response shapes unchanged ──────────────────

test('FULL-M5 usage: a live evaluate + mode run each record usage exactly once', async () => {
  process.env.OPENAI_API_KEY = OAI;
  mockProviders();
  const before = usageLines().length;
  const ev = await post('/api/evaluate', { jd: JD });
  assert.equal(ev.status, 200);
  const md = await post('/api/mode/cover', { run: true });
  assert.equal(md.status, 200);
  const rows = usageLines().slice(before);
  assert.equal(rows.filter((u) => u.provider === 'openai').length, 2,
    `expected exactly one usage row per live run, got ${JSON.stringify(rows)}`);
});

test('FULL-M5 contract: evaluate success/error and mode shapes are unchanged', async () => {
  // A well-formed A–G + SCORE_SUMMARY evaluation → no `warnings` key, so the
  // exact response shape is assertable (a malformed report legitimately adds one).
  const GOOD_EVAL = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((L) => `## Block ${L} — x\nok\n`).join('')
    + '\n---SCORE_SUMMARY---\nCOMPANY: Acme\nROLE: Engineer\nSCORE: 4.0\nARCHETYPE: backend\nLEGITIMACY: High Confidence\n---END_SUMMARY---\n';
  let calls = [];
  process.env.OPENAI_API_KEY = OAI;
  globalThis.fetch = async (u, o = {}) => {
    if (!String(u).includes('api.openai.com')) return realFetch(u, o);
    calls.push('openai');
    return json({ choices: [{ message: { content: GOOD_EVAL }, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 2 } });
  };
  const ev = await post('/api/evaluate', { jd: JD });
  assert.deepEqual(Object.keys(ev.body).sort(), ['markdown', 'mode', 'prompt', 'saved', 'usage'],
    'evaluate success shape drifted');
  assert.equal(ev.body.mode, 'openai');
  assert.equal(ev.body.saved, null);
  assert.equal(ev.body.warnings, undefined, 'a well-formed report must carry no warnings key');

  globalThis.fetch = async (u, o = {}) => (String(u).includes('api.openai.com')
    ? json({ choices: [{ message: { content: '' }, finish_reason: 'stop' }] })
    : realFetch(u, o));
  const err = await post('/api/evaluate', { jd: JD });
  assert.equal(err.status, 502);
  assert.deepEqual(Object.keys(err.body).sort(), ['error', 'mode', 'prompt', 'saved'], 'evaluate 502 shape drifted');
  assert.equal(err.body.mode, 'openai');

  process.env.ANTHROPIC_API_KEY = ANT;
  globalThis.fetch = async (u, o = {}) => {
    if (!String(u).includes('api.anthropic.com')) return realFetch(u, o);
    calls.push('anthropic');
    return json({ content: [{ type: 'text', text: '# cover brief' }], stop_reason: 'end_turn', usage: { input_tokens: 3, output_tokens: 2 } });
  };
  const md = await post('/api/mode/cover', { run: true });
  assert.deepEqual(Object.keys(md.body).sort(), ['markdown', 'mode', 'prompt', 'slug', 'usage'],
    'mode success shape drifted');
  assert.equal(md.body.mode, 'anthropic');
  assert.equal(md.body.slug, 'cover');

  const man = await post('/api/mode/cover', {});
  assert.deepEqual(Object.keys(man.body).sort(), ['message', 'mode', 'prompt', 'slug'], 'mode manual shape drifted');
});
