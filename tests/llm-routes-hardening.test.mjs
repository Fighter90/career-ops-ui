/**
 * v1.241.0 review hardening — the LLM routes.
 *
 *   /api/deep            typed body (400), deep-<unicode-slug>.md namespace with a
 *                        collision suffix, shared cascade (usage recorded),
 *                        cut-off warning; interview-prep list/delete own files only.
 *   /api/evaluate        Gemini subprocess gets --no-save unless `save`; temp JD removed.
 *   /api/evaluate/test-gemini  --no-save always; temp file removed.
 *   /api/auto-pipeline   typed body (400 before SSE), LLM_PROVIDER-aware cascade,
 *                        usage recorded, warnings, empty / cut-off output fails,
 *                        slug collision → the row and `done` point at the real file.
 *   /api/career-plan/generate  typed horizon/focus (400), cut-off warning.
 *   /api/stats/market    cut-off warning.
 *   /api/cv-studio/add-entry   a URL source is read from safeGet's `text`.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT (cv.md, portals.yml, a fake
 * gemini-eval.mjs that records its argv), provider HTTP mocked at the outer
 * boundary (host-matched global fetch), safe-fetch via _setTransport + a DNS
 * stub, server bound to 127.0.0.1. No network, no real keys.
 */
import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promises as dns } from 'node:dns';

const KEYS = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY',
  'OPENROUTER_API_KEY', 'GITHUB_MODELS_API_KEY', 'GITHUB_MODELS_TOKEN', 'LLM_PROVIDER', 'FAKE_GEMINI_EMPTY'];
const ANT = 'sk-ant-fake0123456789abcdefghijklmnop';
const GEM = 'AIzaFakeGeminiKey0123456789abcdefghij';
const OAI = 'sk-fakeopenai0123456789abcdefghijklmn';

let server; let baseUrl; let ROOT; let restoreTransport = null;
const realFetch = globalThis.fetch;
const realLookup = dns.lookup;
const saved = {};

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'llm-routes-hard-'));
  for (const d of ['config', 'data', 'modes', 'output', 'reports', 'interview-prep']) mkdirSync(resolve(ROOT, d), { recursive: true });
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\nSenior backend engineer.\n');
  writeFileSync(resolve(ROOT, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(ROOT, 'data', 'applications.md'), '');
  for (const m of ['_shared', 'oferta', 'deep']) writeFileSync(resolve(ROOT, 'modes', `${m}.md`), `# ${m}\n`);
  // The parent's own interview-prep files — not the deep page's to list/delete.
  writeFileSync(resolve(ROOT, 'interview-prep', 'story-bank.md'), '# Stories\n');
  writeFileSync(resolve(ROOT, 'interview-prep', 'acme-dev.md'), '# Acme prep\n');
  // Fake gemini-eval.mjs: records argv + whether the --file still existed, prints a report.
  writeFileSync(resolve(ROOT, 'gemini-eval.mjs'), [
    "import { appendFileSync, existsSync } from 'node:fs';",
    "const a = process.argv.slice(2);",
    "const f = a[a.indexOf('--file') + 1];",
    "appendFileSync('gemini-argv.jsonl', JSON.stringify({ args: a, fileExisted: existsSync(f) }) + '\\n');",
    "if (!process.env.FAKE_GEMINI_EMPTY) console.log('## Block A\\nGemini report. Score: 4.0/5');",
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
/** Mock provider hosts; everything else (our own server) goes to the real fetch. */
function mockProviders(map) {
  const calls = [];
  globalThis.fetch = async (u, o = {}) => {
    const s = String(u);
    for (const [host, fn] of Object.entries(map)) {
      if (s.includes(host)) { calls.push({ host, body: JSON.parse(o.body) }); return json(fn()); }
    }
    return realFetch(u, o);
  };
  return calls;
}
const anthropicReply = (text, stop = 'end_turn') => () => ({ content: text ? [{ type: 'text', text }] : [], stop_reason: stop, usage: { input_tokens: 11, output_tokens: 7 } });
const openaiReply = (text, finish = 'stop') => () => ({ choices: [{ message: { content: text }, finish_reason: finish }], usage: { prompt_tokens: 5, completion_tokens: 3 } });

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
const usageLines = () => {
  const f = resolve(ROOT, 'data', 'llm-usage.jsonl');
  return existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
};
const geminiCalls = () => {
  const f = resolve(ROOT, 'gemini-argv.jsonl');
  return existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
};
const outputTemps = () => readdirSync(resolve(ROOT, 'output')).filter((f) => /^(web-jd|gemini-smoke|auto-pipeline)-/.test(f));

/** safeGet stubs: public DNS answer + a canned HTML body for any URL. */
async function stubJobPage(html) {
  const { _setTransport } = await import('../server/lib/safe-fetch.mjs');
  dns.lookup = async () => ({ address: '93.184.216.34', family: 4 });
  restoreTransport = _setTransport(async () => ({ status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(html) }));
}

// ── /api/deep ───────────────────────────────────────────────────────────────

test('/api/deep: wrongly typed company/role → 400, not a 500', async () => {
  assert.equal((await post('/api/deep', { company: { toString: 1 } })).status, 400);
  assert.equal((await post('/api/deep', { company: ['Acme'] })).status, 400);
  assert.equal((await post('/api/deep', { company: '   ' })).status, 400);
  assert.equal((await post('/api/deep', { company: 'Acme', role: 42 })).status, 400);
  assert.equal((await post('/api/deep', { company: 'Acme', role: null })).status, 200);
});

test('/api/deep run: deep-<unicode slug>.md, collision suffix, usage, cut-off warning', async () => {
  process.env.ANTHROPIC_API_KEY = ANT;
  const before = usageLines().length;
  mockProviders({ 'api.anthropic.com': anthropicReply('# Яндекс brief', 'max_tokens') });
  const a = await post('/api/deep', { company: 'Яндекс', run: true });
  assert.equal(a.status, 200);
  assert.equal(a.body.mode, 'anthropic');
  assert.equal(a.body.saved, 'deep-яндекс-general.md');
  assert.deepEqual(a.body.warnings, ['brief cut off at the output-token limit']);
  assert.equal(readFileSync(resolve(ROOT, 'interview-prep', 'deep-яндекс-general.md'), 'utf8'), '# Яндекс brief');
  const b = await post('/api/deep', { company: 'Яндекс', run: true });
  assert.equal(b.body.saved, 'deep-яндекс-general-2.md', 'second run does not overwrite the first');
  assert.equal(usageLines().length, before + 2, 'each live run recorded');
  // A different Cyrillic company no longer collides on an ASCII-stripped slug.
  const c = await post('/api/deep', { company: 'Сбербанк', run: true });
  assert.equal(c.body.saved, 'deep-сбербанк-general.md');
});

test('/api/deep run honours LLM_PROVIDER across the whole roster', async () => {
  process.env.ANTHROPIC_API_KEY = ANT;
  process.env.OPENAI_API_KEY = OAI;
  process.env.LLM_PROVIDER = 'openai';
  const calls = mockProviders({ 'api.anthropic.com': anthropicReply('wrong'), 'api.openai.com': openaiReply('# OpenAI brief') });
  const r = await post('/api/deep', { company: 'Stripe', role: 'Backend', run: true });
  assert.equal(r.body.mode, 'openai');
  assert.equal(r.body.warnings, undefined);
  assert.deepEqual(calls.map((c) => c.host), ['api.openai.com']);
  assert.equal(r.body.saved, 'deep-stripe-backend.md');
});

test('/api/deep run: provider error → 502; no key → manual', async () => {
  process.env.ANTHROPIC_API_KEY = ANT;
  mockProviders({ 'api.anthropic.com': anthropicReply('') });
  const r = await post('/api/deep', { company: 'Empty Co', run: true });
  assert.equal(r.status, 502);
  assert.match(r.body.error, /no text/);
  delete process.env.ANTHROPIC_API_KEY;
  const m = await post('/api/deep', { company: 'Empty Co', run: true });
  assert.equal(m.body.mode, 'manual');
});

test('/api/interview-prep lists and deletes only the deep page\'s own files', async () => {
  writeFileSync(resolve(ROOT, 'interview-prep', 'deep-mono-general.md'), '# Mono\n');
  const list = await (await fetch(`${baseUrl}/api/interview-prep`)).json();
  const names = list.files.map((f) => f.name);
  assert.ok(names.includes('deep-mono-general.md'));
  assert.ok(!names.includes('story-bank.md') && !names.includes('acme-dev.md'), names.join(','));
  // Unicode deep name is readable.
  const g = await fetch(`${baseUrl}/api/interview-prep/${encodeURIComponent('deep-яндекс-general.md')}`);
  assert.equal(g.status, 200);
  // Legacy/parent file is still readable but not deletable.
  assert.equal((await fetch(`${baseUrl}/api/interview-prep/acme-dev.md`)).status, 200);
  const d = await fetch(`${baseUrl}/api/interview-prep/story-bank.md`, { method: 'DELETE' });
  assert.equal(d.status, 400);
  assert.ok(existsSync(resolve(ROOT, 'interview-prep', 'story-bank.md')));
  const ok = await fetch(`${baseUrl}/api/interview-prep/deep-mono-general.md`, { method: 'DELETE' });
  assert.equal(ok.status, 200);
  assert.ok(!existsSync(resolve(ROOT, 'interview-prep', 'deep-mono-general.md')));
  const missing = await fetch(`${baseUrl}/api/interview-prep/deep-mono-general.md`, { method: 'DELETE' });
  assert.equal(missing.status, 404);
});

// ── /api/evaluate Gemini subprocess ─────────────────────────────────────────

const JD = 'Senior Backend Engineer at Acme. Go, PostgreSQL, Kubernetes, on-call rotation, code review.';

test('/api/evaluate (Gemini): --no-save unless save, temp JD always removed', async () => {
  process.env.GEMINI_API_KEY = GEM;
  const n = geminiCalls().length;
  const r = await post('/api/evaluate', { jd: JD });
  assert.equal(r.status, 200);
  assert.equal(r.body.mode, 'gemini');
  let call = geminiCalls()[n];
  assert.ok(call.args.includes('--no-save'), call.args.join(' '));
  assert.equal(call.fileExisted, true);
  assert.deepEqual(outputTemps(), []);
  await post('/api/evaluate', { jd: JD, save: true });
  call = geminiCalls()[n + 1];
  assert.ok(!call.args.includes('--no-save'), 'save:true lets the script save');
  assert.deepEqual(outputTemps(), []);
});

test('/api/evaluate/test-gemini: --no-save, temp file removed', async () => {
  process.env.GEMINI_API_KEY = GEM;
  const n = geminiCalls().length;
  const r = await post('/api/evaluate/test-gemini', {});
  assert.equal(r.body.ok, true);
  assert.ok(geminiCalls()[n].args.includes('--no-save'));
  assert.deepEqual(outputTemps(), []);
  delete process.env.GEMINI_API_KEY;
  assert.equal((await post('/api/evaluate/test-gemini', {})).status, 400);
});

// ── /api/auto-pipeline ──────────────────────────────────────────────────────

const JOB_URL = 'https://jobs.example.com/acme/123';
const JOB_HTML = '<html><body><h1>Platform Engineer at Acme</h1><p>' + 'We build distributed systems in Go. '.repeat(10) + '</p></body></html>';
const GOOD_REPORT = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((L) => `## Block ${L} — x\nok\n`).join('')
  + '\n---SCORE_SUMMARY---\nCOMPANY: Acme\nROLE: Platform Engineer\nSCORE: 4.2\nARCHETYPE: Platform\nLEGITIMACY: High Confidence\n---END_SUMMARY---\n';

test('/api/auto-pipeline: wrongly typed fields → JSON 400 before the stream', async () => {
  for (const body of [{ url: { toString: 1 } }, { url: ['x'] }, { url: JOB_URL, lang: { a: 1 } }, { url: JOB_URL, mode: 7 }, { url: JOB_URL, evalMode: [] }]) {
    const r = await post('/api/auto-pipeline', body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.match(r.body.error, /must be a string/);
  }
});

test('/api/auto-pipeline: LLM_PROVIDER-aware cascade, usage, slug collision → real report path', async () => {
  await stubJobPage(JOB_HTML);
  process.env.ANTHROPIC_API_KEY = ANT;
  process.env.OPENAI_API_KEY = OAI;
  process.env.LLM_PROVIDER = 'openai';
  const calls = mockProviders({ 'api.anthropic.com': anthropicReply('wrong'), 'api.openai.com': openaiReply(GOOD_REPORT) });
  const first = sseEvents((await post('/api/auto-pipeline', { url: JOB_URL })).text);
  const done1 = first.find((e) => e.event === 'done').data;
  assert.equal(done1.evalMode, 'openai');
  assert.deepEqual([...new Set(calls.map((c) => c.host))], ['api.openai.com']);
  assert.equal(calls[0].body.max_completion_tokens, 16384);
  assert.ok(usageLines().some((u) => u.provider === 'openai'));
  assert.ok(existsSync(resolve(ROOT, done1.reportPath)));

  // Same company/role/day again: the report is written under a suffixed slug
  // and the done event + tracker row must name THAT file.
  const second = sseEvents((await post('/api/auto-pipeline', { url: JOB_URL })).text);
  const done2 = second.find((e) => e.event === 'done').data;
  assert.notEqual(done2.slug, done1.slug);
  assert.equal(done2.reportPath, `reports/${done2.slug}.md`);
  assert.ok(existsSync(resolve(ROOT, done2.reportPath)));
  const activity = readFileSync(resolve(ROOT, 'data', 'activity.jsonl'), 'utf8');
  assert.match(activity, /"action":"auto-pipeline.report.saved"/);
  assert.match(activity, /"action":"auto-pipeline.tracker.added"/);
});

test('/api/auto-pipeline: the tracker row of a deduped report links the written file', async () => {
  await stubJobPage(JOB_HTML.replace('Acme', 'Globex'));
  process.env.OPENAI_API_KEY = OAI;
  mockProviders({ 'api.openai.com': openaiReply(GOOD_REPORT) });
  const d1 = sseEvents((await post('/api/auto-pipeline', { url: 'https://jobs.example.com/globex/1' })).text).find((e) => e.event === 'done').data;
  // Remove the row so the next run appends a fresh one instead of deduping.
  const apps = resolve(ROOT, 'data', 'applications.md');
  writeFileSync(apps, readFileSync(apps, 'utf8').split('\n').filter((l) => !l.includes('Globex')).join('\n'));
  const d2 = sseEvents((await post('/api/auto-pipeline', { url: 'https://jobs.example.com/globex/2' })).text).find((e) => e.event === 'done').data;
  assert.notEqual(d2.slug, d1.slug);
  const row = readFileSync(apps, 'utf8').split('\n').find((l) => l.includes('Globex'));
  assert.ok(row.includes(`[${d2.slug}](reports/${d2.slug}.md)`), row);
});

test('/api/auto-pipeline: evaluation warnings reach the done event', async () => {
  await stubJobPage(JOB_HTML.replace('Acme', 'Initech'));
  process.env.ANTHROPIC_API_KEY = ANT;
  mockProviders({ 'api.anthropic.com': anthropicReply('## Block A\nOnly one block. Score: 3/5') });
  const done = sseEvents((await post('/api/auto-pipeline', { url: 'https://jobs.example.com/initech/1' })).text).find((e) => e.event === 'done').data;
  assert.equal(done.evalMode, 'anthropic');
  assert.ok(done.warnings.includes('missing SCORE_SUMMARY block'), JSON.stringify(done.warnings));
});

test('/api/auto-pipeline: a cut-off evaluation fails step 3 and writes nothing', async () => {
  await stubJobPage(JOB_HTML.replace('Acme', 'Umbrella'));
  process.env.ANTHROPIC_API_KEY = ANT;
  mockProviders({ 'api.anthropic.com': anthropicReply('## Block A\nhalf', 'max_tokens') });
  const ev = sseEvents((await post('/api/auto-pipeline', { url: 'https://jobs.example.com/umbrella/1' })).text);
  const err = ev.find((e) => e.event === 'error');
  assert.equal(err.data.step, 'evaluate');
  assert.match(err.data.message, /cut off/);
  assert.ok(!ev.some((e) => e.event === 'done'));
  assert.ok(!readdirSync(resolve(ROOT, 'reports')).some((f) => f.includes('umbrella')));
});

test('/api/auto-pipeline: an empty evaluation fails (provider 200 without text)', async () => {
  await stubJobPage(JOB_HTML.replace('Acme', 'Hooli'));
  process.env.ANTHROPIC_API_KEY = ANT;
  mockProviders({ 'api.anthropic.com': anthropicReply('') });
  const ev = sseEvents((await post('/api/auto-pipeline', { url: 'https://jobs.example.com/hooli/1' })).text);
  assert.equal(ev.find((e) => e.event === 'error').data.step, 'evaluate');
  assert.ok(!readdirSync(resolve(ROOT, 'reports')).some((f) => f.includes('hooli')));
});

test('/api/auto-pipeline mode:gemini: --no-save, temp removed, empty stdout fails', async () => {
  await stubJobPage(JOB_HTML.replace('Acme', 'Vandelay'));
  process.env.GEMINI_API_KEY = GEM;
  const n = geminiCalls().length;
  const ok = sseEvents((await post('/api/auto-pipeline', { url: 'https://jobs.example.com/vandelay/1', mode: 'gemini' })).text);
  assert.ok(ok.some((e) => e.event === 'done'));
  assert.ok(geminiCalls()[n].args.includes('--no-save'));
  assert.deepEqual(outputTemps(), []);
  process.env.FAKE_GEMINI_EMPTY = '1';
  const empty = sseEvents((await post('/api/auto-pipeline', { url: 'https://jobs.example.com/vandelay/2', mode: 'gemini' })).text);
  assert.match(empty.find((e) => e.event === 'error').data.message, /empty evaluation/);
});

test('/api/auto-pipeline: pinned anthropic without a key / no key at all fail step 3', async () => {
  await stubJobPage(JOB_HTML);
  const pinned = sseEvents((await post('/api/auto-pipeline', { url: JOB_URL, mode: 'anthropic' })).text);
  assert.equal(pinned.find((e) => e.event === 'error').data.message, 'no LLM key');
  const none = sseEvents((await post('/api/auto-pipeline', { url: JOB_URL })).text);
  assert.equal(none.find((e) => e.event === 'error').data.message, 'no LLM key');
});

// ── career-plan / market / cv-studio ───────────────────────────────────────

test('/api/career-plan/generate: wrongly typed horizon/focus → 400', async () => {
  assert.equal((await post('/api/career-plan/generate', { horizon: { toString: 1 } })).status, 400);
  assert.equal((await post('/api/career-plan/generate', { horizon: ['6'] })).status, 400);
  assert.equal((await post('/api/career-plan/generate', { focus: ['x'] })).status, 400);
  const ok = await post('/api/career-plan/generate', { horizon: 6, focus: 'staff track' });
  assert.equal(ok.status, 200);
  assert.match(ok.body.prompt, /PLANNING HORIZON: 6 months/);
  const { normalizeHorizon } = await import('../server/lib/routes/career-plan.mjs');
  assert.equal(normalizeHorizon({ toString: 1 }), '12');
  assert.equal(normalizeHorizon(['6']), '12');
  assert.equal(normalizeHorizon(24), '24');
});

test('career-plan and market name a cut-off answer', async () => {
  process.env.OPENAI_API_KEY = OAI;
  mockProviders({ 'api.openai.com': openaiReply('# partial', 'length') });
  const plan = await post('/api/career-plan/generate', { run: true });
  assert.equal(plan.status, 200);
  assert.deepEqual(plan.body.warnings, ['plan cut off at the output-token limit']);
  const market = await post('/api/stats/market', { run: true });
  assert.deepEqual(market.body.warnings, ['report cut off at the output-token limit']);
  mockProviders({ 'api.openai.com': openaiReply('# whole') });
  assert.equal((await post('/api/stats/market', { run: true })).body.warnings, undefined);
});

test('/api/cv-studio/add-entry reads a URL source from safeGet `text`', async () => {
  await stubJobPage('<html><body><h2>Project Kestrel</h2><p>' + 'An open-source Rust scheduler for batch GPU jobs. '.repeat(4) + '</p><script>evil()</script></body></html>');
  const r = await post('/api/cv-studio/add-entry', { url: 'https://github.example.com/me/kestrel' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.mode, 'manual');
  assert.match(r.body.prompt, /Project Kestrel/);
  assert.match(r.body.prompt, /Rust scheduler/);
  assert.doesNotMatch(r.body.prompt, /evil\(\)/);
});

test('cv-studio names a cut-off answer', async () => {
  process.env.OPENAI_API_KEY = OAI;
  mockProviders({ 'api.openai.com': openaiReply('# cut', 'length') });
  const r = await post('/api/cv-studio/add-entry', { text: 'Built an open-source Rust scheduler for batch GPU jobs used by three research labs.', run: true });
  assert.deepEqual(r.body.warnings, ['answer cut off at the output-token limit']);
});
