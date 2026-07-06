/**
 * SPA-M2 — plain JSON calls must go through API.* (connection banner,
 * Accept-Language, error shaping), never raw fetch(). The only allowed raw
 * fetch() call sites are the capabilities API.* does not offer:
 *
 *   - auto.js / auto-pipeline.js  → POST + ReadableStream SSE consumption
 *   - cv.js                       → multipart/binary CV import upload
 *   - report-export.js / pdf-generate.js → binary blob downloads
 *
 * Everything else that fetches JSON was migrated (config, dashboard, scan,
 * bug-report). New raw fetch() sites must either use API.* or be added to
 * the allowlist here WITH a reason.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const ALLOWED = new Set([
  'auto.js',            // SSE ReadableStream
  'auto-pipeline.js',   // SSE ReadableStream
  'cv.js',              // binary import upload
  'report-export.js',   // blob download
  'pdf-generate.js',    // blob download
]);

function jsFiles(dir) {
  return readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => join(dir, f));
}

test('no raw fetch() outside the documented streaming/blob call sites', () => {
  const offenders = [];
  for (const file of [
    ...jsFiles(join(ROOT, 'public', 'js', 'views')),
    ...jsFiles(join(ROOT, 'public', 'js', 'lib')),
  ]) {
    if (ALLOWED.has(basename(file))) continue;
    const src = readFileSync(file, 'utf8');
    // Bare fetch( — not API.get/… and not part of a longer identifier.
    const hits = src.match(/(?<![\w.])fetch\(/g) || [];
    if (hits.length) offenders.push(`${basename(file)} (${hits.length})`);
  }
  assert.deepEqual(offenders, [], `raw fetch() found in: ${offenders.join(', ')}`);
});
