/**
 * runner.mjs: a script that traps SIGTERM must still be killed (SIGKILL after the
 * grace period), and a spawn that throws synchronously must resolve, not reject.
 * `child.killed` is true as soon as SIGTERM is delivered, so the old
 * `!child.killed` escalation guard never fired and the request hung forever.
 *
 * CI-isolated: temp project root (with cv.md), throwaway scripts, no network.
 *
 * CAR-152 — this test flaked under full-suite parallel load (2/4 runs) because
 * it raced a fixed wall-clock bound (`elapsed < 5000`) against the whole
 * spawn→timeout→grace→close pipeline. The rewrite awaits the actual transition
 * (the runner's promise, which resolves only when the child closes) and asserts
 * ORDERING, not an exact duration:
 *   - SIGKILL happened AFTER the grace — a lower bound. Node timers never fire
 *     early and both are armed after `started`, so `elapsed >= timeout+grace`
 *     holds under any load;
 *   - escalation FIRED at all — a generous 30 s hang guard turns the
 *     escalation-never-fires hang (the original bug) into a named failure
 *     instead of a stalled CI job. It is a failsafe, not a timing assertion;
 *   - the child died by SIGNAL (`code === null`) while its stdout proves the
 *     SIGTERM trap was installed first — i.e. the SIGKILL itself, not a
 *     default-disposition death nor a self-exit.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

// Test-only timing. timeoutMs doubles as the child's boot headroom: 300 ms was
// tight enough that, in a full-suite spawn storm, SIGTERM could arrive before
// the child installed its trap (default disposition = instant death, empty
// stdout) — a second load race in the same test. 1 s ≈ 10–20× a loaded boot.
const TIMEOUT_MS = 1_000;
const GRACE_MS = 300;
const HANG_GUARD_MS = 30_000;

let dir, runNodeScript;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'runner-kill-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# cv\n');
  // The 60 s self-exit only matters if escalation is broken (the regression this
  // test guards): the orphan then dies on its own and cannot wedge the run.
  writeFileSync(resolve(dir, 'stubborn.mjs'), "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000); console.log('up'); setTimeout(() => process.exit(0), 60000);\n");
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
  let hangGuard;
  const guard = new Promise((_, reject) => {
    hangGuard = setTimeout(
      () => reject(new Error(`child never exited within ${HANG_GUARD_MS / 1000} s — SIGTERM→SIGKILL escalation did not fire`)),
      HANG_GUARD_MS,
    );
  });
  try {
    // Under full-suite load the spawn itself can fail (EAGAIN/EMFILE at the
    // process limit); the runner resolves that as {code:-1, killed:undefined}.
    // stubborn.mjs can never exit -1 on its own (signal death → null), so a -1
    // here is the environment refusing the spawn — a transient to retry, not a
    // product defect to flake on.
    let r;
    for (let attempt = 1; attempt <= 3; attempt++) {
      r = await Promise.race([
        runNodeScript(resolve(dir, 'stubborn.mjs'), [], { timeoutMs: TIMEOUT_MS, killGraceMs: GRACE_MS }),
        guard,
      ]);
      if (r.killed) break;
      if (attempt < 3) await new Promise((res) => setTimeout(res, 250));
    }
    const elapsed = Date.now() - started;
    assert.equal(r.killed, true, `expected a killed run; got code=${r.code} stderr=${JSON.stringify(r.stderr)}`);
    assert.match(r.stdout, /up/); // the trap was installed before SIGTERM arrived
    assert.equal(r.code, null); // died by signal — the SIGKILL, not a self-exit
    assert.ok(
      elapsed >= TIMEOUT_MS + GRACE_MS - 50,
      `child exited before SIGTERM+grace elapsed (${elapsed}ms < ${TIMEOUT_MS + GRACE_MS}ms; the 50 ms slack covers wall-clock stepping, not load)`,
    );
  } finally {
    clearTimeout(hangGuard);
  }
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
