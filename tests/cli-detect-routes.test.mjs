/**
 * AI CLI detection (v1.103.0). Pure PATH scan — no binary is executed. CI-isolated:
 * we build a fake PATH dir with a stub executable and assert detection, plus the
 * endpoint shape. No provider keys, no parent project, no network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server; let baseUrl;
let findOnPath; let detectClis;
let fakeDir;

before(async () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-detect-root-'));
  writeFileSync(join(root, 'cv.md'), '# CV\n');
  process.env.CAREER_OPS_ROOT = root;
  fakeDir = mkdtempSync(join(tmpdir(), 'cli-detect-path-'));
  // A stub "gemini" that is executable but is NEVER run by the detector.
  const stub = join(fakeDir, 'gemini');
  writeFileSync(stub, '#!/bin/sh\necho should-never-run\n');
  chmodSync(stub, 0o755);
  ({ findOnPath, detectClis } = await import('../server/lib/routes/cli-detect.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});
after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

test('findOnPath resolves an executable on the given PATH, null otherwise', () => {
  const hit = findOnPath(['gemini'], fakeDir);
  assert.ok(hit && hit.endsWith('gemini'));
  assert.equal(findOnPath(['definitely-not-a-real-cli-xyz'], fakeDir), null);
});

test('detectClis reports the fake gemini as installed with its path, others not', () => {
  const tools = detectClis(fakeDir);
  const gemini = tools.find((t) => t.id === 'gemini');
  assert.equal(gemini.installed, true);
  assert.ok(gemini.path.endsWith('gemini'));
  const claude = tools.find((t) => t.id === 'claude');
  assert.equal(claude.installed, false);
  assert.equal(claude.path, null);
  // The roster comes from the live allowlist in cli-detect.mjs (an empty
  // PATH reports every known CLI as not installed) — no literal count to
  // drift when a CLI is added. Ids are unique; the stub PATH changes only
  // `installed`, never the roster.
  const roster = detectClis('').map((t) => t.id);
  assert.ok(roster.length > 0);
  assert.equal(new Set(roster).size, roster.length, 'roster ids are unique');
  assert.deepEqual(tools.map((t) => t.id), roster);
  assert.ok(detectClis('').every((t) => t.installed === false && t.path === null));
  // v1.173.0 — Hermes is probed (parent SUPPORTED_CLIS.md parity).
  assert.ok(tools.some((t) => t.id === 'hermes'), 'hermes must be in the roster');
});

test('GET /api/cli-detect returns the tools list + platform', async () => {
  const r = await fetch(`${baseUrl}/api/cli-detect`);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(Array.isArray(j.tools));
  assert.deepEqual(j.tools.map((t) => t.id), detectClis('').map((t) => t.id),
    'endpoint lists exactly the live roster');
  assert.ok(j.tools.every((t) => typeof t.id === 'string' && typeof t.installed === 'boolean'));
  assert.equal(typeof j.platform, 'string');
});
