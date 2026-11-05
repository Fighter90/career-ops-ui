/**
 * eval-two-step.mjs — the orchestration shared by /api/evaluate and the
 * auto-pipeline's eval step (CAR-229/230).
 *
 * scoring (en JSON, temperature 0.1, ≤120 s) → render (locale body, ≤300 s)
 * → server-side assembly (header + SCORE_SUMMARY + yaml block) → validation.
 * A bad scoring JSON gets exactly one retry; a body missing blocks gets one
 * stricter retry and then the server-side fallback body. Every deviation is
 * surfaced as a warning, never silently swallowed.
 */

import { runActiveProvider } from './llm-dispatch.mjs';
import { bundleProjectContext } from './prompts.mjs';
import {
  buildScoringPromptParts,
  buildRenderPromptParts,
  extractScoringJson,
  normalizeScoring,
  assembleReport,
  fallbackBody,
  missingBlocks,
  serverToday,
} from './eval-scoring.mjs';
import { languageOk } from '../../scripts/remote-qa/lang-check.mjs';

const SCORING_TIMEOUT_MS = 120_000;
const SCORING_MAX_TOKENS = 2000;
const RENDER_TIMEOUT_MS = 300_000;
const SCORING_TEMPERATURE = 0.1;
const RENDER_TEMPERATURE = 0.3;

const sleep = (ms, signal) => new Promise((resolve) => {
  if (signal?.aborted) resolve();
  else setTimeout(resolve, ms);
});

/**
 * @param {string} jd sanitized job description
 * @param {string} lang UI locale ('' → en)
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
    if (u.cached_tokens !== undefined) usage.cached = (usage.cached || 0) + u.cached_tokens;
    else if (u.cache_read_input_tokens !== undefined) usage.cached = (usage.cached || 0) + u.cache_read_input_tokens;
    if (u.cost !== undefined) usage.cost = (usage.cost || 0) + u.cost;
    if (Number.isFinite(u.durationMs)) usage.durationMs = (usage.durationMs || 0) + u.durationMs;
  };

  const ctxWarnings = [];
  const ctx = bundleProjectContext({ modeSlugs: ['_shared', 'oferta'], lang: 'en', warnings: ctxWarnings });
  warnings.push(...ctxWarnings);

  // ── Step 1: scoring (en JSON, pinned temperature, one retry) ──────────
  onStage('scoring');
  const scoringParts = buildScoringPromptParts(jd);
  const scoringPrefix = ctx + scoringParts.stable;
  const scoringPrompt = scoringPrefix + scoringParts.volatile;
  let scoring = null;
  let lastScoringError = '';
  for (let attempt = 0; attempt < 2 && !scoring; attempt += 1) {
    if (attempt > 0) {
      warnings.push('scoring retry: the first answer was not usable JSON');
      await sleep(1000, opts.signal);
    }
    const r = await runActiveProvider(scoringPrompt, {
      maxTokens: SCORING_MAX_TOKENS,
      timeoutMs: SCORING_TIMEOUT_MS,
      temperature: SCORING_TEMPERATURE,
      signal: opts.signal,
      cachePrefix: scoringPrefix,
    });
    absorb(r.usage);
    steps += 1;
    if (r.mode === 'too-large') { lastScoringError = `prompt too large (${r.size} > ${r.cap})`; continue; }
    if (r.error) { lastScoringError = r.error; continue; }
    const parsed = extractScoringJson(r.markdown);
    if (!parsed) { lastScoringError = 'answer contained no JSON object'; continue; }
    try {
      scoring = normalizeScoring(parsed);
    } catch (e) {
      lastScoringError = e.message;
    }
  }
  if (!scoring) {
    const err = new Error(`scoring step failed after retry: ${lastScoringError || 'no usable answer'}`);
    err.step = 'scoring';
    throw err;
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
      maxTokens: 16384,
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
    url: opts.url,
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
