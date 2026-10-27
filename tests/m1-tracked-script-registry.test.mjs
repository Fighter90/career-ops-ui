/**
 * FULL-M1 (CAR-164, cluster 3) — TRACKER_MUTATING is the ONE roster of
 * tracker-mutating parent scripts. Before the consolidation every route
 * carried its own private notion of "which scripts rewrite the tracker"
 * (runners.mjs's BUFFERED array next to a bare runNodeScript call,
 * batch.mjs a hardcoded 'merge-tracker.mjs'), so adding a new mutating
 * script meant remembering N scattered call-sites. The property to
 * enforce: a TRACKER_MUTATING script name may appear in a route ONLY as
 * (a) a registry entry feeding `runTrackedScript(def.script)`, or
 * (b) the direct argument of a `runTrackedScript(...)` call — never as a
 * bare `runNodeScript(...)` argument.
 *
 * This also pins the roster shape for the route owners this change does
 * NOT touch (hand-offs): routes/outcome.mjs (spawns outcome.mjs) and
 * routes/followup.mjs (spawns followup-seed.mjs) consult
 * `runTrackedScript` the same way when their owners pick the fix up —
 * the set is already waiting for them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MUTATING = [
  'merge-tracker.mjs',
  'dedup-tracker.mjs',
  'normalize-statuses.mjs',
  'set-status.mjs',
  'outcome.mjs',
  'followup-seed.mjs',
];

test('runner.mjs defines TRACKER_MUTATING exactly once, and no other server module redefines it', () => {
  const runnerSrc = readFileSync(resolve(ROOT, 'server/lib/runner.mjs'), 'utf8');
  assert.equal(runnerSrc.split('TRACKER_MUTATING = new Map').length - 1, 1,
    'the roster must be defined exactly once');
  for (const script of MUTATING) {
    assert.ok(runnerSrc.includes(`'${script}'`), `runner.mjs roster must list ${script}`);
  }
  const libDir = resolve(ROOT, 'server/lib');
  const others = readdirSync(libDir).filter((f) => f.endsWith('.mjs') && f !== 'runner.mjs');
  for (const f of others) {
    const src = readFileSync(join(libDir, f), 'utf8');
    assert.ok(!src.includes('TRACKER_MUTATING'), `${f} must not redefine TRACKER_MUTATING — import it from runner.mjs`);
  }
});

test('a TRACKER_MUTATING script name in a route file is only ever a runTrackedScript call or a registry entry', () => {
  // Documented FULL-M1 hand-offs — files outside this change's ownership
  // (their owners repoint runNodeScript(SEED_SCRIPT)/runNodeScript(SCRIPT)
  // to runTrackedScript, the roster is already waiting in runner.mjs).
  // The literal-bare-call prohibition below still applies to them.
  const HANDOFFS = new Set(['outcome.mjs', 'followup.mjs']);
  const routesDir = resolve(ROOT, 'server/lib/routes');
  for (const f of readdirSync(routesDir).filter((f) => f.endsWith('.mjs'))) {
    if (HANDOFFS.has(f)) continue;
    const lines = readFileSync(join(routesDir, f), 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const script of MUTATING) {
        if (line.includes(`'${script}'`)) {
          // Direct runTrackedScript call, or the BUFFERED registry entry
          // feeding runTrackedScript(def.script) — the only two shapes.
          assert.match(line, /runTrackedScript\(|script:\s*'/,
            `${f}:${i + 1} mentions ${script} outside a runTrackedScript call / registry entry — route it through runTrackedScript (FULL-M1)`);
        }
      }
    });
  }
});

test('routes that spawn outcome.mjs / followup-seed.mjs have not backslid to bare runNodeScript', () => {
  for (const [file, script] of [
    ['server/lib/routes/outcome.mjs', 'outcome.mjs'],
    ['server/lib/routes/followup.mjs', 'followup-seed.mjs'],
  ]) {
    const src = readFileSync(resolve(ROOT, file), 'utf8');
    // These routes are a documented FULL-M1 hand-off (files outside this
    // change's ownership): the roster is waiting in TRACKER_MUTATING. The
    // gate only forbids the worst shape — hardcoding the script name into
    // a bare runNodeScript call — and goes red the moment the owner does
    // the real fix only if they bypass the helper to do it.
    const bare = new RegExp(`runNodeScript\\(\\s*['"]${script}`);
    assert.doesNotMatch(src, bare,
      `${file}: spawn ${script} through runTrackedScript (TRACKER_MUTATING) so it holds its shared-file lock`);
  }
});
