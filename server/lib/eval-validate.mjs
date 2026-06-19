/**
 * Evaluation-report shape validation (v1.75.0 — parent career-ops v1.12.0 #819
 * parity).
 *
 * The parent's `gemini-eval.mjs` gained `validateEvaluationShape()` so a
 * malformed Gemini evaluation surfaces as an error instead of saving garbage.
 * web-ui's `/api/evaluate` Gemini branch shells out to that script, so it
 * inherits the guard. But web-ui ALSO runs evaluations IN-PROCESS through
 * Anthropic / OpenAI / Qwen / OpenRouter / GitHub Models — those responses were
 * returned with no shape check at all.
 *
 * This is the in-process analog. Unlike the parent (which throws to abort the
 * CLI), web-ui returns a list of issues so the route can attach them as a
 * non-fatal `warnings` array — the SPA still receives the artifact, but the
 * caller is told the report looks malformed (e.g. truncated by MAX_TOKENS).
 * Checks mirror the parent's `validateEvaluationShape` exactly.
 *
 * @param {string} text the model's evaluation markdown
 * @returns {string[]} issue messages — empty array means the shape is valid
 */
export function validateEvaluationReport(text) {
  const issues = [];
  if (typeof text !== 'string' || text.trim() === '') return ['empty evaluation report'];

  const requiredBlocks = [
    ['A', /(?:^|\n)#{1,3}\s*(?:A[).:-]?|Block A\b)/im],
    ['B', /(?:^|\n)#{1,3}\s*(?:B[).:-]?|Block B\b)/im],
    ['C', /(?:^|\n)#{1,3}\s*(?:C[).:-]?|Block C\b)/im],
    ['D', /(?:^|\n)#{1,3}\s*(?:D[).:-]?|Block D\b)/im],
    ['E', /(?:^|\n)#{1,3}\s*(?:E[).:-]?|Block E\b)/im],
    ['F', /(?:^|\n)#{1,3}\s*(?:F[).:-]?|Block F\b)/im],
    ['G', /(?:^|\n)#{1,3}\s*(?:G[).:-]?|Block G\b)/im],
  ];
  for (const [label, pattern] of requiredBlocks) {
    if (!pattern.test(text)) issues.push(`missing Block ${label}`);
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
