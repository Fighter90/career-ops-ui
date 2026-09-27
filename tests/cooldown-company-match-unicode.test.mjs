/**
 * cooldown companyMatch — Unicode keys (parent #2569) and CJK/Korean
 * corporate-form markers (parent parity, career-ops @ 5d1a6380 + 48715f41,
 * #2570 / #3957 / #4491). Cases ported from the parent's
 * tests/company-match-corporate-forms.test.mjs.
 *
 * The only production caller is buildCooldownFilter, where a false merge
 * silently skips a job from a DIFFERENT company as "in cooldown" — so the
 * discrimination cases are load-bearing: this key splits, never merges.
 *
 * CI-isolated: pure functions.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { companyMatch } from '../server/lib/cooldown.mjs';
import { normalizeTextKey } from '../server/lib/text-key.mjs';

test('non-Latin names are compared, not erased to an empty key (#2569)', () => {
  assert.equal(companyMatch('株式会社アカネ', '合同会社ゾロ'), false);
  assert.equal(companyMatch('Тинькофф', 'Тинькофф Банк'), true);
  assert.equal(companyMatch('Тинькофф', 'Яндекс'), false);
  // lookaround anchors, not ASCII \b: an accented edge still bounds a word
  assert.equal(companyMatch('Nestlé Deutschland', 'Nestlé'), true);
  assert.equal(companyMatch('Ørsted', 'Ørsted A/S'), true);
  // a Turkish dotted capital keys like its plain form
  assert.equal(companyMatch('İstanbul Tekstil', 'Istanbul Tekstil'), true);
});

test('strips an unspaced corporate-form prefix or suffix (#2570 repro)', () => {
  assert.equal(companyMatch('株式会社メルカリ', 'メルカリ'), true);
  assert.equal(companyMatch('メルカリ株式会社', 'メルカリ'), true);
  assert.equal(companyMatch('阿里巴巴集团股份有限公司', '阿里巴巴集团'), true);
  assert.equal(companyMatch('삼성전자주식회사', '삼성전자'), true);
});

test('unrelated companies stay apart after stripping their forms', () => {
  assert.equal(companyMatch('株式会社アカネ', '合同会社ゾロ'), false);
});

test('same trade name, different legal form: no false merge', () => {
  assert.equal(companyMatch('株式会社アカネ', '合同会社アカネ'), false);
  assert.equal(companyMatch('阿里有限公司', '阿里株式会社'), false);
  assert.equal(companyMatch('小米股份有限公司', '小米有限公司'), false);
});

test('bare corporate-form-only names fall back to the unstripped key', () => {
  assert.equal(companyMatch('株式会社', '合同会社'), false);
  assert.equal(companyMatch('株式会社', '株式会社'), true);
});

test('a bare form never matches a repeated marker or a named entity (#4491)', () => {
  assert.equal(companyMatch('株式会社', '株式会社株式会社'), false);
  assert.equal(companyMatch('株式・会社', '株式・会社 アカネ'), false);
  assert.equal(companyMatch('合同会社 株式会社', '株式会社 合同会社'), false);
});

test('different forms are a verdict in the containment fallback too (#4491)', () => {
  assert.equal(companyMatch('株式会社アカネ', '合同会社 株式会社アカネ'), false);
  assert.equal(companyMatch('株式会社アカネ', '合同会社株式会社アカネ'), false);
  assert.equal(companyMatch('アカネ株式会社', '合同会社 アカネ株式会社'), false);
  assert.equal(companyMatch('株式会社アカネ', '株式会社アカネ 合同会社'), false);
  assert.equal(companyMatch('株式会社アカネ有限会社', '有限会社アカネ株式会社'), false);
});

test('forms added in #4491 are stripped and obey the different-form rule', () => {
  for (const [a, b] of [
    ['阿里巴巴有限责任公司', '阿里巴巴'],
    ['阿里巴巴有限責任公司', '阿里巴巴'],
    ['合名会社アカネ', 'アカネ'],
    ['合資会社アカネ', 'アカネ'],
    ['一般社団法人アカネ', 'アカネ'],
    ['유한회사카카오', '카카오'],
  ]) assert.equal(companyMatch(a, b), true, `${a} ~ ${b}`);
  assert.equal(companyMatch('合名会社アカネ', '合資会社アカネ'), false);
  assert.equal(companyMatch('小米有限责任公司', '小米有限公司'), false);
});

test('a mid-name marker is not stripped', () => {
  assert.equal(companyMatch('メルカリ株式会社ジャパン', 'メルカリ'), false);
});

test('Latin behaviour is unaffected by the CJK-only list', () => {
  assert.equal(companyMatch('Acme Inc.', 'acme inc'), true);
  assert.equal(companyMatch('Acme', 'Zoro Inc'), false);
  assert.equal(companyMatch('Macmega', 'Acme'), false);
});

test('normalizeTextKey drops only the dotted-I combining dot (parent 462d2765/5df43e71)', () => {
  assert.equal(normalizeTextKey('İstanbul Tekstil'), normalizeTextKey('Istanbul Tekstil'));
  // precomposed dotted letters in Polish / Lithuanian / Maltese keep their dot
  assert.notEqual(normalizeTextKey('Żubr'), normalizeTextKey('Zubr'));
  assert.notEqual(normalizeTextKey('Ėmė'), normalizeTextKey('Eme'));
  assert.notEqual(normalizeTextKey('Ġenerali'), normalizeTextKey('Generali'));
});
