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
let evaluationWarnings, EVAL_MAX_TOKENS, evalMaxTokens, evalTimeoutMs;
let buildEvaluationPrompt;

const reply = (json) => async () => ({ ok: true, status: 200, text: async () => JSON.stringify(json) });

let stub, lastPrompt = '', lastMaxTokens = 0, callCount = 0;
import { twoShapeAnswers, scoringFixture, renderBodyFixture } from './helpers/eval-two-step-stub.mjs';
// v1.268.0 — the two-step contract: the stub branches on the prompt it
// received (scoring → JSON; render → the A–G body). Tests swap `answers`
// to drive the retry/fallback paths.
let answers = twoShapeAnswers({ scoring: scoringFixture({ company: 'Acme', role: 'Engineer', score: 4.1 }), body: renderBodyFixture({}) });

before(async () => {
  stub = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      callCount += 1;
      try { const b = JSON.parse(body); lastPrompt = b.messages.map((m) => m.content).join('\n'); lastMaxTokens = b.max_tokens; } catch { lastPrompt = ''; }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content: answers(lastPrompt) } }], usage: { prompt_tokens: 1, completion_tokens: 1, cached_tokens: callCount > 2 ? 999 : 0 } }));
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
  ({ evaluationWarnings, EVAL_MAX_TOKENS, evalMaxTokens, evalTimeoutMs } = await import('../server/lib/routes/llm.mjs'));
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

test('evalMaxTokens: ja joins the token-dense locales (v1.262.4)', () => {
  // remote-QA on prod v1.262.3 — ja hit `502 · openrouter · 300 s · 0 ch` at the
  // standard ceiling TWICE: the full ×19 run 40981578549 AND the 5-locale spot
  // re-run 41012725839 (ar/ko/zh-CN passed their reruns at 250–291 s; ru's
  // one-off drift did not repeat). Same shape class as it/pl.
  assert.equal(evalMaxTokens('ja'), 32768);
  assert.equal(evalMaxTokens('ja-JP'), 32768);
  assert.equal(evalTimeoutMs('ja'), 480_000);
  assert.equal(evalTimeoutMs('en'), 480_000); // CAR-218 — one ceiling for every locale
});

test('evalMaxTokens: pl joins the token-dense locales (v1.262.3)', () => {
  // remote-QA on prod v1.262.1 — run 40960568766 (full ×19) AND the spot
  // re-run 40968958062: the pl evaluate hit `502 · openrouter · 300 s · 0 ch`
  // at the standard ceiling BOTH times while 18/19 locales passed (it needed
  // 302 s inside the token-dense 480 s clock). Deterministic, not a flake —
  // same shape as it → v1.262.1.
  assert.equal(evalMaxTokens('pl'), 32768);
  assert.equal(evalMaxTokens('pl-PL'), 32768);
  assert.equal(evalTimeoutMs('pl'), 480_000);
  // CAR-218 — the clock no longer splits by locale: every locale keeps the
  // same 480 s ceiling (es/zh-CN transient `502 · 300 s · 0 ch`, v1.264.0 QA).
  assert.equal(evalTimeoutMs('en'), 480_000);
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

// ── v1.268.0 (CAR-229/230): the two-step contract over /api/evaluate ───────

async function drainEvaluate(lang = 'en', jdText = 'Senior Platform Engineer at Acme. Kubernetes, Go, on-call. '.repeat(3)) {
  const { createApp } = await import('../server/index.mjs');
  const server = await new Promise((r) => { const s = createApp().listen(0, '127.0.0.1', () => r(s)); });
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/evaluate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': lang, accept: 'text/event-stream' },
      body: JSON.stringify({ jd: jdText, save: false }),
    });
    assert.equal(res.status, 200);
    const text = await res.text();
    const events = [];
    for (const frame of text.split('\n\n')) {
      const ev = (frame.match(/^event:\s*(.+)$/m) || [])[1];
      const data = (frame.match(/^data:\s*([\s\S]+)$/m) || [])[1];
      if (ev) events.push({ ev, data: data ? JSON.parse(data) : {} });
    }
    return events;
  } finally {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  }
}

test('the two-step evaluate streams stages and the server writes the machine surfaces (CAR-229)', async () => {
  answers = twoShapeAnswers({ scoring: scoringFixture({ company: 'Acme', role: 'Engineer', score: 4.1 }), body: renderBodyFixture({}) });
  const events = await drainEvaluate('en');
  const stages = events.filter((e) => e.ev === 'stage').map((e) => e.data.name);
  assert.deepEqual(stages, ['scoring', 'rendering', 'assembling', 'done']);
  const done = events.find((e) => e.ev === 'done').data;
  // The SERVER writes the header + the yaml machine block from the scoring
  // JSON; the display markdown strips the SCORE_SUMMARY (saved-file contract).
  assert.match(done.markdown, /^# Evaluation: Acme — Engineer/m);
  // CAR-239: the fixture solves INTEGER sub-scores; 4.1 snaps to 4.2 on the
  // six-block mean grid (A=5, B–F=4 → 25/6 → 4.2) and the pins assert the
  // achieved values.
  assert.match(done.markdown, /\*\*Score:\*\* 4\.2\/5/);
  assert.match(done.markdown, /```yaml\ncompany: Acme\nrole: Engineer\nscore: 4\.2/);
  assert.ok(!done.markdown.includes('---SCORE_SUMMARY---'), 'display markdown strips the summary block');
  assert.equal(lastMaxTokens, 16384, 'the render call keeps the 16384 ceiling');
  assert.equal(done.scoring.score, 4.2);
});

test('the machine surface is locale-independent (CAR-102): ru and ta carry the same header + yaml', async () => {
  answers = twoShapeAnswers({ scoring: scoringFixture({ company: 'Acme', role: 'Engineer', score: 4.1 }), body: renderBodyFixture({}) });
  for (const lang of ['ru', 'ta']) {
    const events = await drainEvaluate(lang);
    const done = events.find((e) => e.ev === 'done').data;
    assert.match(done.markdown, /^# Evaluation: Acme — Engineer/m, `${lang}: header`);
    assert.match(done.markdown, /\*\*Score:\*\* 4\.2\/5/, `${lang}: pinned score line`);
    assert.match(done.markdown, /```yaml\ncompany: Acme/, `${lang}: yaml machine block`);
    // CAR-239: integer sub-scores from the solver (A=5, B–F=4, G=4) — the
    // per-block map is the actual sub-score shape, not a fractional one.
    assert.match(done.markdown, /```yaml\n[\s\S]*\nblocks: \{A: 5, B: 4/, `${lang}: per-block map`);
  }
});

test('CAR-245: the display payload keeps the JD-verbatim archive (only SCORE_SUMMARY is stripped)', async () => {
  answers = twoShapeAnswers({ scoring: scoringFixture({ company: 'Acme', role: 'Engineer', score: 4.1 }), body: renderBodyFixture({}) });
  const events = await drainEvaluate('en');
  const done = events.find((e) => e.ev === 'done').data;
  // stripScoreSummary removes the machine summary block ONLY — the JD archive
  // appended after the yaml fence must survive into every consumer (the
  // auto-pipeline saved file is asserted in tests/eval-two-step.test.mjs).
  assert.match(done.markdown, /```yaml\n[\s\S]*?\n```\n\n## Job Description \(archived verbatim\)\n\nSenior Platform Engineer at Acme\./);
  assert.ok(done.markdown.includes('on-call.'), 'the JD text rides verbatim');
  assert.ok(!done.markdown.includes('---SCORE_SUMMARY---'), 'the summary block is still stripped');
});

test('a garbage scoring answer is retried once before failing the step (CAR-229)', async () => {
  let scoringCalls = 0;
  answers = (prompt) => {
    if (prompt.includes('Output ONLY a JSON object')) {
      scoringCalls += 1;
      return scoringCalls === 1 ? 'The posting looks like a fine fit for this candidate overall.' : JSON.stringify(scoringFixture({ company: 'Acme', role: 'Engineer', score: 4.1 }));
    }
    return renderBodyFixture({});
  };
  const events = await drainEvaluate('en');
  const done = events.find((e) => e.ev === 'done').data;
  assert.ok(done.warnings.some((w) => /scoring retry/.test(w)), `retry warning present: ${done.warnings}`);
  assert.match(done.markdown, /```yaml\ncompany: Acme/);
});

test('a render missing blocks after the retry falls back to the server body (CAR-229)', async () => {
  answers = twoShapeAnswers({ scoring: scoringFixture({ score: 3.2 }), body: renderBodyFixture({ broken: ['B', 'C', 'D', 'E', 'F', 'G'] }) });
  const events = await drainEvaluate('en');
  const done = events.find((e) => e.ev === 'done').data;
  assert.equal(done.fallbackUsed, true);
  assert.ok(done.warnings.some((w) => /server fallback body used/.test(w)));
  // The fallback body still carries ALL seven headings — the machine
  // surface stays complete even when the localizer degrades.
  for (const L of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
    assert.match(done.markdown, new RegExp(`## ${L}\\)`), `heading ${L}`);
  }
  assert.match(done.markdown, /```yaml\ncompany: Acme/);
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
