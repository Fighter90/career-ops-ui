// @ts-check
/**
 * Recruitee source — hits the public per-tenant offers API.
 *   GET https://<slug>.recruitee.com/api/offers/
 *
 * Implements the web-ui source
 * contract. Per-tenant subdomains vary, so the SSRF defence is an anchored host
 * regex plus `redirect:'error'`. The per-offer URL is commonly on the tenant's
 * own custom domain, so it is NOT host-locked (display-only, never server-fetched).
 *
 * Used by the recruitee adapter (server/lib/portals/adapters/recruitee.mjs).
 *
 * Language versions (CAR-223, parent #5285 ff092313 / #5264 a0317de3): the
 * offers payload carries every translation of an offer in `translations`. Each
 * row this source emits may carry an OPTIONAL `language` field naming the
 * version it serves, with the same code as `?lang=` on its URL — the contract
 * documented in server/lib/language-preferences.mjs. `preferred_languages`
 * reaches the source either as an explicit `preferredLanguageRank` (scan-wide,
 * threaded by the scanner) or as the portals entry's own
 * `preferred_languages` list (opts.company); a `?lang=` on the entry's
 * careers_url asks for that language for that entry and wins over the list.
 */
import { fetchJson } from '../http-json.mjs';
import { htmlToText } from '../html-to-text.mjs';
import { requireObject, requireArray } from './_shape.mjs';
import { resolvePreferredLanguages, preferredLanguageRanker } from '../language-preferences.mjs';

export const RECRUITEE_HOST_RE = /^[a-z0-9][a-z0-9-]*\.recruitee\.com$/;

export const meta = {
  value: 'recruitee',
  label: 'Recruitee',
  region: 'en',
};

/** Defence-in-depth host check on the endpoint built by the adapter. */
export function assertRecruiteeUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`recruitee: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`recruitee: URL must use HTTPS: ${url}`);
  if (!RECRUITEE_HOST_RE.test(parsed.hostname)) {
    throw new Error(`recruitee: untrusted hostname "${parsed.hostname}" — must match <slug>.recruitee.com`);
  }
  return url;
}

// Recruitee stamps "(Sample)" on the seeded posting it serves for trial tenants
// that never launched real hiring (parent #4190 — observed byte-identical on two
// unrelated tenants). The platform's own marker, not a heuristic: the bare word
// "sample" without the parenthesised tag is NOT matched.
const RECRUITEE_SAMPLE_TITLE_RE = /\(sample\)/i;

// The query param a Recruitee offer page takes its rendering language from.
// Without it the page renders the offer's default language.
export const LANGUAGE_PARAM = 'lang';

// A language code as Recruitee writes it in `translations` (`de`, `en`). Codes
// go into job URLs verbatim, so this gate keeps them to tag characters;
// language-preferences.mjs canonicalizes them for comparison.
const LANGUAGE_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;

/**
 * `url` with the language param set to `language`.
 *
 * @param {string} url - Already validated as an https URL.
 * @param {string} language - Already checked against LANGUAGE_RE.
 * @returns {string}
 */
function withLanguage(url, language) {
  const parsed = new URL(url);
  parsed.searchParams.set(LANGUAGE_PARAM, language);
  return parsed.href;
}

/**
 * The language a careers_url asks for (`?lang=xx`, Recruitee's own param), or
 * null. Only a careers_url ON the recruitee host names a language for this
 * source — a branded domain's `?lang=` is somebody else's param.
 *
 * @param {any} entry - The portals.yml company entry (opts.company).
 * @returns {string|null} Lowercased, already checked against LANGUAGE_RE.
 */
export function entryLanguage(entry) {
  if (typeof entry?.careers_url !== 'string') return null;
  let parsed;
  try {
    parsed = new URL(entry.careers_url);
  } catch {
    return null;
  }
  if (!RECRUITEE_HOST_RE.test(parsed.hostname)) return null;
  const language = (parsed.searchParams.get(LANGUAGE_PARAM) || '').trim().toLowerCase();
  return LANGUAGE_RE.test(language) ? language : null;
}

/**
 * The language versions of one offer, its default language first.
 *
 * `translations` maps a language code to that version's `title`,
 * `description` and `requirements`. Each version, the offer's own top-level
 * fields included, is compared by the text it produces (versionText): the
 * trimmed title and the plain-text description and requirements. Nothing
 * names the default language, so it is the translation whose text equals the
 * top-level one — the version the API serves without a language param. A
 * further translation with the same text as a version already returned is a
 * copy under another label, not a translation, and is skipped.
 *
 * Without `allLanguages`, the offer comes back from its top-level fields,
 * tagged with the default language when one matches, followed by the
 * translations in a preferred language (`rank` ≥ 0), so the scan can keep the
 * preferred version. When no translation matches, the offer comes back once:
 * the translation in the best-ranked preferred language, else its top-level
 * fields — an untagged version next to tagged ones would leave the scan
 * nothing to tell them apart by.
 *
 * With `allLanguages`, every translation comes back, the default one first;
 * when none matches the top-level fields, the translations come back in the
 * API's order, and the top-level fields, which would repeat one of them
 * untagged, are left out. An offer with no usable translation comes back once
 * from its top-level fields, with no `language`, either way.
 *
 * A careers_url language (`entryLanguage`) decides alone for that entry when
 * `allLanguages` is off: the offer comes back once, in that translation
 * wherever the offer has it, else as it would with no preferred language.
 *
 * @param {any} j - One offer.
 * @param {boolean} allLanguages
 * @param {((language: string) => number)|null} rank - The preferred_languages rank, if set.
 * @param {string|null} askedLanguage - The careers_url language, lowercased, if any.
 * @returns {Array<{title: string, description: string, language?: string}>}
 */
function languageVersions(j, allLanguages, rank, askedLanguage) {
  const top = versionText(j.title, j.description, j.requirements);
  const versionKey = (v) => JSON.stringify([v.title, v.description]);
  const translations = j.translations && typeof j.translations === 'object' ? j.translations : {};
  const entries = Object.entries(translations)
    .filter(([code, t]) => LANGUAGE_RE.test(code) && t && typeof t === 'object')
    .map(([code, t]) => ({ ...versionText(t.title, t.description, t.requirements), language: code }));
  const defaultEntry = entries.find((v) => versionKey(v) === versionKey(top));
  if (!allLanguages && askedLanguage) {
    const asked = entries.find((v) => v.title && v.language.toLowerCase() === askedLanguage);
    return [asked ?? (defaultEntry ? { ...top, language: defaultEntry.language } : top)];
  }
  const rankOf = (v) => (rank ? rank(v.language) : -1);
  if (!allLanguages && !defaultEntry) {
    const best = entries
      .filter((v) => v.title && rankOf(v) >= 0)
      .reduce((found, v) => (found && rankOf(found) <= rankOf(v) ? found : v), null);
    return [best ?? top];
  }
  const versions = defaultEntry ? [{ ...top, language: defaultEntry.language }] : [];
  const seen = new Set(versions.map(versionKey));
  for (const version of entries) {
    if (!allLanguages && rankOf(version) < 0) continue;
    if (!version.title || seen.has(versionKey(version))) continue;
    seen.add(versionKey(version));
    versions.push(version);
  }
  return versions.length ? versions : [top];
}

/**
 * The text of one version: the trimmed title, and the description and
 * requirements joined, introduction first, and stripped to plain text. This
 * is what two versions of one offer are compared by (the default-language
 * match and the copy filter) and what a row's `description` carries.
 *
 * @param {unknown} title
 * @param {unknown} description
 * @param {unknown} requirements
 * @returns {{title: string, description: string}}
 */
function versionText(title, description, requirements) {
  const body = [description, requirements].filter((part) => typeof part === 'string' && part.trim());
  return {
    title: typeof title === 'string' ? title.trim() : '',
    description: htmlToText(body.join('\n')),
  };
}

function isRecruiteeSamplePosting(j) {
  const title = typeof j?.title === 'string' ? j.title : '';
  return RECRUITEE_SAMPLE_TITLE_RE.test(title);
}

/**
 * Whole-word, case-insensitive containment with Unicode-aware boundaries
 * (`\b` is ASCII-only and misfires next to "Zürich"/"Örebro"), so city "Paris"
 * is NOT considered present in "Parisian HQ".
 * @param {string} text
 * @param {string} word
 */
function containsWholeWord(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu').test(text);
}

/**
 * Location for one offer (parent #4414). The flat `location` field carries only
 * the PRIMARY place; `locations[]` lists every place as `{ name, city, country }`.
 * When it yields 2+ DISTINCT names (city/country appended when not already a
 * whole word of the name), they are joined with " · " — plus "Remote" when the
 * top-level `remote` flag is set and no name already says so. Otherwise falls
 * back to the flat field, else city/country(/Remote).
 * @param {any} j
 */
function assembleLocation(j) {
  const names = Array.isArray(j.locations)
    ? j.locations.map((l) => {
        const name = typeof l?.name === 'string' ? l.name.trim() : '';
        if (!name) return '';
        const parts = [name];
        const city = typeof l?.city === 'string' ? l.city.trim() : '';
        if (city && !containsWholeWord(name, city)) parts.push(city);
        const country = typeof l?.country === 'string' ? l.country.trim() : '';
        if (country && !containsWholeWord(name, country)) parts.push(country);
        return parts.join(', ');
      }).filter(Boolean)
    : [];
  const distinctNames = [...new Set(names)];
  if (distinctNames.length > 1) {
    const hasRemote = distinctNames.some((n) => n.toLowerCase().includes('remote'));
    return j.remote && !hasRemote ? [...distinctNames, 'Remote'].join(' · ') : distinctNames.join(' · ');
  }
  const city = j.city || '';
  const country = j.country || '';
  const remote = j.remote ? 'Remote' : '';
  // Parent parity (v1.239.0): the flat `location` gets the same country fold
  // every locations[] entry gets above.
  if (typeof j.location === 'string' && j.location.trim()) {
    const loc = j.location.trim();
    return typeof country === 'string' && country.trim() && !containsWholeWord(loc, country.trim())
      ? `${loc}, ${country.trim()}`
      : loc;
  }
  return [city, country, remote].filter(Boolean).join(', ');
}

/**
 * Parse a Recruitee `/api/offers/` response. Exported for unit tests.
 * Shape: `{ offers: [{ title, careers_url?, url?, city?, country?, remote?, location?,
 *          description?, requirements?, translations? }] }`.
 * The per-offer url is the dedup key: `careers_url` then `url`, each validated
 * independently (one bad field never shadows a usable other one). Dropped rows:
 * malformed entries (null/primitive), Recruitee's own "(Sample)" demo postings,
 * no usable (trimmed, string) title, no well-formed https URL.
 *
 * Language versions (CAR-223): an offer that carries `translations` may come
 * back once per language version it serves (see {@link languageVersions}) —
 * the default version first, plus the versions a `preferredLanguageRank`
 * ranks (or every version under `allLanguages`). Each version is its own row:
 * its own title and text, the offer's location, and — when the version is
 * tagged — its code as `language` AND as `?lang=` on the URL, so the
 * versions of one offer share a dedup key once language params are folded.
 * Rows are emitted in the default-first order the scanner's per-URL dedup
 * resolves against; the translations ship in the same response, so no request
 * is added.
 *
 * @param {any} json
 * @param {string} companyName
 * @param {{allLanguages?: boolean, preferredLanguageRank?: ((language: string) => number)|null, entryLanguage?: string|null}} [options]
 */
export function parseRecruiteeResponse(json, companyName, { allLanguages = false, preferredLanguageRank = null, entryLanguage = null } = {}) {
  // Phase-2: a 200 that stopped speaking { offers: [...] } is a drifted API or
  // a challenge, not an empty board — THROW (the API is a single request, so
  // this is always "page 1").
  const offers = requireArray(requireObject(json, 'Recruitee offers').offers, 'Recruitee offers');
  const out = [];
  for (const j of offers) {
    if (!j || typeof j !== 'object') continue;
    if (isRecruiteeSamplePosting(j)) continue;
    const title = typeof j.title === 'string' ? j.title.trim() : '';
    if (!title) continue;

    let url = '';
    for (const candidate of [j.careers_url, j.url]) {
      if (typeof candidate !== 'string' || !candidate) continue;
      try {
        const parsed = new URL(candidate);
        if (parsed.protocol === 'https:') { url = parsed.href; break; }
      } catch { /* malformed → try the next candidate */ }
    }
    if (!url) continue;

    const location = assembleLocation(j);
    const isRemote = !!j.remote || /remote/i.test(location);

    for (const version of languageVersions(j, allLanguages, preferredLanguageRank, entryLanguage)) {
      const versionUrl = version.language ? withLanguage(url, version.language) : url;
      out.push({
        id: `recruitee-${versionUrl}`,
        title: version.title,
        company: companyName,
        url: versionUrl,
        salary: '',
        location,
        isRemote,
        workplaceType: isRemote ? 'Remote' : 'Onsite',
        relocates: false,
        date: '',
        snippet: '',
        description: version.description || '',
        source: 'recruitee',
        // CAR-223 contract (server/lib/language-preferences.mjs): the
        // language version this row serves, as the source names the code.
        // Absent = language unknown; the row then behaves exactly as before.
        ...(version.language ? { language: version.language } : {}),
      });
    }
  }
  return out;
}

/**
 * Fetch + normalize a Recruitee tenant's offers.
 *
 * How `preferred_languages` reaches this source (both paths end at the same
 * rank function):
 *   - `opts.preferredLanguageRank` — scan-wide, a
 *     `preferredLanguageRanker(resolvePreferredLanguages(portals))` the
 *     scanner threads; wins when present;
 *   - `company.preferred_languages` — the portals ENTRY's own list, ranked
 *     by the same rules; the fallback.
 *
 * `allLanguages` (keep every version) comes from `opts.dedupIncludeLanguage`
 * or the entry's own `dedup_include_language`. The entry's careers_url
 * `?lang=xx` (on the recruitee host) asks for that language for this entry
 * and wins over the preferred list while `allLanguages` is off.
 *
 * @param {string} apiUrl `https://<slug>.recruitee.com/api/offers/` (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object, dedupIncludeLanguage?: boolean, preferredLanguageRank?: Function }} [opts]
 */
export async function fetchRecruitee(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertRecruiteeUrl(apiUrl);
  const json = await fetchJson(fetchImpl, apiUrl, {
    signal,
    headers: { accept: 'application/json' },
  });
  const allLanguages = opts.dedupIncludeLanguage === true || company.dedup_include_language === true;
  const rank = typeof opts.preferredLanguageRank === 'function'
    ? opts.preferredLanguageRank
    : preferredLanguageRankOr(company);
  return parseRecruiteeResponse(json, company.name || '', {
    allLanguages,
    preferredLanguageRank: rank,
    entryLanguage: entryLanguage(company),
  });
}

/**
 * The rank function for an entry-level `preferred_languages` list, or null
 * when the entry names none (or names junk — the same tolerance the scanner's
 * own list gets: unreadable entries are skipped, never a throw).
 *
 * @param {any} company - The portals.yml entry.
 * @returns {((language: string) => number)|null}
 */
function preferredLanguageRankOr(company) {
  if (company?.preferred_languages === undefined) return null;
  const preferred = resolvePreferredLanguages(company);
  return preferred.length ? preferredLanguageRanker(preferred) : null;
}
