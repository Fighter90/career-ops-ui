/**
 * v1.117.1 hardening guards — source-contract checks for the CodeQL triage
 * (review-required tests):
 *   1. the three shell-out endpoints carry the shared per-IP rate limiter,
 *      and stats.mjs actually imports it (a missing import would be a
 *      ReferenceError at first request);
 *   2. the add-entry text extraction runs the tag strip to a fixed point AND
 *      finishes with the residual [<>] sweep — the sweep is what makes the
 *      8-pass bound safe;
 *   3. the reconcile runner maps to the exact parent script name.
 * Plus behavioral checks of the sanitization semantics on pathological inputs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(resolve(__dirname, '..', ...p), 'utf8');

test('shell-out endpoints are rate-limited (followup ×2 + stats/patterns) and imports exist', () => {
  const fu = read('server', 'lib', 'routes', 'followup.mjs');
  assert.match(fu, /import \{ llmRateLimit \} from '\.\.\/rate-limit\.mjs';/);
  assert.match(fu, /app\.get\('\/api\/followup', llmRateLimit,/);
  assert.match(fu, /app\.post\('\/api\/followup\/seed', llmRateLimit,/);
  const st = read('server', 'lib', 'routes', 'stats.mjs');
  assert.match(st, /import \{ llmRateLimit \} from '\.\.\/rate-limit\.mjs';/);
  assert.match(st, /app\.get\('\/api\/stats\/patterns', llmRateLimit,/);
});

test('add-entry extraction: fixed-point strip + residual [<>] sweep (order matters)', () => {
  const src = read('server', 'lib', 'routes', 'cv-studio.mjs');
  const loop = src.indexOf("do { prev = text; text = text.replace(/<[^>]*>/g, ' '); }");
  const sweep = src.indexOf(".replace(/[<>]/g, ' ')");
  assert.ok(loop !== -1, 'fixed-point tag-strip loop missing');
  assert.ok(sweep !== -1, 'residual [<>] sweep missing');
  assert.ok(sweep > loop, 'the [<>] sweep must run AFTER the strip loop — it is what makes the 8-pass bound safe');
});

test('sanitization semantics: no < or > survives pathological inputs', () => {
  // Mirror the route's chain exactly (script/style content drop → fixed-point
  // strip → [<>] sweep) and drive it with the reviewer's pathological cases.
  const sanitize = (input) => {
    let text = String(input || '')
      .replace(/<script\b[\s\S]*?<\/script[^>]*>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style[^>]*>/gi, ' ');
    let prev;
    let passes = 0;
    do { prev = text; text = text.replace(/<[^>]*>/g, ' '); } while (text !== prev && ++passes < 8);
    return text.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
  };
  const cases = [
    '<scr<script>ipt>alert(1)</scr</script>ipt>',
    '<a <b>>',
    '<<>>',
    'unbalanced < angle and a <style x>body{}</style y> tail',
    '<script>steal()</script>ok',
    '<'.repeat(50) + 'deep' + '>'.repeat(50),
  ];
  for (const c of cases) {
    const out = sanitize(c);
    assert.ok(!/[<>]/.test(out), `angle bracket survived for ${JSON.stringify(c)}: ${JSON.stringify(out)}`);
  }
  assert.equal(sanitize('plain 3 less-than 5 prose'), 'plain 3 less-than 5 prose');
});

test('reconcile runner maps to the exact parent script name', () => {
  const src = read('server', 'lib', 'routes', 'runners.mjs');
  assert.match(src, /\{ route: '\/api\/run\/reconcile',\s+script: 'reconcile-pipeline\.mjs' \}/);
});

test('empty-tracker relay: a structured {error} stdout becomes a healthy empty state, not script-error', () => {
  // Source-contract: both shell-out routes special-case the parent's
  // "no data yet" answer (exit 1 + {error} JSON) BEFORE the failure branch.
  const fu = read('server', 'lib', 'routes', 'followup.mjs');
  assert.match(fu, /available: true, empty: true, note: data\.error/);
  assert.ok(fu.indexOf('empty: true') < fu.indexOf("reason: r.killed ? 'timeout' : 'script-error'"),
    'the empty-state relay must run before the script-error branch');
  const st = read('server', 'lib', 'routes', 'stats.mjs');
  assert.match(st, /available: true, empty: true, note: data\.error/);
  // TST-M1 — mirror the followup ordering assertion for stats: the empty
  // relay must precede the failure branch here too.
  assert.ok(st.indexOf('empty: true') < st.indexOf("reason: r.killed ? 'timeout' : 'script-error'"),
    'the stats empty-state relay must run before the script-error branch');
});

test('empty-tracker relay is keyed to the parent\'s EXACT messages, not to {error} shape (SRV-M2)', async () => {
  const { isEmptyTrackerError, sanitizeDetail } = await import('../server/lib/parent-relay.mjs');
  assert.equal(isEmptyTrackerError('No applications found in tracker.'), true);
  assert.equal(isEmptyTrackerError('Not enough data: 2/8 applications beyond "Evaluated". Keep applying and come back later.'), true);
  // Anything else — incl. a caught exception surfaced as {error} — must NOT
  // be masked as a healthy empty state.
  assert.equal(isEmptyTrackerError('TypeError: x is undefined'), false);
  assert.equal(isEmptyTrackerError(''), false);
  assert.equal(isEmptyTrackerError(undefined), false);
  // SRV-M3 — client-facing detail must not leak absolute paths.
  const out = sanitizeDetail('Error: boom\n    at /Users/someone/secret/place/followup-cadence.mjs:12:3');
  assert.ok(!out.includes('/Users/someone'), out);
});
