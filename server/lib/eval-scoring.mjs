/**
 * eval-scoring.mjs — the v1.268.0 two-step evaluation contract (CAR-229/231),
 * made DETERMINISTIC in v1.268.1 (CAR-239).
 *
 * The 2026-11-05 prod acceptance gate failed the two-step contract's promise:
 * one synthetic JD × 19 locales scored 2.5–4.0 (spread 1.5; gate ≤ 0.5), and
 * repeating the SAME locale drifted too (en 3.2→3.0, ru 3.2→2.5). Root cause:
 * the scoring step was still a creative measurement — temperature 0.1, no
 * seed, and the model itself wrote the global score as a free 0–5 decimal.
 * A number the model invents is not a measurement.
 *
 * The CAR-239 contract:
 *   1. The scoring step returns ONLY integer sub-scores (1–5) per block,
 *      anchored by a rubric («5 = …, 3 = …, 1 = …»), plus summaries and
 *      identity fields. The model never writes the global score — any
 *      "score" field in its JSON is dropped by normalizeScoring.
 *   2. The SERVER computes the final score once, in ONE place:
 *      computeFinalScore() = the weighted mean of the block sub-scores
 *      (A–F weight 1 each; G weight 0 — posting legitimacy is a separate
 *      gate per modes/_shared.md, never a score input), rounded to one
 *      decimal with one rule (Math.round half-up).
 *   3. The scoring step runs at temperature 0 with a fixed seed where the
 *      provider accepts one, and self-consistency (median of N parallel
 *      samples) where it does not — see eval-two-step.mjs.
 *   4. The scoring INPUT is byte-identical across all 19 locales — the JD
 *      fence tag is derived from sha256(jd) (was Math.random, which also
 *      made the scoring input non-reproducible byte-for-byte), so the cache
 *      key in scoring-cache.mjs can be locale-independent.
 *
 * Cache parity (CAR-111): the shared instruction header is byte-identical
 * across locales AND across both steps, so the provider's prefix cache pays
 * for the context bundle once instead of once per language. Every
 * locale-dependent byte (directive, skeleton, reminder, JD) lives in the
 * volatile tail.
 */

import { createHash } from 'node:crypto';

/** The seven blocks, their letters and their EN titles — one map (CAR-148). */
export const EVAL_BLOCKS = {
  A: 'Role Summary',
  B: 'Match with CV',
  C: 'Level and Strategy',
  D: 'Comp and Demand',
  E: 'Customization Plan',
  F: 'Interview Plan',
  G: 'Posting Legitimacy',
};

export const EVAL_BLOCK_LETTERS = Object.keys(EVAL_BLOCKS);

/**
 * CAR-239 — the ONE weight table. A–F carry weight 1 each (the mean of six
 * anchored judgements); G carries weight 0: modes/_shared.md is explicit that
 * posting legitimacy never feeds the 1–5 global score. Weights live here and
 * nowhere else — the prompt documents them, the cache and the final score
 * both derive from this constant.
 */
export const EVAL_BLOCK_WEIGHTS = { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 0 };

export const LEGITIMACY_TIERS = ['High Confidence', 'Proceed with Caution', 'Suspicious'];

/**
 * The language-neutral instruction header shared by both steps. English
 * bytes, identical for every locale and every step, so the provider's
 * prefix cache covers the context bundle + this header in one entry.
 */
export const EVAL_SHARED_INSTRUCTIONS = `You are a strict senior technical recruiter evaluating one job posting against the candidate's documents. Judge evidence, not optimism: a claim without backing in the documents scores low.

Read these files and ground every judgement in them:
  • cv.md
  • config/profile.yml
  • modes/_shared.md
  • modes/oferta.md

Compensation rule (CAR-109): compare money like-for-like — annual against annual, within ONE currency (convert only after both sides are annual). Resolve a monthly figure (×12) and a k/к/тыс/萬 suffix (×1000 / ×10000) BEFORE comparing; read €80,5k as 80500 and 80,000 as 80000. If a conversion is uncertain, state both raw figures and reason from them — an uncertain conversion must NEVER by itself flip the verdict to "below minimum". When a COMPENSATION COMPARISON block with server-normalized figures is provided, use those figures as stated.

The evaluation follows modes/oferta.md's block order: ${EVAL_BLOCK_LETTERS.map((L) => `${L}) ${EVAL_BLOCKS[L]}`).join(', ')}.

`;

/**
 * The scoring step's EN instructions (after the shared header) — the
 * anchored 1–5 integer rubric (CAR-239). The model outputs sub-scores
 * ONLY; the global score is computed server-side by computeFinalScore().
 */
const SCORING_INSTRUCTIONS = `Score each block with an INTEGER sub-score on a 1–5 scale using the anchored rubric below, plus a one-sentence English summary per block. Judge the POSTING as it is written — the same posting must score the same numbers however the answer will be worded later. YOU DO NOT OUTPUT A GLOBAL SCORE: the server computes it from your sub-scores; a "score" field in your JSON is ignored.

Anchors — every block is scored 1 (worst) to 5 (best):
  5 = decisive, explicitly evidenced in the candidate's documents for this dimension
  3 = workable but partial: evidence is thin, mixed or only adjacent
  1 = the dimension fails, or the evidence is absent or contradictory
Block anchors:
  A) Role Summary — 5: role, level and focus are unambiguous and aligned with the candidate's target archetypes; 3: the role is clear but focus or level is partly stated; 1: the role cannot be determined or contradicts the target.
  B) Match with CV — 5: the CV names the JD's core stack and domain with proof; 3: adjacent experience, some named requirements missing; 1: the core requirements are absent from the CV.
  C) Level and Strategy — 5: seniority and strategy match the CV's demonstrated level; 3: one step off or unstated; 1: clearly above or below it.
  D) Comp and Demand — 5: the stated compensation beats the candidate's minimum with headroom; 3: near it, unclear, or an uncertain conversion; 1: below the stated minimum or hostile terms.
  E) Customization Plan — 5: concrete hooks exist to tailor the CV truthfully; 3: only generic hooks; 1: nothing to anchor a truthful tailoring.
  F) Interview Plan — 5: process signals (stages, formats) are stated and preparable; 3: partly stated; 1: absent or unpreparable.
  G) Posting Legitimacy — 5: employer-owned board, specific posting, no ghost signals; 3: minor inconsistencies; 1: multiple ghost or scam signals. Recorded for the report; it carries WEIGHT 0 in the global score — posting legitimacy is a separate gate, never a score input (modes/_shared.md).

Weights: blocks A–F carry weight 1 each; G carries weight 0. The global score is their weighted mean rounded to one decimal (half up), computed by the SERVER.

Output ONLY a JSON object — no markdown fence, no prose before or after, no trailing commentary. Every "score" value MUST be an INTEGER from 1 to 5 — never a decimal, never 0, never 6:
{"company":"<company name or Unknown>","role":"<role title>","archetype":"<detected archetype>","legitimacy":"High Confidence|Proceed with Caution|Suspicious","blocks":{"A":{"score":<1-5 integer>,"summary":"<one English sentence>"},"B":{...},"C":{...},"D":{...},"E":{...},"F":{...},"G":{...}}}

`;

/**
 * The scoring step's byte-stable prefix — shared by the provider prompt and
 * the scoring-cache key (CAR-239): a rubric edit invalidates the cache by
 * construction, because the header bytes are the key's first ingredient.
 */
export const EVAL_SCORING_STABLE_HEADER = EVAL_SHARED_INSTRUCTIONS + SCORING_INSTRUCTIONS;

/** The render step's EN instructions (after the shared header). Locale-neutral bytes. */
const RENDER_INSTRUCTIONS = `You will now RENDER an evaluation report body in a target language from a structured scoring you are given. This is translation and elaboration only — it is NOT a re-judgement:
  • Write EXACTLY seven sections, one per block, in the order A)–G) given in the scoring JSON. Each heading is \`## X) <translated title>\` with the LATIN capital — never your alphabet's numbering.
  • Copy every number from the scoring JSON VERBATIM — never invent, round, average or "adjust" a score.
  • Elaborate each block to at most 5 sentences of grounded prose in the target language, based on the block's summary and the documents.
  • Do NOT write a report title, do NOT write Date/Score/URL/Legitimacy header lines, do NOT write any SCORE_SUMMARY block or yaml block — the server adds those.
  • Output only the seven \`## \` sections, nothing before or after.

`;

/**
 * Deterministic JD fence tag (CAR-239): sha256-derived, so the same JD
 * always produces the same scoring input bytes (Math.random used to break
 * byte-reproducibility — and with it the cache key's JD ingredient).
 */
function jdTag(jd) {
  return createHash('sha256').update(String(jd ?? '')).digest('hex').slice(0, 10);
}

/**
 * Scoring prompt as parts: `stable` is byte-identical for every call of the
 * scoring step (and every locale — see the cache-neutrality gate); `volatile`
 * starts at the JD fence (sha256-derived tag, untrusted content). `today` is
 * server-side knowledge (CAR-101) — the scoring JSON carries no date at all,
 * so nothing can drift.
 */
export function buildScoringPromptParts(jd) {
  const stable = EVAL_SCORING_STABLE_HEADER;
  const volatile = `<untrustedJd-${jdTag(jd)}>\n${jd}\n</untrustedJd>\n`;
  return { stable, volatile };
}

/**
 * Render prompt as parts. `stable` is byte-identical across locales (EN
 * instructions — the locale never leaks into the cached prefix); `volatile`
 * carries everything locale- or posting-specific: the scoring JSON, the
 * locale directive, the heading skeleton, the closing reminder.
 */
export function buildRenderPromptParts(jd, lang, scoring, opts = {}) {
  const stable = EVAL_SHARED_INSTRUCTIONS + RENDER_INSTRUCTIONS;
  const localeDirective = lang && lang !== 'en'
    ? `Target language: ${localeLabel(lang)}. The ENTIRE body — every heading title, sentence and bullet — is written in ${localeLabel(lang)}; technical terms and proper names stay as-is. The Latin block capitals A)–G) are mandatory.\n`
    : 'Target language: English.\n';
  const skeleton = `Section order and EN titles: ${EVAL_BLOCK_LETTERS.map((L) => `## ${L}) ${EVAL_BLOCKS[L]}`).join(' · ')}\n`;
  const reminder = lang && lang !== 'en'
    ? `Final reminder: answer in ${localeLabel(lang)} only, keep the Latin A)–G) headings, copy the scores from the JSON verbatim.\n`
    : 'Final reminder: copy the scores from the JSON verbatim.\n';
  const volatile = `SCORING JSON (canonical — every number here is final):\n${JSON.stringify(scoring, null, 2)}\n\n${localeDirective}${skeleton}<untrustedJd-${jdTag(jd)}>\n${jd}\n</untrustedJd>\n${reminder}`;
  return { stable, volatile };
}

function localeLabel(lang) {
  const base = String(lang || 'en').trim().toLowerCase().split('-')[0];
  const names = {
    en: 'English', es: 'Spanish', 'pt-BR': 'Brazilian Portuguese', ko: 'Korean',
    ja: 'Japanese', ru: 'Russian', 'zh-CN': 'Simplified Chinese', 'zh-TW': 'Traditional Chinese',
    fr: 'French', pl: 'Polish', uk: 'Ukrainian', da: 'Danish', ar: 'Arabic',
    de: 'German', it: 'Italian', tr: 'Turkish', hi: 'Hindi', ta: 'Tamil', vi: 'Vietnamese',
  };
  return names[base] || names[lang] || 'English';
}

/**
 * Extract the scoring JSON from a model answer. Tolerates a markdown fence,
 * prose before/after, and trailing commas are NOT tolerated (JSON.parse).
 * Returns null when nothing parseable is found.
 */
export function extractScoringJson(text) {
  const src = String(text ?? '');
  if (!src.trim()) return null;
  // Prefer a ```json fenced block when present (the strongest signal).
  const fenced = src.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [];
  if (fenced) candidates.push(fenced[1]);
  const first = src.indexOf('{');
  const last = src.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.push(src.slice(first, last + 1));
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c.trim());
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch { /* try the next candidate */ }
  }
  return null;
}

/**
 * CAR-239 — coerce one block sub-score. The contract is INTEGER 1–5
 * (schema in the prompt: `"score": <1-5 integer>`): a fractional value
 * (3.5) or an out-of-range one (0, 6, 99, junk) is unusable → null → the
 * caller retries the scoring step, and after the retry fails, a bounded
 * server error surfaces the reason.
 */
function coerceBlockScore(v) {
  const n = typeof v === 'string' ? Number.parseFloat(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

/**
 * CAR-239 — the ONE rounding rule: weighted mean, rounded to one decimal,
 * half up, in this function and nowhere else.
 */
export function computeFinalScore(blocks) {
  let sum = 0;
  let weight = 0;
  for (const L of EVAL_BLOCK_LETTERS) {
    const w = EVAL_BLOCK_WEIGHTS[L] || 0;
    if (!w) continue;
    sum += blocks[L].score * w;
    weight += w;
  }
  return Math.round((sum / weight) * 10) / 10;
}

/**
 * Validate + normalize a scoring object. The model's global "score" is
 * IGNORED and dropped (CAR-239) — the final score is computed from the
 * integer block sub-scores by computeFinalScore(). Throws with a bounded
 * message when the shape is unusable — the caller retries the scoring step.
 *
 * Transition shim (CAR-239): a model still answering the v1.268.0 FLAT
 * shape (a `score` total, no `blocks` map) is not failed — its total seeds
 * EVERY block sub-score evenly (clamped round to the 1–5 integers), and the
 * server-computed final follows from those as always. A response that has
 * blocks is never shimmed: their sub-scores win and the total is dropped.
 */
export function normalizeScoring(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('scoring JSON is not an object');
  }
  const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const hasBlocks = raw.blocks && typeof raw.blocks === 'object'
    && EVAL_BLOCK_LETTERS.some((L) => raw.blocks[L]);
  let blocks = {};
  if (hasBlocks) {
    for (const L of EVAL_BLOCK_LETTERS) {
      const b = raw.blocks[L];
      const score = b ? coerceBlockScore(b.score) : null;
      if (score === null) throw new Error(`scoring JSON: block ${L} sub-score missing or not an integer 1–5`);
      blocks[L] = { score, summary: clean(b.summary).slice(0, 400) };
    }
  } else {
    // Legacy flat score → even integer sub-scores (the shim): round to the
    // nearest integer, CLAMP onto the 1–5 grid, then coerce for sanity.
    const n = typeof raw.score === 'string' ? Number.parseFloat(raw.score) : raw.score;
    const flat = typeof n === 'number' && Number.isFinite(n)
      ? coerceBlockScore(Math.min(5, Math.max(1, Math.round(n))))
      : null;
    if (flat === null) throw new Error('scoring JSON: no usable blocks and no usable flat score (integer 1–5)');
    for (const L of EVAL_BLOCK_LETTERS) {
      blocks[L] = { score: flat, summary: '' };
    }
  }
  const legitimacyRaw = String(raw.legitimacy || '').toLowerCase();
  const legitimacy = LEGITIMACY_TIERS.find((t) => t.toLowerCase() === legitimacyRaw)
    || (/suspicious|phish|scam|fake|fraud/.test(legitimacyRaw) ? 'Suspicious'
      : /caution|medium|uncertain|warn/.test(legitimacyRaw) ? 'Proceed with Caution'
      : 'High Confidence');
  return {
    company: clean(raw.company) || 'Unknown',
    role: clean(raw.role) || 'Unknown',
    archetype: clean(raw.archetype) || 'Unknown',
    legitimacy,
    score: computeFinalScore(blocks),
    blocks,
  };
}

/** True when the rendered body carries all seven `## X)` headings. */
export function missingBlocks(body) {
  const src = String(body ?? '');
  return EVAL_BLOCK_LETTERS.filter((L) => !new RegExp(`^##\\s*${L}\\)`, 'm').test(src));
}

/**
 * Assemble the final report: the SERVER writes the header, the
 * ---SCORE_SUMMARY--- block and the ```yaml machine block from the scoring
 * JSON; the model's rendered body sits between them. A model that invents a
 * different number in prose cannot move the canonical values — they are not
 * in its control (CAR-229 acceptance), and the header score itself is now a
 * server-side derivation from the sub-scores (CAR-239).
 */
export function assembleReport({ scoring, body, today, url, pdf, salary, location }) {
  const s = scoring;
  const header = [
    `# Evaluation: ${s.company} — ${s.role}`,
    '',
    `**Date:** ${today}`,
    `**Score:** ${s.score}/5`,
    `**URL:** ${url || '—'}`,
    `**PDF:** ${pdf || '❌'}`,
    `**Legitimacy:** ${s.legitimacy}`,
    '',
  ].join('\n');
  const summary = [
    '---SCORE_SUMMARY---',
    `COMPANY: ${s.company}`,
    `ROLE: ${s.role}`,
    `SCORE: ${s.score}`,
    `ARCHETYPE: ${s.archetype}`,
    `LEGITIMACY: ${s.legitimacy}`,
    '---END_SUMMARY---',
  ].join('\n');
  const yaml = [
    '```yaml',
    `company: ${s.company}`,
    `role: ${s.role}`,
    `score: ${s.score}`,
    'status: Evaluated',
    ...(salary ? [`salary: "${String(salary).replace(/"/g, "'")}"`] : []),
    ...(location ? [`location: "${String(location).replace(/"/g, "'")}"`] : []),
    `legitimacy: ${s.legitimacy}`,
    `archetype: ${s.archetype}`,
    `blocks: {${EVAL_BLOCK_LETTERS.map((L) => `${L}: ${s.blocks[L].score}`).join(', ')}}`,
    '```',
  ].join('\n');
  return `${header}${String(body ?? '').trim()}\n\n${summary}\n\n${yaml}\n`;
}

/**
 * Server-side fallback body when the render step cannot produce all seven
 * sections after a retry: the skeleton headings are built here and each
 * block gets its EN summary line. The report stays structurally complete
 * (19/19 machine surface) and the warning names the degraded sections.
 */
export function fallbackBody(scoring) {
  return EVAL_BLOCK_LETTERS.map((L) => `## ${L}) ${EVAL_BLOCKS[L]}\n${scoring.blocks[L].summary || '—'}`).join('\n\n');
}

/** Today as YYYY-MM-DD in the server's local time (CAR-101 anchor). */
export function serverToday(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
