/**
 * The live remote QA judges whether each AI answer is in the locale's
 * language. The v1.238.3 run flagged a Hindi evaluation as "not in hi":
 * counting letters let English terms, URLs and code outweigh Hindi prose
 * (Devanagari vowel signs are not even \p{L}). Words are counted now, with
 * code and URLs dropped, and findings print percentages instead of text.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { languageOk, describe, prose, headingSkeleton } from '../scripts/remote-qa/lang-check.mjs';

const HI = 'यह भूमिका प्लेटफ़ॉर्म टीम के लिए है और उम्मीदवार का अनुभव इसके अनुरूप है। ';
const EN_TERMS = 'Kubernetes Terraform PostgreSQL AWS GCP Go gRPC Kafka ';

test('Hindi prose with English tech terms, code and links is Hindi', () => {
  const yaml = Array.from({ length: 40 }, (_, i) => `  containerPortName${i}: platformServiceDeployment${i}`).join('\n');
  const text = (HI + EN_TERMS).repeat(10)
    + '\n```yaml\n' + yaml + '\n```\n'
    + 'https://example.org/a/very/long/path/that/is/all/latin/letters/and/more/letters\n';
  // Counting letters over the whole text, as before, fails this report.
  const letters = (text.match(/\p{L}/gu) || []).length;
  const deva = (text.match(/[\u0900-\u097F]/g) || []).length;
  assert.ok(deva / letters < 0.3, 'the old letter share would reject it');
  assert.equal(languageOk(text, 'hi'), true, describe(text, 'hi'));
});

test('an English report is not Hindi, and the finding shows only percentages', () => {
  const en = 'The candidate fits the platform role and the evidence supports it. '.repeat(20);
  assert.equal(languageOk(en, 'hi'), false);
  assert.match(describe(en, 'hi'), /^hi script \d+%$/);
  assert.doesNotMatch(describe(en, 'hi'), /candidate/);
});

test('Japanese heavy in kanji passes; Chinese is not Japanese', () => {
  const ja = '本ポジションは基盤チームの中核であり、候補者の経験は要件に合致しています。'.repeat(10);
  const zh = '该职位是平台团队的核心，候选人的经验符合要求。'.repeat(10);
  assert.equal(languageOk(ja, 'ja'), true, describe(ja, 'ja'));
  assert.equal(languageOk(zh, 'ja'), false, describe(zh, 'ja'));
  assert.equal(languageOk(zh, 'zh-CN'), true);
});

test('Russian is not Ukrainian; Latin-word locales still use stop words', () => {
  const ru = 'Эта роль подходит кандидату, опыт соответствует требованиям. '.repeat(10);
  assert.equal(languageOk(ru, 'ru'), true);
  assert.equal(languageOk(ru, 'uk'), false);
  assert.equal(languageOk('Der Kandidat ist für die Rolle geeignet und das ist nicht schlecht. '.repeat(5), 'de'), true);
  assert.equal(prose('a `code` b ```x``` c https://x.y/z d').replace(/\s+/g, ' ').trim(), 'a b c d');
});

test('Arabic and Korean are measured in words; Latin locales report stop-word counts', () => {
  const ar = 'هذا الدور مناسب للمرشح والخبرة تتوافق مع المتطلبات Kubernetes AWS. '.repeat(10);
  const ko = '이 역할은 후보자에게 적합하며 경험이 요구 사항과 일치합니다 Kubernetes AWS. '.repeat(10);
  assert.equal(languageOk(ar, 'ar'), true, describe(ar, 'ar'));
  assert.equal(languageOk(ko, 'ko'), true, describe(ko, 'ko'));
  assert.equal(languageOk('The role fits well. '.repeat(20), 'ko'), false);
  assert.match(describe('Der Kandidat ist gut und die Rolle passt. The end.', 'de'), /^de stop words \d+, en \d+$/);
});

test('headingSkeleton masks every word but keeps a lone A–G letter and the markup', () => {
  const report = '## الكتلة A — ملخص الدور\ntext Acme Corp secret\n## Bloque B — Resumen\n**Veredicto**\n## أ) ملخص\n';
  const s = headingSkeleton(report);
  assert.equal(s, '3 headings, 1 bold lines: "## ʷ A — ʷ ʷ" "## w B — w" "## ʷ) ʷ"');
  assert.doesNotMatch(s, /Acme|secret|Resumen|الكتلة/);
});

test('a short list-shaped answer with three locale stop words and no English ones passes', () => {
  // v1.239.3 live run: a German docs answer scored "de stop words 3, en 0".
  const de = '- Öffne die Seite Scan\n- Wähle eine Quelle\n- Klicke auf Scannen und warte das Ergebnis ab\n';
  assert.equal(languageOk(de, 'de'), true);
  // Three German stop words drowned by English still fail.
  assert.equal(languageOk(de + 'the and with for you your this that are is'.repeat(2), 'de'), false);
});
