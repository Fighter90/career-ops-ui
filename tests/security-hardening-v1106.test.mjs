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

test('config.mjs skips prototype keys when applying env vars to process.env', () => {
  const src = read('server', 'lib', 'routes', 'config.mjs');
  assert.match(src, /k === '__proto__' \|\| k === 'constructor' \|\| k === 'prototype'/);
});
