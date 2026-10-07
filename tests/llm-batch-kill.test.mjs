/**
 * v1.241.0 review hardening — /api/stream/batch stops the WHOLE run.
 *
 * batch-runner.sh fans out worker processes. A client disconnect used to
 * SIGTERM only the bash process, leaving the workers running (and billing);
 * there was no SIGKILL escalation and no runtime cap. The runner now gets its
 * own process group, the group is signalled, SIGTERM escalates to SIGKILL,
 * and a run past BATCH_LIMITS.maxRuntimeMs is stopped.
 *
 * The fake runner ignores SIGTERM (as a trapped/busy script would) and starts
 * a background worker that inherits that, so only a group SIGKILL ends both.
 * CI-isolated: mkdtemp root, 127.0.0.1, no network. POSIX only.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const posix = process.platform !== 'win32';
let server; let baseUrl; let ROOT; let BATCH_LIMITS;

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'llm-batch-kill-'));
  mkdirSync(resolve(ROOT, 'batch'), { recursive: true });
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  const runner = resolve(ROOT, 'batch', 'batch-runner.sh');
  writeFileSync(runner, [
    '#!/bin/bash',
    "trap '' TERM",
    'sleep 300 &',
    'echo $! > "$PWD/worker.pid"',
    'echo $$ > "$PWD/runner.pid"',
    'echo started',
    'wait',
    '',
  ].join('\n'));
  chmodSync(runner, 0o755);
  process.env.CAREER_OPS_ROOT = ROOT;
  ({ BATCH_LIMITS } = await import('../server/lib/routes/batch.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(async () => {
  for (const f of ['worker.pid', 'runner.pid']) {
    const p = resolve(ROOT, f);
    if (existsSync(p)) { try { process.kill(Number(readFileSync(p, 'utf8')), 'SIGKILL'); } catch { /* gone */ } }
  }
  delete process.env.CAREER_OPS_ROOT;
  await new Promise((r) => server.close(r));
  try { rmSync(ROOT, { recursive: true, force: true }); } catch {}
});

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function waitFor(fn, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); }
  return fn();
}
const pidOf = (f) => Number(readFileSync(resolve(ROOT, f), 'utf8').trim());

/** Open the SSE stream; resolve once the runner printed `started`. */
async function startRun(signal) {
  const res = await fetch(`${baseUrl}/api/stream/batch`, { signal });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (!buf.includes('started')) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
  }
  await waitFor(() => existsSync(resolve(ROOT, 'worker.pid')) && existsSync(resolve(ROOT, 'runner.pid')));
  return { reader, dec, buf };
}

test('client disconnect kills the runner AND its workers (group SIGTERM → SIGKILL)', { skip: !posix }, async () => {
  BATCH_LIMITS.killGraceMs = 200;
  const ctrl = new AbortController();
  await startRun(ctrl.signal);
  const worker = pidOf('worker.pid');
  const runner = pidOf('runner.pid');
  assert.ok(alive(worker) && alive(runner), 'run is up');
  ctrl.abort();
  assert.ok(await waitFor(() => !alive(worker) && !alive(runner)), 'worker and runner are gone after the grace period');
});

test('a run past maxRuntimeMs is stopped and reported', { skip: !posix }, async () => {
  for (const f of ['worker.pid', 'runner.pid']) rmSync(resolve(ROOT, f), { force: true });
  BATCH_LIMITS.killGraceMs = 200;
  BATCH_LIMITS.maxRuntimeMs = 400;
  const { reader, dec } = await startRun();
  const worker = pidOf('worker.pid');
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
  }
  assert.match(buf, /event: error\ndata: \{"message":"batch run stopped: over the \d+ s limit"\}/);
  assert.match(buf, /event: done/);
  assert.ok(await waitFor(() => !alive(worker)), 'worker killed');
});
