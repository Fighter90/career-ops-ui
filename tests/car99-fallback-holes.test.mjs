// CAR-99 — FALLBACK_SOURCES holes regression.
//
// The v1.253.0/v1.254.0 count-gate regeneration wrote the literal with a
// trailing double comma on every entry (`},,`) — 120 array elision holes.
// `new Set(FALLBACK_SOURCES.map((s) => s.value))` in views/scan.js then held
// `undefined`, and the first `for (const id of ids) id.length` iteration threw
// `TypeError: Cannot read properties of undefined (reading 'length')` — the
// user-visible #/scan crash caught by logbuf on prod (2026-10-24).
//
// The static drift gate (tests/scan-fallback-sources.test.mjs) reads the file
// as TEXT, so holes are invisible to it; this suite executes the file instead
// and asserts the array is dense and every entry is a usable {value,label}.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'public', 'js', 'lib', 'scan-results.js'), 'utf8');

function loadScanResults() {
  globalThis.window = {};
  new Function(src)(); // classic script semantics, same as <script src>
  return window.ScanResults;
}

test('CAR-99: FALLBACK_SOURCES is dense — zero elision holes (the v1.253.0 ",," crash)', () => {
  const F = loadScanResults().FALLBACK_SOURCES;
  assert.ok(Array.isArray(F) && F.length > 100, 'the fallback mirror is populated');
  assert.equal(
    Object.keys(F).length, F.length,
    'no array holes: every index must own an element (a hole becomes undefined in Set iteration and crashes isApiBackedCompany)',
  );
});

test('CAR-99: every FALLBACK_SOURCES entry is a {value,label} with non-empty strings', () => {
  const F = loadScanResults().FALLBACK_SOURCES;
  const bad = F.filter((s) => !s || typeof s !== 'object' || typeof s.value !== 'string' || !s.value || typeof s.label !== 'string');
  assert.deepEqual(bad, [], 'entries must all be usable by the Source dropdown and the company classifier');
});

test('CAR-99: the scan view Set built from FALLBACK_SOURCES holds no undefined (isApiBackedCompany safety)', () => {
  const F = loadScanResults().FALLBACK_SOURCES;
  const set = new Set(F.map((s) => s.value));
  assert.ok(!set.has(undefined), 'undefined in the adapter-id Set makes id.length throw');
  // The exact loop shape views/scan.js::isApiBackedCompany runs — must not throw.
  for (const id of set) {
    if (id.length >= 4) { /* host substring test */ }
  }
  assert.ok(true);
});

test('CAR-99: the source file carries no double-comma elision anywhere', () => {
  assert.ok(!src.includes(',,', ), 'a literal ",," in an array is an elision hole — regenerate the list with single commas');
});
