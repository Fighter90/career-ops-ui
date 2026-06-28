/**
 * v1.33.0 (WS4) — `location_filter` parity with parent career-ops 1.8.0 (#570).
 *
 * Parent's `scan.mjs` gained an optional `location_filter` block in
 * `portals.yml`. web-ui runs its OWN in-process scanners
 * (`en-scanner.mjs` / `ru-scanner.mjs`) — they do NOT shell out to the
 * parent's `scan.mjs`, so the parent feature does not flow through
 * automatically. This module mirrors the parent's `buildLocationFilter`
 * semantics EXACTLY so both scanners gain the same behaviour.
 *
 * portals.yml:
 *   location_filter:
 *     allow: ["Remote", "United States", "Atlanta"]
 *     block: ["India", "London", "Germany"]
 *
 * Semantics (verbatim from parent scan.mjs):
 *   - No `location_filter` key            → everything passes.
 *   - Empty/missing location on a job     → pass (don't penalize missing data).
 *   - `block` match                       → reject (takes precedence over allow).
 *   - `allow` empty                       → pass (already cleared block).
 *   - `allow` non-empty                   → must match ≥ 1 keyword.
 *   - All matches: case-insensitive substring.
 */

// ── Title filter ────────────────────────────────────────────────────
// v1.76.0 — parity with parent career-ops v1.13.0 scan.mjs (#1102, #1187).
// Two robustness fixes over the old `title.includes(keyword)` approach:
//   1. Short all-letter acronyms (2-3 chars: cfo, coo, sdr, bdr, gsi…) match on
//      WORD BOUNDARIES, so "COO" no longer matches "Coordinator" and "SDR" no
//      longer matches mid-word. Multi-word phrases and keywords with non-letters
//      (".NET", "SAP ", "L&D") keep fast, permissive substring matching.
//   2. Malformed config is normalized away: a null / numeric / empty entry in
//      title_filter.{positive,negative} can no longer crash the scan via
//      k.toLowerCase().

/**
 * Compile a lowercased keyword into a matcher `(lower) => boolean`.
 * @param {string} kw already-lowercased keyword
 */
export function compileKeyword(kw) {
  if (/^[a-z]{2,3}$/.test(kw)) {
    const re = new RegExp(`\\b${kw}\\b`);
    return (lower) => re.test(lower);
  }
  return (lower) => lower.includes(kw);
}

/**
 * Compile a raw keyword list (tolerating malformed entries) into an array of
 * matcher functions. Exposed so the RU scanner can compile its negative list
 * once while keeping the lowercased array for collision warnings.
 * @param {unknown} arr
 * @returns {Array<(lower: string) => boolean>}
 */
export function compileKeywordList(arr) {
  // v1.79.0 — trim BEFORE the length check (parent career-ops v1.14.0 #1261):
  // a whitespace-only keyword ("  ") otherwise survives length>0 and compiles
  // into a substring matcher that matches almost everything.
  return (Array.isArray(arr) ? arr : [])
    .filter((k) => typeof k === 'string')
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0)
    .map(compileKeyword);
}

/**
 * Build a title predicate from `portals.yml::title_filter`. A job passes when it
 * matches at least one positive keyword (or there are none) AND no negative one.
 * @param {{positive?: unknown, negative?: unknown}|null|undefined} titleFilter
 * @returns {(title: string) => boolean} predicate — true = keep the job
 */
export function buildTitleFilter(titleFilter) {
  const positive = compileKeywordList(titleFilter?.positive);
  const negative = compileKeywordList(titleFilter?.negative);
  return (title) => {
    const lower = (title || '').toLowerCase();
    const hasPositive = positive.length === 0 || positive.some((m) => m(lower));
    const hasNegative = negative.some((m) => m(lower));
    return hasPositive && !hasNegative;
  };
}

/**
 * @param {{allow?: string[], block?: string[]}|null|undefined} locationFilter
 * @returns {(location: string) => boolean} predicate — true = keep the job
 */
export function buildLocationFilter(locationFilter) {
  if (!locationFilter || typeof locationFilter !== 'object') return () => true;
  const allow = (Array.isArray(locationFilter.allow) ? locationFilter.allow : [])
    .map((k) => String(k).toLowerCase());
  const block = (Array.isArray(locationFilter.block) ? locationFilter.block : [])
    .map((k) => String(k).toLowerCase());

  return (location) => {
    if (!location) return true;
    const lower = String(location).toLowerCase();
    if (block.length > 0 && block.some((k) => lower.includes(k))) return false;
    if (allow.length === 0) return true;
    return allow.some((k) => lower.includes(k));
  };
}

/**
 * v1.75.0 — `content_filter` parity with parent career-ops 1.12.0 (#974).
 *
 * Like `location_filter` but matches against a posting's free-text
 * description/snippet rather than its location. Only sources that populate a
 * `description` (or `snippet`) field are affected — every other posting passes,
 * so enabling this never silently drops postings from sources that don't ship a
 * body. Semantics mirror the parent's `buildContentFilter` exactly.
 *
 * portals.yml:
 *   content_filter:
 *     positive: ["python", "machine learning"]
 *     negative: ["clearance", "on-site only"]
 *
 * Semantics (verbatim from parent scan.mjs):
 *   - No `content_filter` key            → everything passes.
 *   - Empty/missing description on a job → pass (don't penalize missing data).
 *   - `negative` match                   → reject.
 *   - `positive` empty                   → pass.
 *   - `positive` non-empty               → must match ≥ 1 keyword.
 *   - All matches: case-insensitive substring.
 *
 * @param {{positive?: string[], negative?: string[]}|null|undefined} contentFilter
 * @returns {(description: string) => boolean} predicate — true = keep the job
 */
export function buildContentFilter(contentFilter) {
  if (!contentFilter || typeof contentFilter !== 'object') return () => true;
  const positive = (Array.isArray(contentFilter.positive) ? contentFilter.positive : [])
    .map((k) => String(k).toLowerCase());
  const negative = (Array.isArray(contentFilter.negative) ? contentFilter.negative : [])
    .map((k) => String(k).toLowerCase());

  return (description) => {
    if (typeof description !== 'string' || description.trim() === '') return true;
    const lower = description.toLowerCase();
    if (negative.length > 0 && negative.some((k) => lower.includes(k))) return false;
    if (positive.length === 0) return true;
    return positive.some((k) => lower.includes(k));
  };
}
