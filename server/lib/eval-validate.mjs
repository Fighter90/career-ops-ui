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
  const requiredBlocks = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((L) => [
    L,
    new RegExp(`^#{1,3}[ \\t]*[^\\n]{0,24}?(?<![A-Za-z\\u0400-\\u04FF])[${LOOKALIKE[L] || L}](?![A-Za-z\\u0400-\\u04FF])`, 'mu'),
    new RegExp(`^#{1,3}[ \\t]*[^\\n]{0,24}?(?<![\\p{L}\\p{M}])(?:${ABJAD[L]})(?![\\p{L}\\p{M}])`, 'mu'),
  ]);
  for (const [label, latin, abjad] of requiredBlocks) {
    if (!latin.test(text) && !abjad.test(text)) issues.push(`missing Block ${label}`);
  }

  const summary = text.match(/---SCORE_SUMMARY---\s*([\s\S]*?)---END_SUMMARY---/);
  if (!summary) {
    issues.push('missing SCORE_SUMMARY block');
  } else {
    const summaryBlock = summary[1];
    for (const key of ['COMPANY', 'ROLE', 'ARCHETYPE', 'LEGITIMACY']) {
      const field = summaryBlock.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'mi'));
      const value = field?.[1]?.trim() ?? '';
      // COMPANY may legitimately be "unknown"; the others may not.
      if (!value || (key !== 'COMPANY' && value.toLowerCase() === 'unknown')) {
        issues.push(`SCORE_SUMMARY ${key} is required`);
      }
    }
    const score = summaryBlock.match(/^\s*SCORE:\s*([0-9]+(?:\.[0-9]+)?)/mi);
    const scoreValue = score ? Number(score[1]) : NaN;
    if (!Number.isFinite(scoreValue) || scoreValue < 0 || scoreValue > 5) {
      issues.push('SCORE_SUMMARY score must be a number between 0 and 5');
    }
  }

  return issues;
}

/**
 * Remove the machine-readable ---SCORE_SUMMARY--- … ---END_SUMMARY--- block
 * the prompt asks for, as the parent's eval scripts do before writing a
 * report: it exists for validation, not for the reader.
 */
export function stripScoreSummary(text) {
  return String(text ?? '').replace(/\n*---SCORE_SUMMARY---[\s\S]*?---END_SUMMARY---\n*/, '\n').trimEnd();
}
