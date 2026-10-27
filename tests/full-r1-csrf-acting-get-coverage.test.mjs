/**
 * FULL-R1 (finding 1) — static coverage gate: every registered `app.get`
 * under a side-effecting prefix must be matched by request-guard.mjs's
 * `ACTING_GET` regex (the one shared prefix matcher applied once in
 * `server/index.mjs`, BEFORE any route is registered).
 *
 * This is the "future stream route forgetting the guard fails CI"
 * requirement from FULL-R1: a future `app.get('/api/stream/whatever', …)`
 * is covered automatically because ACTING_GET matches the `/api/stream/`
 * PREFIX, not an enumerated list — but this test exists so that changing
 * the prefix itself (or adding an acting GET under a brand-new prefix
 * that ACTING_GET doesn't know about) is caught here, not discovered live.
 *
 * Source-static: reads the route files as text, no server boot.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ROUTE_FILES = [
  resolve(ROOT, 'server/index.mjs'),
  ...readdirSync(resolve(ROOT, 'server/lib/routes'))
    .filter((f) => f.endsWith('.mjs'))
    .map((f) => resolve(ROOT, 'server/lib/routes', f)),
];

/** Every literal `app.get('/path', …)` registration found across the route files. */
function findRegisteredGets() {
  const out = [];
  for (const file of ROUTE_FILES) {
    const src = readFileSync(file, 'utf8');
    const re = /\bapp\.get\(\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(src))) out.push({ path: m[1], file });
  }
  return out;
}

// FULL-R1 review r1 — gate the REAL regex, not a copy: the copy let a
// guard-side narrowing of ACTING_GET pass CI silently while registered
// routes lost coverage. The export in request-guard.mjs is now the single
// source; this test proves REGISTERED ROUTES are the ones it covers.
import { ACTING_GET } from '../server/lib/request-guard.mjs';

test('every app.get() under /api/stream, /api/run or /api/geocode matches ACTING_GET', () => {
  const gets = findRegisteredGets();
  assert.ok(gets.length > 10, 'sanity: the scan found a plausible number of app.get() registrations');
  const streamOrRun = gets.filter((g) => /^\/api\/(stream|run)\b/.test(g.path) || g.path === '/api/geocode');
  assert.ok(streamOrRun.length >= 7, 'sanity: at least the known /api/stream/* GETs were found');
  for (const g of streamOrRun) {
    assert.ok(
      ACTING_GET.test(g.path),
      `${g.path} (registered in ${g.file.split('/').pop()}) is a side-effecting GET but ACTING_GET would not refuse a cross-site request to it`,
    );
  }
});

test('ACTING_GET does not accidentally swallow an unrelated read-only route', () => {
  // A quick canary the other direction: ordinary reads must NOT be
  // classified as acting (over-matching would 403 harmless cross-site
  // reads, which is a correctness bug, not a security one, but still
  // worth catching here).
  for (const safe of ['/api/health', '/api/scan-results', '/api/reports', '/api/tracker', '/api/dashboard']) {
    assert.equal(ACTING_GET.test(safe), false, safe);
  }
});
