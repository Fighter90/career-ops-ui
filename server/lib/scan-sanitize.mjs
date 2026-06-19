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
 * live formula when the TSV is opened in a spreadsheet. These helpers mirror
 * the parent's scan.mjs sanitizers exactly so both code paths agree.
 */

/** Collapse all control/whitespace runs to single spaces and trim. */
export function normalizeScanScalar(value) {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
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
