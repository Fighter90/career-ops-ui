// @ts-check
/**
 * scan-quarantine.mjs — skip ATS sources that return permanent failures.
 *
 * v1.80.0 — idea from bracketouverte/job-crawler's `dead-slugs.ts` (reimplemented,
 * no code lifted). When an EN-scanner source fetch returns a permanent
 * 404/410, its tracked-companies entry is recorded in `data/scan-quarantine.json`
 * and skipped on later scans — killing the recurring "Temporal: HTTP 404" /
 * "Lindy: HTTP 404" noise and shaving wasted requests off every run.
 *
 * Self-healing: a quarantined entry is retried after RETRY_AFTER_DAYS (a slug
 * can come back), so this never permanently hides a board. Keyed by the
 * tracked-companies `name` (stable across runs) AND the endpoint that failed:
 * an entry only holds while the company still resolves to the same URL, so
 * fixing a dead careers_url retries it on the very next scan instead of
 * leaving it skipped for the rest of the window.
 *
 * File shape: `{ entries: { "<name>": { url, status, since } } }`.
 */
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { PATHS } from './paths.mjs';

export const QUARANTINE_PATH = PATHS.applications.replace(/applications\.md$/, 'scan-quarantine.json');
export const RETRY_AFTER_DAYS = 14;
const DAY_MS = 86_400_000;

/** Read the quarantine file. Corrupt/missing → an empty, well-formed object. */
export function loadQuarantine() {
  try {
    const raw = JSON.parse(readFileSync(QUARANTINE_PATH, 'utf8'));
    if (!raw || typeof raw !== 'object' || !raw.entries || typeof raw.entries !== 'object') {
      return { entries: {} };
    }
    return raw;
  } catch {
    return { entries: {} };
  }
}

/**
 * True when `key` is quarantined AND still inside the retry window. When `url`
 * is given, the entry only applies while it recorded that same endpoint — a
 * changed url means the config was fixed, so the source is tried again.
 * @param {any} q
 * @param {string} key
 * @param {number} [now]
 * @param {string} [url]
 */
export function isQuarantined(q, key, now = Date.now(), url) {
  const e = q && q.entries && q.entries[key];
  if (!e || typeof e !== 'object') return false;
  if (url && e.url && e.url !== url) return false;
  const since = Date.parse(e.since);
  if (Number.isNaN(since)) return false;
  return (now - since) < RETRY_AFTER_DAYS * DAY_MS;
}

/** Record/refresh a quarantine entry (resets the retry clock). Mutates + returns q. */
export function quarantineAdd(q, key, info = {}, at) {
  if (!q.entries) q.entries = {};
  q.entries[key] = {
    url: info.url || '',
    status: info.status != null ? info.status : 'permanent',
    since: at || new Date().toISOString(),
  };
  return q;
}

/** Drop entries past the retry window so the file doesn't grow unbounded. */
export function pruneQuarantine(q, now = Date.now()) {
  for (const [k, e] of Object.entries(q.entries || {})) {
    const since = Date.parse(e && e.since);
    if (Number.isNaN(since) || (now - since) >= RETRY_AFTER_DAYS * DAY_MS) delete q.entries[k];
  }
  return q;
}

export function saveQuarantine(q) {
  mkdirSync(QUARANTINE_PATH.replace(/\/[^/]+$/, ''), { recursive: true });
  // tmp + rename: a crash mid-write must not leave a truncated file behind.
  const tmp = `${QUARANTINE_PATH}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(q, null, 2) + '\n');
  renameSync(tmp, QUARANTINE_PATH);
}

/** A fetch error that warrants quarantine: a permanent HTTP 404 / 410. */
export function isPermanentFailure(err) {
  if (!err) return false;
  if (err.status === 404 || err.status === 410) return true;
  return /\bHTTP (404|410)\b/.test(String(err.message || ''));
}
