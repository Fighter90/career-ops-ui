/**
 * score-backfill.mjs — CAR-243. A slice of the prod tracker (159 rows) links
 * a report but carries a sentinel Score cell (— / N/A / - / empty): the row
 * was evaluated, the score just never reached the tracker. This module backs
 * the /api/runners/score-backfill dry-run/apply runner:
 *
 *   · extractReportScore — the report's global score, from ONE of its
 *     machine surfaces, in priority order:
 *       1. the ---SCORE_SUMMARY--- block (CAR-92: the language-invariant
 *          machine block is the single source for the global score);
 *       2. the report-header cascade (parseReportHeader: the English
 *          **Score:** label, the Machine-Summary yaml `score:`, localized
 *          bold labels ×17, the /5 value form, prose labels);
 *       3. the line-anchored English score scan (extractBodyScore — the
 *          gemini-subprocess legacy path).
 *   · scanTrackerScoreGaps / applyTrackerScoreFix — the tracker half:
 *     sentinel-Score rows with a resolvable report, fixed line-surgically
 *     (ONLY the Score cell changes).
 *
 * Pure functions over strings — the filesystem and the tracker lock stay
 * with the route.
 */

import { parseReportHeader } from './parsers.mjs';
import { extractSummaryScore, extractBodyScore } from './eval-validate.mjs';
import { splitTrackerRow, trackerCellText, trackerColumnIndexes } from './data-migrations.mjs';

/** The report's global score (0–5 number) from its machine surfaces, or null. */
export function extractReportScore(reportText) {
  const summary = extractSummaryScore(reportText);
  if (summary != null) return summary;
  const header = parseReportHeader(reportText).scoreNum;
  if (header != null) return header;
  return extractBodyScore(reportText);
}

const SCORE_SENTINELS = new Set(['—', '-', 'n/a', 'na']);

/** True when a Score cell means "no score recorded" (sentinel or empty). */
export function isSentinelScore(cell) {
  const v = trackerCellText(cell).toLowerCase().replace(/\s+/g, ' ').trim();
  return v === '' || SCORE_SENTINELS.has(v);
}

/**
 * Scan the tracker text for Score gaps: data rows whose Score cell is a
 * sentinel and that carry a report. `resolveReportScore(reportCell)` maps
 * the Report cell to `{ score }` or `{ score: null, reason }` (provided by
 * the caller so this module stays filesystem-free). Rows without a
 * resolvable score are reported with `fixed: null` and an
 * `unresolvedReason` — reported, never guessed.
 */
export function scanTrackerScoreGaps(trackerText, resolveReportScore) {
  const gaps = [];
  const lines = String(trackerText ?? '').split('\n');
  const cols = trackerColumnIndexes(trackerText);
  for (let i = 0; i < lines.length; i += 1) {
    const cells = splitTrackerRow(lines[i]);
    if (!cells || cells.length < 8) continue;
    if (!/^\d+$/.test(cells[0])) continue; // data rows carry a numeric #
    if (!isSentinelScore(cells[cols.score])) continue;
    const res = resolveReportScore ? resolveReportScore(cells[cols.report]) : null;
    const score = res != null && typeof res === 'object' ? res.score : (typeof res === 'number' ? res : null);
    const fixed = score != null ? `${score}/5` : null;
    gaps.push({
      line: i + 1,
      num: cells[0],
      company: trackerCellText(cells[cols.company]),
      score: trackerCellText(cells[cols.score]) || null,
      reportScore: score ?? null,
      fixed,
      unresolvedReason: fixed ? null
        : (res != null && typeof res === 'object' && res.reason ? res.reason : 'no-report'),
    });
  }
  return gaps;
}

/**
 * Apply the fixes: only rows whose scan entry carries a non-null `fixed`.
 * Each touched line has ONLY its Score cell replaced — every other byte of
 * the line survives verbatim. The value is written in the tracker's own
 * `X.X/5` convention.
 */
export function applyTrackerScoreFix(trackerText, gaps) {
  const fixByLine = new Map(gaps.filter((g) => g.fixed).map((g) => [g.line, g.fixed]));
  if (!fixByLine.size) return { text: trackerText, changed: 0 };
  const lines = String(trackerText ?? '').split('\n');
  const cols = trackerColumnIndexes(trackerText);
  let changed = 0;
  for (const [lineNo, scoreRaw] of fixByLine) {
    const idx = lineNo - 1;
    const cells = splitTrackerRow(lines[idx]);
    if (!cells || cells.length < 8) continue;
    // The score comes from a report machine surface (a number); flatten any
    // line-break/pipe noise before the rebuild — never a phantom column.
    const score = String(scoreRaw ?? '').replace(/[|\r\n\t]+/g, ' ').trim();
    if (!score) continue;
    const before = lines[idx];
    const rebuilt = `| ${cells.map((c, i2) => (i2 === cols.score ? score : c)).join(' | ')} |`;
    if (rebuilt !== before) {
      lines[idx] = rebuilt;
      changed += 1;
    }
  }
  return { text: lines.join('\n'), changed };
}
