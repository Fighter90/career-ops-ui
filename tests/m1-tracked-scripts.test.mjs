/**
 * FULL-M1 (CAR-164, cluster 1) — tracker-mutating parent scripts spawned by
 * web-ui routes must hold the same in-process lock web-ui's own writers use.
 *
 * The parent tree is read-only for web-ui, so the parent script cannot take
 * `withFileLock(PATHS.applications)` itself — the lock has to wrap the SPAWN
 * in the route. Before this fix:
 *
 *   POST /api/run/merge  ─┐
 *   POST /api/run/dedup  ─┤  three concurrent subprocess read-modify-writes
 *   POST /api/batch/merge ─┘  on data/applications.md — merge-tracker.mjs
 *                             takes the parent's own OS-level tracker lock,
 *                             but dedup-tracker.mjs / normalize-statuses.mjs
 *                             take NOTHING, and none of them can serialize
 *                             against web-ui's in-process tracker writers.
 *
 * `TRACKER_MUTATING` (script → PATHS key of the file it writes) is the one
 * roster; `runTrackedScript` consults it so routes don't scatter lock/args
 * pairs. The subprocess runner is injectable so these tests spawn nothing.
 *
 * Accepted residual (single-user app): a tracker write from a CLI outside
 * web-ui still races a web-ui write — the OS lock covers only the parent
 * scripts that opt in, and this in-process lock covers only spawns web-ui
 * itself makes.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let runTrackedScript;
let TRACKER_MUTATING;
let withFileLock;
let _resetLocks;
let PATHS;

before(async () => {
  const root = mkdtempSync(join(tmpdir(), 'm1-tracked-'));
  writeFileSync(resolve(root, 'cv.md'), '# Test\n');
  mkdirSync(resolve(root, 'data'), { recursive: true });
  process.env.CAREER_OPS_ROOT = root;
  ({ runTrackedScript, TRACKER_MUTATING } = await import('../server/lib/runner.mjs'));
  ({ withFileLock, _resetLocks } = await import('../server/lib/file-lock.mjs'));
  ({ PATHS } = await import('../server/lib/paths.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  _resetLocks();
});

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fake runner: records entry/exit per call so ordering is observable. */
function recordingRunner(log, holdMs = 40) {
  return (script) => {
    const entry = { script, start: Date.now(), end: 0 };
    log.push(entry);
    return delay(holdMs).then(() => { entry.end = Date.now(); return { code: 0, stdout: '', stderr: '' }; });
  };
}

test('TRACKER_MUTATING covers every parent script that rewrites a shared data file', () => {
  const expected = [
    'merge-tracker.mjs',        // applications.md (has its own OS lock)
    'dedup-tracker.mjs',        // applications.md (NO lock in the parent)
    'normalize-statuses.mjs',   // applications.md (NO lock in the parent)
    'set-status.mjs',           // applications.md (has its own OS lock)
    'outcome.mjs',              // applications.md via set-status.mjs
    'followup-seed.mjs',        // data/follow-ups.md (own OS lock, scoped)
  ];
  for (const script of expected) {
    assert.ok(TRACKER_MUTATING.has(script), `${script} must be in TRACKER_MUTATING`);
  }
  // Each entry names the shared file it mutates (the lock target).
  assert.equal(TRACKER_MUTATING.get('followup-seed.mjs'), 'followUps');
  for (const script of expected.slice(0, 5)) {
    assert.equal(TRACKER_MUTATING.get(script), 'applications');
  }
});

test('read-only / non-tracker scripts are NOT in the set (they must never wait on the tracker lock)', () => {
  for (const script of [
    'doctor.mjs', 'verify-pipeline.mjs', 'cv-sync-check.mjs',
    'reconcile-pipeline.mjs', // pipeline.md, not the tracker
    'scan.mjs', 'check-liveness.mjs', 'generate-pdf.mjs',
  ]) {
    assert.equal(TRACKER_MUTATING.has(script), false, `${script} must not be in TRACKER_MUTATING`);
  }
});

test('two concurrent tracked spawns serialize on the tracker lock', async () => {
  _resetLocks();
  const log = [];
  await Promise.all([
    runTrackedScript('merge-tracker.mjs', [], {}, recordingRunner(log)),
    runTrackedScript('dedup-tracker.mjs', [], {}, recordingRunner(log)),
  ]);
  assert.equal(log.length, 2);
  const [first, second] = log[0].start <= log[1].start ? log : [log[1], log[0]];
  assert.ok(
    first.end <= second.start + 2,
    `the second tracked spawn must not start before the first finished (first ${first.start}-${first.end}, second started ${second.start})`,
  );
});

test('a tracked spawn waits for an in-process writer already holding the tracker lock', async () => {
  _resetLocks();
  let releaseHeld;
  const held = withFileLock(PATHS.applications, () => new Promise((r) => { releaseHeld = r; }));
  await delay(10); // let the holder acquire
  let started = false;
  const spawn = runTrackedScript('normalize-statuses.mjs', [], {}, async () => { started = true; return { code: 0 }; });
  await delay(30);
  assert.equal(started, false, 'tracked spawn must wait while the tracker lock is held by an in-process writer');
  releaseHeld();
  await Promise.all([held, spawn]);
  assert.equal(started, true);
});

test('non-mutating scripts pass through without taking the tracker lock', async () => {
  _resetLocks();
  let releaseHeld;
  const held = withFileLock(PATHS.applications, () => new Promise((r) => { releaseHeld = r; }));
  await delay(10);
  const t0 = Date.now();
  const r = await runTrackedScript('doctor.mjs', [], {}, async () => ({ code: 0, stdout: '', stderr: '' }));
  assert.ok(Date.now() - t0 < 80, 'doctor.mjs must run immediately, not wait for the tracker lock');
  assert.equal(r.code, 0);
  releaseHeld();
  await held;
});

test('static gate — routes spawn tracker-mutating scripts through runTrackedScript, never bare runNodeScript', () => {
  const runnersSrc = readFileSync(resolve(ROOT, 'server/lib/routes/runners.mjs'), 'utf8');
  assert.match(runnersSrc, /runTrackedScript\(\s*def\.script/,
    'the BUFFERED runner loop must go through runTrackedScript so TRACKER_MUTATING entries hold the tracker lock');
  assert.doesNotMatch(runnersSrc, /runNodeScript\(\s*def\.script/,
    'a bare runNodeScript(def.script, …) bypasses the tracker lock for merge/dedup/normalize');

  const batchSrc = readFileSync(resolve(ROOT, 'server/lib/routes/batch.mjs'), 'utf8');
  assert.match(batchSrc, /runTrackedScript\(\s*'merge-tracker\.mjs'/,
    'POST /api/batch/merge must hold the tracker lock around the merge-tracker.mjs spawn');
  assert.doesNotMatch(batchSrc, /runNodeScript\(\s*'merge-tracker\.mjs'/,
    'a bare runNodeScript(merge-tracker.mjs) bypasses the tracker lock');
});
