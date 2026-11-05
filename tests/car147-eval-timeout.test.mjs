/**
 * CAR-147 — POST /api/evaluate with locale `ta` returned HTTP 502 after
 * exactly 300 s with an empty report (prod, 2026-10-26): the server's own
 * EVAL_TIMEOUT_MS aborts the provider call, and Tamil is output-token-dense —
 * Indic scripts tokenize at several tokens per syllable — so the same
 * buffered 16384-token report sits at/past the 300 s wall (the repo already
 * documented a looping 46 587-char ta report). The INPUT is not slower: the
 * prompt is ≈ EN and the context prefix is prompt-cached (CAR-111).
 *
 * CAR-218 — remote-QA on v1.264.0 caught transient `502 · 300 s · 0 ch` runs
 * on es and zh-CN — locales that were never token-dense — so CAR-147's
 * locale-aware split (300 s base / 480 s for ta/hi/it/pl/ja) is folded into
 * ONE ceiling: 480 s for EVERY locale. The locale split survives only in the
 * output-token budget (evalMaxTokens, CAR-174 — untouched here).
 *
 * Contract: evalTimeoutMs(lang) is a pure function of the locale returning
 * 480_000 unconditionally (the lang argument stays in the signature — call
 * sites and this suite pin it), and EVERY evaluate-family call site (the
 * merged /api/evaluate cascade, both gemini-eval.mjs subprocess sites, the
 * auto-pipeline evaluation) passes `timeoutMs: evalTimeoutMs(<locale>)`,
 * never the bare constant. mode/deep/smoke paths are out of scope.
 * CAR-174 extends the token half: every in-process site passes
 * `maxTokens: evalMaxTokens(<locale>)` (16384 base, 32768 token-dense).
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT with cv.md; no network, no keys.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LLM_SRC = resolve(HERE, '..', 'server', 'lib', 'routes', 'llm.mjs');
const AUTO_SRC = resolve(HERE, '..', 'server', 'lib', 'routes', 'auto-pipeline.mjs');

let evalTimeoutMs;
let ROOT;

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'car147-eval-timeout-'));
  for (const d of ['config', 'data', 'modes']) mkdirSync(resolve(ROOT, d), { recursive: true });
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\n');
  writeFileSync(resolve(ROOT, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(ROOT, 'data', 'applications.md'), '');
  for (const m of ['_shared', 'oferta']) writeFileSync(resolve(ROOT, 'modes', `${m}.md`), `# ${m}\n`);
  process.env.CAREER_OPS_ROOT = ROOT;
  ({ evalTimeoutMs } = await import('../server/lib/routes/llm.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  rmSync(ROOT, { recursive: true, force: true });
});

test('evalTimeoutMs: every locale gets the single 480 s ceiling (CAR-218)', () => {
  assert.equal(evalTimeoutMs('en'), 480_000);
  assert.equal(evalTimeoutMs('es'), 480_000);
  assert.equal(evalTimeoutMs('zh-CN'), 480_000);
  assert.equal(evalTimeoutMs('ru'), 480_000);
  assert.equal(evalTimeoutMs('fr'), 480_000);
  assert.equal(evalTimeoutMs('de-DE'), 480_000);
  assert.equal(evalTimeoutMs('xx'), 480_000); // unknown locale
  assert.equal(evalTimeoutMs(), 480_000);
  assert.equal(evalTimeoutMs(undefined), 480_000);
});

test('evalTimeoutMs: the CAR-147 token-dense locales (ta, hi) are no longer special', () => {
  assert.equal(evalTimeoutMs('ta'), 480_000);
  assert.equal(evalTimeoutMs('hi'), 480_000);
  assert.equal(evalTimeoutMs('ta-IN'), 480_000);
  assert.equal(evalTimeoutMs('TA'), 480_000); // case-insensitive, defensive
});

test('evalTimeoutMs is a pure function of the lang string', () => {
  assert.equal(evalTimeoutMs('ta'), evalTimeoutMs('ta'));
  assert.equal(evalTimeoutMs('en'), evalTimeoutMs('en'));
});

test('source-static: the two-step evaluate carries per-step ceilings and a ≤300 s render clock (CAR-229/230)', () => {
  const two = readFileSync(resolve('server/lib/eval-two-step.mjs'), 'utf8');
  // Scoring is a bounded JSON answer: ≤120 s, small budget, pinned temperature.
  assert.match(two, /SCORING_TIMEOUT_MS = 120_000/);
  assert.match(two, /SCORING_MAX_TOKENS = 2000/);
  assert.match(two, /SCORING_TEMPERATURE = 0\.1/);
  // Render keeps a hard ≤300 s clock — no "eternal" request. The output
  // budget is locale-aware again (review v1.268.1 restored CAR-174):
  // the caller threads evalMaxTokens(lang) (16384 EN / 32768 token-dense);
  // the literal below is the EN default for direct calls.
  assert.match(two, /RENDER_TIMEOUT_MS = 300_000/);
  assert.match(two, /maxTokens: opts\.maxTokens \|\| 16384/);
  assert.match(two, /timeoutMs: RENDER_TIMEOUT_MS/);
});

test('source-static: the evaluate gemini-eval subprocess passes evalTimeoutMs(lang)', () => {
  const llm = readFileSync(LLM_SRC, 'utf8');
  assert.match(llm, /runNodeScript\('gemini-eval\.mjs', args, \{ timeoutMs: evalTimeoutMs\(lang\) \}\)/);
});

test('source-static: the auto-pipeline evaluation goes through the two-step helper; the gemini subprocess keeps evalTimeoutMs', () => {
  const ap = readFileSync(AUTO_SRC, 'utf8');
  // The cascade path delegates to the shared two-step helper (per-step
  // ceilings live there — see the CAR-229 test above).
  assert.match(ap, /runTwoStepEvaluation\(jdText, lang,/);
  // the cloned 300_000 wall is gone — a future call site must use evalTimeoutMs
  assert.doesNotMatch(ap, /const EVAL_TIMEOUT_MS = 300_000/);
  // The gemini subprocess keeps the locale-aware clock (evalTimeoutMs(lang)).
  assert.match(ap, /timeoutMs: evalTimeoutMs\(lang\), signal: ctrl\.signal \}\)/);
});
