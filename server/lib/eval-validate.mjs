/**
 * Evaluation-report shape validation (v1.75.0).
 *
 * The `/api/evaluate` Gemini branch shells out to a `gemini-eval.mjs` script
 * whose `validateEvaluationShape()` makes a malformed Gemini evaluation surface
 * as an error instead of saving garbage, so it inherits that guard. But web-ui
 * ALSO runs evaluations IN-PROCESS through Anthropic / OpenAI / Qwen /
 * OpenRouter / GitHub Models — those responses were returned with no shape
 * check at all.
 *
 * This is the in-process analog. Rather than throwing to abort a CLI, web-ui
 * returns a list of issues so the route can attach them as a non-fatal
 * `warnings` array — the SPA still receives the artifact, but the caller is
 * told the report looks malformed (e.g. truncated by MAX_TOKENS). The checks
 * mirror the `validateEvaluationShape` contract exactly.
 *
 * @param {string} text the model's evaluation markdown
 * @returns {string[]} issue messages — empty array means the shape is valid
 */
export function validateEvaluationReport(text) {
  const issues = [];
  if (typeof text !== 'string' || text.trim() === '') return ['empty evaluation report'];

  // A block heading carries its letter, optionally after a word: `## A)`,
  // `## Block A — …`, or — in a translated report — `## Bloque A`,
  // `## ブロックA`, `## Блок А` (Cyrillic look-alikes accepted for A/B/C/E).
  // The letter must not sit inside a Latin word (`## About` is not Block A).
  const LOOKALIKE = { A: 'АA', B: 'ВB', C: 'СC', E: 'ЕE' };
  // An Arabic report writes the block letter in abjad order (أ ب ج د هـ و ز)
  // however the prompt asks — three live runs in a row (v1.239.x). Accepted
  // only as a standalone word, so a letter inside an Arabic word never counts.
  const ABJAD = { A: 'أ|ا|إ|آ', B: 'ب', C: 'ج', D: 'د', E: 'هـ|ه', F: 'و', G: 'ز' };
  // A Hindi report spells the letter out in Devanagari: `## ए)`, `## बी)` …
  // `## जी)` (local deepseek run, 2026-10-07). Same standalone-word rule.
  const DEVANAGARI = { A: 'ए', B: 'बी', C: 'सी', D: 'डी', E: 'ई', F: 'एफ़|एफ', G: 'जी' };
  const requiredBlocks = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((L) => [
    L,
    new RegExp(`^#{1,3}[ \\t]*[^\\n]{0,24}?(?<![A-Za-z\\u0400-\\u04FF])[${LOOKALIKE[L] || L}](?![A-Za-z\\u0400-\\u04FF])`, 'mu'),
    new RegExp(`^#{1,3}[ \\t]*[^\\n]{0,24}?(?<![\\p{L}\\p{M}])(?:${ABJAD[L]}|${DEVANAGARI[L]})(?![\\p{L}\\p{M}])`, 'mu'),
  ]);
  for (const [label, latin, spelled] of requiredBlocks) {
    if (!latin.test(text) && !spelled.test(text)) issues.push(`missing Block ${label}`);
  }

  const summary = text.match(/---SCORE_SUMMARY---\s*([\s\S]*?)---END_SUMMARY---/);
  if (!summary) {
    issues.push('missing SCORE_SUMMARY block');
  } else {
    const summaryBlock = summary[1];
    // [ \t]*, not \s*: \s crosses newlines, so an EMPTY `ROLE:` line would
    // capture the next line ("SCORE: 4.1") as its value and pass.
    for (const key of ['COMPANY', 'ROLE', 'ARCHETYPE', 'LEGITIMACY']) {
      const field = summaryBlock.match(new RegExp(`^[ \\t]*${key}:[ \\t]*(.+)$`, 'mi'));
      const value = field?.[1]?.trim() ?? '';
      // COMPANY may legitimately be "unknown"; the others may not.
      if (!value || (key !== 'COMPANY' && value.toLowerCase() === 'unknown')) {
        issues.push(`SCORE_SUMMARY ${key} is required`);
      }
    }
    const scoreLine = summaryBlock.match(/^[ \t]*(?:\*\*)?[ \t]*SCORE[ \t]*(?:\*\*)?[ \t]*:[ \t]*(.*)$/mi);
    const score = scoreLine && asciiNumber(scoreLine[1]).match(/^[*_ \t]*([0-9]+(?:\.[0-9]+)?)/);
    const scoreValue = score ? Number(score[1]) : NaN;
    if (!Number.isFinite(scoreValue) || scoreValue < 0 || scoreValue > 5) {
      issues.push('SCORE_SUMMARY score must be a number between 0 and 5');
      // v1.248.2 (da regression) — when the score check fails, the server log
      // gets ONLY the SCORE: line itself (trimmed, capped). CI logs are public:
      // no other report content (JD/CV quotes, company prose) may be printed.
      if (scoreLine) {
        console.warn(`[eval-validate] invalid score — SCORE line: ${JSON.stringify(scoreLine[0].trim().slice(0, 120))}`);
      }
    }
  }

  return issues;
}

/**
 * Localized digits → ASCII, then comma disambiguation:
 *  - a separator followed by 1–2 digits is DECIMAL («4,2» → 4.2, the da/fr
 *    form) — Arabic decimal \u066B and fullwidth full stop \uFF0E behave alike;
 *  - a comma followed by EXACTLY 3 digits is a THOUSANDS separator
 *    («4,200» → 4200). The old code read it as 4.200 = 4.2 and passed the
 *    0..5 gate — the exact false positive the v1.248.2 regression flagged.
 * Ambiguous runs (4 digits+, several commas) are left untouched so the
 * score match simply fails and the report is flagged instead of misread.
 */
const DIGIT_ZEROS = [0x0660, 0x06F0, 0x0966, 0x09E6, 0x0A66, 0x0AE6, 0x0B66, 0x0BE6, 0x0C66, 0x0CE6, 0x0D66, 0x0E50, 0xFF10];
export function asciiNumber(s) {
  return String(s ?? '').replace(/[\u0660-\u0669\u06F0-\u06F9\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0BE6-\u0BEF\u0C66-\u0C6F\u0CE6-\u0CEF\u0D66-\u0D6F\u0E50-\u0E59\uFF10-\uFF19]/g, (c) => {
    const cp = c.codePointAt(0);
    const zero = DIGIT_ZEROS.find((z) => cp >= z && cp <= z + 9);
    return String(cp - zero);
  })
    // thousands first: exactly 3 trailing digits (ASCII, Arabic \u066C, fullwidth \uFF0C comma)
    .replace(/(\d)[,\u066C\uFF0C](\d{3})(?!\d)/g, '$1$2')
    // then decimal: 1–2 trailing digits (ASCII, Arabic \u066B, fullwidth \uFF0E)
    .replace(/(\d)[,\u066B\uFF0E](\d{1,2})(?!\d)/g, '$1.$2');
}

/**
 * Remove the machine-readable ---SCORE_SUMMARY--- … ---END_SUMMARY--- block
 * the prompt asks for, as the parent's eval scripts do before writing a
 * report: it exists for validation, not for the reader.
 */
export function stripScoreSummary(text) {
  return String(text ?? '').replace(/\n*---SCORE_SUMMARY---[\s\S]*?---END_SUMMARY---\n*/, '\n').trimEnd();
}
