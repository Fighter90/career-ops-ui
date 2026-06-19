/**
 * Tests for validateEvaluationReport (v1.75.0 — parent v1.12.0 #819 parity).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEvaluationReport } from '../server/lib/eval-validate.mjs';

const GOOD = `
## Block A — Fit
...
## Block B
## Block C
## Block D
## Block E
## Block F
## Block G — Posting Legitimacy
...

---SCORE_SUMMARY---
COMPANY: Acme AI
ROLE: Head of Applied AI
ARCHETYPE: AI Leadership
LEGITIMACY: Verified
SCORE: 4.2
---END_SUMMARY---
`;

test('valid A–G report with SCORE_SUMMARY → no issues', () => {
  assert.deepEqual(validateEvaluationReport(GOOD), []);
});

test('empty text → single issue', () => {
  assert.deepEqual(validateEvaluationReport(''), ['empty evaluation report']);
  assert.deepEqual(validateEvaluationReport(null), ['empty evaluation report']);
});

test('missing blocks are each reported', () => {
  const text = `## Block A\n## Block B\n---SCORE_SUMMARY---\nCOMPANY: X\nROLE: Y\nARCHETYPE: Z\nLEGITIMACY: Verified\nSCORE: 3\n---END_SUMMARY---`;
  const issues = validateEvaluationReport(text);
  for (const b of ['C', 'D', 'E', 'F', 'G']) {
    assert.ok(issues.includes(`missing Block ${b}`), `expected missing Block ${b}`);
  }
});

test('missing SCORE_SUMMARY block flagged', () => {
  const text = '## Block A\n## Block B\n## Block C\n## Block D\n## Block E\n## Block F\n## Block G';
  assert.ok(validateEvaluationReport(text).includes('missing SCORE_SUMMARY block'));
});

test('score out of range flagged', () => {
  const text = GOOD.replace('SCORE: 4.2', 'SCORE: 9.9');
  assert.ok(validateEvaluationReport(text).includes('SCORE_SUMMARY score must be a number between 0 and 5'));
});

test('COMPANY may be unknown, but ROLE/ARCHETYPE/LEGITIMACY may not', () => {
  const text = GOOD
    .replace('COMPANY: Acme AI', 'COMPANY: unknown')
    .replace('ROLE: Head of Applied AI', 'ROLE: unknown');
  const issues = validateEvaluationReport(text);
  assert.ok(!issues.includes('SCORE_SUMMARY COMPANY is required'));
  assert.ok(issues.includes('SCORE_SUMMARY ROLE is required'));
});
