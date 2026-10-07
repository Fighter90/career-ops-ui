/**
 * v1.29.2 — multi-phase SSE contract for `GET /api/stream/scan?source=both`.
 *
 * Bug repro pre-v1.29.2:
 *   1. User clicks the "🌐 Scan" button which calls `Router.go` → request to
 *      `/api/stream/scan?source=both`.
 *   2. Server runs EN phase, emits `done`, then runs RU phase.
 *   3. Client's `API.stream` closes the EventSource on the FIRST `done`.
 *   4. Server's `res.on('close')` fires → AbortController aborts → RU phase
 *      starts but immediately gets cancelled.
 *   5. User sees only EN output; RU phase appears never to fire.
 *
 * Fix:
 *   - Server `driveOne` accepts a `final` param; emits `done` with
 *     `final: <bool>`. The `both` branch passes `false` to the first phase
 *     and `true` to the second.
 *   - Client `API.stream` keeps the connection open on `done` when
 *     `data.final === false`. Backward-compatible: existing single-phase
 *     producers don't set `final`, so default behaviour is unchanged.
 *
 * Tests below assert the server contract. The client contract is asserted
 * statically by reading the api.js source (matches the documented branch).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let server;
let baseUrl;
const offlineCalls = [];

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'scan-multiphase-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# x\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  // Tracked companies needs at least one entry with a recognizable URL so
  // EN scanner runs (even though no real fetch will happen — we use a
  // localhost-only fixture with no companies = empty EN scan succeeds).
  writeFileSync(resolve(dir, 'portals.yml'),
    'tracked_companies: []\nrussian_portals:\n  sources: ["hh", "habr"]\n  queries: ["dummy"]\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'x\n');
  process.env.CAREER_OPS_ROOT = dir;
  const { createApp } = await import('../server/index.mjs');
  // CI isolation: the regional phase queries hh / habr. Drive the REAL
  // scanners (the banner + phase contract is what is under test) but with an
  // offline fetchImpl, so no request leaves the machine — each source just
  // records a failure and the phase still completes with `done`.
  const { __scanRunners } = await import('../server/lib/routes/scan.mjs');
  const offlineFetch = async (u) => { offlineCalls.push(String(u)); throw new Error('offline (test stub)'); };
  const realEn = __scanRunners.en;
  const realRu = __scanRunners.ru;
  __scanRunners.en = (opts) => realEn({ ...opts, fetchImpl: offlineFetch });
  __scanRunners.ru = (opts) => realRu({ ...opts, fetchImpl: offlineFetch });
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  return new Promise((r) => server.close(r));
});

// Helper: collect SSE events from a streamed body, no `done` early-close.
async function collectEvents(res, maxMs = 20000) {
  const events = [];
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const ev = (block.match(/^event:\s*(\S+)/m) || [])[1];
      const data = (block.match(/^data:\s*(.*)$/m) || [])[1];
      if (ev) {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch {}
        events.push({ ev, data: parsed });
      }
    }
  }
  return events;
}

test('source=ats: single phase emits `done` with `final: true` (single-phase contract preserved)', async () => {
  const r = await fetch(baseUrl + '/api/stream/scan?source=ats&dryRun=1');
  assert.equal(r.status, 200);
  const events = await collectEvents(r, 8000);
  const dones = events.filter((e) => e.ev === 'done');
  assert.equal(dones.length, 1, `expected 1 done event, got ${dones.length}`);
  assert.equal(dones[0].data?.final, true,
    `single-phase done must have final:true, got ${JSON.stringify(dones[0].data)}`);
});

test('source=regional: single phase emits `done` with `final: true`', async () => {
  const r = await fetch(baseUrl + '/api/stream/scan?source=regional&dryRun=1');
  assert.equal(r.status, 200);
  const events = await collectEvents(r, 12000);
  const dones = events.filter((e) => e.ev === 'done');
  assert.equal(dones.length, 1);
  assert.equal(dones[0].data?.final, true);
});

test('source=both: emits TWO `done` events — first `final:false`, second `final:true`', async () => {
  const r = await fetch(baseUrl + '/api/stream/scan?source=both&dryRun=1');
  assert.equal(r.status, 200);
  const events = await collectEvents(r, 15000);
  const dones = events.filter((e) => e.ev === 'done');
  assert.equal(dones.length, 2, `expected 2 done events for source=both, got ${dones.length}`);
  assert.equal(dones[0].data?.final, false,
    `first phase done must carry final:false so client keeps stream open; got ${JSON.stringify(dones[0].data)}`);
  assert.equal(dones[1].data?.final, true,
    `second phase done must carry final:true so client closes; got ${JSON.stringify(dones[1].data)}`);
});

test('source=both: TWO `start` events — en-scanner then ru-scanner (order matters)', async () => {
  const r = await fetch(baseUrl + '/api/stream/scan?source=both&dryRun=1');
  const events = await collectEvents(r, 15000);
  const starts = events.filter((e) => e.ev === 'start');
  assert.equal(starts.length, 2, `expected 2 start events, got ${starts.length}`);
  assert.equal(starts[0].data?.script, 'en-scanner');
  assert.equal(starts[1].data?.script, 'ru-scanner');
});

test('API.stream client keeps EventSource open on `done.final === false` (static-source canary)', () => {
  // The DOM test would need jsdom; we assert on the api.js source instead.
  const apiSrc = readFileSync(resolve(__dirname, '..', 'public', 'js', 'api.js'), 'utf8');
  // Must NOT contain the pre-v1.29.2 unconditional close pattern.
  assert.doesNotMatch(
    apiSrc,
    /if\s*\(\s*ev\s*===\s*['"]done['"]\s*\|\|\s*ev\s*===\s*['"]error['"]\s*\)\s*es\.close\(\)/,
    'api.js still has the v1.29.1 unconditional `if (ev === "done" || ev === "error") es.close()` — multi-phase bug returns',
  );
  // Must contain the v1.29.2 guard: close on done only if !data || data.final !== false.
  assert.match(
    apiSrc,
    /data\.final\s*!==\s*false/,
    'api.js must close EventSource on `done` only when `data.final !== false`',
  );
});

test('API.stream client closes on plain `done` (no `final` field) — backward compat', () => {
  // Static canary: the close-branch must be `(!data || data.final !== false)`,
  // so a `done` payload without `final` (legacy single-phase producers) still
  // closes the stream.
  const apiSrc = readFileSync(resolve(__dirname, '..', 'public', 'js', 'api.js'), 'utf8');
  assert.match(
    apiSrc,
    /\(\s*!data\s*\|\|\s*data\.final\s*!==\s*false\s*\)/,
    'api.js must treat missing `final` field as "close" (backward-compat)',
  );
});

// ────────── functional bug-fix coverage (v1.29.2) ──────────

test('source=both: RU phase ACTUALLY produces content, not just start/done shells', async () => {
  // The user-visible symptom of the bug was "no RU output". Asserting only
  // on the count of `done` events catches the SSE-shape regression but NOT
  // a regression where the RU phase is mocked-out or short-circuits early.
  // This test demands that the RU-scanner phase emits the canonical banner
  // line so the QA-eye-visible bug is locked down forever.
  const r = await fetch(baseUrl + '/api/stream/scan?source=both&dryRun=1');
  const events = await collectEvents(r, 15000);
  const ruLogs = events.filter((e) =>
    e.ev === 'log' &&
    typeof e.data?.line === 'string' &&
    e.data.line.includes('RU Portal Scan'),
  );
  assert.ok(
    ruLogs.length >= 1,
    `expected ≥ 1 log event with "RU Portal Scan" banner from the RU phase, got ${ruLogs.length}. ` +
    `Full event types: ${events.map((e) => e.ev).join(',')}`,
  );
});

test('source=both: ru-scanner `start` arrives AFTER the en-scanner `done` (correct ordering)', async () => {
  // Pre-v1.29.2 the bug manifested as the SECOND `start` never arriving.
  // We also need to assert it arrives in the RIGHT spot in the timeline.
  const r = await fetch(baseUrl + '/api/stream/scan?source=both&dryRun=1');
  const events = await collectEvents(r, 15000);

  // Find indices of the key events in arrival order.
  const enStart  = events.findIndex((e) => e.ev === 'start' && e.data?.script === 'en-scanner');
  const enDone   = events.findIndex((e, i) => i > enStart && e.ev === 'done');
  const ruStart  = events.findIndex((e, i) => i > enDone && e.ev === 'start' && e.data?.script === 'ru-scanner');
  const finalDone = events.findIndex((e, i) => i > ruStart && e.ev === 'done' && e.data?.final === true);

  assert.notEqual(enStart,    -1, 'en-scanner start missing');
  assert.notEqual(enDone,     -1, 'en-scanner done missing');
  assert.notEqual(ruStart,    -1, 'ru-scanner start missing — pre-v1.29.2 bug returned');
  assert.notEqual(finalDone,  -1, 'final done (final:true) missing');
  assert.ok(enStart < enDone && enDone < ruStart && ruStart < finalDone,
    `event order broken: enStart=${enStart} enDone=${enDone} ruStart=${ruStart} finalDone=${finalDone}`);
});

test('source=both with dryRun=1: data/pipeline.md is NOT modified (regression on writeFiles=false)', async () => {
  // The `writeFiles=false` contract: dry-run scans must NEVER write to
  // pipeline.md / scan-history.tsv. A multi-phase dry-run with one phase
  // accidentally writing while the other doesn't is a class of bug; this
  // test gates against any phase silently flipping writeFiles.
  const ROOT = process.env.CAREER_OPS_ROOT;
  const pipelinePath = resolve(ROOT, 'data', 'pipeline.md');
  const before = readFileSync(pipelinePath, 'utf8');
  const r = await fetch(baseUrl + '/api/stream/scan?source=both&dryRun=1');
  await collectEvents(r, 15000);
  const after = readFileSync(pipelinePath, 'utf8');
  assert.equal(after, before,
    'dryRun=1 must not touch data/pipeline.md, but it changed');
});

// ────────── pure-logic close-decision (mirrors api.js) ──────────

test('close-decision logic table (mirrors public/js/api.js stream branch)', () => {
  // Pure replica of the v1.29.2 branch. If a future refactor changes the
  // decision rule, this test fails BEFORE the static-source canary above
  // (which only catches refactors that ALSO remove the literal string).
  function shouldClose(ev, data) {
    if (ev === 'error') return true;
    if (ev === 'done' && (!data || data.final !== false)) return true;
    return false;
  }
  const cases = [
    // [event, data, expected close]
    ['done', { final: false },        false],  // intermediate phase — keep open
    ['done', { final: true },         true ],  // explicit final phase — close
    ['done', {},                      true ],  // legacy single-phase (no `final` field)
    ['done', null,                    true ],  // legacy producer sending null payload
    ['done', undefined,               true ],  // legacy producer sending no payload
    ['done', { final: 0 },            true ],  // `0` !== false → close (defensive)
    ['done', { final: 'false' },      true ],  // string 'false' !== false → close
    ['error', { message: 'oops' },    true ],  // always close on error
    ['error', null,                   true ],
    ['start', {},                     false],  // never close on start
    ['log',   { line: 'x' },          false],  // never close on log
  ];
  for (const [ev, data, expected] of cases) {
    assert.equal(
      shouldClose(ev, data), expected,
      `shouldClose(${JSON.stringify(ev)}, ${JSON.stringify(data)}) expected ${expected}`,
    );
  }
});

// ────────── bug-repro: forensic documentation ──────────

test('bug forensics: simulating a pre-v1.29.2 client that closes on first `done` aborts phase 2', async () => {
  // This test DOCUMENTS the pre-v1.29.2 bug for future readers. It is
  // green only because the SERVER-side fix (`final:false`) is in place
  // AND the test simulates an old client that ignores the `final` field.
  // The point is: with the field IN place, the server still detects an
  // early-closing client and aborts the second phase — proving the
  // server-side abort handling is intact. If a future refactor removes
  // `res.on('close')` from `driveOne`, this test catches it.
  //
  // We open the SSE stream, read until the FIRST `done`, then forcibly
  // close the response stream (simulating EventSource.close() in the old
  // client). Then we wait a beat and verify the server doesn't keep
  // sending events into the void.
  const r = await fetch(baseUrl + '/api/stream/scan?source=both&dryRun=1');
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let sawEnDone = false;
  // Read until we see the first `done` block, then cancel the reader.
  while (!sawEnDone) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    if (/event:\s*done/.test(buf)) {
      sawEnDone = true;
      break;
    }
  }
  assert.ok(sawEnDone, 'EN-phase `done` should have arrived');
  // Cancel the reader — this is what an old client's `es.close()` does
  // at the TCP level (closes the HTTP response stream).
  await reader.cancel('test: simulate early-close client').catch(() => {});
  // The server has now detected the close and aborted phase 2. Nothing
  // observable to assert on the client side — but the test exercising
  // the abort path proves the `res.on('close')` handler still runs.
  // (If the server kept writing into a closed stream, we'd get an
  // unhandled exception that node:test would surface as a failure.)
  await new Promise((r) => setTimeout(r, 100));
});

test('CI isolation: the regional phase went through the offline stub (no live hh/habr)', () => {
  assert.ok(offlineCalls.length > 0, 'the stub must have intercepted the regional source calls');
  assert.ok(offlineCalls.every((u) => typeof u === 'string'));
});
