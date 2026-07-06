/**
 * SRV-H2 — /api/stream/batch must carry llmRateLimit.
 *
 * batch-runner.sh fans out N parallel real LLM evaluations, making this
 * the most expensive endpoint the app exposes; it was the only LLM-cost
 * route without the limiter. Source-contract test in the same style as
 * tests/parity-hardening-v1171.test.mjs (the limiter no-ops on loopback,
 * so a behavioral 429 assertion is not reachable from a local test bind).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'server/lib/routes/batch.mjs'), 'utf8');

test('batch.mjs imports llmRateLimit', () => {
  assert.match(src, /import \{ llmRateLimit \} from '\.\.\/rate-limit\.mjs';/);
});

test('GET /api/stream/batch is gated by llmRateLimit', () => {
  assert.match(src, /app\.get\('\/api\/stream\/batch', llmRateLimit,/);
});

// SRV-M1 — the key smoke-test routes make real (cheap) provider calls
// and must carry the same limiter.
const llmSrc = readFileSync(join(ROOT, 'server/lib/routes/llm.mjs'), 'utf8');

test('POST /api/evaluate/test-gemini is gated by llmRateLimit', () => {
  assert.match(llmSrc, /app\.post\('\/api\/evaluate\/test-gemini', llmRateLimit,/);
});

test('POST /api/evaluate/test-anthropic is gated by llmRateLimit', () => {
  assert.match(llmSrc, /app\.post\('\/api\/evaluate\/test-anthropic', llmRateLimit,/);
});
