// @ts-check
/**
 * Unicode-aware text key for dedup / matching.
 *
 * The web-ui equivalents used to key company and role titles with an ASCII-only
 * strip (`[^a-z0-9]` / plain `.toLowerCase()`). That silently erased non-Latin
 * text — «Тинькофф», 「サイボウズ」, "Nestlé" collapsed toward each other or to an
 * empty key — so distinct employers/roles could merge and genuine reposts of a
 * non-Latin listing went undetected. This helper keeps every letter, combining
 * mark, and digit in ANY script, and folds width/compatibility variants
 * (full-width「ＡＣＭＥ」→ "acme", ﬁ ligature → "fi") via NFKC first.
 *
 * @param {unknown} value  raw cell — a null/undefined keys to '' like any other
 *   empty field (NOT the literal "null"/"undefined", which would compare equal
 *   to each other and form a bogus group).
 * @param {string} [separator]  what a run of non-key characters collapses to.
 *   '' (default) for a spaceless key ("Acme, Inc." → "acmeinc"); ' ' for a
 *   tokenizable key ("Acme, Inc." → "acme inc").
 * @returns {string}
 */
export function normalizeTextKey(value, separator = '') {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    // Drop the combining dot that lowercasing a Turkish dotted capital leaves
    // behind: 'İ'.toLowerCase() is 'i' + U+0307, so "İstanbul" and "Istanbul"
    // keyed apart (parent 462d2765 / 5df43e71). NO NFD here — that is the
    // safety property: NFKC keeps ż, ė, ġ precomposed so their dots survive,
    // while i + U+0307 has no precomposed form and stays exposed.
    .replace(/\u0307/gu, '')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, separator)
    .trim();
}
