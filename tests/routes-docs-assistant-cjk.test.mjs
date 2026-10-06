/**
 * routes-1 — docs-assistant tokenizer: an unspaced CJK question used to be ONE
 * token (`[\p{L}\p{N}]{3,}`) and matched zero help sections. CJK runs are now
 * indexed as character bigrams; Latin/Cyrillic words keep the 3+ rule.
 * Pure functions — no server, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, topSections, splitSections } from '../server/lib/routes/docs-assistant.mjs';

const DOC = [
  '## 简历设置', '在这里设置简历的格式和 PDF 导出。', '',
  '## 扫描', '扫描门户网站的职位。', '',
  '## スキャン', 'スキャンのフィルターを変更する方法。', '',
  '## 이력서 설정', '이력서 설정을 바꾸는 방법.', '',
  '## Tracker', 'How the tracker works.', '',
].join('\n');

test('tokenize: CJK runs become bigrams, Latin words keep the 3+ rule', () => {
  assert.deepEqual(tokenize('设置简历'), ['设置', '置简', '简历']);
  assert.deepEqual(tokenize('How do I scan'), ['how', 'scan']);
  assert.deepEqual(tokenize('PDF格式'), ['pdf', '格式']);
  assert.deepEqual(tokenize('字'), []);
  assert.deepEqual(tokenize(null), []);
});

test('an unspaced Chinese question finds the right section', () => {
  const picked = topSections(splitSections(DOC), '如何设置简历的格式？');
  assert.equal(picked[0].title, '简历设置');
});

test('Japanese and Korean questions find their sections', () => {
  assert.equal(topSections(splitSections(DOC), 'スキャンのフィルターを変更するには')[0].title, 'スキャン');
  assert.equal(topSections(splitSections(DOC), '이력서 설정을 바꾸려면')[0].title, '이력서 설정');
});

test('English retrieval is unchanged', () => {
  assert.equal(topSections(splitSections(DOC), 'how does the tracker work')[0].title, 'Tracker');
});
