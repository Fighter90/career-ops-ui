/**
 * Scan-view source helper (v1.132.0; extended for the P-16 split).
 *
 * The #/scan view was split across several files to satisfy the < 800-LOC
 * file-size contract:
 *   - `public/js/lib/scan-results.js` (v1.132.0) — the results-rendering
 *     subsystem (renderResults, buildChipRow, the row/facet builders,
 *     FALLBACK_SOURCES).
 *   - `public/js/views/scan/runner.js` (P-16) — the scan-execution engine
 *     (progress bar, run-state, Stop, SSE stream, per-source runners).
 *   - `public/js/views/scan/filters.js` (P-16) — the result-filter state
 *     machine (apply/reset + saved-search serialization).
 * Source-static tests that grep the scan view for a rule/pattern read the
 * CONCATENATION via `loadScanSrc()` so a pattern that moved between the files is
 * still found — the assertion is agnostic to which physical file now holds it.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Every file that makes up the #/scan view, concatenated. */
export function loadScanSrc() {
  return [
    readFileSync(resolve(ROOT, 'public', 'js', 'views', 'scan.js'), 'utf8'),
    readFileSync(resolve(ROOT, 'public', 'js', 'views', 'scan', 'runner.js'), 'utf8'),
    readFileSync(resolve(ROOT, 'public', 'js', 'views', 'scan', 'filters.js'), 'utf8'),
    readFileSync(resolve(ROOT, 'public', 'js', 'lib', 'scan-results.js'), 'utf8'),
  ].join('\n');
}
