/**
 * Opus 5-5 review round on CAR-92 — auto-pipeline findings.
 *
 *   R3. The gemini-eval.mjs subprocess was spawned WITHOUT the route's abort
 *       signal — a disconnected client still burned up to 300 s of Gemini
 *       spend (the runner's kill plumbing existed; nobody passed the signal).
 *   R5. The gemini subprocess prints the parent's oferta report, whose
 *       ---SCORE_SUMMARY--- block only exists when the model (or the script's
 *       prompt) asks for one — the parent copy deployed on the server predates
 *       the summary prompt. With the summary missing, every such evaluation
 *       was rejected as "no SCORE 0–5" even though the body carries
 *       `**Score:** 4.2/5`. The gemini path now synthesizes the summary from
 *       the body (extractBodyScore + report header + the JD guess), so the
 *       shared validator/extractor keep one code path.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT with a FAKE gemini-eval.mjs (records
 * argv; hang/sigterm mode), JD fetch stubbed via safe-fetch's transport + a
 * DNS stub, server bound to 127.0.0.1. No network, no keys.
 */
import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promises as dns } from 'node:dns';

const KEYS = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'LLM_PROVIDER', 'FAKE_GEMINI_HANG'];
const GEM = 'AIzaFakeGeminiKey0123456789abcdefghij';

// The parent's oferta shape WITHOUT the machine summary block — the deployed
// server's gemini-eval.mjs predates the summary prompt. The score lives in
// the body only.
const OLD_FORMAT_REPORT = [
  '## A) Context', 'Acme is hiring.',
  '## B) Fit', 'Matches the CV.',
  '## C) Risks', 'On-call load.',
  '## D) Salary', 'Estimates only.',
  '## E) Questions', 'Team topology?',
  '## F) Red Flags', 'None found. Legitimacy: High Confidence',
  '## G) Verdict', 'Proceed.',
  '**Score:** 4.2/5',
].join('\n');

let server; let baseUrl; let ROOT; let restoreTransport = null;
const realFetch = globalThis.fetch;
const realLookup = dns.lookup;
const saved = {};

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'auto-pipeline-opus-'));
  for (const d of ['config', 'data', 'modes', 'output', 'reports']) mkdirSync(resolve(ROOT, d), { recursive: true });
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\nSenior backend engineer.\n');
  writeFileSync(resolve(ROOT, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(ROOT, 'data', 'applications.md'), '');
  for (const m of ['_shared', 'oferta']) writeFileSync(resolve(ROOT, 'modes', `${m}.md`), `# ${m}\n`);
  // Fake gemini-eval.mjs: argv recorder + a hang mode that logs SIGTERM, so
  // the abort test can observe the child actually being killed.
  writeFileSync(resolve(ROOT, 'gemini-eval.mjs'), [
    "import { appendFileSync } from 'node:fs';",
    "appendFileSync('gemini-argv.jsonl', JSON.stringify({ args: process.argv.slice(2) }) + '\\n');",
    "if (process.env.FAKE_GEMINI_HANG) {",
    "  appendFileSync('gemini-events.jsonl', JSON.stringify({ ev: 'start' }) + '\\n');",
    "  process.on('SIGTERM', () => { appendFileSync('gemini-events.jsonl', JSON.stringify({ ev: 'sigterm' }) + '\\n'); process.exit(0); });",
    "  setTimeout(() => {}, 15000); // hang until killed",
    "} else {",
    `  console.log(${JSON.stringify(OLD_FORMAT_REPORT)});`,
    "}",
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
  rmSync(resolve(ROOT, 'gemini-events.jsonl'), { force: true });
  rmSync(resolve(ROOT, 'gemini-argv.jsonl'), { force: true });
});
afterEach(() => {
  globalThis.fetch = realFetch;
  dns.lookup = realLookup;
  if (restoreTransport) { restoreTransport(); restoreTransport = null; }
});

const JOB_URL = 'https://jobs.example.com/acme/42';
const JOB_HTML = '<html><body><h1>Platform Engineer at Acme</h1><p>' + 'We build distributed systems in Go. '.repeat(10) + '</p></body></html>';

async function stubJobPage(html) {
  const { _setTransport } = await import('../server/lib/safe-fetch.mjs');
  dns.lookup = async () => ({ address: '93.184.216.34', family: 4 });
  restoreTransport = _setTransport(async () => ({ status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(html) }));
}

const sseEvents = (text) => text.split('\n\n').filter(Boolean).map((b) => ({
  event: (b.match(/^event: (.+)$/m) || [])[1],
  data: JSON.parse((b.match(/^data: (.+)$/m) || [, 'null'])[1]),
}));

const geminiEvents = () => {
  const f = resolve(ROOT, 'gemini-events.jsonl');
  return existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
};

// ── R3 — a client disconnect kills the gemini subprocess ─────────────────────

test('R3: aborting the request kills the gemini-eval.mjs child (SIGTERM observed)', async () => {
  await stubJobPage(JOB_HTML);
  process.env.FAKE_GEMINI_HANG = '1';

  const clientCtrl = new AbortController();
  const resp = await fetch(baseUrl + '/api/auto-pipeline', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: JOB_URL, mode: 'gemini' }),
    signal: clientCtrl.signal,
  });
  // Stream the SSE until the evaluate step starts (the child is up), then hang up.
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    if (buf.includes('"key":"evaluate"') && buf.includes('"status":"running"')) break;
  }
  // Wait until the child has booted (its own SIGTERM handler installed) — an
  // earlier abort would still kill it (the default disposition), just without
  // anything to log it with.
  for (let i = 0; i < 60 && !geminiEvents().some((e) => e.ev === 'start'); i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  clientCtrl.abort();
  // The kill is SIGTERM → the fake script logs it and exits. Give it a moment.
  let killed = false;
  for (let i = 0; i < 60 && !killed; i++) {
    await new Promise((r) => setTimeout(r, 50));
    killed = geminiEvents().some((e) => e.ev === 'sigterm');
  }
  assert.ok(killed, 'the subprocess must observe SIGTERM when the client disconnects');
  reader.cancel().catch(() => {});
});

// ── R5 — the gemini path reads the score from the report body ────────────────

test('R5: a summary-less gemini report with a body «**Score:** 4.2/5» completes with that score', async () => {
  await stubJobPage(JOB_HTML);
  const ev = sseEvents((await fetch(baseUrl + '/api/auto-pipeline', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: JOB_URL, mode: 'gemini' }),
  }).then((r) => r.text())));
  const done = ev.find((e) => e.event === 'done');
  assert.ok(done, `the run completes — events: ${JSON.stringify(ev.map((e) => [e.event, e.data?.message]))}`);
  assert.equal(done.data.score, 4.2, 'the body score is the score');
  assert.equal(done.data.evalMode, 'gemini');
  // The tracker row carries the score too.
  const tracker = readFileSync(resolve(ROOT, 'data', 'applications.md'), 'utf8');
  assert.match(tracker, /\| 4\.2\/5 \|/, 'the tracker row shows 4.2/5');
  // The saved report drops the machine block (synthesized or not).
  const reports = existsSync(resolve(ROOT, 'reports')) ? readdirSync(resolve(ROOT, 'reports')) : [];
  const savedReport = reports.map((f) => readFileSync(resolve(ROOT, 'reports', f), 'utf8')).join('\n');
  assert.ok(!savedReport.includes('SCORE_SUMMARY'), 'the synthesized summary block is stripped before saving');
});

test('R5: a gemini report with no score anywhere is still rejected (the gate holds)', async () => {
  await stubJobPage(JOB_HTML);
  // The same fixture without its score line — the validation gate must still
  // stop a report with no score at all (body or summary).
  const orig = readFileSync(resolve(ROOT, 'gemini-eval.mjs'), 'utf8');
  writeFileSync(resolve(ROOT, 'gemini-eval.mjs'), orig.replace("**Score:** 4.2/5", 'no score line here'));
  const ev = sseEvents((await fetch(baseUrl + '/api/auto-pipeline', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: JOB_URL, mode: 'gemini' }),
  }).then((r) => r.text())));
  const err = ev.find((e) => e.event === 'error');
  assert.ok(err, 'no score → rejected');
  assert.match(err.data.message, /no SCORE 0–5/);
});
