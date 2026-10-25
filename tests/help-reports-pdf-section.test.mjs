/**
 * FIX-5 (v1.163.0) — the in-app "Ask the docs" assistant answered that the
 * help guide "does not seem to cover exporting a report to PDF", although
 * `#/reports/:slug` has a working 📄 Generate PDF control. A new
 * "Export a report to PDF" H3 was added under §10 Reports in all 17 bundles.
 *
 * This guards that (a) the guidance is present in every bundle, and (b) the
 * docs-assistant retrieval (`splitSections` + `topSections`) surfaces the
 * Reports section for a PDF-export question — i.e. the answer is now grounded.
 *
 * CI-isolated: pure functions + on-disk help bundles; no server/network/LLM.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { splitSections, topSections } from '../server/lib/routes/docs-assistant.mjs';
import { legacyDictText } from './helpers/i18n-vm.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const help = (lang) => readFileSync(resolve(ROOT, 'docs', 'help', `${lang}.md`), 'utf8');
const BUNDLES = ['en', 'es', 'pt-BR', 'ko-KR', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi', 'ta', 'vi'];

// CAR-107 — the localized bundles cite the label the UI actually renders, so
// the gate resolves `common.generatePdf` per locale from the assembled dict
// (en keeps the literal 'Generate PDF').
const generatePdfLabel = (lang) => {
  if (lang === 'en') return 'Generate PDF';
  const dictLang = lang === 'ko-KR' ? 'ko' : lang; // dict key is ko, help file is ko-KR
  const line = legacyDictText().split('\n').find((l) => l.includes(`'common.generatePdf'`));
  const langRe = dictLang.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  const m = line ? line.match(new RegExp(`${langRe}'?:\\s*'([^']*)'`)) : null;
  return m ? m[1] : 'Generate PDF';
};

test('FIX-5: every help bundle documents report → PDF export in §10 Reports', () => {
  for (const lang of BUNDLES) {
    const md = help(lang);
    const sections = splitSections(md);
    const reports = sections.find((s) => /^10\./.test(s.title.replace(/^##\s*/, '')) || /#\/reports\b(?!\/)/.test(s.title));
    assert.ok(reports, `${lang}: §10 Reports section found`);
    // The PDF guidance lives in that section: the button label the UI renders
    // in this locale (CAR-107) + the output path.
    const label = generatePdfLabel(lang);
    assert.match(reports.body, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${lang}: Reports section mentions the PDF button (${label})`);
    assert.match(reports.body, /output\/\*?\.pdf/, `${lang}: Reports section names output/*.pdf`);
  }
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
