/**
 * Pure summary-building helpers for the remote-QA prod scripts, extracted so
 * the report format is unit-testable without a deployed host or a browser
 * (tested in tests/remote-qa-observability.test.mjs).
 *
 * CAR-175 — the summary must NAME its failures, not count them: the scan line
 * gains a "stderr samples" sub-list (which source failed and why), and the
 * evaluate cell gains the provider's own output-token counter ("tok ~N").
 * Honesty rule: samples are capped and redacted BEFORE the cut (the
 * makeRedactor contract), and a missing usage prints nothing — never "tok ?".
 */

/** Table-cell text escaping: backslashes, pipes and newlines flattened. */
export function mdEscape(v) {
  return String(v).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
}

/** The sample budget: at most 10 named errors, each at most 160 chars. */
const ERR_SAMPLES_MAX = 10;
const ERR_SAMPLE_CAP = 160;

/**
 * CAR-175 — name the failing sources: the innerText of each `#scan-console
 * span.err`, whitespace-flattened for a table cell, redacted BEFORE the
 * truncation (a cut mid-host once dodged the secret mask), capped at 10.
 */
export function collectErrTexts(texts, redact, { max = ERR_SAMPLES_MAX, cap = ERR_SAMPLE_CAP } = {}) {
  return (Array.isArray(texts) ? texts : [])
    .map((t) => redact(String(t).replace(/\s+/g, ' ').trim()).slice(0, cap))
    .filter(Boolean)
    .slice(0, max);
}

/** The provider's output-token count from a /api/evaluate usage object, in
 *  the shapes server/lib/llm-usage.mjs normalizes: Anthropic `output_tokens`,
 *  OpenAI-compatible `completion_tokens`, Gemini `candidatesTokenCount` +
 *  `thoughtsTokenCount` (both billed as output). Anything unusable — missing
 *  usage, input-only counts, malformed numbers — returns null so the summary
 *  honestly prints nothing instead of a made-up "tok ?". */
export function evalOutTokens(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const gem = (usage.candidatesTokenCount != null || usage.thoughtsTokenCount != null)
    ? (Number(usage.candidatesTokenCount) || 0) + (Number(usage.thoughtsTokenCount) || 0)
    : undefined;
  const n = Number(usage.output_tokens ?? usage.completion_tokens ?? gem);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** The scan paragraph — byte-identical to the pre-CAR-175 line, plus a
 *  "stderr samples" sub-list when the run had named errors. */
export function scanSummaryBlock(scan) {
  const base = `**Scan (#/scan, all sources):** ${scan.secs}s${scan.busyWaits ? ` (waited ${scan.busyWaits} min for a scan already running)` : ''} · ${(scan.phases || []).join(' · ') || 'no phase finished'}${scan.failed.length ? ' · failed: ' + scan.failed.join(',') : ''} · stderr lines ${scan.errLines} · result rows ${scan.before} → ${scan.after}`;
  const samples = Array.isArray(scan.errTexts) ? scan.errTexts : [];
  if (!samples.length) return base;
  return `${base}\n\nstderr samples:\n${samples.map((t) => `- ${mdEscape(t)}`).join('\n')}`;
}

/** One locale's docs/evaluate cell. `outTok` (the provider's output tokens,
 *  when the response carried a usage object) appends "tok ~N"; anything else
 *  renders byte-identical to the pre-CAR-175 cell. */
export function summaryCell(x) {
  if (!x) return '—';
  const tok = x.outTok != null ? ` · tok ~${x.outTok}` : '';
  return `${x.status} · ${x.mode || '-'} · ${Math.round(x.ms / 1000)}s · ${x.len} ch${tok} · ${x.lang ? 'lang ✓' : 'lang ✗'}${'shape' in x ? (x.shape ? ' · A–G ✓' : ' · A–G ✗') : ''}`;
}
