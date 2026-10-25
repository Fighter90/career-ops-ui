/**
 * FIX-5 (v1.163.0) — the in-app "Ask the docs" assistant answered that the
 * help guide "does not seem to cover exporting a report to PDF", although
 * `#/reports/:slug` has a working 📄 Generate PDF control. A new
 * "Export a report to PDF" H3 was added under §10 Reports in all 17 bundles.
 *
 * This guards that (a) the guidance is present in every bundle, and (b) the
 * docs-assistant retrieval (`splitSections` + `topSections`) surfaces the
 * Reports section for a PDF-export question — i.e. the answer is now grounded.
 * CAR-144 additionally pins the label resolver itself: it reads the assembled
 * dict it is given and fails loudly when a locale entry is missing — never a
 * silent English fallback, never an apostrophe-truncated label.
 *
 * CI-isolated: pure functions + on-disk help bundles; no server/network/LLM.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { splitSections, topSections } from '../server/lib/routes/docs-assistant.mjs';
import { loadAssembledDict } from './helpers/i18n-vm.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const help = (lang) => readFileSync(resolve(ROOT, 'docs', 'help', `${lang}.md`), 'utf8');
const BUNDLES = ['en', 'es', 'pt-BR', 'ko-KR', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi'];

// CAR-107 — the localized bundles cite the label the UI actually renders, so
// the gate resolves `common.generatePdf` per locale from the assembled dict.
// CAR-144 — from the dict it is GIVEN (injectable, so the gate itself is
// testable) and it FAILS LOUDLY when the key is missing for a locale: no
// silent English fallback, and the label is returned whole (the old
// `[^']*` scan truncated at the first apostrophe).
const generatePdfLabel = (dict, lang) => {
  const dictLang = lang === 'ko-KR' ? 'ko' : lang; // dict key is ko, help file is ko-KR
  const label = dict && dict['common.generatePdf'] && dict['common.generatePdf'][dictLang];
  if (!label || !String(label).trim()) {
    throw new Error(`common.generatePdf is missing for locale ${dictLang} — the FIX-5 gate must not fall back to English`);
  }
  return label;
};

test('FIX-5: every help bundle documents report → PDF export in §10 Reports', () => {
  const DICT = loadAssembledDict();
  for (const lang of BUNDLES) {
    const md = help(lang);
    const sections = splitSections(md);
    const reports = sections.find((s) => /^10\./.test(s.title.replace(/^##\s*/, '')) || /#\/reports\b(?!\/)/.test(s.title));
    assert.ok(reports, `${lang}: §10 Reports section found`);
    // The PDF guidance lives in that section: the button label the UI renders
    // in this locale (CAR-107) + the output path.
    const label = generatePdfLabel(DICT, lang);
    assert.match(reports.body, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${lang}: Reports section mentions the PDF button (${label})`);
    assert.match(reports.body, /output\/\*?\.pdf/, `${lang}: Reports section names output/*.pdf`);
  }
});

// CAR-144 — the resolver is keyed to the dict it is GIVEN: no silent English
// fallback when a locale entry is missing (the old `?? 'Generate PDF'`
// fallback let the gate pass against the pre-CAR-107 English label), and a
// label containing an apostrophe is returned whole (the old `[^']*` scan
// truncated at the first `'`, making the match vacuously broad).
test('CAR-144: the PDF label resolver reads the dict it is given and fails loudly on a missing locale', () => {
  const partial = { 'common.generatePdf': { en: 'Generate PDF', ru: 'Создать PDF' } };
  assert.equal(generatePdfLabel(partial, 'ru'), 'Создать PDF', 'the label comes from the injected dict, per locale');
  assert.throws(() => generatePdfLabel(partial, 'fr'), /common\.generatePdf/,
    'a missing locale entry must fail the gate, never fall back to the English label');
  const apostrophe = { 'common.generatePdf': { fr: "Générer l'aperçu PDF" } };
  assert.equal(generatePdfLabel(apostrophe, 'fr'), "Générer l'aperçu PDF",
    'a label containing an apostrophe is returned whole');
});

test('FIX-5: the docs-assistant retrieval surfaces Reports for a PDF-export question', () => {
  const sections = splitSections(help('en'));
  const top = topSections(sections, 'How do I export a report to PDF?', 5);
  const titles = top.map((s) => s.title);
  assert.ok(
    titles.some((t) => /reports/i.test(t)),
    `Reports section must be in the top-5 grounding sections, got: ${titles.join(' | ')}`,
  );
});
