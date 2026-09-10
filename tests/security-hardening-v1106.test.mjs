/**
 * Security hardening (v1.106.0) — static guards from the CodeQL triage.
 * These are source-pattern checks (the escaped sink is client-side / the proto
 * guards are internal helpers), matching the convention in router.test.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(resolve(__dirname, '..', ...p), 'utf8');

test('router.js escapes the error message before it reaches innerHTML (xss-through-exception)', () => {
  const src = read('public', 'js', 'router.js');
  // The error paragraph must go through an escaper, not raw ${err.message}.
  assert.match(src, /const esc = \(s\) =>/);
  assert.match(src, /\$\{esc\(\(err && err\.message\) \|\| err\)\}/);
  assert.doesNotMatch(src, /<p[^>]*>\$\{\(err && err\.message\) \|\| err\}<\/p>/); // old unescaped form gone
});

test('content.mjs guards dotted-path writes against prototype pollution', () => {
  const src = read('server', 'lib', 'routes', 'content.mjs');
  assert.match(src, /const UNSAFE_KEY = \(k\) =>/);
  assert.match(src, /__proto__.*constructor.*prototype/s);
  // Both writers bail on an unsafe key.
  const guards = src.match(/if \(parts\.some\(UNSAFE_KEY\) \|\| UNSAFE_KEY\(leaf\)\) return;/g) || [];
  assert.ok(guards.length >= 2, `expected setArray + setDotted guarded, found ${guards.length}`);
});

/**
 * v1.233.2 — this used to grep for a literal
 * `k === '__proto__' || k === 'constructor' || k === 'prototype'` guard inside
 * the loop that copies saved values into `process.env`.
 *
 * That guard is gone, and its absence is the improvement. The loop now iterates
 * `KNOWN_KEYS` — a module-level array of hardcoded SCREAMING_SNAKE names —
 * instead of `Object.entries(safe)`, so a prototype key cannot reach the
 * property position at all and a runtime check against one is dead code.
 * CodeQL raised two high-severity `js/remote-property-injection` alerts on the
 * old shape: `safe` is built only from KNOWN_KEYS, but that constraint lives in
 * a different loop and the analyser could not follow it.
 *
 * Asserting the source text of a guard was always the weaker test — it proves a
 * string is present, not that the endpoint is safe. This asserts the structure
 * that makes the guard unnecessary, and `config-endpoint.test.mjs` covers the
 * behaviour end to end.
 */
test('config.mjs cannot steer a process.env write with a request-supplied name', () => {
  const src = read('server', 'lib', 'routes', 'config.mjs');
  // The env-apply loop iterates the constant allowlist, not the request-derived map.
  assert.match(src, /for \(const k of KNOWN_KEYS\) \{[\s\S]{0,400}?process\.env\[k\]/,
    'the process.env write must be reached by iterating KNOWN_KEYS, so the property name is a module literal');
  assert.doesNotMatch(src, /for \(const \[k, val\] of Object\.entries\(safe\)\)/,
    'iterating the request-derived map puts a user-influenced name in the property position');
});
