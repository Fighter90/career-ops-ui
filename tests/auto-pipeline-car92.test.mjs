/**
 * CAR-92 — findings 3, 5, 6 on /api/auto-pipeline:
 *
 *   3. The manual fallback built its prompt from an EMPTY JD — the posting
 *      URL appeared nowhere, so "manual fallback always available" was hollow.
 *   5. A client-sent `mode: 'anthropic'` pinned the paid provider even when
 *      the server's LLM_PROVIDER config (the spend tier) says otherwise.
 *      The pin is honoured only when the server's provider order permits it.
 *   6. A client disconnect stopped only the JD fetch — the LLM call (and the
 *      spend) ran to completion. The route's abort signal is now threaded
 *      into the provider runners.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT (cv.md, portals.yml), JD fetch stubbed
 * via safe-fetch's transport + a DNS stub, provider HTTP mocked at the host
 * boundary, server bound to 127.0.0.1. No network, no real keys.
 */
import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promises as dns } from 'node:dns';

const KEYS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'LLM_PROVIDER'];
const ANT = 'sk-ant-fake0123456789abcdefghijklmnop';
const OAI = 'sk-fakeopenai0123456789abcdefghijklmn';

let server; let baseUrl; let ROOT; let restoreTransport = null;
const realFetch = globalThis.fetch;
const realLookup = dns.lookup;
const saved = {};

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'auto-pipeline-car92-'));
  for (const d of ['config', 'data', 'modes', 'output', 'reports']) mkdirSync(resolve(ROOT, d), { recursive: true });
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\nSenior backend engineer.\n');
  writeFileSync(resolve(ROOT, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(ROOT, 'data', 'applications.md'), '');
  for (const m of ['_shared', 'oferta']) writeFileSync(resolve(ROOT, 'modes', `${m}.md`), `# ${m}\n`);
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  process.env.CAREER_OPS_ROOT = ROOT;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(async () => {
  globalThis.fetch = realFetch;
  dns.lookup = realLookup;
  for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  delete process.env.CAREER_OPS_ROOT;
  await new Promise((r) => server.close(r));
  try { rmSync(ROOT, { recursive: true, force: true }); } catch { /* temp dir */ }
});

beforeEach(() => { for (const k of KEYS) delete process.env[k]; globalThis.fetch = realFetch; });
afterEach(() => {
  globalThis.fetch = realFetch;
  dns.lookup = realLookup;
  if (restoreTransport) { restoreTransport(); restoreTransport = null; }
});

const JOB_URL = 'https://jobs.example.com/acme/42';
const JOB_HTML = '<html><body><h1>Platform Engineer at Acme</h1><p>' + 'We build distributed systems in Go. '.repeat(10) + '</p></body></html>';
const GOOD_REPORT = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((L) => `## Block ${L} — x\nok\n`).join('')
  + '\n---SCORE_SUMMARY---\nCOMPANY: Acme\nROLE: Platform Engineer\nSCORE: 4.2\nARCHETYPE: Platform\nLEGITIMACY: High Confidence\n---END_SUMMARY---\n';

async function stubJobPage(html) {
  const { _setTransport } = await import('../server/lib/safe-fetch.mjs');
  dns.lookup = async () => ({ address: '93.184.216.34', family: 4 });
  restoreTransport = _setTransport(async () => ({ status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(html) }));
}

const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
const sseEvents = (text) => text.split('\n\n').filter(Boolean).map((b) => ({
  event: (b.match(/^event: (.+)$/m) || [])[1],
  data: JSON.parse((b.match(/^data: (.+)$/m) || [, 'null'])[1]),
}));

async function post(body) {
  const r = await fetch(baseUrl + '/api/auto-pipeline', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, text: await r.text() };
}

// ── Finding 3 — the manual prompt carries the posting URL ───────────────────

test('CAR-92.3: the manual fallback prompt contains the posting URL (fetch-it-yourself contract)', async () => {
  const { text } = await post({ url: JOB_URL, mode: 'manual' });
  const done = sseEvents(text).find((e) => e.event === 'done');
  assert.ok(done, 'manual mode still completes');
  assert.ok(done.data.prompt.includes(JOB_URL), `the prompt must carry the URL for the human/agent to fetch — got: ${done.data.prompt.slice(0, 200)}`);
  // Still the fast no-fetch contract: manual completes without any provider.
  const stream = await post({ url: JOB_URL, mode: 'manual' });
  assert.ok(sseEvents(stream.text).some((e) => e.event === 'done'));
});

// ── Finding 5 — the client cannot overrule the server's provider tier ───────

test('CAR-92.5: mode:"anthropic" is ignored when LLM_PROVIDER pins a cheaper provider', async () => {
  await stubJobPage(JOB_HTML);
  process.env.ANTHROPIC_API_KEY = ANT;
  process.env.OPENAI_API_KEY = OAI;
  process.env.LLM_PROVIDER = 'openai';
  const calls = [];
  globalThis.fetch = async (u, o = {}) => {
    const s = String(u);
    if (s.includes('api.anthropic.com') || s.includes('api.openai.com')) {
      calls.push(s.includes('anthropic') ? 'anthropic' : 'openai');
      return json({ choices: [{ message: { content: GOOD_REPORT }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 3 } });
    }
    return realFetch(u, o);
  };
  const ev = sseEvents((await post({ url: JOB_URL, mode: 'anthropic' })).text);
  const done = ev.find((e) => e.event === 'done');
  assert.ok(done, 'the run completes');
  assert.equal(done.data.evalMode, 'openai', 'the server config (LLM_PROVIDER) decides, not the request body');
  assert.deepEqual(calls, ['openai'], 'no paid-provider call may happen');
});

test('CAR-92.5: with LLM_PROVIDER=auto the explicit anthropic pin is still honoured', async () => {
  await stubJobPage(JOB_HTML);
  process.env.ANTHROPIC_API_KEY = ANT;
  process.env.OPENAI_API_KEY = OAI;
  process.env.LLM_PROVIDER = 'auto';
  const hosts = [];
  globalThis.fetch = async (u, o = {}) => {
    const s = String(u);
    if (s.includes('api.anthropic.com')) { hosts.push('anthropic'); return json({ content: [{ type: 'text', text: GOOD_REPORT }], stop_reason: 'end_turn', usage: { input_tokens: 5, output_tokens: 3 } }); }
    if (s.includes('api.openai.com')) { hosts.push('openai'); return json({ choices: [{ message: { content: GOOD_REPORT }, finish_reason: 'stop' }], usage: {} }); }
    return realFetch(u, o);
  };
  const ev = sseEvents((await post({ url: JOB_URL, mode: 'anthropic' })).text);
  assert.equal(ev.find((e) => e.event === 'done').data.evalMode, 'anthropic');
  assert.deepEqual(hosts, ['anthropic']);
});

test('CAR-92.5: mode:"manual" stays always available regardless of the server tier', async () => {
  process.env.LLM_PROVIDER = 'anthropic';
  process.env.ANTHROPIC_API_KEY = ANT;
  const { text } = await post({ url: JOB_URL, mode: 'manual' });
  assert.ok(sseEvents(text).find((e) => e.event === 'done').data.mode === 'manual');
});

// ── Finding 6 — a client disconnect aborts the in-flight LLM call ───────────

test('CAR-92.6: closing the connection aborts the upstream provider call (no further spend)', async () => {
  await stubJobPage(JOB_HTML);
  process.env.ANTHROPIC_API_KEY = ANT;
  let sawAbort = false;
  globalThis.fetch = async (u, o = {}) => {
    if (String(u).includes('api.anthropic.com')) {
      return new Promise((_, reject) => {
        // A self-release timer keeps a pre-fix red run from parking the route's
        // own EVAL timer (the abort only propagates with the fix).
        const release = setTimeout(() => bail('mock provider timed out (no abort seen)'), 5000);
        const bail = (why) => { clearTimeout(release); reject(new Error(why)); };
        const sig = o && o.signal;
        if (!sig) { bail('no signal passed to the provider fetch'); return; }
        if (sig.aborted) { sawAbort = true; bail('aborted before send'); return; }
        sig.addEventListener('abort', () => { sawAbort = true; bail('The operation was aborted'); });
      });
    }
    return realFetch(u, o);
  };

  const clientCtrl = new AbortController();
  const reportsBefore = existsSync(resolve(ROOT, 'reports')) ? readdirSync(resolve(ROOT, 'reports')) : [];
  const resp = await fetch(baseUrl + '/api/auto-pipeline', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: JOB_URL }),
    signal: clientCtrl.signal,
  });
  // Stream the SSE until the LLM call starts, then hang up.
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    if (buf.includes('"key":"evaluate"') && buf.includes('"status":"running"')) break;
  }
  clientCtrl.abort();
  for (let i = 0; i < 40 && !sawAbort; i++) await new Promise((r) => setTimeout(r, 50));
  assert.ok(sawAbort, 'the provider fetch must observe the abort when the client disconnects');
  reader.cancel().catch(() => {});
  // No report may be filed for the aborted run (only files from earlier
  // tests in this file may exist).
  await new Promise((r) => setTimeout(r, 200));
  const reports = existsSync(resolve(ROOT, 'reports')) ? readdirSync(resolve(ROOT, 'reports')) : [];
  const fresh = reports.filter((f) => !reportsBefore.includes(f));
  assert.deepEqual(fresh, [], `no report after disconnect, found: ${fresh.join(', ')}`);
});

test('CAR-92.6: runAnthropic fails fast when the caller signal is already aborted', async () => {
  const { runAnthropic } = await import('../server/lib/anthropic.mjs');
  const ctrl = new AbortController();
  ctrl.abort();
  let called = 0;
  const t0 = Date.now();
  const r = await runAnthropic('hi', { signal: ctrl.signal, fetchImpl: async () => { called++; return json({}); } });
  assert.ok(r.error, 'pre-aborted signal is an error, not a hang');
  assert.equal(called, 0, 'no upstream call is made');
  assert.ok(Date.now() - t0 < 1000);
});
