/**
 * v1.16.0 — Server-side POST /api/auto-pipeline SSE (G-007 follow-up).
 *
 * Covers:
 *   - URL validation gate (step 1 fails → SSE error event)
 *   - No-LLM-key path (step 3 reaches "manual" mode → SSE error event)
 *   - Tracker row append (step 5 with mock JD fetched from an injected HTML)
 *
 * We don't invoke the live LLM here — the unit test asserts the SSE
 * framing + gate behaviour. End-to-end LLM coverage lives in the
 * comprehensive e2e suite which exercises Anthropic against a real key.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promises as dns } from 'node:dns';

let server;
let baseUrl;
let dir;
let restoreTransport = null;
const origLookup = dns.lookup;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'auto-pipeline-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'),   { recursive: true });
  mkdirSync(resolve(dir, 'modes'),  { recursive: true });
  mkdirSync(resolve(dir, 'reports'),{ recursive: true });
  mkdirSync(resolve(dir, 'output'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n\nSenior backend engineer, 10 years.\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '# Applications\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), '# Oferta mode\n');
  writeFileSync(resolve(dir, 'modes', '_shared.md'), '# Shared\n');
  process.env.CAREER_OPS_ROOT = dir;
  // Clear EVERY inherited provider key so we hit the "no LLM key" branch
  // for the gate test below — a developer shell with OPENAI_API_KEY /
  // QWEN_API_KEY set would otherwise turn that test into a paid LLM call.
  for (const k of Object.keys(process.env)) {
    if (/_API_KEY$|^OLLAMA_BASE_URL$/.test(k)) delete process.env[k];
  }
  const { createApp } = await import('../server/index.mjs');
  ({ _setTransport } = await import('../server/lib/safe-fetch.mjs'));
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });
});

after(() => {
  dns.lookup = origLookup;
  if (restoreTransport) restoreTransport();
  delete process.env.CAREER_OPS_ROOT;
  return new Promise((r) => server.close(r));
});

let _setTransport;

/**
 * POST /api/auto-pipeline with body, drain SSE stream, return all
 * parsed events.
 */
async function callAutoPipeline(body, opts = {}) {
  const resp = await fetch(baseUrl + '/api/auto-pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  const events = [];
  if (!resp.ok || !resp.body) return { resp, events };
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n\n'); buf = parts.pop();
    for (const p of parts) {
      const eventMatch = p.match(/^event:\s*([\w-]+)/m);
      const dataMatch  = p.match(/^data:\s*(.+)/m);
      if (eventMatch && dataMatch) {
        try { events.push({ event: eventMatch[1], data: JSON.parse(dataMatch[1]) }); }
        catch { events.push({ event: eventMatch[1], data: dataMatch[1] }); }
      }
    }
    // Bail if a terminal event is received — server should res.end() shortly.
    if (events.some((e) => e.event === 'done' || e.event === 'error')) {
      // give the server a tick to actually end
      break;
    }
  }
  return { resp, events };
}

test('SSE: emits start event before any step', async () => {
  // Use an invalid-URL trip to keep this short — start should still fire.
  const { events } = await callAutoPipeline({ url: 'not-a-url' });
  assert.ok(events.length > 0);
  assert.equal(events[0].event, 'start');
  assert.equal(events[0].data.steps, 5);
});

test('SSE: invalid URL → step 1 fails, error event, no further steps', async () => {
  const { events } = await callAutoPipeline({ url: 'javascript:alert(1)' });
  const errs = events.filter((e) => e.event === 'error');
  const steps = events.filter((e) => e.event === 'step');
  assert.ok(errs.length >= 1);
  assert.equal(errs[0].data.step, 'validate');
  // Should NOT have fired step 2 / 3 / 4 / 5
  const stepsRun = steps.filter((s) => s.data.status === 'running');
  assert.equal(stepsRun.length, 1);
  assert.equal(stepsRun[0].data.i, 0);
});

test('SSE: loopback URL rejected by SSRF gate', async () => {
  const { events } = await callAutoPipeline({ url: 'http://127.0.0.1:4317/admin' });
  const errs = events.filter((e) => e.event === 'error');
  assert.ok(errs.length >= 1);
  assert.equal(errs[0].data.step, 'validate');
});

test('SSE: valid URL but no LLM key → reaches step 3 then errors', async () => {
  // No live network: pin DNS to a public documentation address and serve
  // the JD from a stubbed safe-fetch transport. Validate + fetch must
  // succeed, then the evaluate step must fail with "no LLM key".
  const fetched = [];
  dns.lookup = async () => ({ address: '93.184.216.34', family: 4 });
  restoreTransport = _setTransport(async (url) => {
    fetched.push(url.href);
    return {
      status: 200,
      headers: { 'content-type': 'text/html' },
      body: Buffer.from('<h1>Senior Backend Engineer at Example</h1><p>'
        + 'We build distributed systems in Go and Postgres. '.repeat(4) + '</p>'),
    };
  });
  try {
    const { events } = await callAutoPipeline({ url: 'https://jobs.example.com/job-123' });
    assert.deepEqual(fetched, ['https://jobs.example.com/job-123'], 'JD fetched once via the stub');
    const doneSteps = events.filter((e) => e.event === 'step' && e.data.status === 'done').map((e) => e.data.i);
    assert.deepEqual(doneSteps, [0, 1], 'validate and fetch complete, nothing after');
    const err = events.find((e) => e.event === 'error');
    assert.ok(err, 'should emit an error event without LLM key');
    assert.equal(err.data.step, 'evaluate');
    assert.equal(err.data.message, 'no LLM key');
  } finally {
    dns.lookup = origLookup;
    restoreTransport(); restoreTransport = null;
  }
});

test('SSE: response headers are SSE-compatible', async () => {
  const resp = await fetch(baseUrl + '/api/auto-pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'javascript:bad' }),
  });
  assert.equal(resp.status, 200);
  const ct = resp.headers.get('content-type') || '';
  assert.match(ct, /text\/event-stream/);
});

// ── v1.54.10 — SSE client-disconnect hygiene (static contract) ──
// A client closing mid-stream must NOT make the next res.write()
// escalate to an uncaughtException (it flaked the Playwright e2e
// job: 32/32 pass, "not ok 2 - <file>"). openSse() must register an
// 'error' listener AND guard writes on a finished/destroyed socket.
import { readFileSync as _rf } from 'node:fs';
import { fileURLToPath as _f } from 'node:url';
import { dirname as _d, resolve as _r } from 'node:path';
test('openSse swallows client-disconnect + guards writes (no uncaught)', () => {
  const src = _rf(_r(_d(_f(import.meta.url)), '..', 'server', 'lib',
    'routes', 'auto-pipeline.mjs'), 'utf8');
  assert.match(src, /res\.on\('error',\s*\(\)\s*=>/,
    'openSse must register a res error listener');
  assert.match(src, /if \(res\.writableEnded \|\| res\.destroyed\) return;/,
    'send() must skip writing once the socket is finished/destroyed');
  assert.match(src, /try \{\s*\n\s*res\.write\(`event:/,
    'the res.write pair must be wrapped in try/…');
});
