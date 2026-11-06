import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEvaluationReport } from '../server/lib/eval-validate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const HELP = readdirSync(resolve(ROOT, 'docs/help')).filter((name) => name.endsWith('.md'));
const BLOCKS = [
  'A. **Role Summary**',
  'B. **Match with CV**',
  'C. **Level and Strategy**',
  'D. **Comp and Demand**',
  'E. **Customization Plan**',
  'F. **Interview Plan**',
  'G. **Posting Legitimacy**',
  'H. **Draft Application Answers**',
];

test('current help bundles describe the actual A–G shape and optional H', () => {
  assert.equal(HELP.length, 19, 'all supported help locales are covered');
  for (const name of HELP) {
    const text = read(`docs/help/${name}`);
    const reportSection = text.match(/### [^\n]*A[–-]G[^\n]*\n([\s\S]*?)(?=\n### |\n---\n|$)/);
    assert.ok(reportSection, `${name}: missing A–G output-sections heading`);
    for (const block of BLOCKS) {
      assert.ok(reportSection[1].includes(block), `${name}: missing ${block}`);
    }
    assert.ok(!/(?<![A-Za-z])A[–-]F\b/u.test(text), `${name}: still promises A–F output`);
    assert.ok(!/(?:Section|section|секци[ияії]|секції) G\b/u.test(text),
      `${name}: draft application answers incorrectly assigned to G`);
  }
});

test('the active roadmap no longer schedules A–F output', () => {
  const roadmap = read('docs/ROADMAP.md');
  const activePhase = roadmap.split('\n').find((line) => line.startsWith('| P-16 |'));
  assert.ok(activePhase, 'P-16 still exists in the roadmap');
  assert.ok(!/A[–-]F/.test(activePhase), 'active roadmap retains obsolete A–F migration');
});

test('current A–G fixture with optional H validates; legacy A–F remains a viewer concern', () => {
  const report = [
    '# Evaluation: Example — Engineer',
    '**Score:** 4.6/5',
    '**Legitimacy:** High Confidence',
    ...'ABCDEFG'.split('').map((letter) => `## ${letter}) Section ${letter}\nDetails`),
    '## H) Draft Application Answers\nAnswer to application question',
    '---SCORE_SUMMARY---',
    'COMPANY: Example',
    'ROLE: Engineer',
    'ARCHETYPE: Engineer',
    'LEGITIMACY: High Confidence',
    'SCORE: 4.6/5',
    '---END_SUMMARY---',
  ].join('\n\n');
  assert.deepEqual(validateEvaluationReport(report), []);
  const withoutH = report.replace('## H) Draft Application Answers\nAnswer to application question\n\n', '');
  assert.notEqual(withoutH, report, 'fixture must remove H');
  assert.deepEqual(validateEvaluationReport(withoutH), [], 'H remains optional');
});
