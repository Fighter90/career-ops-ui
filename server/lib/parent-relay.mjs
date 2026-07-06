/**
 * Shared helpers for routes that shell out to parent career-ops scripts
 * (followup-cadence.mjs, followup-seed.mjs, analyze-patterns.mjs) and relay
 * their JSON stdout. Consolidates the v1.117.1 parse rule and the v1.117.2
 * empty-tracker contract in one place so the two consumers can't drift.
 */
import { PROJECT_ROOT } from './paths.mjs';

/**
 * Parse a script's stdout as JSON. The whole trimmed stdout is tried FIRST
 * (the parent scripts print a single JSON document), and only on failure do
 * we fall back to slicing from the first `{` — so a stray {…}-shaped log
 * line before the payload can't silently win over the real document
 * (v1.117.1 review).
 */
export function parseJsonStdout(stdout) {
  const s = String(stdout || '').trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch { /* fall through to the sliced attempt */ }
  const start = s.indexOf('{');
  if (start === -1) return null;
  try {
    return JSON.parse(s.slice(start));
  } catch {
    return null;
  }
}

/**
 * The parent scripts exit 1 with a structured {error} on stdout for exactly
 * two benign "no data yet" cases (followup-cadence.mjs:287,
 * analyze-patterns.mjs:411,445). Only THOSE messages count as a healthy
 * empty state — any other {error} must fall through to the honest
 * script-error path, otherwise a future parent regression that also emits
 * {error} would be silently masked as "nothing tracked yet".
 */
export function isEmptyTrackerError(error) {
  if (typeof error !== 'string') return false;
  return error === 'No applications found in tracker.'
    || error.startsWith('Not enough data:');
}

/**
 * Clip child stderr for a client-facing `detail` field. An uncaught child
 * exception prints absolute-path stack frames (…/followup-cadence.mjs:12:3),
 * which would leak the server's filesystem layout and username — replace the
 * project root wherever it appears, then drop any other absolute paths.
 */
export function sanitizeDetail(stderr) {
  let s = String(stderr || '').split('\n').slice(0, 3).join(' ');
  while (s.includes(PROJECT_ROOT)) s = s.replace(PROJECT_ROOT, '<project>');
  // Any remaining absolute unix path (e.g. node internals outside the root).
  s = s.replace(/(^|[\s("'])\/(?:[\w.-]+\/)+[\w.-]+/g, '$1<path>');
  return s.slice(0, 300);
}
