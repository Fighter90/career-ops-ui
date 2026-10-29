/**
 * v1.239.4 — the v1.239.3 live run reported "missing SCORE_SUMMARY block"
 * for ko and zh-TW evaluations of 10–11k characters: the answer was cut off
 * at 8192 output tokens before the summary at its end. Providers now say
 * when an answer was cut off, and the evaluation warnings name it.
 *
 * CAR-174 — remote-QA v1.261.1: a ta evaluation ran 268 s and came back
 * 32 032 characters cut at the 16384-token output ceiling — Block B–G and
 * the SCORE_SUMMARY missing (ta volume history 11k → 17k → 32k chars: the
 * model's ta output is unstable in volume). CAR-147 (#524) fixed the
 * wall-clock half (480 s for ta/hi) and exposed the token half. Two layers:
 *   · per-locale output ceiling — evalMaxTokens(lang) gives the token-dense
 *     locales (ta, hi) 32768 while every other locale keeps 16384; the
 *     provider SDK clamps rise to the same ceiling so the value survives;
 *   · a prompt volume budget for ta — the model is told, in Tamil, to keep
 *     each A–G block short and the whole report bounded.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT with cv.md; the stub provider binds
 * 127.0.0.1:0; no network, no keys.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let runOpenAICompatible, runAnthropic, runGemini;
let evaluationWarnings, EVAL_MAX_TOKENS, evalMaxTokens;
let buildEvaluationPrompt;

const reply = (json) => async () => ({ ok: true, status: 200, text: async () => JSON.stringify(json) });

let stub, lastPrompt = '', lastMaxTokens = 0;
const REPLY = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((L) => `## ${L}) Section\nThe candidate meets the requirements: relevant platform experience, Kubernetes and Go valued for this role.`).join('\n\n')
  + '\n\n---SCORE_SUMMARY---\nCOMPANY: Acme\nROLE: Engineer\nSCORE: 4.1\nARCHETYPE: Platform\nLEGITIMACY: High Confidence\n---END_SUMMARY---\n';

before(async () => {
  stub = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try { const b = JSON.parse(body); lastPrompt = b.messages.map((m) => m.content).join('\n'); lastMaxTokens = b.max_tokens; } catch { lastPrompt = ''; }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content: REPLY } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }));
    });
  });
  await new Promise((r) => stub.listen(0, '127.0.0.1', r));

  const dir = mkdtempSync(resolve(tmpdir(), 'eval-truncation-'));
  for (const d of ['config', 'data', 'modes', 'reports']) mkdirSync(resolve(dir, d), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  for (const m of ['_shared', 'oferta']) writeFileSync(resolve(dir, 'modes', `${m}.md`), `# ${m}\n`);
  process.env.CAREER_OPS_ROOT = dir;
  process.env.LLM_PROVIDER = 'hermes';
  process.env.HERMES_API_KEY = 'stub-key-123456';
  process.env.HERMES_BASE_URL = `http://127.0.0.1:${stub.address().port}/v1`;

  ({ runOpenAICompatible } = await import('../server/lib/openai.mjs'));
  ({ runAnthropic } = await import('../server/lib/anthropic.mjs'));
  ({ runGemini } = await import('../server/lib/gemini.mjs'));
  ({ evaluationWarnings, EVAL_MAX_TOKENS, evalMaxTokens } = await import('../server/lib/routes/llm.mjs'));
  ({ buildEvaluationPrompt } = await import('../server/lib/prompts.mjs'));
});

after(() => {
  for (const k of ['CAREER_OPS_ROOT', 'LLM_PROVIDER', 'HERMES_API_KEY', 'HERMES_BASE_URL']) delete process.env[k];
  stub?.close();
});

// ── v1.239.4 contract (unchanged) ───────────────────────────────────────────

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

test('evaluationWarnings names a cut-off report first; EN evaluations keep 16384 tokens', () => {
  const w = evaluationWarnings({ markdown: '## Block A\n', truncated: true });
  assert.equal(w[0], 'report cut off at the output-token limit');
  assert.ok(w.includes('missing SCORE_SUMMARY block'));
  assert.ok(!evaluationWarnings({ markdown: '## Block A\n', truncated: false }).includes('report cut off at the output-token limit'));
  assert.equal(EVAL_MAX_TOKENS, 16384);
});

// ── CAR-174 layer (a): the per-locale output-token ceiling ─────────────────

test('evalMaxTokens: EN and unknown/undefined keep the 16384 ceiling', () => {
  assert.equal(evalMaxTokens('en'), 16384);
  assert.equal(evalMaxTokens(), 16384);
  assert.equal(evalMaxTokens(undefined), 16384);
  assert.equal(evalMaxTokens('fr'), 16384);
  assert.equal(evalMaxTokens('de-DE'), 16384);
});

test('evalMaxTokens: token-dense locales (ta, hi, it) get 32768', () => {
  assert.equal(evalMaxTokens('ta'), 32768);
  assert.equal(evalMaxTokens('hi'), 32768);
  assert.equal(evalMaxTokens('ta-IN'), 32768);
  assert.equal(evalMaxTokens('TA'), 32768); // case-insensitive, defensive
  // CAR-190 tail — remote-QA v1.262.0 (OpenRouter era): an it evaluation ran
  // 264 s and came back 15045 chars cut right before the SCORE_SUMMARY block
  // (tok ~15635 at the 16384 ceiling). Same shape class as ta v1.261.1.
  assert.equal(evalMaxTokens('it'), 32768);
  assert.equal(evalMaxTokens('it-IT'), 32768);
});

test('evalMaxTokens is a pure function of the lang string', () => {
  assert.equal(evalMaxTokens('ta'), evalMaxTokens('ta'));
  assert.equal(evalMaxTokens('en'), evalMaxTokens('en'));
});

test('provider SDKs forward a 32768-token ceiling instead of clamping it back to 16384', async () => {
  let body = null;
  const capture = (j) => async (_url, opts) => { body = JSON.parse(opts.body); return { ok: true, status: 200, text: async () => JSON.stringify(j) }; };
  await runAnthropic('p', { apiKey: 'k', maxTokens: 32768, fetchImpl: capture({ content: [{ type: 'text', text: 'a' }], stop_reason: 'end_turn' }) });
  assert.equal(body.max_tokens, 32768, 'anthropic');
  await runOpenAICompatible('p', { url: 'https://x.invalid/v1', apiKey: 'k', model: 'm', label: 'T', maxTokens: 32768, fetchImpl: capture({ choices: [{ message: { content: 'a' }, finish_reason: 'stop' }] }) });
  assert.equal(body.max_tokens, 32768, 'openai-compatible');
  await runGemini('p', { apiKey: 'k', maxTokens: 32768, fetchImpl: capture({ candidates: [{ content: { parts: [{ text: 'a' }] } }] }) });
  assert.equal(body.generationConfig.maxOutputTokens, 32768, 'gemini');
});

test('provider SDKs still clamp overshoot at the 32768 ceiling', async () => {
  let body = null;
  const capture = async (_url, opts) => { body = JSON.parse(opts.body); return { ok: true, status: 200, text: async () => JSON.stringify({ content: [{ type: 'text', text: 'a' }], stop_reason: 'end_turn' }) }; };
  await runAnthropic('p', { apiKey: 'k', maxTokens: 999_999, fetchImpl: capture });
  assert.equal(body.max_tokens, 32768);
});

test('a ta evaluation asks the provider for 32768 tokens; an en one keeps 16384', async () => {
  const { createApp } = await import('../server/index.mjs');
  const server = await new Promise((r) => { const s = createApp().listen(0, '127.0.0.1', () => r(s)); });
  try {
    const post = (lang) => fetch(`http://127.0.0.1:${server.address().port}/api/evaluate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': lang },
      body: JSON.stringify({ jd: 'Senior Platform Engineer at Acme. Kubernetes, Go, on-call. '.repeat(3), save: false }),
    }).then((r2) => r2.json());
    await post('ta');
    assert.equal(lastMaxTokens, 32768);
    await post('en');
    assert.equal(lastMaxTokens, 16384);
  } finally {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  }
});

// ── CAR-174 layer (b): the ta prompt carries a hard output-volume budget ───

test('the ta evaluation prompt carries a hard output-volume budget; en/es prompts do not', () => {
  const jd = 'Senior Platform Engineer at Acme. Kubernetes, Go, on-call.';
  const ta = buildEvaluationPrompt(jd, 'ta');
  assert.match(ta, /அளவு வரம்பு/, 'volume-limit lead');
  assert.match(ta, /5 வாக்கியங்கள்/, 'at most 5 sentences per block');
  assert.match(ta, /900 சொற்கள்/, 'at most 900 words total');
  // the budget rides the tail, but the language reminder stays the LAST instruction (CAR-92)
  assert.ok(ta.lastIndexOf('Write the whole report in Tamil') > ta.indexOf('அளவு வரம்பு'));
  assert.doesNotMatch(buildEvaluationPrompt(jd, 'en'), /அளவு வரம்பு/);
  assert.doesNotMatch(buildEvaluationPrompt(jd, 'es'), /அளவு வரம்பு/);
});
