/**
 * eval-scoring.mjs — the v1.268.0 two-step evaluation contract (CAR-229/231).
 *
 * The old single-shot contract asked the model to write the whole localized
 * report INCLUDING the header, the score and the machine summary — and the
 * 2026-11-04 prod regression showed what that costs: the same synthetic JD
 * scored 1.0 (fr) to 4.0 (ta) depending on the report language, and the
 * machine block was present in only 8 of 17 locales (de/uk lost the header
 * entirely). Numbers that a localizer may move are not measurements.
 *
 * The contract is now TWO steps with one shared, byte-stable, ENGLISH
 * instruction header:
 *   1. scoring — the model reads the context and the JD and outputs ONLY a
 *      JSON object (company, role, archetype, legitimacy, score, per-block
 *      A–G scores + short EN summaries). English in, JSON out, temperature
 *      pinned low — the measurement step.
 *   2. render — the model translates that structure into the report body in
 *      the target locale. It is forbidden to touch numbers (copied verbatim
 *      from the JSON), to write a header, or to write any machine block.
 *
 * The SERVER assembles the report: header lines, the ---SCORE_SUMMARY---
 * block and the ```yaml machine block are all built here from the scoring
 * JSON, so every locale ships the same machine surface by construction
 * (CAR-102) and a model that "corrects" a number in prose cannot move the
 * canonical values.
 *
 * Cache parity (CAR-111): the shared instruction header is byte-identical
 * across locales AND across both steps, so the provider's prefix cache pays
 * for the context bundle once instead of once per language. Every
 * locale-dependent byte (directive, skeleton, reminder, JD) lives in the
 * volatile tail.
 */

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

/** The scoring step's EN instructions (after the shared header). */
const SCORING_INSTRUCTIONS = `Score each block on a 0–5 scale with a one-sentence English summary, and give the global 0–5 score the way modes/oferta.md weights the blocks. Judge the POSTING as it is written — the same posting must score the same number however the answer will be worded later.

Output ONLY a JSON object — no markdown fence, no prose before or after, no trailing commentary:
{"company":"<company name or Unknown>","role":"<role title>","archetype":"<detected archetype>","legitimacy":"High Confidence|Proceed with Caution|Suspicious","score":<0-5 decimal>,"blocks":{"A":{"score":<0-5 decimal>,"summary":"<one English sentence>"},"B":{...},"C":{...},"D":{...},"E":{...},"F":{...},"G":{...}}}

`;

/** The render step's EN instructions (after the shared header). Locale-neutral bytes. */
const RENDER_INSTRUCTIONS = `You will now RENDER an evaluation report body in a target language from a structured scoring you are given. This is translation and elaboration only — it is NOT a re-judgement:
  • Write EXACTLY seven sections, one per block, in the order A)–G) given in the scoring JSON. Each heading is \`## X) <translated title>\` with the LATIN capital — never your alphabet's numbering.
  • Copy every number from the scoring JSON VERBATIM — never invent, round, average or "adjust" a score.
  • Elaborate each block to at most 5 sentences of grounded prose in the target language, based on the block's summary and the documents.
  • Do NOT write a report title, do NOT write Date/Score/URL/Legitimacy header lines, do NOT write any SCORE_SUMMARY block or yaml block — the server adds those.
  • Output only the seven \`## \` sections, nothing before or after.

`;

/**
 * Scoring prompt as parts: `stable` is byte-identical for every call of the
 * scoring step; `volatile` starts at the JD fence (random tag, untrusted
 * content). `today` is server-side knowledge (CAR-101) — the scoring JSON
 * carries no date at all, so nothing can drift.
 */
export function buildScoringPromptParts(jd) {
  const stable = EVAL_SHARED_INSTRUCTIONS + SCORING_INSTRUCTIONS;
  const volatile = `<untrustedJd-${Math.random().toString(36).slice(2, 10)}>\n${jd}\n</untrustedJd>\n`;
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
  const volatile = `SCORING JSON (canonical — every number here is final):\n${JSON.stringify(scoring, null, 2)}\n\n${localeDirective}${skeleton}<untrustedJd-${Math.random().toString(36).slice(2, 10)}>\n${jd}\n</untrustedJd>\n${reminder}`;
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

/** Coerce one 0–5 block/global score; returns null for junk. */
function coerceScore(v) {
  const n = typeof v === 'string' ? Number.parseFloat(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 5) return null;
  return Math.round(n * 10) / 10;
}

/**
 * Validate + normalize a scoring object. Throws with a bounded message when
 * the shape is unusable — the caller retries the scoring step.
 */
export function normalizeScoring(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('scoring JSON is not an object');
  }
  const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const blocks = {};
  for (const L of EVAL_BLOCK_LETTERS) {
    const b = raw.blocks && typeof raw.blocks === 'object' ? raw.blocks[L] : undefined;
    const score = b ? coerceScore(b.score) : null;
    if (score === null) throw new Error(`scoring JSON: block ${L} score missing or not 0–5`);
    blocks[L] = { score, summary: clean(b.summary).slice(0, 400) };
  }
  const score = coerceScore(raw.score);
  if (score === null) throw new Error('scoring JSON: global score missing or not 0–5');
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
    score,
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
 * in its control (CAR-229 acceptance).
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
