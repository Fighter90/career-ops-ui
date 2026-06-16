/**
 * Cover-letter PDF generation. The `cover` mode produces the letter text as
 * markdown; the #/cover result offers a Generate-PDF button that renders it
 * via the shared inline markdown→PDF pipeline (POST /api/stream/pdf/inline).
 * Browser-only wiring is asserted against source (repo convention for
 * mode-page.js).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const read = (...p) => readFileSync(resolve(ROOT, ...p), 'utf8');

const MP = read('public', 'js', 'views', 'mode-page.js');

test('mode-page: cover is a registered generic mode with a JD + optional greeting field', () => {
  assert.match(MP, /slug: 'cover'/, 'cover MODES entry must exist');
  assert.match(MP, /label: 'cover\.jdLbl'/, 'cover must take a job-description input');
  assert.match(MP, /label: 'cover\.greetingLbl'/, 'cover must expose the optional greeting field');
});

test('mode-page: cover + interview-prep results both surface Generate PDF (inline pipeline)', () => {
  // The gate must include BOTH slugs.
  assert.match(
    MP,
    /\(slug === 'interview-prep' \|\| slug === 'cover'\) && window\.PdfGenerate/,
    'Generate PDF must be enabled for cover AND interview-prep',
  );
  // It must use the shared inline markdown→PDF kind and pass the live slug
  // (not a hardcoded one), so the cover PDF is named/handled as `cover`.
  assert.match(
    MP,
    /kind: 'inline', markdown, title, slug, button:/,
    'cover PDF must go through the inline kind with the dynamic slug',
  );
});

test('server: inline PDF endpoint (the cover-letter render target) is POST', () => {
  const runners = read('server', 'lib', 'routes', 'runners.mjs');
  assert.match(runners, /app\.post\('\/api\/stream\/pdf\/inline'/,
    'POST /api/stream/pdf/inline must exist (cover + interview-prep render through it)');
});

test('server: cover is in MODE_ALLOWLIST (the letter-text generator)', () => {
  const llm = read('server', 'lib', 'routes', 'llm.mjs');
  assert.match(llm, /MODE_ALLOWLIST = \[[^\]]*'cover'/, 'cover must be allowlisted for POST /api/mode/cover');
});
