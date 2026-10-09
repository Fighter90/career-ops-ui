/**
 * v1.248.2 — the auto-pipeline JD floor is 200 chars, not 50.
 *
 * The prod eval timer fed pipeline placeholder entries
 * (https://example.com/qa-v167-…) to the evaluation; the short model
 * answers ("Insufficient JD…") were still saved as
 * reports/<date>-t-role-<ts>.md and the dashboard showed the newest one
 * as "Last evaluation". The gate now stops BEFORE the LLM call: SSE
 * error event (never a 500), a server-console warning carrying the URL
 * and the reason, and NO report file / tracker row.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT, page fetch via _setTransport +
 * a DNS stub, provider HTTP mocked on global fetch, 127.0.0.1 only.
 * Without the fix the short-body run reaches the mocked provider and
 * writes a report — every assertion here goes red on the old code.
 */
import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promises as dns } from 'node:dns';

const KEYS = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY',
  'OPENROUTER_API_KEY', 'GITHUB_MODELS_API_KEY', 'GITHUB_MODELS_TOKEN', 'LLM_PROVIDER', 'HUGGINGFACE_API_KEY'];
const OAI = 'sk-fakeopenai0123456789abcdefghijklmn';
const savedEnv = {};
let server; let baseUrl; let ROOT; let restoreTransport = null;
const realFetch = globalThis.fetch;
const realLookup = dns.lookup;

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'auto-pipe-jd-gate-'));
  for (const d of ['config', 'data', 'modes', 'output', 'reports']) mkdirSync(resolve(ROOT, d), { recursive: true });
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\n\nSenior backend engineer, 10 years.\n');
  writeFileSync(resolve(ROOT, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(ROOT, 'data', 'applications.md'), '# Applications Tracker\n');
  writeFileSync(resolve(ROOT, 'modes', 'oferta.md'), '# Oferta\n');
  writeFileSync(resolve(ROOT, 'modes', '_shared.md'), '# Shared\n');
  for (const k of KEYS) { savedEnv[k] = process.env[k]; delete process.env[k]; }
  process.env.CAREER_OPS_ROOT = ROOT;
  const { createApp } = await import('../server/index.mjs');
  ({ _setTransport } = await import('../server/lib/safe-fetch.mjs'));
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(async () => {
  globalThis.fetch = realFetch;
  dns.lookup = realLookup;
  if (restoreTransport) restoreTransport();
  for (const k of KEYS) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
  delete process.env.CAREER_OPS_ROOT;
  await new Promise((r) => server.close(r));
  try { rmSync(ROOT, { recursive: true, force: true }); } catch {}
});

let _setTransport;

beforeEach(() => {
  globalThis.fetch = realFetch;
  // Start each case from an empty reports/ so "no report was written" is meaningful.
  for (const f of readdirSync(resolve(ROOT, 'reports'))) rmSync(resolve(ROOT, 'reports', f));
});

afterEach(() => {
  globalThis.fetch = realFetch;
  dns.lookup = realLookup;
  if (restoreTransport) { restoreTransport(); restoreTransport = null; }
});

/** Stub the page fetch + provider HTTP; drain the SSE stream into events. */
async function run(body, providerBody) {
  const { _setTransport: set } = await import('../server/lib/safe-fetch.mjs');
  dns.lookup = async () => ({ address: '93.184.216.34', family: 4 });
  restoreTransport = set(async () => ({ status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(PAGE_BODY) }));
  globalThis.fetch = async (u, o = {}) => {
  const host = (() => { try { return new URL(String(u)).hostname; } catch { return ''; } })();
  if (host === 'api.openai.com') {
      return new Response(JSON.stringify({ choices: [{ message: { content: providerBody }, finish_reason: 'stop' }] }),
        { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(u, o);
  };
  process.env.OPENAI_API_KEY = OAI;
  const resp = await fetch(baseUrl + '/api/auto-pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  const events = text.split('\n\n').filter(Boolean).map((b) => ({
    event: (b.match(/^event: (.+)$/m) || [])[1],
    data: JSON.parse((b.match(/^data: (.+)$/m) || [, 'null'])[1]),
  }));
  return { status: resp.status, events, text };
}

// What a placeholder page yields after HTML stripping: more than the old
// 50-char floor, far below any real JD (~1 KB+).
const PAGE_BODY = '<html><body>Example Domain. This domain is for use in illustrative examples in documents.</body></html>';
// The junk the timer used to persist (what the model answers to a non-JD page).
const JUNK_ANSWER = 'Insufficient JD information to evaluate.';

const SANITIZED_LEN = 'Example Domain. This domain is for use in illustrative examples in documents.'.length;

test('placeholder page (<200 chars): SSE error at fetch, NO report file, console warning with the host', async () => {
  assert.ok(SANITIZED_LEN >= 50 && SANITIZED_LEN < 200, `fixture must sit between the old and new gates, got ${SANITIZED_LEN}`);
  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...a) => warnings.push(a.join(' '));
  let out;
  try { out = await run({ url: 'https://example.com/qa-v167-t-role' }, JUNK_ANSWER); }
  finally { console.warn = origWarn; }

  // Meaningful API answer: SSE error event for the fetch step — never a 500.
  assert.equal(out.status, 200);
  const err = out.events.find((e) => e.event === 'error');
  assert.ok(err, 'expected an SSE error event');
  assert.equal(err.data.step, 'fetch');
  assert.equal(err.data.message, 'JD too short');
  assert.ok(!out.events.some((e) => e.event === 'done'), 'no done event');

  // The core regression: no report file at all.
  const reports = readdirSync(resolve(ROOT, 'reports'));
  assert.deepEqual(reports, [], `no report may be written for a placeholder JD, got ${reports.join(', ')}`);
  // And no tracker row either (the tracker still holds only its header).
  const apps = readFileSync(resolve(ROOT, 'data', 'applications.md'), 'utf8');
  assert.ok(!apps.includes('Example'), 'no tracker row for the placeholder run');

  // Server-console warning carries the URL + the reason, nothing else.
  const hit = warnings.find((w) => w.includes('host: example.com'));
  assert.ok(hit, `expected a console warning naming the host, got: ${warnings.join(' | ')}`);
  assert.match(hit, /JD too short|200/);
  // Never the page text or the model answer.
  assert.ok(!warnings.join(' ').includes('illustrative examples'));
  assert.ok(!warnings.join(' ').includes(JUNK_ANSWER));
});

test('control: a real-size JD passes the gate (reaches the evaluate step)', async () => {
  const long = ('We are looking for a Senior Platform Engineer to own our Kubernetes platform. '
    + 'You will design CI/CD pipelines, run AWS infrastructure with Terraform and improve observability. ').repeat(4);
  const { _setTransport: set } = await import('../server/lib/safe-fetch.mjs');
  dns.lookup = async () => ({ address: '93.184.216.34', family: 4 });
  restoreTransport = set(async () => ({ status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(`<p>${long}</p>`) }));
  // No provider key at all: the run must get PAST the fetch gate and fail at
  // the evaluate step with the no-key message — proving the gate is not over-blocking.
  globalThis.fetch = realFetch;
  delete process.env.OPENAI_API_KEY;
  const resp = await fetch(baseUrl + '/api/auto-pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://jobs.example.com/real-1' }),
  });
  const text = await resp.text();
  const err = text.split('\n\n').map((b) => ({
    event: (b.match(/^event: (.+)$/m) || [])[1],
    data: JSON.parse((b.match(/^data: (.+)$/m) || [, 'null'])[1]),
  })).find((e) => e.event === 'error');
  assert.ok(err, 'expected an error event');
  assert.equal(err.data.step, 'evaluate', 'a real-size JD must clear the fetch gate');
  assert.equal(err.data.message, 'no LLM key');
});
