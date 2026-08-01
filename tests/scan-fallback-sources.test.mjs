/**
 * v1.119.1 — drift guard for the #/scan Source dropdown's offline fallback.
 *
 * `public/js/views/scan.js` keeps a static FALLBACK_SOURCES list that mirrors
 * the server registry at build time (used only when `GET /api/scan/sources`
 * is unreachable). It silently lagged the registry from v1.87.0 through
 * v1.119.0 (21 providers missing). This test parses the client list out of
 * the view source and asserts exact value-set parity with the auto-discovered
 * registry, so adding an adapter without touching the fallback fails CI.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { SOURCES } from '../server/lib/sources/registry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCAN_JS = join(__dirname, '..', 'public', 'js', 'lib', 'scan-results.js');

function parseFallbackSources(src) {
  const start = src.indexOf('const FALLBACK_SOURCES = [');
  assert.ok(start !== -1, 'FALLBACK_SOURCES declaration not found in scan-results.js');
  const end = src.indexOf('];', start);
  const block = src.slice(start, end);
  const entries = [...block.matchAll(/\{\s*value:\s*'([^']+)',\s*label:\s*'((?:[^'\\]|\\.)*)'\s*\}/g)]
    .map((m) => ({ value: m[1], label: m[2].replace(/\\'/g, "'") }));
  return entries;
}

test('scan-results.js FALLBACK_SOURCES mirrors the server source registry exactly', () => {
  const src = readFileSync(SCAN_JS, 'utf8');
  const fallback = parseFallbackSources(src);

  const fallbackValues = fallback.map((s) => s.value).sort();
  const registryValues = SOURCES.map((s) => s.value).sort();
  assert.deepEqual(fallbackValues, registryValues,
    'FALLBACK_SOURCES drifted from server/lib/sources registry — sync the client list');

  // Labels must match the registry meta too (the dropdown shows them verbatim).
  const registryLabels = new Map(SOURCES.map((s) => [s.value, s.label]));
  for (const s of fallback) {
    assert.equal(s.label, registryLabels.get(s.value),
      `label mismatch for "${s.value}"`);
  }

  // No duplicate values in the client list.
  assert.equal(new Set(fallbackValues).size, fallbackValues.length);
});
