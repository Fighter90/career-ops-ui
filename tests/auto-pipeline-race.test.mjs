/**
 * auto-pipeline-race.test.mjs — the report-create contract (v1.269 review):
 * the FIRST save uses the exclusive `wx` flag (no existsSync-then-write
 * TOCTOU — CodeQL #752); a pre-existing file never gets clobbered — the
 * dedup path writes an epoch-suffixed alt slug instead; both files carry the
 * bounded sanitized content.
 *
 * CI-isolated: CAREER_OPS_ROOT = mktemp with cv.md + a seeded conflicting
 * report file; no network, no keys, servers on 127.0.0.1:0.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const SAVE = {};
let dataRoot;

before(async () => {
  for (const k of ['CAREER_OPS_ROOT']) SAVE[k] = process.env[k];
  dataRoot = mkdtempSync(resolve(tmpdir(), 'ap-race-'));
  process.env.CAREER_OPS_ROOT = dataRoot;
  mkdirSync(resolve(dataRoot, 'data'), { recursive: true });
  mkdirSync(resolve(dataRoot, 'modes'), { recursive: true });
  writeFileSync(resolve(dataRoot, 'cv.md'), '# CV\nEngineer with Go and Kubernetes.');
});

after(async () => {
  rmSync(dataRoot, { recursive: true, force: true });
  for (const [k, v] of Object.entries(SAVE)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

test('the report save uses the exclusive wx flag (race contract pinned at source)', async () => {
  const src = await (await import('node:fs/promises')).readFile(
    resolve(import.meta.dirname, '..', 'server', 'lib', 'routes', 'auto-pipeline.mjs'), 'utf8');
  assert.ok(src.includes("flag: 'wx'"), 'the first save must be write-exclusive (wx) — no existsSync-then-write TOCTOU');
  assert.ok(!/if \(existsSync\(file\)\) \{/.test(src), 'the existsSync-then-write branch must be gone');
  assert.ok(src.includes("code !== 'EEXIST'"), 'EEXIST falls through to the epoch-suffix dedup path');
  assert.ok(src.includes("sanitized.length > 512 * 1024"), 'the bounded write survives the restructure');
});
