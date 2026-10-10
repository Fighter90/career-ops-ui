/**
 * Branch coverage for the LLM routes (group B of the v1.241.0 review): the
 * error and fallback paths a user actually hits — provider errors, missing
 * keys, manual mode, bad input, failed fetches — plus the batch routes.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT, provider HTTP mocked by host on the
 * global fetch, safe-fetch via _setTransport + a DNS stub, fake parent
 * scripts (batch-runner.sh, merge-tracker.mjs), 127.0.0.1 only.
 */
import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, chmodSync, rmSync , readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promises as dns } from 'node:dns';

const KEYS = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY',
  'OPENROUTER_API_KEY', 'GITHUB_MODELS_API_KEY', 'GITHUB_MODELS_TOKEN', 'LLM_PROVIDER'];
const ANT = 'sk-ant-fake0123456789abcdefghijklmnop';
const GEM = 'AIzaFakeGeminiKey0123456789abcdefghij';
const OAI = 'sk-fakeopenai0123456789abcdefghijklmn';
const posix = process.platform !== 'win32';

let server; let baseUrl; let ROOT; let restoreTransport = null;
const realFetch = globalThis.fetch;
const realLookup = dns.lookup;
const saved = {};

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'llm-routes-cov-'));
  for (const d of ['config', 'data', 'modes', 'output', 'reports', 'interview-prep']) mkdirSync(resolve(ROOT, d), { recursive: true });
  // CV over the 64 KB cap: the evaluate route must pass the truncation on.
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\n' + 'Senior engineer. '.repeat(4200));
  writeFileSync(resolve(ROOT, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(ROOT, 'data', 'applications.md'), '');
  for (const m of ['_shared', 'oferta', 'deep', 'cover']) writeFileSync(resolve(ROOT, 'modes', `${m}.md`), `# ${m}\n`);
  writeFileSync(resolve(ROOT, 'merge-tracker.mjs'), "console.log('merged ' + process.argv.slice(2).join(' '));\n");
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
  try { rmSync(ROOT, { recursive: true, force: true }); } catch {}
});

beforeEach(() => { for (const k of KEYS) delete process.env[k]; globalThis.fetch = realFetch; });
afterEach(() => {
  globalThis.fetch = realFetch;
  dns.lookup = realLookup;
  if (restoreTransport) { restoreTransport(); restoreTransport = null; }
});

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
function mockProviders(map) {
  globalThis.fetch = async (u, o = {}) => {
    const s = String(u);
    for (const [host, fn] of Object.entries(map)) if (s.includes(host)) return fn();
    return realFetch(u, o);
  };
}
const ok = (o) => () => json(o);
const fail = (msg, status = 500) => () => json({ error: { message: msg } }, status);
const antText = (t) => ok({ content: [{ type: 'text', text: t }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
// v1.248.3 — a report that passes validateEvaluationReport (A–G + a complete
// SCORE_SUMMARY): the pipeline validates BEFORE saving, so gate stubs must
// return a full report, not a one-block sketch.
const FULL_REPORT = ['## A) Context', '## B) Fit', '## C) Risks', '## D) Salary',
  '## E) Questions', '## F) Legitimacy: high', '## G) Verdict: proceed',
  '---SCORE_SUMMARY---', 'COMPANY: Acme', 'ROLE: Engineer', 'ARCHETYPE: backend',
  'LEGITIMACY: high', 'SCORE: 3.5/5', '---END_SUMMARY---'].join('\n');
const oaiText = (t) => ok({ choices: [{ message: { content: t }, finish_reason: 'stop' }] });
const gemText = (t) => ok({ candidates: [{ content: { parts: [{ text: t }] }, finishReason: 'STOP' }] });

async function post(path, body) {
  const r = await fetch(baseUrl + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch { /* SSE */ }
  return { status: r.status, body: j, text };
}
const sseEvents = (text) => text.split('\n\n').filter(Boolean).map((b) => ({
  event: (b.match(/^event: (.+)$/m) || [])[1],
  data: JSON.parse((b.match(/^data: (.+)$/m) || [, 'null'])[1]),
}));
async function stubPage(handler) {
  const { _setTransport } = await import('../server/lib/safe-fetch.mjs');
  dns.lookup = async () => ({ address: '93.184.216.34', family: 4 });
  restoreTransport = _setTransport(async (u) => {
    const r = await handler(String(u));
    return { status: r.status ?? 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(r.body ?? '') };
  });
}
const JD = 'Senior Backend Engineer at Acme. Go, PostgreSQL, Kubernetes, on-call rotation, code review.';

// ── /api/evaluate + smoke tests ─────────────────────────────────────────────

test('/api/evaluate: short JD 400, manual mode, no-key manual, save writes the JD', async () => {
  assert.equal((await post('/api/evaluate', { jd: 'short' })).status, 400);
  const m = await post('/api/evaluate', { jd: JD, mode: 'manual' });
  assert.equal(m.body.mode, 'manual');
  const n = await post('/api/evaluate', { jd: JD, save: true });
  assert.equal(n.body.mode, 'manual');
  assert.match(n.body.saved, /^jd-.*\.txt$/);
  assert.ok(existsSync(resolve(ROOT, 'jds', n.body.saved)));
});

test('/api/evaluate: Anthropic error 502; success carries the CV truncation warning', async () => {
  process.env.ANTHROPIC_API_KEY = ANT;
  mockProviders({ 'api.anthropic.com': fail('overloaded', 529) });
  const e = await post('/api/evaluate', { jd: JD });
  assert.equal(e.status, 502);
  assert.match(e.body.error, /overloaded/);
  mockProviders({ 'api.anthropic.com': antText('## Block A\nreport') });
  const r = await post('/api/evaluate', { jd: JD });
  assert.equal(r.status, 200);
  assert.ok(r.body.warnings.some((w) => /^cv\.md truncated at \d+ of \d+ characters$/.test(w)), r.body.warnings.join('|'));
  assert.ok(r.body.warnings.includes('missing SCORE_SUMMARY block'));
});

test('/api/evaluate: tail provider error 502 and success', async () => {
  process.env.OPENAI_API_KEY = OAI;
  mockProviders({ 'api.openai.com': fail('quota', 429) });
  assert.equal((await post('/api/evaluate', { jd: JD })).status, 502);
  mockProviders({ 'api.openai.com': oaiText('## Block A\nreport') });
  const r = await post('/api/evaluate', { jd: JD });
  assert.equal(r.body.mode, 'openai');
  assert.ok(r.body.warnings.length > 0);
});

test('/api/evaluate/test-anthropic: no key 400, provider error, ok sample', async () => {
  assert.equal((await post('/api/evaluate/test-anthropic', {})).status, 400);
  process.env.ANTHROPIC_API_KEY = ANT;
  mockProviders({ 'api.anthropic.com': fail('bad key', 401) });
  const e = await post('/api/evaluate/test-anthropic', {});
  assert.equal(e.body.ok, false);
  mockProviders({ 'api.anthropic.com': antText('ok') });
  const r = await post('/api/evaluate/test-anthropic', {});
  assert.deepEqual([r.body.ok, r.body.sample], [true, 'ok']);
});

// ── /api/mode/:slug ─────────────────────────────────────────────────────────

test('/api/mode: unknown slug 404, missing template 404, manual with/without key', async () => {
  assert.equal((await post('/api/mode/nope', {})).status, 404);
  assert.equal((await post('/api/mode/training', {})).status, 404);
  const m = await post('/api/mode/cover', { company: 'Acme' });
  assert.match(m.body.message, /No API key set/);
  process.env.OPENAI_API_KEY = OAI;
  const k = await post('/api/mode/cover', { company: 'Acme' });
  assert.match(k.body.message, /Set \{ run: true \}/);
});

test('/api/mode: provider errors are 502 for Anthropic, Gemini and the tail', async () => {
  process.env.ANTHROPIC_API_KEY = ANT;
  mockProviders({ 'api.anthropic.com': fail('a') });
  assert.equal((await post('/api/mode/cover', { run: true })).status, 502);
  delete process.env.ANTHROPIC_API_KEY;
  process.env.GEMINI_API_KEY = GEM;
  mockProviders({ 'generativelanguage.googleapis.com': fail('g') });
  assert.equal((await post('/api/mode/cover', { run: true })).status, 502);
  delete process.env.GEMINI_API_KEY;
  process.env.OPENAI_API_KEY = OAI;
  mockProviders({ 'api.openai.com': fail('o') });
  assert.equal((await post('/api/mode/cover', { run: true })).status, 502);
});

test('a forced provider without a key falls back to the configured one', async () => {
  process.env.LLM_PROVIDER = 'claude';
  process.env.GEMINI_API_KEY = GEM;
  mockProviders({ 'generativelanguage.googleapis.com': gemText('# letter') });
  const r = await post('/api/mode/cover', { run: true });
  assert.equal(r.body.mode, 'gemini');
  const d = await post('/api/deep', { company: 'Acme', run: true });
  assert.equal(d.body.mode, 'gemini');
});

test('/api/apply-helper: url required; checklist returned', async () => {
  assert.equal((await post('/api/apply-helper', {})).status, 400);
  const r = await post('/api/apply-helper', { url: 'https://x.example/job', jd: 'x'.repeat(700) });
  assert.match(r.body.checklist, /KNOCK-OUT/);
});

// ── /api/auto-pipeline failure paths ───────────────────────────────────────

const pipeline = async (body) => sseEvents((await post('/api/auto-pipeline', body)).text);
const errorOf = (ev) => ev.find((e) => e.event === 'error')?.data;
const LONG = '<p>' + 'We build distributed systems in Go and Rust for payments. '.repeat(6) + '</p>';

test('/api/auto-pipeline: fetch failures stop at step 2', async () => {
  await stubPage(() => ({ status: 404, body: 'nope' }));
  assert.deepEqual(errorOf(await pipeline({ url: 'https://jobs.example.com/a' })), { step: 'fetch', message: 'HTTP 404' });
  await stubPage(() => ({ body: '<p>tiny</p>' }));
  assert.equal(errorOf(await pipeline({ url: 'https://jobs.example.com/b' })).message, 'JD too short');
  await stubPage(() => ({ body: '' }));
  assert.equal(errorOf(await pipeline({ url: 'https://jobs.example.com/c' })).step, 'fetch');
  await stubPage(() => { throw new Error('socket hang up'); });
  assert.equal(errorOf(await pipeline({ url: 'https://jobs.example.com/d' })).message, 'socket hang up');
});

test('/api/auto-pipeline: provider error fails step 3 with its message', async () => {
  await stubPage(() => ({ body: '<h1>Engineer at Acme</h1>' + LONG }));
  process.env.OPENAI_API_KEY = OAI;
  mockProviders({ 'api.openai.com': fail('rate limited', 429) });
  const err = errorOf(await pipeline({ url: 'https://jobs.example.com/e' }));
  assert.equal(err.step, 'evaluate');
  assert.match(err.message, /rate limited/);
});

test('/api/auto-pipeline: "Company — Role" title and hostname fallbacks', async () => {
  process.env.ANTHROPIC_API_KEY = ANT;
  mockProviders({ 'api.anthropic.com': antText(FULL_REPORT) });
  await stubPage(() => ({ body: '<h1>Initrode — Staff Platform Engineer</h1>\n' + LONG }));
  let done = (await pipeline({ url: 'https://jobs.example.com/f' })).find((e) => e.event === 'done').data;
  assert.deepEqual([done.company, done.role, done.score, done.legitimacy], ['Initrode', 'Staff Platform Engineer', 3.5, 'High']);
  // No title line: the company comes from the hostname.
  await stubPage(() => ({ body: LONG + '\n<p>Software engineer wanted</p>' }));
  done = (await pipeline({ url: 'https://careers.globodyne.com/g' })).find((e) => e.event === 'done').data;
  assert.equal(done.company, 'Globodyne');
  // An ATS host is not a company (v1.248.3, CAR follow-up): with no company
  // in the text the run is REJECTED instead of filing an `unknown-role`
  // report — the exact pattern that produced 44 junk `t-role` files on prod.
  await stubPage(() => ({ body: LONG }));
  const ev = await pipeline({ url: 'https://boards.greenhouse.io/x/jobs/1' });
  const err = ev.find((e) => e.event === 'error');
  assert.match(err?.data?.message || '', /company\/role not identifiable|no company\/role hints/);
  assert.equal(err?.data?.rejected, true);
  assert.ok(!ev.some((e) => e.event === 'done'), 'no done event for a nameless entry');
  assert.ok(!readdirSync(resolve(ROOT, 'reports')).some((f) => f.includes('unknown-role')), 'no unknown-role report');
});

test('/api/auto-pipeline: a duplicate company/role row is deduped, not appended', async () => {
  process.env.ANTHROPIC_API_KEY = ANT;
  mockProviders({ 'api.anthropic.com': antText(FULL_REPORT) });
  await stubPage(() => ({ body: '<h1>Dedupe Engineer at Soylent</h1>' + LONG }));
  const a = (await pipeline({ url: 'https://jobs.example.com/h1' })).find((e) => e.event === 'done').data;
  const b = (await pipeline({ url: 'https://jobs.example.com/h2' })).find((e) => e.event === 'done').data;
  assert.equal(a.trackerNum, b.trackerNum);
});

// ── career-plan / market ───────────────────────────────────────────────────

for (const [path, body] of [['/api/career-plan/generate', {}], ['/api/stats/market', { region: 'Berlin', currency: 'eur' }]]) {
  test(`${path}: manual (key / no key), run without provider, provider error`, async () => {
    const m = await post(path, body);
    assert.equal(m.body.mode, 'manual');
    assert.match(m.body.message, /No API key set/);
    const none = await post(path, { ...body, run: true });
    assert.equal(none.body.mode, 'manual');
    process.env.OPENAI_API_KEY = OAI;
    assert.match((await post(path, body)).body.message, /Set \{ run: true \}/);
    mockProviders({ 'api.openai.com': fail('down') });
    assert.equal((await post(path, { ...body, run: true })).status, 502);
  });
}

test('PUT/GET /api/career-plan round-trips the plan', async () => {
  const r = await fetch(`${baseUrl}/api/career-plan`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ markdown: '# Plan' }) });
  assert.equal(r.status, 200);
  assert.equal((await (await fetch(`${baseUrl}/api/career-plan`)).json()).markdown, '# Plan');
});

// ── cv-studio ──────────────────────────────────────────────────────────────

test('cv-studio humanize / tailor: live success, provider error, no provider', async () => {
  const text = 'Responsible for the backend systems and various duties across teams.';
  const jd = 'Senior backend engineer: Go, Postgres, Kafka, ownership of payments services.';
  assert.equal((await post('/api/cv-studio/humanize', { text, run: true })).body.mode, 'manual');
  assert.equal((await post('/api/cv-studio/tailor', { jd, run: true })).body.mode, 'manual');
  process.env.OPENAI_API_KEY = OAI;
  mockProviders({ 'api.openai.com': oaiText('# rewritten') });
  assert.equal((await post('/api/cv-studio/humanize', { text, run: true })).body.markdown, '# rewritten');
  assert.equal((await post('/api/cv-studio/tailor', { jd, run: true })).body.markdown, '# rewritten');
  assert.match((await post('/api/cv-studio/tailor', { jd })).body.message, /Set \{ run: true \}/);
  mockProviders({ 'api.openai.com': fail('down') });
  assert.equal((await post('/api/cv-studio/humanize', { text, run: true })).status, 502);
  assert.equal((await post('/api/cv-studio/tailor', { jd, run: true })).status, 502);
  assert.equal((await post('/api/cv-studio/add-entry', { text: text + ' ' + text, run: true })).status, 502);
});

test('cv-studio add-entry: unsafe URL 400, non-2xx 422, fetch error 422, thin source 400', async () => {
  assert.equal((await post('/api/cv-studio/add-entry', { url: 'http://127.0.0.1/x' })).status, 400);
  await stubPage(() => ({ status: 500, body: 'err' }));
  const a = await post('/api/cv-studio/add-entry', { url: 'https://src.example.com/a' });
  assert.equal(a.status, 422);
  assert.match(a.body.error, /HTTP 500/);
  await stubPage(() => { throw new Error('boom'); });
  assert.equal((await post('/api/cv-studio/add-entry', { url: 'https://src.example.com/b' })).status, 422);
  await stubPage(() => ({ body: '<p>tiny</p>' }));
  assert.equal((await post('/api/cv-studio/add-entry', { url: 'https://src.example.com/c' })).status, 400);
  process.env.OPENAI_API_KEY = OAI;
  assert.match((await post('/api/cv-studio/add-entry', { text: 'x'.repeat(100) })).body.message, /Set \{ run: true \}/);
});

// ── batch ──────────────────────────────────────────────────────────────────

test('GET/PUT /api/batch: missing input, size cap, URL sanity, write + additions', async () => {
  let g = await (await fetch(`${baseUrl}/api/batch`)).json();
  assert.deepEqual([g.exists, g.runnerExists, g.rows, g.additions], [false, false, [], []]);
  const put = (raw) => fetch(`${baseUrl}/api/batch`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ raw }) });
  assert.equal((await put('x'.repeat(1024 * 1024 + 1))).status, 413);
  assert.equal((await put('1\tnot-a-url\tsrc\n')).status, 400);
  const w = await (await put('# comment\n1\thttps://a.example/j\tlinkedin\tnote one\tnote two\n\n')).json();
  assert.deepEqual([w.ok, w.rows], [true, 1]);
  mkdirSync(resolve(ROOT, 'batch', 'tracker-additions'), { recursive: true });
  writeFileSync(resolve(ROOT, 'batch', 'tracker-additions', '001.tsv'), 'row');
  writeFileSync(resolve(ROOT, 'batch', 'tracker-additions', '.hidden'), 'x');
  g = await (await fetch(`${baseUrl}/api/batch`)).json();
  assert.equal(g.rows[0].notes, 'note one\tnote two');
  assert.deepEqual(g.additions.map((a) => a.name), ['001.tsv']);
});

test('/api/stream/batch: missing runner → error + done code 2', async () => {
  const text = await (await fetch(`${baseUrl}/api/stream/batch`)).text();
  assert.match(text, /event: error\ndata: \{"message":"batch\/batch-runner\.sh not found/);
  assert.match(text, /event: done\ndata: \{"code":2\}/);
});

test('/api/stream/batch: validated flags reach the runner; bad ones are dropped', { skip: !posix }, async () => {
  const runner = resolve(ROOT, 'batch', 'batch-runner.sh');
  writeFileSync(runner, '#!/bin/bash\necho "ARGS $*"\necho "warn" >&2\nexit 3\n');
  chmodSync(runner, 0o755);
  const q = 'dryRun=1&parallel=3&minScore=4.0&retry=1&maxRetries=5&model=claude-sonnet-4.6&startFrom=7';
  const text = await (await fetch(`${baseUrl}/api/stream/batch?${q}`)).text();
  const ev = sseEvents(text);
  assert.deepEqual(ev[0].data.args, ['--dry-run', '--parallel', '3', '--min-score', '4.0', '--retry-failed', '--max-retries', '5', '--model', 'claude-sonnet-4.6', '--start-from', '7']);
  assert.ok(ev.some((e) => e.event === 'log' && e.data.stream === 'stderr' && e.data.line === 'warn'));
  assert.deepEqual(ev.at(-1), { event: 'done', data: { code: 3, additions: 1 } });
  const bad = sseEvents(await (await fetch(`${baseUrl}/api/stream/batch?retry=1&maxRetries=99&model=${encodeURIComponent('x;rm -rf')}&startFrom=0&parallel=abc`)).text());
  assert.deepEqual(bad[0].data.args, ['--parallel', '1', '--retry-failed']);
});

test('POST /api/batch/merge runs merge-tracker.mjs (dry run passes the flag)', async () => {
  const r = await post('/api/batch/merge', { dryRun: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.code, 0);
  assert.match(r.body.stdout, /merged --dry-run/);
});
