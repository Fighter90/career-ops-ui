/**
 * LLM usage recorder + aggregator + route (v1.105.0). CI-isolated: a mktemp
 * CAREER_OPS_ROOT holds data/llm-usage.jsonl; no network, no provider keys.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
