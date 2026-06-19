/**
 * Scan-write sanitizers (v1.75.0 — parent career-ops v1.12.0 #1098 parity).
 *
 * Job postings come from external feeds (Greenhouse, RemoteOK, Glints, …).
 * Their title / company / location strings are attacker-influenced data that
 * the scanners persist into two on-disk formats:
 *
 *   • data/scan-history.tsv  — tab-separated rows, one per posting
 *   • data/pipeline.md       — a fenced URL list
 *
 * Without sanitization a posting whose company name contains a newline could
 * inject a whole extra TSV row, and a value beginning with `= + - @` becomes a
 * live formula when the TSV is opened in a spreadsheet. These helpers follow
 * the parent's scan.mjs sanitizers; the control-character class is a strict
 * superset of the parent's (`\r\n\t` plus the vertical tab, form feed, and the
 * Unicode line/paragraph separators), so any record/line separator a viewer
 * might honor is collapsed — never weaker than the parent.
 */

// Record/line/column separators (and their close cousins) that must never
// survive into a TSV cell or a fenced pipeline line. `\r\n\t` are the TSV
// separators proper; \v \f and U+2028/U+2029 are line breaks some viewers honor.
const SCAN_SEPARATORS = /[\r\n\t\v\f\u2028\u2029]+/g;

/** Collapse all control/line/separator runs to single spaces and trim. */
export function normalizeScanScalar(value) {
  return String(value ?? '')
    .replace(SCAN_SEPARATORS, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** First whitespace-delimited token — strips smuggled newlines/extra fields. */
export function normalizeScanUrl(value) {
  return String(value ?? '').trim().split(/\s+/)[0] || '';
}

/**
 * One TSV cell: normalized, then formula-guarded. A leading `= + - @` is the
 * spreadsheet formula-injection vector — prefix a single quote to neutralize it
 * (the same defense Excel/Sheets recommend).
 */
export function sanitizeTsvField(value) {
  const normalized = normalizeScanScalar(value);
  return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
}
