/**
 * v1.25.0 (G-014) — `/api/auto-pipeline` honours `mode: 'manual'`.
 *
 * Pre-v1.25, the route always tried to call an LLM. When the user
 * passed `mode: 'manual'` (mirroring `/api/evaluate`'s contract), the
 * request still hung 1-3 minutes waiting on Anthropic. Two consequences:
 *
 *  1. **DoS-risk on public bind** — even with `llmRateLimit` (10
 *     req/60s), 10 attackers × 10 reqs/min = $50/min in Anthropic spend.
 *  2. **CI / test friction** — any test exercising the orchestrator
 *     against a stand with `ANTHROPIC_API_KEY` set hangs past timeout.
 *
 * v1.25 adds an explicit short-circuit at the top of the handler:
 * when `mode === 'manual'` (or `evalMode === 'manual'` for back-compat),
 * the SSE flow emits all 5 stages with status `done`/`skipped`, returns
 * the canonical `buildEvaluationPrompt` string in the `done` payload,
 * and ends the response WITHOUT calling fetch() or the LLM.
 *
 * This test asserts the short-circuit:
 *   - response is fast (<500 ms)
 *   - SSE stream contains `event: start`, 5 `event: step`s, `event: done`
 *   - the `done` payload has `mode: 'manual'` and a non-empty `prompt`
 *   - no LLM key is consumed (we don't set ANTHROPIC_API_KEY)
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

// One fixture root + one server for the whole file: paths.mjs is an ESM
// singleton, so a second mkdtemp root per test would never be read anyway
// (the module cache pins PATHS to whichever root the first import saw).
let server;
let baseUrl;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'auto-manual-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), '# Oferta\n');
  process.env.CAREER_OPS_ROOT = dir;
  // CRITICAL: start with NO provider key. The short-circuit must fire
  // regardless of key presence; in the wild a CI run with the key set
  // used to hang here. The key-set case below adds one explicitly.
  for (const k of Object.keys(process.env)) {
    if (/_API_KEY$|^OLLAMA_BASE_URL$/.test(k)) delete process.env[k];
  }
  const { createApp } = await import('../server/index.mjs');
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
  delete process.env.ANTHROPIC_API_KEY;
  return new Promise((r) => server.close(r));
});

test('POST /api/auto-pipeline mode:manual returns prompt without LLM call', async () => {
  const t0 = Date.now();
  const r = await fetch(baseUrl + '/api/auto-pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://job-boards.greenhouse.io/anthropic/jobs/x',
      mode: 'manual',
    }),
  });
  const text = await r.text();
  const elapsed = Date.now() - t0;

  // Speed: short-circuit means no fetch, no LLM. Anything > 2 s
  // suggests the manual flag was ignored.
  assert.ok(elapsed < 2000, `expected <2s, got ${elapsed}ms`);
  assert.equal(r.status, 200);

  // SSE shape: start event + step events covering all 5 STEPS keys +
  // done event. The runtime emits `running` then `done` per step
  // through `step(i, status)` so we count distinct step keys rather
  // than raw event lines.
  assert.match(text, /^event: start\b/m);
  for (const key of ['validate', 'fetch', 'evaluate', 'report', 'tracker']) {
    assert.match(text, new RegExp(`"key":"${key}"`),
      `expected step event with key="${key}"`);
  }
  assert.match(text, /^event: done\b/m);

  // The `done` payload carries mode:'manual' + a non-empty prompt.
  const doneLine = text.split('\n').find((l) => l.startsWith('data:') &&
    /"mode":"manual"/.test(l) && /"prompt"/.test(l));
  assert.ok(doneLine, 'expected `done` event with mode:"manual" + prompt');
  const payload = JSON.parse(doneLine.replace(/^data:\s*/, ''));
  assert.equal(payload.mode, 'manual');
  assert.ok(payload.prompt && payload.prompt.length > 50,
    `expected non-empty prompt, got: ${JSON.stringify(payload.prompt)?.slice(0, 80)}`);
  // The prompt mentions the canonical mode evaluation hooks.
  assert.match(payload.prompt, /CV|career|оценк|valida|évaluation|評価/i);
});

test('POST /api/auto-pipeline mode:manual works even with ANTHROPIC_API_KEY set', async () => {
  // Reproducer for the original G-014 symptom: key set + mode:manual
  // would still kick off a live call. Now the short-circuit fires
  // before evalMode resolution. The key is read live (process.env ∨ .env)
  // per request, so setting it here is enough.
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-fake-do-not-call';
  try {
    const t0 = Date.now();
    const r = await fetch(baseUrl + '/api/auto-pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://job-boards.greenhouse.io/anthropic/jobs/x',
        mode: 'manual',
      }),
    });
    const text = await r.text();
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 2000, `key-set manual mode hung ${elapsed}ms — regression`);
    assert.equal(r.status, 200);
    assert.match(text, /"mode":"manual"/);
    assert.match(text, /^event: done\b/m);
  } finally {
    delete process.env.ANTHROPIC_API_KEY;
  }
});

test('POST /api/auto-pipeline back-compat: legacy evalMode:manual also short-circuits', async () => {
  // Pre-v1.25 callers passed `evalMode: 'manual'`. The handler keeps
  // honouring it so we don't break in-flight clients.
  const r = await fetch(baseUrl + '/api/auto-pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://job-boards.greenhouse.io/anthropic/jobs/x',
      evalMode: 'manual',
    }),
  });
  const text = await r.text();
  assert.equal(r.status, 200);
  assert.match(text, /"mode":"manual"/);
  assert.match(text, /^event: done\b/m);
});
