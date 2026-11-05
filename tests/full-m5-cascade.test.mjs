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
// v1.268.0 (CAR-229/230) — the live evaluate makes TWO provider calls with
// prompt-keyed shapes (scoring → bare JSON, render → the A–G body); the
// provider mocks branch on the raw request body via the shared helper.
import { twoShapeAnswers, scoringFixture, renderBodyFixture } from './helpers/eval-two-step-stub.mjs';

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

// FULL-M5 CodeQL — host equality via the URL parser, never substring
// containment on a URL literal (js/incomplete-url-substring-sanitization):
// a decoy URL carrying the host as a substring must not match.
function hostIs(u, host) {
  try { return new URL(String(u)).host === host; } catch { return false; }
}
const saved = {};
// The two-shape answer set for the live evaluate cascade: a valid scoring
// JSON for the scoring prompt and a complete A–G body for the render prompt.
// Prompts from /api/mode and /api/deep carry neither marker → the mock falls
// through to its generic brief.
const evalAnswers = twoShapeAnswers({
  scoring: scoringFixture({ company: 'Acme', role: 'Engineer', archetype: 'backend', legitimacy: 'High Confidence', score: 4.0 }),
  body: renderBodyFixture({}),
});

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

/** Provider mocks in each provider's own response schema, matched by host.
 *  v1.268.0 — the evaluate cascade's two calls are answered by prompt shape
 *  (the raw request body carries the marker text; JSON escaping never touches
 *  either marker string), so the mock branches before falling back to the
 *  generic one-line brief used by /api/mode and /api/deep. */
function mockProviders() {
  const calls = [];
  const answer = (name, rawBody) => evalAnswers(String(rawBody ?? '')) || `# ${name} brief`;
  globalThis.fetch = async (u, o = {}) => {
    const s = String(u);
    if (hostIs(s, 'api.anthropic.com')) {
      calls.push({ host: 'anthropic', signal: o.signal || null });
      return json({ content: [{ type: 'text', text: answer('anthropic', o?.body) }], stop_reason: 'end_turn', usage: { input_tokens: 3, output_tokens: 2 } });
    }
    if (hostIs(s, 'generativelanguage.googleapis.com')) {
      calls.push({ host: 'gemini', signal: o.signal || null });
      return json({ candidates: [{ content: { parts: [{ text: '# gemini brief' }] } }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 } });
    }
    for (const [host, name] of [['api.openai.com', 'openai'], ['api.deepseek.com', 'deepseek'], ['127.0.0.1:8642', 'hermes']]) {
      if (hostIs(s, host)) {
        calls.push({ host: name, signal: o.signal || null });
        return json({ choices: [{ message: { content: answer(name, o?.body) }, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 2 } });
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

/** POST /api/evaluate and drain the SSE stream into `{ev, data}` frames
 *  (v1.268.0 — every evaluate path answers on the stream; a 4xx before the
 *  stream stays plain JSON and yields an empty frame list). */
async function postEvaluate(body, { signal } = {}) {
  const r = await fetch(baseUrl + '/api/evaluate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
  const text = await r.text();
  const events = [];
  for (const frame of text.split('\n\n')) {
    const ev = (frame.match(/^event:\s*(.+)$/m) || [])[1];
    const data = (frame.match(/^data:\s*([\s\S]+)$/m) || [])[1];
    if (ev) events.push({ ev, data: data ? JSON.parse(data) : {} });
  }
  return { status: r.status, events, text };
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
    if (!hostIs(u, 'api.anthropic.com')) return realFetch(u, o);
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
      postEvaluate({ jd: JD }),
      post('/api/mode/cover', { run: true }),
      post('/api/deep', { company: 'Acme', run: true }),
    ]);
    assert.equal(ev.status, 200, `evaluate ${JSON.stringify(env)}: ${ev.text.slice(0, 200)}`);
    assert.equal(md.status, 200, `mode ${JSON.stringify(env)}: ${JSON.stringify(md.body).slice(0, 200)}`);
    assert.equal(dp.status, 200, `deep ${JSON.stringify(env)}: ${JSON.stringify(dp.body).slice(0, 200)}`);
    // v1.268.0 — every evaluate path answers on the SSE stream; the terminal
    // `done` frame carries the same `mode` the pre-streaming JSON had.
    const doneFrame = ev.events.find((e) => e.ev === 'done');
    assert.ok(doneFrame, `evaluate ${JSON.stringify(env)}: no done frame — ${ev.text.slice(0, 200)}`);
    const modes = [doneFrame.data.mode, md.body.mode, dp.body.mode];
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
  const calls = mockProviders();
  const before = usageLines().length;
  const ev = await postEvaluate({ jd: JD });
  assert.equal(ev.status, 200);
  assert.ok(ev.events.some((e) => e.ev === 'done'), 'the evaluate run must complete (done frame)');
  const md = await post('/api/mode/cover', { run: true });
  assert.equal(md.status, 200);
  const rows = usageLines().slice(before);
  const providerCalls = calls.filter((c) => c.host === 'openai').length;
  // v1.268.0 — the evaluate cascade makes TWO provider calls (scoring + render)
  // and llm-dispatch records each exactly once; the mode run records its one
  // call exactly once. Usage-per-provider-call stays 1:1 — the route never
  // double-records a call the dispatch already recorded.
  assert.ok(providerCalls >= 3, `expected the evaluate's two steps + the mode run to call the provider, got ${providerCalls} calls`);
  assert.equal(rows.filter((u) => u.provider === 'openai').length, providerCalls,
    `expected exactly one usage row per provider call, got ${JSON.stringify(rows)}`);
});

test('FULL-M5 contract: evaluate success/error and mode shapes are unchanged', async () => {
  // v1.268.0 — /api/evaluate answers as an SSE stream for every path; the
  // terminal `done` frame carries the success payload and a failure after the
  // headers is an `error` frame. The evaluate legs below assert the stream
  // shapes; the /api/mode shapes are unchanged (plain JSON).
  let calls = [];
  process.env.OPENAI_API_KEY = OAI;
  globalThis.fetch = async (u, o = {}) => {
    if (!hostIs(u, 'api.openai.com')) return realFetch(u, o);
    calls.push('openai');
    const answer = evalAnswers(String(o?.body ?? ''));
    return json({ choices: [{ message: { content: answer }, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 2 } });
  };
  const ev = await postEvaluate({ jd: JD });
  assert.equal(ev.status, 200);
  const doneFrame = ev.events.find((e) => e.ev === 'done');
  assert.ok(doneFrame, 'a clean two-step run must end in a done frame');
  assert.deepEqual(Object.keys(doneFrame.data).sort(), ['elapsedMs', 'fallbackUsed', 'markdown', 'mode', 'saved', 'scoring', 'steps', 'usage'],
    'evaluate success shape drifted');
  assert.equal(doneFrame.data.mode, 'openai');
  assert.equal(doneFrame.data.saved, null);
  assert.equal(doneFrame.data.warnings, undefined, 'a well-formed run must carry no warnings key');
  // The server assembles the machine surfaces (header + yaml block) and the
  // display markdown strips the SCORE_SUMMARY.
  assert.match(doneFrame.data.markdown, /^# Evaluation: Acme — Engineer/m);
  assert.ok(!doneFrame.data.markdown.includes('---SCORE_SUMMARY---'), 'the summary block must be stripped from the payload');

  globalThis.fetch = async (u, o = {}) => (hostIs(u, 'api.openai.com')
    ? json({ choices: [{ message: { content: '' }, finish_reason: 'stop' }] })
    : realFetch(u, o));
  const err = await postEvaluate({ jd: JD });
  // Failure AFTER the headers → an `error` frame on the 200 stream, not a
  // plain-JSON 502 (the headers are already gone when the step fails).
  assert.equal(err.status, 200);
  const errFrame = err.events.find((e) => e.ev === 'error');
  assert.ok(errFrame, 'the failed run must carry an error frame');
  assert.deepEqual(Object.keys(errFrame.data).sort(), ['message', 'step'], 'evaluate error-frame shape drifted');
  assert.equal(errFrame.data.step, 'scoring', 'an unusable scoring answer must fail the scoring step');
  assert.ok(errFrame.data.message, 'the error frame must carry a message');
  assert.ok(!err.events.some((e) => e.ev === 'done'), 'a failed run must not emit a done frame');

  process.env.ANTHROPIC_API_KEY = ANT;
  globalThis.fetch = async (u, o = {}) => {
    if (!hostIs(u, 'api.anthropic.com')) return realFetch(u, o);
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
