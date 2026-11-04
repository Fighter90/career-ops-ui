// @ts-check
/**
 * portals.yml — misspelled top-level key detection (parent career-ops #6107,
 * 32863fd6 — mirrored).
 *
 * A key one or two edits from a real setting, such as `tracked_companys`,
 * used to be silently ignored: the company list was read as missing, the scan
 * reported success with zero companies. This module carries the known-keys
 * allowlist and the nearest-key suggestion helper; the scanner parse path
 * (server/lib/en-scanner.mjs loadPortals) rejects a near-miss with a named
 * error naming the file, the key, and the suggestion.
 *
 * A key outside the list is left alone when it is not within 2 edits of a
 * known setting: people keep private notes in the same file, and those must
 * not fail a scan.
 */

// Settings the scanners (and the parent's scanners — portals.yml is a shared
// user-layer file) actually read. Keys only the parent reads
// (experience_filter, dayforce_boards, interamt_searches, …) stay known so a
// file configured for the parent scans cleanly here too. web-ui-only keys the
// EN/RU scanners read (telegram_channels, scan_quarantine, years_min,
// companies, russian_portals) are appended.
export const PORTAL_TOP_LEVEL_KEYS = [
  'title_filter',
  'title_filter_full',
  'title_filter_overrides',
  'search_queries',
  'tracked_companies',
  'job_boards',
  'scan_history',
  'preferred_languages',
  'interamt_searches',
  'dayforce_boards',
  'location_filter',
  'country_eligibility_filter',
  'salary_filter',
  'experience_filter',
  'portal_prune_quiet_days',
  'max_posting_age_days',
  'trust_filter',
  'content_filter',
  'visa_filter',
  'skip_tiers',
  'domain_filter',
  'field_filters',
  'company_aliases',
  'portal_health_threshold',
  'portal_health_stale_days',
  // web-ui-specific top-level keys the scanners read
  'telegram_channels',
  'scan_quarantine',
  'years_min',
  'companies',
  'russian_portals',
];

/** @param {unknown} v */
function isObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/** Levenshtein distance, lowercase-insensitive at the call site. */
/** @param {string} a @param {string} b */
function editDistance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * The closest candidate within `maxDistance` edits (case-insensitive), or
 * null. Mirrors the parent's validate-profile.mjs nearestKey.
 * @param {string} key
 * @param {string[]} candidates
 * @param {number} [maxDistance]
 * @returns {string|null}
 */
export function nearestKey(key, candidates, maxDistance = 3) {
  let best = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = editDistance(key.toLowerCase(), c.toLowerCase());
    if (d < bestD) { bestD = d; best = c; }
  }
  return bestD <= maxDistance ? best : null;
}

/**
 * Every top-level portals.yml key that is not known but IS within 2 edits of
 * a known setting — i.e. a probable typo. Far-from-any-setting keys (private
 * notes) and the known settings themselves are never reported. Mirrors the
 * parent's validate-portals.mjs portalTopLevelTypos.
 * @param {unknown} config the parsed portals.yml document
 * @returns {{ key: string, suggestion: string }[]}
 */
export function portalTopLevelTypos(config) {
  if (!isObject(config)) return [];
  const known = new Set(PORTAL_TOP_LEVEL_KEYS);
  const found = [];
  for (const key of Object.keys(config)) {
    if (known.has(key)) continue;
    const suggestion = nearestKey(key, PORTAL_TOP_LEVEL_KEYS, 2);
    if (!suggestion) continue;
    found.push({ key, suggestion });
  }
  return found;
}
