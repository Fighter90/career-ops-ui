/**
 * runner.mjs: a script that traps SIGTERM must still be killed (SIGKILL after the
 * grace period), and a spawn that throws synchronously must resolve, not reject.
 * `child.killed` is true as soon as SIGTERM is delivered, so the old
 * `!child.killed` escalation guard never fired and the request hung forever.
 *
 * CI-isolated: temp project root (with cv.md), throwaway scripts, no network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let dir, runNodeScript;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'runner-kill-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# cv\n');
  writeFileSync(resolve(dir, 'stubborn.mjs'), "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000); console.log('up');\n");
  writeFileSync(resolve(dir, 'quick.mjs'), "console.log('hi');\n");
  process.env.CAREER_OPS_ROOT = dir;
  ({ runNodeScript } = await import('../server/lib/runner.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  rmSync(dir, { recursive: true, force: true });
});

test('a script that traps SIGTERM is SIGKILLed after the grace period (the promise resolves)', async () => {
  const started = Date.now();
  const r = await runNodeScript(resolve(dir, 'stubborn.mjs'), [], { timeoutMs: 300, killGraceMs: 300 });
  assert.equal(r.killed, true);
  assert.match(r.stdout, /up/);
  assert.ok(Date.now() - started < 5000, 'resolved well inside the default 5 s grace — escalation fired');
});

test('a normal script resolves with its output and exit code', async () => {
  const r = await runNodeScript(resolve(dir, 'quick.mjs'), [], { timeoutMs: 5000 });
  assert.equal(r.code, 0);
  assert.equal(r.stdout.trim(), 'hi');
});

test('an argument spawn rejects synchronously (NUL byte) resolves {code:-1} instead of rejecting', async () => {
  const r = await runNodeScript(resolve(dir, 'quick.mjs'), ['a\0b'], { timeoutMs: 5000 });
  assert.equal(r.code, -1);
  assert.match(r.stderr, /null bytes|NUL|invalid/i);
});
