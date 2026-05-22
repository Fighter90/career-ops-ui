/**
 * v1.54.5 — F-V54-C (regression run): the #/batch TSV editor had a
 * hint wired via aria-describedby but NO accessible NAME (no <label
 * htmlFor>, no aria-label / aria-labelledby), so a screen reader
 * announced an unlabelled "edit text". aria-describedby supplies a
 * description, not a name (WCAG 1.3.1 Info & Relationships / 4.1.2
 * Name, Role, Value). The textarea now carries an aria-label via the
 * new i18n key `batch.tsvAria`, consistent with the sibling
 * run-control inputs that already use *Aria keys.
 *
 * Browser-only view → asserted statically (router.test.mjs style).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyDictText } from './helpers/i18n-vm.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const BATCH = readFileSync(R('public', 'js', 'views', 'batch.js'), 'utf8');
const DICT = legacyDictText();

test('the batch-tsv textarea has an aria-label (accessible name)', () => {
  // the textarea block: id 'batch-tsv' must own an aria-label that
  // resolves through i18n, while keeping its existing describedby hint.
  const block = BATCH.match(/id:\s*'batch-tsv'[\s\S]{0,500}?placeholder:/);
  assert.ok(block, 'batch-tsv textarea block not found');
  assert.match(block[0], /'aria-label':\s*t\('batch\.tsvAria'/,
    'batch-tsv must have an aria-label via t(batch.tsvAria)');
  assert.match(block[0], /'aria-describedby':\s*'batch-tsv-hint'/,
    'existing aria-describedby hint must be preserved');
});

test('batch.tsvAria is defined across all 8 locales', () => {
  const line = DICT.split('\n').find((l) => l.includes("'batch.tsvAria'"));
  assert.ok(line, 'i18n key batch.tsvAria missing');
  for (const loc of ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr']) {
    const tok = /-/.test(loc) ? `'${loc}':` : `${loc}:`;
    assert.ok(line.includes(tok), `batch.tsvAria missing locale ${loc}`);
  }
});
