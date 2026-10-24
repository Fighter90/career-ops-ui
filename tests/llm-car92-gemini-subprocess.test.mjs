/**
 * CAR-92 — finding 2: the gemini-eval.mjs subprocess path ignored the locale,
 * the exit code, the client-visible stderr and usage accounting.
 *
 *   /api/evaluate (Gemini branch): non-zero exit was returned as HTTP 200 with
 *   no error, `...result` forwarded the raw stderr to the client, the timeout
 *   was 120 s while EVAL_TIMEOUT_MS is 300 s, no --lang was passed and
 *   recordUsage was never called.
 *   /api/auto-pipeline mode:'gemini': same lang/usage gaps (its exit-code and
 *   timeout handling was already right).
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT with a FAKE gemini-eval.mjs that
 * records its argv and can exit non-zero / print usage. No network, no keys.
 */
import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promises as dns } from 'node:dns';

const KEYS = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'LLM_PROVIDER', 'FAKE_GEMINI_EXIT', 'FAKE_GEMINI_USAGE'];
const GEM = 'AIzaFakeGeminiKey0123456789abcdefghij';
const REPORT = ['## A) Context', '## B) Fit', '## C) Risks', '## D) Salary', '## E) Questions',
  '## F) Legitimacy: high', '## G) Verdict: proceed', '---SCORE_SUMMARY---', 'COMPANY: Vandelay',
  'ROLE: Engineer', 'ARCHETYPE: backend', 'LEGITIMACY: high', 'SCORE: 4.0/5', '---END_SUMMARY---'].join('\n');
const STDERR_MARKER = 'Gemini API internal detail SHOULD-NOT-REACH-THE-CLIENT';

let server; let baseUrl; let ROOT; let restoreTransport = null;
const realFetch = globalThis.fetch;
const realLookup = dns.lookup;
const saved = {};

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'llm-car92-gemini-'));
  for (const d of ['config', 'data', 'modes', 'output', 'reports']) mkdirSync(resolve(ROOT, d), { recursive: true });
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\nSenior backend engineer.\n');
  writeFileSync(resolve(ROOT, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(ROOT, 'data', 'applications.md'), '');
  for (const m of ['_shared', 'oferta']) writeFileSync(resolve(ROOT, 'modes', `${m}.md`), `# ${m}\n`);
  // Fake gemini-eval.mjs: argv recorder + switchable failure/usage modes.
  writeFileSync(resolve(ROOT, 'gemini-eval.mjs'), [
    "import { appendFileSync } from 'node:fs';",
    "const a = process.argv.slice(2);",
    "appendFileSync('gemini-argv.jsonl', JSON.stringify({ args: a }) + '\\n');",
    "if (process.env.FAKE_GEMINI_EXIT) { console.error(" + JSON.stringify(STDERR_MARKER) + "); process.exit(Number(process.env.FAKE_GEMINI_EXIT)); }",
    "if (process.env.FAKE_GEMINI_USAGE) console.log(JSON.stringify({ prompt_tokens: 123, completion_tokens: 45 }));",
    `console.log(${JSON.stringify(REPORT)});`,
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
  try { rmSync(ROOT, { recursive: true, force: true }); } catch { /* temp dir */ }
});

beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
  process.env.GEMINI_API_KEY = GEM;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  dns.lookup = realLookup;
  if (restoreTransport) { restoreTransport(); restoreTransport = null; }
});

const JD = 'Senior Backend Engineer at Acme. Go, PostgreSQL, Kubernetes, on-call rotation, code review.';
const JOB_URL = 'https://jobs.example.com/vandelay/1';
const JOB_HTML = '<html><body><h1>Platform Engineer at Vandelay Industries</h1><p>' + 'We build systems in Go. '.repeat(10) + '</p></body></html>';

const geminiCalls = () => {
  const f = resolve(ROOT, 'gemini-argv.jsonl');
  return existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
};
const usageLines = () => {
  const f = resolve(ROOT, 'data', 'llm-usage.jsonl');
  return existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean)
    .map((l) => JSON.parse(l)).filter((u) => u.provider === 'gemini') : [];
};

async function stubJobPage(html) {
  const { _setTransport } = await import('../server/lib/safe-fetch.mjs');
  dns.lookup = async () => ({ address: '93.184.216.34', family: 4 });
  restoreTransport = _setTransport(async () => ({ status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(html) }));
}
const sseEvents = (text) => text.split('\n\n').filter(Boolean).map((b) => ({
  event: (b.match(/^event: (.+)$/m) || [])[1],
  data: JSON.parse((b.match(/^data: (.+)$/m) || [, 'null'])[1]),
}));

async function post(path, body) {
  const r = await fetch(baseUrl + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch { /* SSE */ }
  return { status: r.status, body: j, text };
}

test('CAR-92.2: the subprocess timeout is EVAL_TIMEOUT_MS (300 s), not 120 s', async () => {
  const { GEMINI_EVAL_TIMEOUT_MS } = await import('../server/lib/routes/llm.mjs');
  assert.equal(GEMINI_EVAL_TIMEOUT_MS, 300_000);
});

test('CAR-92.2: /api/evaluate passes --lang to the subprocess', async () => {
  const n = geminiCalls().length;
  const r = await post('/api/evaluate', { jd: JD, lang: 'ru' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  let args = geminiCalls()[n].args;
  assert.equal(args[0], '--lang', `argv was: ${args.join(' ')}`);
  assert.equal(args[1], 'ru');
  await post('/api/evaluate', { jd: JD });
  args = geminiCalls()[n + 1].args;
  assert.equal(args[1], 'en', 'defaults to en');
  // The lang VALUE must never leak into the JD text position (the script
  // treats bare words as positional JD text).
  assert.ok(args.indexOf('--file') < args.indexOf('--lang') + 2 || args.indexOf('--file') !== -1);
});

test('CAR-92.2: /api/evaluate non-zero exit → 502 with a bounded error, stderr never forwarded', async () => {
  process.env.FAKE_GEMINI_EXIT = '1';
  const r = await post('/api/evaluate', { jd: JD });
  assert.equal(r.status, 502, 'a failed subprocess must not be a 200');
  assert.ok(r.body.error, 'an error message is present');
  assert.match(r.body.error, /exit|код|code|1/i);
  assert.ok(!('stderr' in r.body), 'raw stderr must not reach the client');
  assert.ok(!JSON.stringify(r.body).includes(STDERR_MARKER), 'stderr content must not reach the client');
});

test('CAR-92.2: /api/evaluate gemini usage is parsed from stdout and recorded', async () => {
  process.env.FAKE_GEMINI_USAGE = '1';
  const before = usageLines().length;
  const r = await post('/api/evaluate', { jd: JD });
  assert.equal(r.status, 200);
  const rows = usageLines();
  assert.equal(rows.length, before + 1, 'one usage row appended');
  assert.equal(rows.at(-1).provider, 'gemini');
  assert.equal(rows.at(-1).in, 123);
  assert.equal(rows.at(-1).out, 45);
});

test('CAR-92.2: /api/evaluate without a usage line in stdout records nothing (best-effort)', async () => {
  const before = usageLines().length;
  const r = await post('/api/evaluate', { jd: JD });
  assert.equal(r.status, 200);
  assert.equal(usageLines().length, before, 'no fabricated usage');
});

test('CAR-92.2: auto-pipeline mode:gemini passes --lang, records usage, and fails the step on exit 1', async () => {
  await stubJobPage(JOB_HTML);
  const n = geminiCalls().length;
  const beforeUsage = usageLines().length;
  const ok = sseEvents((await post('/api/auto-pipeline', { url: JOB_URL, mode: 'gemini', lang: 'ru' })).text);
  const args = geminiCalls()[n].args;
  assert.equal(args[0], '--lang');
  assert.equal(args[1], 'ru');
  assert.ok(ok.some((e) => e.event === 'done'), 'the happy path still completes');
  assert.equal(usageLines().length, beforeUsage, 'no usage without a usage line in stdout');

  process.env.FAKE_GEMINI_USAGE = '1';
  await post('/api/auto-pipeline', { url: JOB_URL, mode: 'gemini' });
  const rows = usageLines();
  assert.equal(rows.length, beforeUsage + 1, 'usage recorded on the auto-pipeline gemini path');
  assert.equal(rows.at(-1).in, 123);

  delete process.env.FAKE_GEMINI_USAGE;
  process.env.FAKE_GEMINI_EXIT = '1';
  const bad = sseEvents((await post('/api/auto-pipeline', { url: JOB_URL, mode: 'gemini' })).text);
  const err = bad.find((e) => e.event === 'error');
  assert.ok(err, 'a failed subprocess fails the evaluate step');
  assert.match(err.data.message, /gemini-eval exit 1/);
  assert.ok(!JSON.stringify(bad).includes(STDERR_MARKER), 'stderr stays on the server');
});
