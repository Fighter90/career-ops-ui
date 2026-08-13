/**
 * FIX-1 (v1.159.0) — report metadata must not be language-coupled.
 *
 * Pre-fix `parseReportHeader` matched ONLY English bold labels
 * (`**Score:**`, `**Legitimacy:**`, `**Date:**`), so a report generated in
 * any non-English locale produced `scoreNum: null` / empty date / empty
 * legitimacy — and `#/reports` rendered a blank metadata strip with no
 * score pill (reports.js only draws the pill when `scoreNum != null`).
 *
 * The fix parses the language-invariant `## Machine Summary` YAML block
 * (the same `score:` / `legitimacy:` keys auto-pipeline already reads),
 * tolerates locale numeric forms, and falls back to the file mtime for the
 * date — while keeping English reports byte-identical.
 *
 * CI-isolated: pure function, fixtures inline, no server / parent / network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReportHeader, scoreStringToNum, REPORT_LABELS } from '../server/lib/parsers.mjs';

// The one English report from the audit — must stay byte-identical.
const EN_REPORT = `# Evaluation: Netwrk — Team Lead Go

**Date:** 2026-05-27
**Archetype:** Staff Backend
**Score:** 4.5/5
**URL:** https://example.com/j/1
**Legitimacy:** High Confidence
**PDF:** ready

---

## A) Role Summary
…

## Machine Summary
score: 4.5 / 5
legitimacy: High
company: Netwrk
role: Team Lead Go
`;

// A Russian report: localized prose blocks + the language-invariant block.
const RU_REPORT = `# Оценка вакансии: Пример — Ведущий инженер

## Блок A — Краткое описание роли
…

## Блок B — Соответствие CV
…

## Блок C — Уровень и стратегия
Оценка соответствия: 1.5 / 5
Легитимность: High Confidence

## Machine Summary
score: 1.5 / 5
legitimacy: High
company: Пример
role: Ведущий инженер
url: https://example.com/j/2
`;

const NO_SCORE_REPORT = `# Заметка без оценки

Просто текст без блока Machine Summary и без оценки.
`;

test('FIX-1: EN report parses via bold labels, byte-identical to legacy', () => {
  const h = parseReportHeader(EN_REPORT);
  assert.equal(h.score, '4.5/5'); // the bold-label form, NOT the MS "4.5 / 5"
  assert.equal(h.scoreNum, 4.5);
  assert.equal(h.date, '2026-05-27');
  assert.equal(h.legitimacy, 'High Confidence'); // bold value, not MS "High"
  assert.equal(h.url, 'https://example.com/j/1');
});

test('FIX-1: RU report parses via the language-invariant Machine Summary block', () => {
  const h = parseReportHeader(RU_REPORT, { mtime: new Date('2026-07-01T10:00:00Z') });
  assert.equal(h.scoreNum, 1.5, 'scoreNum from MS score');
  assert.ok(h.score.includes('1.5'), 'score display carries the number');
  assert.ok(/^high/i.test(h.legitimacy), 'legitimacy from MS');
  assert.ok(h.date, 'date non-empty (MS date or mtime fallback)');
  assert.equal(h.url, 'https://example.com/j/2');
});

test('FIX-1: date falls back to file mtime when the body has none', () => {
  const h = parseReportHeader(NO_SCORE_REPORT, { mtime: new Date('2026-07-01T10:00:00Z') });
  assert.equal(h.date, '2026-07-01');
});

test('FIX-1: no score anywhere → unparsed shape (scoreNum null, score empty)', () => {
  const h = parseReportHeader(NO_SCORE_REPORT, { mtime: new Date('2026-07-01T10:00:00Z') });
  assert.equal(h.scoreNum, null);
  assert.equal(h.score, '');
});

test('FIX-1: scoreStringToNum tolerates locale numeric forms', () => {
  assert.equal(scoreStringToNum('1.5/5'), 1.5);
  assert.equal(scoreStringToNum('1.5 / 5'), 1.5);
  assert.equal(scoreStringToNum('1,5/5'), 1.5); // comma decimal
  assert.equal(scoreStringToNum('1.5 из 5'), 1.5); // RU "of"
  assert.equal(scoreStringToNum('4.5 out of 5'), 4.5);
  assert.equal(scoreStringToNum('5/5'), 5);
  assert.equal(scoreStringToNum('nope'), null);
  assert.equal(scoreStringToNum('9/5'), null); // out of 0–5 range → null
  assert.equal(scoreStringToNum(null), null);
});

test('FIX-1: locale label table covers all 17 UI locales', () => {
  const LOCALES = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi'];
  for (const l of LOCALES) {
    assert.ok(REPORT_LABELS[l], `REPORT_LABELS missing locale ${l}`);
    assert.ok(REPORT_LABELS[l].score?.length, `no score label for ${l}`);
    assert.ok(REPORT_LABELS[l].legitimacy?.length, `no legitimacy label for ${l}`);
  }
  assert.equal(Object.keys(REPORT_LABELS).length, 17, 'exactly 17 locales');
});

test('FIX-1: localized prose fallback (RU labels, no Machine Summary block)', () => {
  const md = '# Оценка\n\nОценка: 2.0 из 5\nЛегитимность: Medium\n';
  const h = parseReportHeader(md);
  assert.equal(h.scoreNum, 2.0);
  assert.ok(/medium/i.test(h.legitimacy));
});

// ── v1.174.0 audit repro (FIND-1 / FIND-2 / overflow) ──────────────────────
// The real broken reports: an H1 that CONTAINS the score label word
// ("# Оценка вакансии: <title>", note the trailing colon), the real score in
// the localized BOLD form, and NO Machine Summary block. Pre-fix, the loose
// prose matcher grabbed the H1 title → score = the vacancy name → scoreNum null
// → "Score not detected". Legitimacy carried unstripped `**` markers.
const RU_BOLD_NO_MS = `# Оценка вакансии: Anthropic — Global Applied AI Architecture Lead

**Оценка:** 1.5 / 5
**Легитимность:** ** High Confidence

## Блок A — описание
…текст…
`;

test('FIND-1: an H1 that contains the label word is never grabbed as the score', () => {
  const h = parseReportHeader(RU_BOLD_NO_MS, { mtime: new Date('2026-07-01T10:00:00Z') });
  assert.equal(h.scoreNum, 1.5, 'scoreNum from the bold **Оценка:** line, not the H1');
  assert.doesNotMatch(h.score, /Anthropic|Architecture|Lead/, 'score is not the vacancy title');
  assert.ok(/1\.5/.test(h.score), 'score display carries the number');
});

test('FIND-2: markdown emphasis is stripped from the legitimacy value', () => {
  const h = parseReportHeader(RU_BOLD_NO_MS, { mtime: new Date('2026-07-01T10:00:00Z') });
  assert.equal(h.legitimacy, 'High Confidence', 'no leading/trailing ** in the chip');
  assert.doesNotMatch(h.legitimacy, /\*/, 'no asterisks survive in the legitimacy value');
});

test('overflow: a score line with trailing status text compacts to just the score', () => {
  const md = '# Оценка вакансии: Пример\n\n**Оценка:** 1.8, Status: Evaluated, применение не рекомендовано.\n';
  const h = parseReportHeader(md, { mtime: new Date('2026-05-21T10:00:00Z') });
  assert.equal(h.scoreNum, 1.8);
  assert.doesNotMatch(h.score, /Status|рекомендовано/, 'score chip carries no trailing prose');
  assert.ok(h.score.length <= 12, `score display stays short (was "${h.score}")`);
  // AI-review #2 — a bold label with NO derivable number yields an empty score
  // (→ muted "Score not detected" chip), never trailing prose in the field.
  const noNum = parseReportHeader('# Оценка вакансии: X\n\n**Оценка:** применение не рекомендовано.\n');
  assert.equal(noNum.scoreNum, null);
  assert.equal(noNum.score, '', 'no number → empty score field, not prose');
});

test('FIND-1: the bold label beats a same-word H1 even when both have a colon', () => {
  // Both the heading and the score line start with "Оценка" and a colon.
  const md = '# Оценка вакансии: X — Y\n\n**Оценка:** 3.0 / 5\n**Легитимность:** Medium\n';
  const h = parseReportHeader(md, { mtime: new Date('2026-05-27T10:00:00Z') });
  assert.equal(h.scoreNum, 3.0);
});
