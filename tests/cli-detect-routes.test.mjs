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
  process.env.CAREER_OPS_ROOT = mkdtempSync(join(tmpdir(), 'cli-detect-root-'));
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
  // The known allowlist is fixed (10 agent CLIs: 9 first-class incl. Cursor
  // v1.127.0/parent #2115 + Gemini). See server/lib/routes/cli-detect.mjs.
  assert.equal(tools.length, 10);
});

test('GET /api/cli-detect returns the tools list + platform', async () => {
  const r = await fetch(`${baseUrl}/api/cli-detect`);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(Array.isArray(j.tools) && j.tools.length === 10);
  assert.ok(j.tools.every((t) => typeof t.id === 'string' && typeof t.installed === 'boolean'));
  assert.equal(typeof j.platform, 'string');
});
