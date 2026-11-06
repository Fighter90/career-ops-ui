/**
 * eval-two-step.mjs — the orchestration shared by /api/evaluate and the
 * auto-pipeline's eval step (CAR-229/230), made DETERMINISTIC in v1.268.1
 * (CAR-239).
 *
 * scoring (en JSON, temperature 0, fixed seed where accepted, ≤120 s)
 * → render (locale body, ≤300 s) → server-side assembly (header +
 * SCORE_SUMMARY + yaml block) → validation. A bad scoring JSON gets exactly
 * one retry; a body missing blocks gets one stricter retry and then the
 * server-side fallback body. Every deviation is surfaced as a warning,
 * never silently swallowed.
 *
 * CAR-239 determinism layers, in order:
 *   1. temperature 0 on the scoring step (RENDER keeps its own temperature).
 *   2. a fixed seed (EVAL_SCORE_SEED, default 42) sent to providers that
 *      accept one (the OpenAI-compatible family); Anthropic/Gemini silently
 *      ignore it.
 *   3. self-consistency where no seed is accepted: EVAL_SCORE_SAMPLES
 *      parallel scoring calls (default 3 without seed support, 1 with),
 *      MEDIAN of each sub-score, then the final score is computed once from
 *      the medians. Every sample's usage is absorbed.
 *   4. the scoring cache (scoring-cache.mjs): a repeat of the same
 *      scoring input (header + JD + CV + profile + model) skips the
 *      provider entirely — stage name 'scoring (cached)'. Disable with
 *      EVAL_SCORE_CACHE=0.
 */

import { runActiveProvider, resolveProvider, providerAcceptsSeed } from './llm-dispatch.mjs';
import { bundleProjectContext } from './prompts.mjs';
import {
  buildScoringPromptParts,
  buildRenderPromptParts,
  extractScoringJson,
  normalizeScoring,
  computeFinalScore,
  assembleReport,
  fallbackBody,
  missingBlocks,
  serverToday,
  EVAL_BLOCK_LETTERS,
  EVAL_SCORING_STABLE_HEADER,
} from './eval-scoring.mjs';
import { scoringCacheKey, readScoringCache, writeScoringCache, scoringModelIdentity } from './scoring-cache.mjs';
import { languageOk } from '../../scripts/remote-qa/lang-check.mjs';

const SCORING_TIMEOUT_MS = 120_000;
const SCORING_MAX_TOKENS = 2000;
const RENDER_TIMEOUT_MS = 300_000;
// CAR-239 — the scoring step is a measurement: temperature 0 (was 0.1 in
// v1.268.0; the prod acceptance gate showed the spread that buys).
const SCORING_TEMPERATURE = 0;
const RENDER_TEMPERATURE = 0.3;

const sleep = (ms, signal) => new Promise((resolve) => {
  if (signal?.aborted) resolve();
  else setTimeout(resolve, ms);
});

/**
 * CAR-239 — the fixed sampling seed for the scoring step. EVAL_SCORE_SEED
 * overrides; the default (42) is a constant chosen once, not a per-run
 * random — determinism is the point.
 */
export function evalScoreSeed(env = process.env) {
  const n = Number.parseInt(env.EVAL_SCORE_SEED, 10);
  return Number.isFinite(n) ? n : 42;
}

/**
 * CAR-239 — how many parallel scoring samples to take. Default: 1 when the
 * active provider accepts a seed, 3 when it does not (self-consistency
 * replaces determinism the provider cannot give). EVAL_SCORE_SAMPLES
 * overrides (clamped 1–5).
 */
export function evalScoreSamples(acceptsSeed, env = process.env) {
  const n = Number.parseInt(env.EVAL_SCORE_SAMPLES, 10);
  if (Number.isFinite(n)) return Math.min(5, Math.max(1, n));
  return acceptsSeed ? 1 : 3;
}

/** The one median rule: sorted ascending, element at ⌊n/2⌋ (upper middle for even n). */
function medianOf(values) {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/**
 * CAR-239 — self-consistency: fold N normalized scorings into one. Each
 * block's sub-score is the MEDIAN of the samples; the block summary comes
 * from the first sample whose score equals that median, and the identity
 * fields (company/role/archetype/legitimacy) from the first sample whose
 * final score is the median final — all index-ordered, so the fold is
 * deterministic even when the samples disagree. The final score is then
 * computed ONCE from the median sub-scores, exactly as for a single sample.
 */
export function medianScoring(valid) {
  if (!Array.isArray(valid) || valid.length === 0) {
    throw new Error('medianScoring: no usable scoring samples');
  }
  if (valid.length === 1) return valid[0];
  const blocks = {};
  for (const L of EVAL_BLOCK_LETTERS) {
    const m = medianOf(valid.map((v) => v.blocks[L].score));
    const src = valid[valid.findIndex((v) => v.blocks[L].score === m)];
    blocks[L] = { score: m, summary: src.blocks[L].summary };
  }
  const base = valid[valid.findIndex((v) => v.score === medianOf(valid.map((x) => x.score)))];
  return { ...base, blocks, score: computeFinalScore(blocks) };
}

/** True when the scoring cache is switched off (EVAL_SCORE_CACHE=0/false). */
function cacheDisabled() {
  return process.env.EVAL_SCORE_CACHE === '0' || process.env.EVAL_SCORE_CACHE === 'false';
}

/**
 * @param {string} jd sanitized job description
 * @param {string} lang UI locale ('' → en) — the scoring input is
 *   locale-neutral by construction (the cache-neutrality gate pins it);
 *   `lang` only shapes the render step.
 * @param {object} [opts]
 * @param {string} [opts.url] posting URL for the header
 * @param {string} [opts.saved] saved JD filename for the header
 * @param {string} [opts.salary] server-normalized comp for the yaml block
 * @param {string} [opts.location] posting location for the yaml block
 * @param {string} [opts.today] YYYY-MM-DD anchor (tests)
 * @param {AbortSignal} [opts.signal]
 * @param {(stage: string, detail?: string) => void} [opts.onStage]
 * @returns {Promise<{markdown: string, scoring: object, usage: object|null, warnings: string[], steps: number}>}
 */
export async function runTwoStepEvaluation(jd, lang, opts = {}) {
  const today = opts.today || serverToday();
  const onStage = typeof opts.onStage === 'function' ? opts.onStage : () => {};
  const warnings = [];
  let usage = null;
  let steps = 0;
  const absorb = (u) => {
    if (!u) return;
    if (!usage) usage = { in: 0, out: 0, ...(u.cached !== undefined ? { cached: 0 } : {}) };
    usage.in += u.input_tokens ?? u.prompt_tokens ?? u.in ?? 0;
    usage.out += u.output_tokens ?? u.completion_tokens ?? u.out ?? 0;
    // Review v1.268.1 — a provider that reports the cache sum AS `cached`
    // (instead of cached_tokens / cache_read_input_tokens) must not be lost.
    if (u.cached !== undefined) usage.cached = (usage.cached || 0) + Number(u.cached);
    else if (u.cached_tokens !== undefined) usage.cached = (usage.cached || 0) + u.cached_tokens;
    else if (u.cache_read_input_tokens !== undefined) usage.cached = (usage.cached || 0) + u.cache_read_input_tokens;
    if (u.cost !== undefined) usage.cost = (usage.cost || 0) + u.cost;
    if (Number.isFinite(u.durationMs)) usage.durationMs = (usage.durationMs || 0) + u.durationMs;
  };

  const ctxWarnings = [];
  const ctx = bundleProjectContext({ modeSlugs: ['_shared', 'oferta'], lang: 'en', warnings: ctxWarnings });
  warnings.push(...ctxWarnings);

  // ── Step 1: scoring (en JSON, temperature 0, seed + median, one retry) ─
  const scoringParts = buildScoringPromptParts(jd);
  const scoringPrefix = ctx + scoringParts.stable;
  const scoringPrompt = scoringPrefix + scoringParts.volatile;

  // CAR-239 — the determinism cache: a repeat of the same scoring input
  // (stable header + JD + CV + profile + model) skips the provider. The
  // input is locale-neutral, so one entry serves all 19 locales. The cache
  // is consulted BEFORE the stage fires, so consumers see exactly one
  // scoring stage — 'scoring (cached)' on a hit, 'scoring' on a miss.
  let scoring = null;
  let lastScoringError = '';
  let cacheKey = null;
  if (!cacheDisabled()) {
    try {
      cacheKey = scoringCacheKey({
        stableHeader: EVAL_SCORING_STABLE_HEADER,
        jd,
        model: scoringModelIdentity(resolveProvider()?.mode),
      });
      scoring = readScoringCache(cacheKey);
    } catch { /* the cache is best-effort — scoring works without it */ }
  }
  onStage(scoring ? 'scoring (cached)' : 'scoring');

  if (!scoring) {
    const seed = evalScoreSeed();
    const acceptsSeed = providerAcceptsSeed(resolveProvider()?.mode);
    const samples = evalScoreSamples(acceptsSeed);
    for (let attempt = 0; attempt < 2 && !scoring; attempt += 1) {
      if (attempt > 0) {
        warnings.push('scoring retry: the first answer was not usable JSON');
        await sleep(1000, opts.signal);
      }
      // CAR-239 — self-consistency: N parallel samples through the same
      // shared cascade; every sample's usage is absorbed below.
      const answers = await Promise.all(
        Array.from({ length: samples }, () => runActiveProvider(scoringPrompt, {
          maxTokens: SCORING_MAX_TOKENS,
          timeoutMs: SCORING_TIMEOUT_MS,
          temperature: SCORING_TEMPERATURE,
          seed,
          signal: opts.signal,
          cachePrefix: scoringPrefix,
        })),
      );
      const valid = [];
      for (const r of answers) {
        absorb(r.usage);
        if (r.mode === 'too-large') { lastScoringError ||= `prompt too large (${r.size} > ${r.cap})`; continue; }
        if (r.error) { lastScoringError ||= r.error; continue; }
        const parsed = extractScoringJson(r.markdown);
        if (!parsed) { lastScoringError ||= 'answer contained no JSON object'; continue; }
        try {
          valid.push(normalizeScoring(parsed));
        } catch (e) {
          lastScoringError ||= e.message;
        }
      }
      steps += samples;
      if (valid.length > 0) {
        scoring = medianScoring(valid);
        if (samples > 1) {
          warnings.push(`scoring self-consistency: median of ${valid.length}/${samples} usable samples (EVAL_SCORE_SAMPLES=${samples}, seed ${acceptsSeed ? 'sent' : 'unsupported'})`);
        }
      }
    }
  }
  if (!scoring) {
    const err = new Error(`scoring step failed after retry: ${lastScoringError || 'no usable answer'}`);
    err.step = 'scoring';
    throw err;
  }
  if (cacheKey) {
    try { await writeScoringCache(cacheKey, scoring); } catch { /* best-effort */ }
  }

  // ── Step 2: render (locale body, one stricter retry, server fallback) ─
  onStage('rendering');
  const renderParts = buildRenderPromptParts(jd, lang, scoring);
  const renderPrefix = ctx + renderParts.stable;
  const renderPrompt = renderPrefix + renderParts.volatile;
  let body = '';
  let renderTried = 0;
  for (; renderTried < 2; renderTried += 1) {
    const extra = renderTried > 0
      ? '\nYour previous answer was missing some of the seven sections. Output ALL SEVEN `## A)` … `## G)` sections, nothing else.\n'
      : '';
    const r = await runActiveProvider(renderPrompt + extra, {
      // CAR-174 — the render budget is locale-aware (ta/hi/it/pl/ja ran past
      // 16384 and came back cut). Callers pass evalMaxTokens(lang); the
      // default keeps the EN ceiling for direct calls.
      maxTokens: opts.maxTokens || 16384,
      timeoutMs: RENDER_TIMEOUT_MS,
      temperature: RENDER_TEMPERATURE,
      signal: opts.signal,
      cachePrefix: renderPrefix,
    });
    absorb(r.usage);
    steps += 1;
    if (r.error) {
      warnings.push(`render attempt ${renderTried + 1} failed: ${r.error}`);
      continue;
    }
    body = r.markdown || '';
    const missing = missingBlocks(body);
    if (missing.length === 0) break;
    if (r.truncated) warnings.push(`render cut off at the token ceiling (missing: ${missing.join(', ')})`);
    body = '';
  }
  let fallbackUsed = false;
  if (missingBlocks(body).length > 0) {
    body = fallbackBody(scoring);
    fallbackUsed = true;
    warnings.push(`render incomplete after retry — server fallback body used (${lang || 'en'})`);
  }

  // ── Assembly: the server owns every machine surface ───────────────────
  onStage('assembling');
  const markdown = assembleReport({
    scoring,
    body,
    today,
    // Review v1.268.1 — the URL rides model-adjacent input; a manual-route
    // caller may pass text with embedded newlines (forging `**X:**` header
    // LINES) or bold-label markers (forging them INLINE). Flatten whitespace,
    // strip bold markers, cap. The auto-pipeline caller is gate-validated;
    // this is the belt for the manual path.
    url: typeof opts.url === 'string'
      ? opts.url.replace(/[\r\n\t]+/g, ' ').replace(/\*\*/g, '').trim().slice(0, 400)
      : opts.url,
    pdf: opts.saved ? '✅' : undefined,
    salary: opts.salary,
    location: opts.location,
  });
  if (lang && lang !== 'en' && !languageOk(body, lang)) {
    warnings.push(`report not in ${lang}`);
  }
  onStage('done', fallbackUsed ? 'fallback-body' : 'ok');
  return { markdown, scoring, usage, warnings, steps, fallbackUsed };
}
