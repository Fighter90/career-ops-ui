/**
 * server/lib/runner.mjs — buffered (runNodeScript) and streaming
 * (streamNodeScript) subprocess wrappers. We test them with throwaway
 * scripts written into a temp dir so we don't depend on parent-project
 * scripts existing or the network being up.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { EventEmitter } from 'node:events';

let projectRoot;
let runNodeScript;
let streamNodeScript;

before(async () => {
  projectRoot = mkdtempSync(resolve(tmpdir(), 'runner-test-'));
  // Three throwaway scripts the runner can spawn:
  writeFileSync(resolve(projectRoot, 'echo.mjs'),
    `process.stdout.write('hello\\n'); process.stderr.write('warning\\n'); process.exit(0);\n`);
  writeFileSync(resolve(projectRoot, 'fail.mjs'),
    `process.stdout.write('starting\\n'); process.exit(7);\n`);
  writeFileSync(resolve(projectRoot, 'slow.mjs'),
    `setTimeout(() => process.exit(0), 10_000);\n`);
  process.env.CAREER_OPS_ROOT = projectRoot;
  // Need cv.md for paths.mjs to settle on this root
  writeFileSync(resolve(projectRoot, 'cv.md'), '# placeholder\n');
  ({ runNodeScript, streamNodeScript } = await import('../server/lib/runner.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
});

// ────────────────────────── runNodeScript ──────────────────────────

test('runNodeScript: captures stdout + stderr + exit code', async () => {
  const r = await runNodeScript('echo.mjs');
  assert.equal(r.code, 0);
  assert.match(r.stdout, /hello/);
  assert.match(r.stderr, /warning/);
});

test('runNodeScript: non-zero exit is returned, not thrown', async () => {
  const r = await runNodeScript('fail.mjs');
  assert.equal(r.code, 7);
  assert.match(r.stdout, /starting/);
});

test('runNodeScript: timeoutMs kills slow scripts with negative-ish exit', async () => {
  const r = await runNodeScript('slow.mjs', [], { timeoutMs: 200 });
  // SIGTERM exit code is null on macOS, undefined on some runners; just
  // make sure the script DIDN'T get to its 10-second exit.
  assert.notEqual(r.code, 0);
});

test('runNodeScript: missing script returns spawn error in code:-1 path', async () => {
  const r = await runNodeScript('does-not-exist-' + Date.now() + '.mjs');
  // The script doesn't exist → node exits non-zero (1 typically) but the
  // `error` event is NOT fired (since spawn itself succeeded). Either way
  // the contract is "resolves with non-zero", which is what callers rely on.
  assert.notEqual(r.code, 0);
});

test('runNodeScript: env override merged into child env', async () => {
  // Write a one-shot inspector script that prints back an env var.
  writeFileSync(
    resolve(projectRoot, 'env-probe.mjs'),
    `process.stdout.write(process.env.CAREEROPS_RUNNER_TEST || 'unset');\n`
  );
  const r = await runNodeScript('env-probe.mjs', [], {
    env: { CAREEROPS_RUNNER_TEST: 'override-value' },
  });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, 'override-value');
});

// ────────────────────────── streamNodeScript ──────────────────────────

function fakeRes() {
  const r = new EventEmitter();
  r.headers = null;
  r.chunks = [];
  r.ended = false;
  r.writeHead = (status, headers) => { r.headers = headers; r._status = status; };
  r.flushHeaders = () => {};
  r.write = (s) => { r.chunks.push(s); return true; };
  r.end = () => { r.ended = true; };
  return r;
}

// Poll until `pred(res)` holds. Spawning a child node process is not
// bounded by any fixed sleep — under coverage instrumentation or machine
// load a 200ms wait flakes (seen locally on `npm run test:coverage`),
// while CI stays green. 5s is far above any healthy spawn+exit.
async function waitFor(res, pred, deadlineMs = 5000) {
  const t0 = Date.now();
  while (!pred(res) && Date.now() - t0 < deadlineMs) {
    await new Promise((r) => setTimeout(r, 25));
  }
}

test('streamNodeScript: sends start + log + done events', async () => {
  const res = fakeRes();
  streamNodeScript(res, 'echo.mjs');
  // Wait for the child to exit (usually instant, but not bounded)
  await waitFor(res, (r) => r.ended);
  // Headers
  assert.equal(res._status, 200);
  assert.equal(res.headers['Content-Type'], 'text/event-stream');
  // Joined chunks form a multi-event SSE stream
  const all = res.chunks.join('');
  assert.match(all, /event: start/);
  assert.match(all, /"script":"echo\.mjs"/);
  assert.match(all, /event: log[\s\S]*"line":"hello"/);
  assert.match(all, /event: log[\s\S]*"line":"warning"/);
  assert.match(all, /event: done[\s\S]*"code":0/);
  assert.equal(res.ended, true);
});

test('streamNodeScript: client-close kills the child', async () => {
  const res = fakeRes();
  streamNodeScript(res, 'slow.mjs');
  // Simulate the browser disconnecting before the script finishes.
  await new Promise((r) => setTimeout(r, 100));
  res.emit('close');
  // The child should die (we asserted `slow.mjs` would otherwise sleep 10s);
  // confirm a `done`/`error` event arrives well before that.
  await waitFor(res, (r) => /event: (done|error)/.test(r.chunks.join('')));
  const all = res.chunks.join('');
  assert.match(all, /event: (done|error)/);
});

test('streamNodeScript: non-zero exit is reported in done event', async () => {
  const res = fakeRes();
  streamNodeScript(res, 'fail.mjs');
  await waitFor(res, (r) => r.ended);
  const all = res.chunks.join('');
  assert.match(all, /event: done[\s\S]*"code":7/);
});
