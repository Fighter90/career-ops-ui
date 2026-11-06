#!/usr/bin/env node
// evaluate-locale-parity grader (CAR-239).
//
// The v1.268.0 prod acceptance gate failed here: one synthetic JD × 19
// locales scored 2.5–4.0 (spread 1.5; gate ≤ 0.5), because the scoring step
// was non-deterministic AND its input leaked the locale's random fence tag.
// The CAR-239 contract pins the scoring INPUT as locale-neutral — this
// grader proves the whole pipeline holds it.
//
// Modes:
//   default   — STUB mode, offline, CI-isolated: the real two-step evaluate
//               runs against a deterministic stub provider (same JD → same
//               sub-scores). Gate: max−min ≤ 0.5. Must PASS with no network
//               and no keys — it is part of `node evals/workflow/run.mjs`.
//   --live    — post-deploy leg: the SAME gate against a deployed
//               /api/evaluate (1 JD × 19 real locales, real LLM). Opt-in
//               via PROD_URL (or EVAL_PARITY_BASE_URL) + AUTH_LOGIN /
//               AUTH_PASSWORD; never runs from the workflow grader.
//
// Usage: node evals/evaluate-locale-parity/run.mjs [--live]

import { PROBE_JD, LOCALES, withStubEval, spread } from '../lib/stub-eval-harness.mjs';

const GATE = 0.5;
const live = process.argv.includes('--live');
const base = (process.env.EVAL_PARITY_BASE_URL || process.env.PROD_URL || '').replace(/\/+$/, '');

const results = [];

if (live) {
  if (!base || !process.env.AUTH_LOGIN || !process.env.AUTH_PASSWORD) {
    console.error('live mode needs PROD_URL (or EVAL_PARITY_BASE_URL) + AUTH_LOGIN + AUTH_PASSWORD');
    process.exit(2);
  }
  const auth = Buffer.from(`${process.env.AUTH_LOGIN}:${process.env.AUTH_PASSWORD}`).toString('base64');
  for (const lang of LOCALES) {
    const res = await fetch(`${base}/api/evaluate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Basic ${auth}` },
      body: JSON.stringify({ jd: PROBE_JD, lang, save: false }),
    });
    const score = res.ok ? await scoreFromSse(res) : NaN;
    results.push({ lang, score, error: res.ok ? null : `HTTP ${res.status}` });
    console.log(`  ${lang.padEnd(6)} ${Number.isFinite(score) ? score.toFixed(1) : `ERR ${res.status}`}`);
  }
} else {
  await withStubEval(async ({ run }) => {
    for (const lang of LOCALES) {
      try {
        const r = await run(PROBE_JD, lang);
        results.push({ lang, score: r.score, cached: r.stages.includes('scoring (cached)') });
        console.log(`  ${lang.padEnd(6)} ${r.score.toFixed(1)}${r.cached ? '  (scoring cached)' : ''}`);
      } catch (e) {
        results.push({ lang, score: NaN, error: e.message });
        console.log(`  ${lang.padEnd(6)} ERR ${e.message}`);
      }
    }
  });
}

const scores = results.filter((r) => Number.isFinite(r.score)).map((r) => r.score);
const failed = results.filter((r) => !Number.isFinite(r.score));
const max = scores.length ? Math.max(...scores) : NaN;
const min = scores.length ? Math.min(...scores) : NaN;
const s = scores.length ? spread(scores) : NaN;
const pass = failed.length === 0 && scores.length === LOCALES.length && s <= GATE;

console.log(`\nevaluate-locale-parity (${live ? 'LIVE' : 'STUB'}) — 1 JD × ${LOCALES.length} locales`);
if (scores.length) console.log(`  scores: min ${min.toFixed(1)} · max ${max.toFixed(1)} · spread ${s.toFixed(1)} (gate ≤ ${GATE})`);
if (failed.length) console.log(`  errors: ${failed.map((f) => `${f.lang}: ${f.error}`).join('; ')}`);
console.log(`  ${pass ? 'PASS' : 'FAIL'}`);
process.exit(pass ? 0 : 1);

/** Read the SSE stream and pull the score line out of the `done` frame. */
async function scoreFromSse(res) {
  const text = await res.text();
  const done = text.split('\n').filter((l) => l.startsWith('data: ')).map((l) => {
    try { return JSON.parse(l.slice(6)); } catch { return null; }
  }).find((d) => d && d.markdown);
  if (!done) return NaN;
  const m = String(done.markdown).match(/\*\*Score:\*\* ([\d.]+)\/5/);
  return m ? Number(m[1]) : NaN;
}
