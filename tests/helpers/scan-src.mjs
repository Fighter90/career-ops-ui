/**
 * Scan-view source helper (v1.132.0).
 *
 * The #/scan view was split: the results-rendering subsystem (renderResults,
 * buildChipRow, the row/facet builders, FALLBACK_SOURCES) moved out of
 * `public/js/views/scan.js` into `public/js/lib/scan-results.js` to satisfy the
 * < 800-LOC file-size contract. Source-static tests that grep the scan view for
 * a rule/pattern read the CONCATENATION via `loadScanSrc()` so a pattern that
 * moved between the two files is still found — the assertion is agnostic to
 * which physical file now holds it.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The two files that make up the #/scan view, concatenated. */
export function loadScanSrc() {
  return [
    readFileSync(resolve(ROOT, 'public', 'js', 'views', 'scan.js'), 'utf8'),
    readFileSync(resolve(ROOT, 'public', 'js', 'lib', 'scan-results.js'), 'utf8'),
  ].join('\n');
}
