#!/usr/bin/env node
// evaluate-repeatability grader (CAR-239).
//
// The v1.268.0 prod gate also failed repeats of the SAME locale (en 3.2→3.0,
// ru 3.2→2.5): the scoring dice were re-rolled on every call. The CAR-239
// contract answers with temperature 0 + a fixed seed where the provider
// takes one, self-consistency (median of parallel samples) where it does
// not, and the scoring cache (same input → the stored sub-scores, spread 0).
//
// Modes:
//   default   — STUB mode, offline, CI-isolated: en/ru/de × 3 repeats each,
//               through the real two-step evaluate against a deterministic
//               stub. TWO legs:
//                 cache ON  — repeats 2–3 are cache hits → spread MUST be 0;
//                 cache OFF — every repeat re-runs the (deterministic) stub
//                             → spread ≤ 0.2 proves the harness itself.
//               Must PASS with no network and no keys — part of
//               `node evals/workflow/run.mjs`.
//   --live    — post-deploy leg: 1 JD × 3 repeats × 3 locales (en/ru/de)
//               against a deployed /api/evaluate; gate spread ≤ 0.2
//               (with the scoring cache the repeats read 0). Opt-in via
//               PROD_URL + AUTH_LOGIN/AUTH_PASSWORD.
//
// Usage: node evals/evaluate-repeatability/run.mjs [--live]

import { PROBE_JD, withStubEval, spread } from '../lib/stub-eval-harness.mjs';

const GATE = 0.2;
const REPEATS = 3;
const LANGS = ['en', 'ru', 'de'];
const live = process.argv.includes('--live');
const base = (process.env.EVAL_REPEAT_BASE_URL || process.env.PROD_URL || '').replace(/\/+$/, '');

const rows = [];
let pass = true;

if (live) {
  if (!base || !process.env.AUTH_LOGIN || !process.env.AUTH_PASSWORD) {
    console.error('live mode needs PROD_URL (or EVAL_REPEAT_BASE_URL) + AUTH_LOGIN + AUTH_PASSWORD');
    process.exit(2);
  }
  const auth = Buffer.from(`${process.env.AUTH_LOGIN}:${process.env.AUTH_PASSWORD}`).toString('base64');
  for (const lang of LANGS) {
    const scores = [];
    for (let i = 0; i < REPEATS; i += 1) {
      const res = await fetch(`${base}/api/evaluate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Basic ${auth}` },
        body: JSON.stringify({ jd: PROBE_JD, lang, save: false }),
      });
      const score = res.ok ? await scoreFromSse(res) : NaN;
      scores.push(score);
    }
    const ok = scores.every(Number.isFinite) && spread(scores) <= GATE;
    pass &&= ok;
    rows.push({ lang, scores, ok });
    console.log(`  ${lang.padEnd(4)} repeats: ${scores.map((s) => (Number.isFinite(s) ? s.toFixed(1) : 'ERR')).join(' → ')}  spread ${Number.isFinite(spread(scores)) ? spread(scores).toFixed(1) : '—'} (gate ≤ ${GATE}) ${ok ? '✓' : '✗'}`);
  }
} else {
  // Leg 1 — the cache ON (production default): repeats 2–3 must be hits.
  await withStubEval(async ({ run }) => {
    for (const lang of LANGS) {
      const scores = [];
      const cached = [];
      for (let i = 0; i < REPEATS; i += 1) {
        const r = await run(PROBE_JD, lang);
        scores.push(r.score);
        cached.push(r.stages.includes('scoring (cached)'));
      }
      const s = spread(scores);
      // Run 1 is a miss, runs 2–3 are hits, so the spread is exactly 0.
      const ok = s === 0 && cached[1] && cached[2];
      pass &&= ok;
      rows.push({ lang, scores, cached: true, ok });
      console.log(`  ${lang.padEnd(4)} cache ON : ${scores.map((x) => x.toFixed(1)).join(' → ')}  spread ${s.toFixed(1)} ${ok ? '✓' : '✗'}${ok && cached[1] ? '  (repeats cached)' : ''}`);
    }
  });
  // Leg 2 — the cache OFF: every repeat re-runs; the deterministic stub
  // must still hold the spread under the gate (this is the leg that fails
  // loudly if anyone reintroduces randomness into the scoring input).
  process.env.EVAL_SCORE_CACHE = '0';
  try {
    await withStubEval(async ({ run }) => {
      for (const lang of LANGS) {
        const scores = [];
        for (let i = 0; i < REPEATS; i += 1) scores.push((await run(PROBE_JD, lang)).score);
        const s = spread(scores);
        const ok = s <= GATE;
        pass &&= ok;
        rows.push({ lang, scores, cached: false, ok });
        console.log(`  ${lang.padEnd(4)} cache OFF: ${scores.map((x) => x.toFixed(1)).join(' → ')}  spread ${s.toFixed(1)} (gate ≤ ${GATE}) ${ok ? '✓' : '✗'}`);
      }
    });
  } finally {
    delete process.env.EVAL_SCORE_CACHE;
  }
}

console.log(`\nevaluate-repeatability (${live ? 'LIVE' : 'STUB'}) — 1 JD × ${REPEATS} repeats × ${LANGS.length} locales (en/ru/de)`);
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
