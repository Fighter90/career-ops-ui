/**
 * v1.239.4 — the v1.239.3 live run reported "missing SCORE_SUMMARY block"
 * for ko and zh-TW evaluations of 10–11k characters: the answer was cut off
 * at 8192 output tokens before the summary at its end. Providers now say
 * when an answer was cut off, and the evaluation warnings name it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runOpenAICompatible } from '../server/lib/openai.mjs';
import { runAnthropic } from '../server/lib/anthropic.mjs';
import { evaluationWarnings, EVAL_MAX_TOKENS } from '../server/lib/routes/llm.mjs';

const reply = (json) => async () => ({ ok: true, status: 200, text: async () => JSON.stringify(json) });

test('OpenAI-compatible: finish_reason "length" marks the answer truncated', async () => {
  const base = { url: 'https://x.invalid/v1', apiKey: 'k', model: 'm', label: 'T' };
  const cut = await runOpenAICompatible('p', { ...base, fetchImpl: reply({ choices: [{ message: { content: 'a' }, finish_reason: 'length' }] }) });
  assert.equal(cut.truncated, true);
  const whole = await runOpenAICompatible('p', { ...base, fetchImpl: reply({ choices: [{ message: { content: 'a' }, finish_reason: 'stop' }] }) });
  assert.equal(whole.truncated, false);
});

test('Anthropic: stop_reason "max_tokens" marks the answer truncated', async () => {
  const cut = await runAnthropic('p', { apiKey: 'k', fetchImpl: reply({ content: [{ type: 'text', text: 'a' }], stop_reason: 'max_tokens' }) });
  assert.equal(cut.truncated, true);
  const whole = await runAnthropic('p', { apiKey: 'k', fetchImpl: reply({ content: [{ type: 'text', text: 'a' }], stop_reason: 'end_turn' }) });
  assert.equal(whole.truncated, false);
});

test('evaluationWarnings names a cut-off report first; evaluations ask for 16384 tokens', () => {
  const w = evaluationWarnings({ markdown: '## Block A\n', truncated: true });
  assert.equal(w[0], 'report cut off at the output-token limit');
  assert.ok(w.includes('missing SCORE_SUMMARY block'));
  assert.ok(!evaluationWarnings({ markdown: '## Block A\n', truncated: false }).includes('report cut off at the output-token limit'));
  assert.equal(EVAL_MAX_TOKENS, 16384);
});
