// CAR-97 — the live QA language checker was blind to Vietnamese.
//
// vi is Latin-script and had NO entry in lang-check's WORDS table, so
// `hits(WORDS[locale] || WORDS.en)` counted ENGLISH stop words for a vi
// report — "vi stop words 2, en 2" on the 2026-10-24 live regression read a
// (likely) Vietnamese answer as `report not in vi`. Same failure class as the
// ta fix in v1.248.2 (which added Tamil to SCRIPT); vi needed a WORDS table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { languageOk, describe, prose } from '../scripts/remote-qa/lang-check.mjs';

const VI_REPORT = [
  '# Đánh giá: Công ty ABC — Kỹ sư hậu cần',
  '',
  '## Tóm tắt — A — Điểm phù hợp',
  'Vị trí này là một sự phù hợp tốt cho hồ sơ của ứng viên vì các yêu cầu về hậu cần và tự động hóa.',
  'Công ty sử dụng nhiều công cụ mà ứng viên đã làm việc trong quá khứ, và vai trò này cho phép làm việc từ xa.',
  '',
  '## B — Lợi thế cạnh tranh',
  'Kinh nghiệm của ứng viên với hệ thống phân phối và tối ưu hóa tuyến đường là một lợi thế rõ rệt.',
].join('\n');

test('CAR-97: a Vietnamese report passes languageOk — vi has its own stop-word table', () => {
  assert.equal(languageOk(VI_REPORT, 'vi'), true, 'pure vi prose must not read as "not in vi"');
});

test('CAR-97: describe() counts vi stop words from the vi table, not the English one', () => {
  const d = describe(VI_REPORT, 'vi');
  const m = /vi stop words (\d+), en (\d+)/.exec(d);
  assert.ok(m, `describe format: ${d}`);
  const vi = Number(m[1]);
  const en = Number(m[2]);
  assert.ok(vi >= 5, `vi stop words must reach the >=5 bar from the vi table (got ${vi})`);
  assert.ok(en < vi, `English hits must be the minority in vi prose (en ${en} vs vi ${vi})`);
});

test('CAR-97: an English report still fails the vi check (the gate keeps its teeth)', () => {
  const EN = '## Summary A — Fit\nThe candidate is a strong fit for this role with the required logistics and automation background.\n'.repeat(3);
  assert.equal(languageOk(EN, 'vi'), false, 'an English report must not pass as vi');
});

test('CAR-97: prose() still strips the SCORE_SUMMARY block before counting (vi regression guard)', () => {
  const t = prose(VI_REPORT + '\n---SCORE_SUMMARY---\nfit: 4/5\n---END_SUMMARY---\n');
  assert.ok(!t.includes('SCORE_SUMMARY'), 'the summary block is stripped from the share');
  assert.ok(t.includes('Đánh giá'), 'vi prose survives');
});
