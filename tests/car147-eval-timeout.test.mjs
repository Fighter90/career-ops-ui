/**
 * CAR-147 — POST /api/evaluate with locale `ta` returned HTTP 502 after
 * exactly 300 s with an empty report (prod, 2026-10-26): the server's own
 * EVAL_TIMEOUT_MS aborts the provider call, and Tamil is output-token-dense —
 * Indic scripts tokenize at several tokens per syllable — so the same
 * buffered 16384-token report sits at/past the 300 s wall (the repo already
 * documented a looping 46 587-char ta report). The INPUT is not slower: the
 * prompt is ≈ EN and the context prefix is prompt-cached (CAR-111).
 *
 * Contract: the evaluation ceiling is a pure function of the locale —
 * EN (and unknown/undefined) keep the 300 s wall; token-dense locales
 * (ta, hi) get 480 s — and EVERY evaluate-family call site (the merged
 * /api/evaluate cascade, both gemini-eval.mjs subprocess sites, the
 * auto-pipeline evaluation) passes `timeoutMs: evalTimeoutMs(<locale>)`,
 * never the bare constant. mode/deep/smoke paths are out of scope.
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

test('evalTimeoutMs: EN and unknown/undefined keep the 300 s wall', () => {
  assert.equal(evalTimeoutMs('en'), 300_000);
  assert.equal(evalTimeoutMs(), 300_000);
  assert.equal(evalTimeoutMs(undefined), 300_000);
  assert.equal(evalTimeoutMs('fr'), 300_000);
  assert.equal(evalTimeoutMs('de-DE'), 300_000);
});

test('evalTimeoutMs: token-dense locales (ta, hi) get the 480 s ceiling', () => {
  assert.equal(evalTimeoutMs('ta'), 480_000);
  assert.equal(evalTimeoutMs('hi'), 480_000);
  assert.equal(evalTimeoutMs('ta-IN'), 480_000);
  assert.equal(evalTimeoutMs('TA'), 480_000); // case-insensitive, defensive
});

test('evalTimeoutMs is a pure function of the lang string', () => {
  assert.equal(evalTimeoutMs('ta'), evalTimeoutMs('ta'));
  assert.equal(evalTimeoutMs('en'), evalTimeoutMs('en'));
});

test('source-static: the merged /api/evaluate cascade passes evalTimeoutMs(lang)', () => {
  const llm = readFileSync(LLM_SRC, 'utf8');
  assert.equal((llm.match(/maxTokens: EVAL_MAX_TOKENS/g) || []).length, 1);
  assert.match(llm, /maxTokens: EVAL_MAX_TOKENS,\s*timeoutMs: evalTimeoutMs\(lang\),/);
  // and never reverts to the bare constant at that site
  assert.doesNotMatch(llm, /maxTokens: EVAL_MAX_TOKENS,\s*timeoutMs: EVAL_TIMEOUT_MS,/);
});

test('source-static: the evaluate gemini-eval subprocess passes evalTimeoutMs(lang)', () => {
  const llm = readFileSync(LLM_SRC, 'utf8');
  assert.match(llm, /runNodeScript\('gemini-eval\.mjs', args, \{ timeoutMs: evalTimeoutMs\(lang\) \}\)/);
});

test('source-static: the auto-pipeline evaluation (cascade + subprocess) passes evalTimeoutMs(lang)', () => {
  const ap = readFileSync(AUTO_SRC, 'utf8');
  assert.match(ap, /maxTokens: EVAL_MAX_TOKENS, timeoutMs: evalTimeoutMs\(lang\), signal: ctrl\.signal/);
  assert.match(ap, /timeoutMs: evalTimeoutMs\(lang\), signal: ctrl\.signal \}\)/);
  // the cloned 300_000 wall is gone — a future call site must use evalTimeoutMs
  assert.doesNotMatch(ap, /const EVAL_TIMEOUT_MS = 300_000/);
});
