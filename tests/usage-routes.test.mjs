/**
 * LLM usage recorder + aggregator + route (v1.105.0). CI-isolated: a mktemp
 * CAREER_OPS_ROOT holds data/llm-usage.jsonl; no network, no provider keys.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname as dn } from 'node:path';

let server; let baseUrl; let logFile;
let normalizeUsage; let recordUsage; let readUsage; let aggregate; let priceFor;

before(async () => {
  const root = mkdtempSync(join(tmpdir(), 'usage-root-'));
  process.env.CAREER_OPS_ROOT = root;
  logFile = join(root, 'llm-usage-test.jsonl'); // explicit temp file — never touches PATHS/real parent
  ({ normalizeUsage, recordUsage, readUsage, aggregate } = await import('../server/lib/llm-usage.mjs'));
  ({ priceFor } = await import('../server/lib/llm-pricing.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});
after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

test('normalizeUsage handles Anthropic / OpenAI / Gemini shapes', () => {
  assert.deepEqual(normalizeUsage({ input_tokens: 10, output_tokens: 5 }), { in: 10, out: 5 });
  assert.deepEqual(normalizeUsage({ prompt_tokens: 7, completion_tokens: 3 }), { in: 7, out: 3 });
  assert.deepEqual(normalizeUsage({ promptTokenCount: 4, candidatesTokenCount: 2 }), { in: 4, out: 2 });
  assert.deepEqual(normalizeUsage(null), { in: 0, out: 0 });
});

test('priceFor multiplies token counts by the provider rate', () => {
  // anthropic: in 3.00 / out 15.00 per 1M
  assert.ok(Math.abs(priceFor('anthropic', 1_000_000, 1_000_000) - 18) < 1e-9);
  assert.equal(priceFor('unknown-provider', 1000, 1000), 0);
});

test('recordUsage appends a JSONL line and readUsage parses it (skips zero-token)', () => {
  // Explicit temp file → fully isolated, never touches PATHS or the real parent.
  recordUsage('anthropic', { input_tokens: 100, output_tokens: 40 }, 1_000, logFile);
  recordUsage('gemini', { promptTokenCount: 50, candidatesTokenCount: 20 }, 2_000, logFile);
  recordUsage('anthropic', { input_tokens: 0, output_tokens: 0 }, 3_000, logFile); // no tokens → not recorded
  assert.ok(existsSync(logFile));
  const rows = readUsage(logFile);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].provider, 'anthropic');
  assert.deepEqual({ in: rows[0].in, out: rows[0].out }, { in: 100, out: 40 });
});

test('aggregate rolls up per window + provider with estimated USD', () => {
  const now = 10_000;
  const rows = [
    { ts: now - 1000, provider: 'anthropic', in: 1_000_000, out: 1_000_000 }, // in 24h
    { ts: now - (2 * 24 * 60 * 60 * 1000), provider: 'gemini', in: 1_000_000, out: 0 }, // in 7d, not 24h
  ];
  const agg = aggregate(rows, now);
  const w24 = agg.windows['24h'];
  assert.equal(w24.providers.length, 1);
  assert.equal(w24.providers[0].provider, 'anthropic');
  assert.ok(Math.abs(w24.totalUsd - 18) < 1e-9);
  const w7 = agg.windows['7d'];
  assert.equal(w7.calls, 2);
  assert.ok(w7.totalUsd > 18); // + gemini input cost
  assert.ok(agg.windows.all.calls === 2);
});

test('GET /api/usage returns windows + prices + totalCalls', async () => {
  const r = await fetch(`${baseUrl}/api/usage`);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.windows && j.windows['24h'] && j.windows.all);
  assert.ok(j.prices && j.prices.anthropic);
  assert.equal(typeof j.totalCalls, 'number');
});

// ── CAR-106 — a provider-reported cost must survive the round trip ───────────
// Self-hosted gateways (Hermes) bill the UPSTREAM model and report the real
// cost in their OpenAI-compatible usage object. The recorder used to keep only
// `{in, out}`, and the pricing table prices hermes at 0/0 → $0.0000 forever.

test('normalizeUsage keeps a provider-reported cost; tokens-only shapes unchanged', () => {
  // Hermes-style gateway usage: the real billed cost rides the OpenAI shape.
  assert.deepEqual(
    normalizeUsage({ prompt_tokens: 1000, completion_tokens: 500, cost: 0.0123 }),
    { in: 1000, out: 500, cost: 0.0123 },
  );
  // Tokens-only shapes keep the exact old shape (no cost key added).
  assert.deepEqual(normalizeUsage({ input_tokens: 10, output_tokens: 5 }), { in: 10, out: 5 });
  // Garbage / negative cost is never fabricated.
  assert.deepEqual(normalizeUsage({ prompt_tokens: 1, completion_tokens: 1, cost: 'abc' }), { in: 1, out: 1 });
  assert.deepEqual(normalizeUsage({ prompt_tokens: 1, completion_tokens: 1, cost: -5 }), { in: 1, out: 1 });
});

test('recordUsage persists the provider-reported cost through the JSONL round trip', () => {
  recordUsage('hermes', { prompt_tokens: 1_000_000, completion_tokens: 0, cost: 1.23 }, 5_000, logFile);
  const rec = readUsage(logFile).find((r) => r.provider === 'hermes' && r.cost != null);
  assert.ok(rec, 'cost-bearing record survived the round trip');
  assert.ok(Math.abs(rec.cost - 1.23) < 1e-12);
});

test('aggregate: provider-reported cost wins over the (zero) pricing estimate', () => {
  const now = 20_000;
  const agg = aggregate(
    [{ ts: now - 1000, provider: 'hermes', in: 9_500_000, out: 100_000, cost: 1.23 }],
    now,
  );
  const p = agg.windows['24h'].providers.find((x) => x.provider === 'hermes');
  assert.ok(Math.abs(p.usd - 1.23) < 1e-12, `hermes usd should be 1.23, got ${p.usd}`);
  assert.ok(Math.abs(agg.windows['24h'].totalUsd - 1.23) < 1e-12);
});

test('aggregate: tokens-only keeps the estimate; when both exist the provider cost wins', () => {
  const now = 20_000;
  // Tokens-only record → pricing-table estimate, exactly as before.
  const aggTok = aggregate(
    [{ ts: now - 1000, provider: 'anthropic', in: 1_000_000, out: 1_000_000 }],
    now,
  );
  assert.ok(Math.abs(aggTok.windows['24h'].totalUsd - 18) < 1e-9);
  // BOTH tokens and cost on one record → the provider-reported number is real.
  const aggBoth = aggregate(
    [{ ts: now - 1000, provider: 'anthropic', in: 1_000_000, out: 1_000_000, cost: 0.5 }],
    now,
  );
  assert.ok(Math.abs(aggBoth.windows['24h'].totalUsd - 0.5) < 1e-12);
  // Mixed records for one provider: cost-bearing uses its cost, tokens-only
  // falls back to the estimate (hermes table = 0 → 0 for the second record).
  const aggMix = aggregate([
    { ts: now - 1000, provider: 'hermes', in: 100, out: 100, cost: 1.23 },
    { ts: now - 2000, provider: 'hermes', in: 1_000_000, out: 1_000_000 },
  ], now);
  const pm = aggMix.windows['24h'].providers.find((x) => x.provider === 'hermes');
  assert.ok(Math.abs(pm.usd - 1.23) < 1e-12);
});

test('GET /api/usage surfaces the Hermes gateway cost end-to-end', async () => {
  const { PATHS } = await import('../server/lib/paths.mjs');
  recordUsage('hermes', { prompt_tokens: 9_500_000, completion_tokens: 37_000, cost: 4.2 }, Date.now(), PATHS.llmUsage);
  const r = await fetch(`${baseUrl}/api/usage`);
  assert.equal(r.status, 200);
  const j = await r.json();
  const hermes = j.windows.all.providers.find((p) => p.provider === 'hermes');
  assert.ok(hermes, 'hermes row present');
  assert.ok(Math.abs(hermes.usd - 4.2) < 1e-9, `hermes usd should be 4.2, got ${hermes.usd}`);
});

test('usage: llmLatency p50/p90/max from durationMs rows (v1.268.0 CAR-230)', async () => {
  const { recordUsage, readUsage } = await import('../server/lib/llm-usage.mjs');
  // PATHS resolves ONCE per process (to this suite's mkdtemp root): the journal
  // is PATHS.llmUsage — write durations, then read the endpoint back.
  recordUsage('anthropic', { input_tokens: 10, output_tokens: 5, durationMs: 120_000 });
  recordUsage('anthropic', { input_tokens: 10, output_tokens: 5, durationMs: 180_000 });
  recordUsage('anthropic', { input_tokens: 10, output_tokens: 5, durationMs: 400_000 });
  const { createApp } = await import('../server/index.mjs');
  const server = await new Promise((r) => { const s = createApp().listen(0, '127.0.0.1', () => r(s)); });
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/usage`);
    const body = await res.json();
    const journaled = readUsage().filter((r) => Number.isFinite(r.durationMs));
    assert.ok(body.llmLatency, `durationMs rows → llmLatency present (journaled=${journaled.length}, totalCalls=${body.totalCalls})`);
    assert.equal(body.llmLatency.n, 3);
    assert.equal(body.llmLatency.p50Ms, 180_000, 'the middle value is the p50');
    assert.equal(body.llmLatency.maxMs, 400_000);
  } finally {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  }
});

test('usage: llmLatency null when the journal has no durationMs rows (v1.268.0 CAR-230)', async () => {
  const { PATHS } = await import('../server/lib/paths.mjs');
  // Isolated journal (PATHS resolves once per process — this suite's mkdtemp
  // root is shared with the p50 test, so this test rebuilds the journal file
  // with duration-free rows before reading).
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync(dn(PATHS.llmUsage), { recursive: true });
  writeFileSync(PATHS.llmUsage, [
    JSON.stringify({ ts: 1_000, provider: 'anthropic', in: 10, out: 5 }),
    JSON.stringify({ ts: 2_000, provider: 'openrouter', in: 20, out: 8 }),
  ].join('\n') + '\n');
  const { createApp } = await import('../server/index.mjs');
  const server = await new Promise((r) => { const s = createApp().listen(0, '127.0.0.1', () => r(s)); });
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/usage`);
    const body = await res.json();
    assert.equal(body.llmLatency, null, 'no durationMs rows → null latency');
  } finally {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  }
});

// ── CAR-240 — steps[] + cached survive the round trip; the aggregator
// rolls cachedIn / cacheHitRate per window and the endpoint exposes them.

test('CAR-240: recordUsage persists cached + bounded steps through the JSONL round trip', () => {
  recordUsage('anthropic', {
    input_tokens: 10_000, output_tokens: 2_000, cached: 4_000,
    steps: [
      { name: 'scoring', in: 8_000, out: 500, cached: 3_000, cost: 0.01, durationMs: 61_000 },
      { name: 'rendering', in: 2_000, out: 1_500, cached: 1_000, cost: 0.02, durationMs: 90_000 },
    ],
  }, 30_000, logFile);
  const rec = readUsage(logFile).find((r) => r.ts === 30_000);
  assert.ok(rec, 'the cached/steps record survived');
  assert.equal(rec.cached, 4_000);
  assert.equal(rec.steps.length, 2);
  assert.equal(rec.steps[0].name, 'scoring');
  assert.equal(rec.steps[0].cached, 3_000);
  assert.equal(rec.steps[0].durationMs, 61_000);
  // tokens-only + duration-only shapes unchanged (no cached/steps keys)
  recordUsage('gemini', { promptTokenCount: 50, candidatesTokenCount: 20, durationMs: 5_000 }, 31_000, logFile);
  const plain = readUsage(logFile).find((r) => r.ts === 31_000);
  assert.equal(plain.cached, undefined);
  assert.equal(plain.steps, undefined);
});

test('CAR-240: steps are sanitized — junk entries/fields dropped, array capped at 4', () => {
  recordUsage('anthropic', {
    input_tokens: 100, output_tokens: 10, cached: -5, // negative cached → dropped
    steps: [
      'not an object',                                        // dropped
      { name: 'ok', in: 10, out: 5, sneaky: '<script>' },     // unknown key stripped
      { name: 42, in: 'abc' },                                // no usable numbers → dropped
      { name: 'rendering', out: 3 },
      { name: 'extra-1', in: 1 },
      { name: 'extra-2', in: 2 },                             // beyond the cap → dropped
    ],
  }, 40_000, logFile);
  const rec = readUsage(logFile).find((r) => r.ts === 40_000);
  assert.equal(rec.cached, undefined, 'a negative cached sum is never fabricated');
  assert.ok(Array.isArray(rec.steps), 'the usable steps survived');
  assert.equal(rec.steps.length, 2, 'capped at 4 AND junk-free');
  assert.deepEqual(rec.steps.map((s) => s.name), ['ok', 'rendering']);
  assert.equal(rec.steps[0].sneaky, undefined, 'unknown keys never ride the journal');
  // a steps value that is not an array is dropped entirely
  recordUsage('anthropic', { input_tokens: 1, output_tokens: 1, steps: { name: 'x' } }, 41_000, logFile);
  assert.equal(readUsage(logFile).find((r) => r.ts === 41_000).steps, undefined);
});

test('CAR-240: aggregate rolls cached per provider + cachedIn/cacheHitRate per window', () => {
  const now = 50_000;
  const agg = aggregate([
    { ts: now - 1000, provider: 'anthropic', in: 1_000, out: 100, cached: 400 },
    { ts: now - 2000, provider: 'anthropic', in: 1_000, out: 100, cached: 100 },
    { ts: now - 3000, provider: 'openrouter', in: 2_000, out: 50 }, // no cached key
  ], now);
  const w = agg.windows['24h'];
  const a = w.providers.find((p) => p.provider === 'anthropic');
  assert.equal(a.cached, 500, 'cached sums per provider');
  assert.equal(w.cachedIn, 500);
  assert.ok(Math.abs(w.cacheHitRate - 500 / 4_000) < 1e-12, 'hit rate = cachedIn / totalIn');
  assert.equal(agg.windows['7d'].cacheHitRate, w.cacheHitRate, 'same rows in the wider window');
});

test('CAR-240: cacheHitRate is null (never a fake 0%) when the window has no input tokens', () => {
  const now = 60_000;
  const agg = aggregate([{ ts: now - 1000, provider: 'x', in: 0, out: 5 }], now);
  assert.equal(agg.windows['24h'].totalIn, 0);
  assert.equal(agg.windows['24h'].cacheHitRate, null);
});

test('CAR-240: GET /api/usage exposes cachedIn + cacheHitRate and the usage view reads them', async () => {
  const { PATHS } = await import('../server/lib/paths.mjs');
  // Isolated journal: earlier tests in this suite append to PATHS.llmUsage
  // (PATHS resolves once per process), so rebuild it with only this row
  // before reading the endpoint — same pattern as the null-latency test.
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync(dn(PATHS.llmUsage), { recursive: true });
  writeFileSync(PATHS.llmUsage,
    JSON.stringify({ ts: Date.now(), provider: 'anthropic', in: 1_000, out: 100, cached: 250 }) + '\n');
  const r = await fetch(`${baseUrl}/api/usage`);
  assert.equal(r.status, 200);
  const j = await r.json();
  for (const key of ['24h', '7d', '30d', 'all']) {
    const w = j.windows[key];
    assert.ok('cachedIn' in w, `${key}: cachedIn exposed`);
    assert.ok('cacheHitRate' in w, `${key}: cacheHitRate exposed`);
  }
  const all = j.windows.all;
  assert.equal(all.cachedIn, 250);
  assert.ok(Math.abs(all.cacheHitRate - 0.25) < 1e-12);
  // the view renders the new columns from the same field names (source pin —
  // the browser view is covered by the static + Playwright suites)
  const { readFileSync } = await import('node:fs');
  const view = readFileSync(new URL('../public/js/views/usage.js', import.meta.url), 'utf8');
  assert.match(view, /usage\.cacheIn/);
  assert.match(view, /usage\.cacheRate/);
  assert.match(view, /p\.cached/);
  assert.match(view, /w\.cachedIn/);
  assert.match(view, /w\.cacheHitRate/);
});
