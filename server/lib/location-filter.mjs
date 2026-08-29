/**
 * v1.33.0 (WS4) — `location_filter` support.
 *
 * `portals.yml` may carry an optional `location_filter` block. web-ui runs its
 * OWN in-process scanners (`en-scanner.mjs` / `ru-scanner.mjs`), so this module
 * implements the `buildLocationFilter` semantics directly and both scanners
 * gain the same behaviour.
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

// ── Keyword prefixes (parity with the parent's title-keywords.mjs) ──
// `title_filter` and `content_filter` both default to case-insensitive
// SUBSTRING matching, which is why a bare negative `intern` also rejects
// "International Product Manager" and a bare `java` rejects everything that
// merely mentions "JavaScript". Flipping that default would be a breaking
// change for every configured install, so the parent made precision opt-in per
// entry. Both filters honour the prefixes (see compileContentKeyword), but only
// the TITLE filter also auto-anchors 2-3 letter acronyms:
//
//   word:intern  → whole word. Rejects "Operations Intern", leaves
//                  "International …" and "Internal …" alone.
//   stem:agent   → must START a word, may continue. Separates "Agentforce"
//                  from "Reagents".
//
// web-ui had neither, so a `word:`-prefixed entry was matched as the literal
// text "word:intern" — which appears in no job title, silently turning that
// filter line into a no-op. A live portals.yml using the prefix therefore
// filtered correctly through the CLI and not at all here.
const WORD_PREFIX = 'word:';
const STEM_PREFIX = 'stem:';

// Unicode-aware word character: \b is ASCII-only and would treat an accented
// letter as a boundary, matching mid-word in non-English titles.
const WORD_CHAR = String.raw`[\p{L}\p{M}\p{N}_]`;
const anchoredPattern = (body) => new RegExp(`(?<!${WORD_CHAR})${body}(?!${WORD_CHAR})`, 'u');
// Same left boundary, no right one: the keyword must start a word, and the
// word may continue past it.
const stemPattern = (body) => new RegExp(`(?<!${WORD_CHAR})${body}`, 'u');

function escapeForRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compile a `word:` / `stem:` prefixed keyword, or return null when the entry
 * carries no prefix and should fall through to the default matcher.
 * @param {string} kw already trimmed and lowercased
 * @returns {((lower: string) => boolean) | null}
 */
function compilePrefixedKeyword(kw) {
  for (const [prefix, pattern] of [[WORD_PREFIX, anchoredPattern], [STEM_PREFIX, stemPattern]]) {
    if (!kw.startsWith(prefix)) continue;
    const bare = kw.slice(prefix.length).trim();
    // A bare `word:` is a config typo. Matching NOTHING is the safe reading:
    // as a positive it contributes no match, whereas an empty pattern would
    // match everything and, as a negative, veto an entire scan from one stray
    // colon. Prefer silently dropping one entry over a silent flood.
    if (!bare) return () => false;
    const re = pattern(escapeForRegExp(bare));
    return (lower) => re.test(lower);
  }
  return null;
}

// ── Title filter ────────────────────────────────────────────────────
// v1.76.0 — title-filter matching robustness.
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
  const prefixed = compilePrefixedKeyword(kw);
  if (prefixed) return prefixed;
  if (/^[a-z]{2,3}$/.test(kw)) {
    // The same Unicode boundary as `word:`, NOT \b: \b is ASCII-only, so a
    // two-letter acronym matched inside an accented word while `word:` did not.
    // One spelling of the rule keeps the two from drifting apart.
    const re = anchoredPattern(escapeForRegExp(kw));
    return (lower) => re.test(lower);
  }
  return (lower) => lower.includes(kw);
}

/**
 * An AND-group: whitespace-delimited ` + ` between terms in a single
 * `title_filter.positive` entry means EVERY term must appear in the title, in
 * any order. `title_filter.positive` is otherwise a
 * hand-maintained list of literal spellings, and real titles vary in word order
 * and separators — an AND-group lets one entry require a conjunction
 * ("staff + platform") without enumerating every ordering. The surrounding
 * whitespace is REQUIRED on purpose: a bare `split('+')` would shatter "c++"
 * and "front+back" into fragments that match almost every title.
 */
const AND_SEPARATOR = /\s+\+\s+/;

/**
 * Compile one already-lowercased `positive` entry. An AND-group (` + `) becomes
 * a matcher that requires EVERY term; anything else is a plain
 * {@link compileKeyword}. Each term keeps its own word-boundary treatment, so a
 * 2–3-letter term still can't hit inside another word.
 * @param {string} kw already-lowercased keyword
 */
export function compilePositiveKeyword(kw) {
  if (!AND_SEPARATOR.test(kw)) return compileKeyword(kw);
  const matchers = kw.split(AND_SEPARATOR).map((t) => t.trim()).filter(Boolean).map(compileKeyword);
  if (matchers.length === 0) return compileKeyword(kw);
  return (lower) => matchers.every((m) => m(lower));
}

/**
 * Compile a raw keyword list (tolerating malformed entries) into an array of
 * matcher functions. Exposed so the RU scanner can compile its negative list
 * once while keeping the lowercased array for collision warnings.
 * @param {unknown} arr
 * @param {(kw: string) => (lower: string) => boolean} [compiler] per-entry
 *   compiler — {@link compileKeyword} (default) for negatives, or
 *   {@link compilePositiveKeyword} for AND-group-aware positives.
 * @returns {Array<(lower: string) => boolean>}
 */
export function compileKeywordList(arr, compiler = compileKeyword) {
  // v1.79.0 — trim BEFORE the length check:
  // a whitespace-only keyword ("  ") otherwise survives length>0 and compiles
  // into a substring matcher that matches almost everything.
  return (Array.isArray(arr) ? arr : [])
    .filter((k) => typeof k === 'string')
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0)
    .map(compiler);
}

/**
 * Compile a lowercased `content_filter` keyword into a matcher.
 *
 * `content_filter` matches the job DESCRIPTION, and its default has always been
 * a plain substring — which is why a bare negative `java` rejects every posting
 * that merely mentions "JavaScript". A `word:` / `stem:` prefix opts one entry
 * out of that, with identical semantics to the title filter; every other entry
 * keeps the substring behaviour byte-for-byte.
 *
 * Unlike {@link compileKeyword} there is NO automatic anchoring of short
 * keywords. The title filter anchors 2-3 letter acronyms because "COO" inside
 * "Coordinator" is always wrong; a 2-3 letter run inside a paragraph of prose
 * is routinely intended ("aws", "gcp", "sql", "go").
 *
 * @param {string} kw already trimmed and lowercased
 */
export function compileContentKeyword(kw) {
  return compilePrefixedKeyword(kw) ?? ((lower) => lower.includes(kw));
}

/**
 * Build a title predicate from `portals.yml::title_filter`. A job passes when it
 * matches at least one positive keyword (or there are none) AND no negative one.
 * @param {{positive?: unknown, negative?: unknown}|null|undefined} titleFilter
 * @returns {(title: string) => boolean} predicate — true = keep the job
 */
export function buildTitleFilter(titleFilter) {
  const positive = compileKeywordList(titleFilter?.positive, compilePositiveKeyword);
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
 * v1.75.0 — `content_filter` support.
 *
 * Like `location_filter` but matches against a posting's free-text
 * description/snippet rather than its location. Only sources that populate a
 * `description` (or `snippet`) field are affected — every other posting passes,
 * so enabling this never silently drops postings from sources that don't ship a
 * body.
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
  // Compiled through compileContentKeyword so a `word:` / `stem:` entry is
  // honoured here too. Without it a prefixed entry matched the literal text
  // "word:java", i.e. nothing — the same silent no-op the title filter had.
  const positive = compileKeywordList(contentFilter.positive, compileContentKeyword);
  const negative = compileKeywordList(contentFilter.negative, compileContentKeyword);

  return (description) => {
    if (typeof description !== 'string' || description.trim() === '') return true;
    const lower = description.toLowerCase();
    if (negative.length > 0 && negative.some((m) => m(lower))) return false;
    if (positive.length === 0) return true;
    return positive.some((m) => m(lower));
  };
}
