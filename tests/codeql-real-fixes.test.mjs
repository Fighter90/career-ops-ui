/**
 * CodeQL real-fix regression locks (2026-10-28 triage — 4 alerts).
 *
 * #667/#668 (high) — server/lib/routes/content.mjs PUT /api/profile iterated
 *   `Object.entries(req.body.fields)` straight into `setDotted(base, path, …)`,
 *   putting a request-supplied string in the property-name position. The 400
 *   gate a few lines above only admits PROFILE_FIELD_PATHS keys, but the
 *   analyser cannot follow that constraint across two loops — the same shape
 *   that produced the v1.233.2 config.mjs alerts (see
 *   security-hardening-v1106.test.mjs). The fix iterates the module-level
 *   allowlist instead, so the property name is a literal by construction.
 *
 * #632 — server/lib/sources/hh.mjs initialised `finalUrl` with the page URL
 *   and immediately overwrote it from the guarded fetch's destructuring
 *   (js/useless-assignment-to-local); the dead initialiser is removed — the
 *   only read stays `finalUrl || ''`-guarded.
 *
 * Behavioural coverage lives where it already is: the known-path write, the
 * unknown-path 400 and the merge-not-replace contract for PUT /api/profile are
 * locked by tests/profile-field-form.test.mjs (referenced, not duplicated).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(resolve(__dirname, '..', ...p), 'utf8');

test('content.mjs PUT /api/profile derives every dotted write from the PROFILE_FIELD_PATHS allowlist', () => {
  const src = read('server', 'lib', 'routes', 'content.mjs');
  // The write loop iterates the module-level allowlist — the property name is
  // a module literal by construction; a request key is only ever READ.
  assert.match(
    src,
    /for \(const path of PROFILE_FIELD_PATHS\) \{[\s\S]{0,200}?setDotted\(base, path, incoming\[path\]\)/,
    'setDotted must be reached by iterating PROFILE_FIELD_PATHS, so the property name is a module literal',
  );
  assert.doesNotMatch(
    src,
    /for \(const \[path, value\] of Object\.entries\(incoming\)\) setDotted/,
    'iterating the request-derived map puts a user-influenced string in the property-name position (CodeQL #667/#668)',
  );
});

test('content.mjs mirrors the same allowlist-driven shape for the array writers', () => {
  const src = read('server', 'lib', 'routes', 'content.mjs');
  assert.match(
    src,
    /for \(const path of Object\.keys\(PROFILE_ARRAY_SPECS\)\) \{[\s\S]{0,200}?setArray\(base, path, incomingArrays\[path\], PROFILE_ARRAY_SPECS\[path\]\)/,
    'setArray must iterate the module-level spec keys, not the request-derived map',
  );
  assert.doesNotMatch(
    src,
    /for \(const \[path, value\] of Object\.entries\(incomingArrays\)\)/,
    'same taint shape as the scalar loop — request-derived key as a property name',
  );
});

test('hh.mjs finalUrl carries no dead initialiser (CodeQL #632)', () => {
  const src = read('server', 'lib', 'sources', 'hh.mjs');
  assert.match(src, /let finalUrl;/, 'declare without the immediately-overwritten initialiser');
  assert.doesNotMatch(src, /let finalUrl = `\$\{HH_SITE\}/, 'the initialiser was dead — always overwritten by the guarded fetch');
  // The only read stays undefined-safe.
  assert.match(src, /finalUrl \|\| ''/);
});
