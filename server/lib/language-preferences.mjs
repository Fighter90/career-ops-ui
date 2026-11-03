// @ts-check
/**
 * language-preferences.mjs — shared posting-language helpers (CAR-223).
 *
 * The web-ui mirror of the parent's preferred_languages stack:
 *   - career-ops #4789 (66314d3a) — the language a posting URL names
 *     (`languageFormsFromUrl`, the URL_LANGUAGE_PARAMS read-back);
 *   - career-ops #5285 (ff092313) — `preferred_languages`: the languages the
 *     candidate wants a posting in, best first (`resolvePreferredLanguages`,
 *     `preferredLanguageRanker`, `orderByPreferredLanguage`), the kept-row
 *     pick for one posting's version group (`preferredLanguagePick`), and the
 *     validate-portals.mjs entry checks (`validatePreferredLanguages`).
 *
 * WHO IMPORTS THIS MODULE
 *
 *   - the scanner (server/lib/en-scanner.mjs) — orders each source's rows
 *     preferred-language first so its per-URL dedup keeps the preferred
 *     version, and reads back the language a seen URL names;
 *   - language-emitting sources (server/lib/sources/recruitee.mjs, personio)
 *     — turn a `preferred_languages` list into the rank function they filter
 *     their versions by.
 *
 * The JOB-ROW CONTRACT this module sits under: a source that serves language
 * versions of one posting MAY tag each row with an OPTIONAL `language` field
 * (`'en' | 'de' | …`, the code as the source names it) and, when the versions
 * share one URL, carry the code as the board's own language query param on the
 * URL (`?lang=` on Recruitee, `?language=` on Personio). Untagged rows mean
 * "language unknown" and behave exactly as before — they never match a
 * preferred language and never displace one.
 *
 * Semantics are ported verbatim from the parent commits named above; the
 * canonical `languageSubtag` reduction lives here (not in url-key.mjs) so both
 * consumers share ONE implementation without a cross-module dependency: it
 * mirrors the parent's url-key.mjs::languageSubtag byte for byte. No external
 * dependencies — `Intl.Locale` is a Node ≥ 18 builtin.
 */

/**
 * Query params naming the language a posting page renders in. An ATS that
 * serves every language version of one posting at one URL tells the versions
 * apart by one of these (Personio `?language=`, Recruitee `?lang=`). The
 * scanner imports this list for its dedup key, so the scanner and the sources
 * read the same names.
 */
export const LANGUAGE_PARAMS = ['language', 'lang', 'locale'];

/**
 * A posting language reduced to the form two languages are compared in; ''
 * when the value is empty or not a string.
 *
 * A value that parses as a language tag (`_` read as `-`) is reduced by
 * `Intl.Locale` to its canonical language subtag: the region and script go
 * (`en-GB`, `en_GLOBAL`, `zh-Hant-TW` → `en`, `en`, `zh`) — regional variants
 * of one language are the same text for any reader — and legacy or three-letter
 * codes map to the current two-letter one (`deu` → `de`, `iw` → `he`).
 * Anything that doesn't parse, such as `English (US)`, is compared whole,
 * case-folded; a name like `German` parses as a (non-standard) tag and comes
 * back lowercased. The two postings being compared come from one employer, and
 * almost always one source, so the value only has to be consistent within a
 * source, not standard across sources.
 *
 * @param {unknown} value - A language param value, a row's `language`, or a
 *   preferred_languages entry.
 * @returns {string}
 */
export function languageSubtag(value) {
  if (typeof value !== 'string') return '';
  const v = value.trim();
  if (!v) return '';
  try {
    return new Intl.Locale(v.replace(/_/g, '-')).language;
  } catch {
    return v.toLowerCase();
  }
}

/**
 * The comparison forms of one posting language: zero or one entry — the
 * {@link languageSubtag} form, or nothing for an empty/non-string value.
 *
 * The array shape (not a bare string or null) is what the parent's scan-side
 * helpers pass around, so callers can treat "unknown" uniformly as an empty
 * list.
 *
 * @param {unknown} language
 * @returns {string[]}
 */
export function languageFormsForDedup(language) {
  const form = languageSubtag(language);
  return form ? [form] : [];
}

/**
 * The posting language a URL asks for, as dedup forms; none when it names none.
 *
 * Read back from the same params a dedup key strips (`language` / `lang` /
 * `locale`, name-matched case-insensitively, first one wins), so the language
 * versions of one posting that share a URL key can still be told apart on rows
 * that carry no `language` of their own (pipeline.md lines, tracker rows,
 * scan-history rows written before the `language` column existed).
 *
 * Parent semantics (66314d3a) are query-param-only: a locale path segment
 * (`/en/jobs/…`) names no language here — only Personio/Recruitee-style
 * params do.
 *
 * @param {unknown} url
 * @returns {string[]} Zero or one form, as {@link languageFormsForDedup}.
 */
export function languageFormsFromUrl(url) {
  if (typeof url !== 'string' || !url) return [];
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return [];
  }
  for (const [name, value] of parsed.searchParams) {
    if (LANGUAGE_PARAMS.includes(name.toLowerCase())) return languageFormsForDedup(value);
  }
  return [];
}

/**
 * Read the `preferred_languages` setting: the languages the candidate wants a
 * posting in, best first.
 *
 * Each entry is reduced the way posting languages are ({@link languageSubtag}),
 * so `en-GB` and `en` name one language. A single string counts as a one-entry
 * list; anything that is not a non-empty string is skipped, and a repeated
 * language keeps its first place. Pass the whole portals config, or a fragment
 * carrying just `preferred_languages` (an entry-level list — same shape).
 *
 * @param {object|undefined} [config] - Parsed portals.yml (or an entry with
 *   its own `preferred_languages`).
 * @returns {string[]} Language forms, best first; empty when unset.
 */
export function resolvePreferredLanguages(config = {}) {
  const raw = config?.preferred_languages;
  const list = typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw : [];
  return [...new Set(list.flatMap((entry) => languageFormsForDedup(entry)))];
}

/**
 * Rank a posting language against the preferred list: its place in the list,
 * or -1 when it is not there or unknown.
 *
 * Handed to sources as `preferredLanguageRank` (the parent's
 * `ctx.preferredLanguageRank`), so a source compares its own codes by the same
 * rules without its own copy of them.
 *
 * @param {string[]} preferred - From {@link resolvePreferredLanguages}.
 * @returns {(language: unknown) => number}
 */
export function preferredLanguageRanker(preferred) {
  return (language) => {
    const [form] = languageFormsForDedup(language);
    return form === undefined ? -1 : preferred.indexOf(form);
  };
}

/**
 * Order one source's rows so that postings in a preferred language come
 * first, best language first; the rest keep the source's order.
 *
 * The sort is stable. Where several language versions of one posting come
 * back, a dedup that keeps the first row it meets then keeps the preferred
 * one; where every version is kept, the preferred ones come first. The
 * source's own order — each posting's default language first — is untouched
 * as the input, so callers that need the pre-order sequence (for example to
 * resolve a seen row's language against the source's default-first rule)
 * build it from the unsorted array.
 *
 * @template {{language?: unknown}} T
 * @param {T[]} rows
 * @param {(language: unknown) => number} rank - From {@link preferredLanguageRanker}.
 * @returns {T[]} A new array; `rows` is left as it was.
 */
export function orderByPreferredLanguage(rows, rank) {
  const keyOf = (row) => {
    const r = rank(row?.language);
    return r < 0 ? Number.POSITIVE_INFINITY : r;
  };
  return rows
    .map((row, index) => ({ row, index, key: keyOf(row) }))
    .sort((a, b) => a.key - b.key || a.index - b.index)
    .map(({ row }) => row);
}

/**
 * The kept row when one posting came back as several language rows.
 *
 * The parent keeps one version per posting by ordering the rows
 * preferred-first ({@link orderByPreferredLanguage}) and letting the dedup
 * keep the first row it meets; this is that first row, pickable directly —
 * the row in the best-ranked preferred language, else (no list, no match, or
 * unknown languages on every row) the source's own first row, which is the
 * posting's default-language version under the sources' default-first rule.
 * An order of preference, never a filter: no row is dropped by this call.
 *
 * @template {{language?: unknown}} T
 * @param {T[]} rows - One posting's version group (or any row list).
 * @param {string[]|undefined} [preferred] - From {@link resolvePreferredLanguages}.
 * @returns {T|undefined} `undefined` when `rows` is empty or not an array.
 */
export function preferredLanguagePick(rows, preferred) {
  if (!Array.isArray(rows) || rows.length === 0) return undefined;
  if (!Array.isArray(preferred) || preferred.length === 0) return rows[0];
  return orderByPreferredLanguage(rows, preferredLanguageRanker(preferred))[0];
}

/**
 * Validate a `preferred_languages` value the way the parent's
 * validate-portals.mjs does (ff092313): a list of language codes, or a single
 * code; every entry must be a non-empty string.
 *
 * The scanner skips an entry it cannot read and silently falls back to the
 * posting's default version, so a typo can only surface here — that is why
 * the check is strict about the VALUE shape (list-or-string, non-empty
 * strings) while leaving the code spelling free: a loose code (`deu`,
 * `German`) still reduces through {@link languageSubtag} and works.
 *
 * @param {unknown} value - The `preferred_languages` value (undefined = unset,
 *   which is valid).
 * @returns {{ok: boolean, errors: Array<{path: string, message: string}>}}
 *   `path` mirrors the parent's validator keys: `preferred_languages` for the
 *   whole value, `preferred_languages[idx]` for one entry.
 */
export function validatePreferredLanguages(value) {
  if (value === undefined) return { ok: true, errors: [] };
  if (!Array.isArray(value) && typeof value !== 'string') {
    return {
      ok: false,
      errors: [{ path: 'preferred_languages', message: 'preferred_languages must be a list of language codes (e.g. [en])' }],
    };
  }
  const list = Array.isArray(value) ? value : [value];
  /** @type {Array<{path: string, message: string}>} */
  const errors = [];
  list.forEach((entry, idx) => {
    if (typeof entry !== 'string' || !entry.trim()) {
      errors.push({ path: `preferred_languages[${idx}]`, message: 'each preferred language must be a non-empty language code' });
    }
  });
  return { ok: errors.length === 0, errors };
}
