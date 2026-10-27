/**
 * FULL-M6 (CAR-165) — effectiveEnv re-reads and re-parses the whole .env file
 * on every call. Every provider-key lookup (has{Anthropic,Gemini,OpenAI,…}Key,
 * /api/health, /api/status/providers, each eval dispatch) paid a full
 * open+read+parse when process.env missed. This adds the house
 * mtime+size-keyed cache (same pattern as store.mjs's reportCache) with
 * observable hit/miss counters, invalidated on any content change or delete.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let envConfig;
let file;

before(async () => {
  envConfig = await import('../server/lib/env-config.mjs');
  file = join(mkdtempSync(join(tmpdir(), 'env-cache-')), '.env');
});

test('effectiveEnv serves repeat reads from the mtime+size cache', () => {
  writeFileSync(file, 'CACHE_PROBE_A=v1\n');
  envConfig.__envFileCache.reset();
  assert.equal(envConfig.effectiveEnv('CACHE_PROBE_A', file), 'v1'); // miss: parses
  assert.equal(envConfig.effectiveEnv('CACHE_PROBE_A', file), 'v1'); // hit
  assert.equal(envConfig.effectiveEnv('CACHE_PROBE_B', file), undefined); // hit (file unchanged)
  const c = envConfig.__envFileCache;
  assert.ok(c.hits >= 2, `repeat reads must be cache hits (got hits=${c.hits}, misses=${c.misses})`);
  assert.equal(c.misses, 1, 'one parse for three reads');
});

test('cache invalidates when the file content changes', () => {
  writeFileSync(file, 'CACHE_PROBE_A=v2-longer\n'); // different size AND mtime
  assert.equal(envConfig.effectiveEnv('CACHE_PROBE_A', file), 'v2-longer');
});

test('cache invalidates when the file is deleted', () => {
  rmSync(file);
  assert.equal(envConfig.effectiveEnv('CACHE_PROBE_A', file), undefined);
});

test('process.env still wins over the file', () => {
  writeFileSync(file, 'CACHE_PROBE_A=file-wins?\n');
  process.env.CACHE_PROBE_A = 'live-wins';
  try {
    assert.equal(envConfig.effectiveEnv('CACHE_PROBE_A', file), 'live-wins');
  } finally {
    delete process.env.CACHE_PROBE_A;
  }
});
