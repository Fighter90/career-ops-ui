// @ts-check
/**
 * MyCareersFuture source — Singapore's national job bank, run by Workforce
 * Singapore (WSG, a statutory board under the Ministry of Manpower). Same class
 * as arbeitsagentur.mjs (Germany) / vdab.mjs (Flanders) / jobbankca.mjs
 * (Canada): a high-volume public employment service, no login, no API key.
 *
 * Implements the web-ui source contract (rich `meta` for auto-discovery + pure
 * helpers). Config comes from the company entry's `mycareersfuture:` block,
 * read via `opts.company`:
 *
 *   tracked_companies:
 *     - name: MyCareersFuture — Software Engineering
 *       provider: mycareersfuture
 *       mycareersfuture:
 *         # keywords optional: falls back to config/profile.yml's target_roles
 *         # (primary[] + archetypes[].name) when omitted, same as jobbankca.mjs.
 *         keywords: ["software engineer", "backend developer"]
 *         size: 100          # results per page (1–100, default 100)
 *       max_pages: 5          # optional, clamped to MAX_PAGES_CAP (20)
 *       enabled: true
 *
 * PUBLIC API, NO AUTH. The search endpoint is the same one
 * mycareersfuture.gov.sg's own frontend uses. Pagination is controlled by the
 * QUERY-STRING `page` param, not the JSON body's `page` field — the body page is
 * still sent (mirrors the site's own request shape) but must never be relied on
 * to advance pages. `limit` (page size) is server-validated at <= 100, so SIZE
 * is clamped to that ceiling.
 *
 * SSRF: the search endpoint is host-pinned to api.mycareersfuture.gov.sg over
 * HTTPS (assertApiUrl) with `redirect: 'error'`; each job-detail URL returned by
 * the API is independently host-locked to www.mycareersfuture.gov.sg (cleanUrl).
 *
 * Used by the mycareersfuture adapter
 * (server/lib/portals/adapters/mycareersfuture.mjs).
 */
import { fetchJsonWithRetry } from '../http-json.mjs';
import { PATHS } from '../paths.mjs';
import { existsSync, readFileSync } from 'node:fs';
// NOTE: `js-yaml` is loaded lazily inside resolveProfileKeywords (below), NOT at
// module top level. The registry enumerates every source with a bare `import()`
// to read its `meta` — that runs in environments without the repo-root
// node_modules (the cvstart.org Pages build only `npm ci`s in site/). A
// top-level `import 'js-yaml'` there throws, the registry silently drops this
// source, and the landing's source count falls out of sync with the app. Keep
// source modules import-safe with only node: builtins + relative modules; defer
// third-party deps to call time. Guarded by tests/site-sources.test.mjs.

const API_HOST = 'api.mycareersfuture.gov.sg';
export const API_URL = 'https://api.mycareersfuture.gov.sg/v2/search';
const TRUSTED_JOB_HOST = 'www.mycareersfuture.gov.sg';

const MAX_PAGE_SIZE = 100; // server-enforced ceiling on `limit`
const DEFAULT_MAX_PAGES = 5; // 5 x 100 = 500 postings/keyword before over-fetch stops paying off
const MAX_PAGES_CAP = 20; // hard ceiling regardless of a misconfigured max_pages

export const meta = {
  value: 'mycareersfuture',
  label: 'MyCareersFuture',
  region: 'en',
};

/** Clamp a runtime integer into [min, max], falling back to `def` for NaN. */
function intInRange(val, def, min, max) {
  const n = Number(val);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/**
 * Assert that `url` points to MyCareersFuture's search API
 * (api.mycareersfuture.gov.sg) over HTTPS. Throws on failure — closes the SSRF
 * vector on an endpoint override before any fetch goes out.
 * @param {string} url
 * @returns {string} the validated url
 */
export function assertApiUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`mycareersfuture: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`mycareersfuture: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== API_HOST) {
    throw new Error(`mycareersfuture: untrusted hostname "${parsed.hostname}" — must be ${API_HOST}`);
  }
  return url;
}

/**
 * Read + sanitize the entry's `mycareersfuture:` config block, plus the shared
 * `max_pages` field (same key jobbankca.mjs/workday.mjs use).
 * @param {{ mycareersfuture?: any, max_pages?: unknown }} entry
 * @returns {{ keywords: string[], size: number, maxPages: number }}
 */
export function parseConfig(entry) {
  const cfg = (entry && entry.mycareersfuture) || {};
  const keywords = [...new Set(
    (Array.isArray(cfg.keywords) ? cfg.keywords : [])
      .filter((k) => typeof k === 'string' && k.trim())
      .map((k) => k.trim()),
  )];
  return {
    keywords,
    size: intInRange(cfg.size, MAX_PAGE_SIZE, 1, MAX_PAGE_SIZE),
    maxPages: intInRange(entry && entry.max_pages, DEFAULT_MAX_PAGES, 1, MAX_PAGES_CAP),
  };
}

/**
 * Extract candidate search keywords from a parsed profile.yml's `target_roles`
 * block: `primary[]` plus `archetypes[].name`. Pure — exported for tests.
 * @param {any} profile
 * @returns {string[]}
 */
export function profileTargetKeywords(profile) {
  const roles = profile && profile.target_roles;
  if (!roles || typeof roles !== 'object') return [];
  return [...new Set(
    [
      ...(Array.isArray(roles.primary) ? roles.primary : []),
      ...(Array.isArray(roles.archetypes) ? roles.archetypes.map((a) => a && a.name) : []),
    ]
      .filter((k) => typeof k === 'string')
      .map((k) => k.trim())
      .filter(Boolean),
  )];
}

/**
 * Read config/profile.yml (if present) and return its target-role keywords.
 * Fails open (empty array) on a missing/unparseable file — a convenience
 * fallback, never a hard requirement, so it must never throw. Async because
 * js-yaml is imported lazily (see the top-of-file note) — it loads at scan time
 * on the server, where the dep is installed, not at module-import time.
 * @param {string} [profilePath]
 * @returns {Promise<string[]>}
 */
export async function resolveProfileKeywords(profilePath = PATHS.profile) {
  if (!profilePath || !existsSync(profilePath)) return [];
  try {
    const yaml = await import('js-yaml');
    const profile = yaml.load(readFileSync(profilePath, 'utf8')) || {};
    return profileTargetKeywords(profile);
  } catch {
    return [];
  }
}

/**
 * Clean and host-lock a job-detail URL straight from the API response — defence
 * in depth against the API ever returning (or being tricked into returning) an
 * off-host URL.
 *
 * Requires the trusted host's exact default-port HTTPS origin with no embedded
 * credentials: `.hostname` alone already can't be fooled by a
 * `https://TRUSTED_JOB_HOST@evil.example/` userinfo trick (`.hostname` extracts
 * only the real host), but a URL carrying a non-default port or `user:pass@`
 * userinfo on the REAL host would still pass a `.hostname`-only check and has no
 * legitimate reason to appear in this feed, so both are rejected outright.
 * @param {unknown} value
 * @returns {string}
 */
export function cleanUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:'
      && parsed.hostname === TRUSTED_JOB_HOST
      && parsed.port === ''
      && parsed.username === ''
      && parsed.password === ''
      ? parsed.href
      : '';
  } catch {
    return '';
  }
}

/**
 * Normalize one raw `results[]` record into a Job plus its jobPostId (kept for
 * dedup, stripped before the source returns it). Returns null when the posting
 * lacks a usable id, title, or trusted url.
 *
 * `company` prefers `hiringCompany` (the real employer) over `postedCompany`
 * (the poster, which is a recruitment agency when `isPostedOnBehalf` is true).
 * @param {any} r
 * @returns {({title: string, url: string, company: string, location: string, postedAt?: number, id: string}) | null}
 */
export function normalizeJob(r) {
  const id = r && r.metadata && r.metadata.jobPostId;
  const title = String((r && r.title) || '').trim();
  const url = cleanUrl(r && r.metadata && r.metadata.jobDetailsUrl);
  if (!id || !title || !url) return null;
  const company = String(
    (r.hiringCompany && r.hiringCompany.name)
    || (r.postedCompany && r.postedCompany.name)
    || '',
  ).trim();
  const districts = Array.isArray(r.address && r.address.districts) ? r.address.districts : [];
  const location = districts.map((d) => d && d.location).filter(Boolean).join(', ');
  const result = { title, url, company, location, id: String(id) };
  const posted = Date.parse((r.metadata && r.metadata.newPostingDate) || '');
  if (Number.isFinite(posted)) result.postedAt = posted;
  return result;
}

/**
 * Fetch + normalize MyCareersFuture postings across the configured keywords.
 * @param {string} endpoint base search endpoint (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object,
 *           maxPages?: number, profileKeywords?: string[] }} [opts]
 * @returns {Promise<Array<{title: string, url: string, company: string, location: string, postedAt?: number}>>}
 */
export async function fetchMyCareersFuture(endpoint = API_URL, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  // Defence-in-depth: reject an off-host endpoint override before any fetch.
  assertApiUrl(endpoint);

  const { size, maxPages: configuredMaxPages, keywords: ownKeywords } = parseConfig(company);
  let keywords = ownKeywords;
  // Fall back to config/profile.yml's target_roles when this entry has no
  // mycareersfuture.keywords[] of its own — same convention jobbankca.mjs uses.
  // `opts.profileKeywords` is an injectable override (tests avoid the FS).
  if (!keywords.length) {
    keywords = Array.isArray(opts.profileKeywords) ? opts.profileKeywords : await resolveProfileKeywords();
  }
  if (!keywords.length) {
    throw new Error(`mycareersfuture: entry "${company.name || '(unnamed)'}" has no mycareersfuture.keywords[] and no config/profile.yml target_roles to fall back to`);
  }

  // Bounded probe vs real scan (mirrors vdab/jobbankca opts.maxPages): a health
  // probe caps pagination so a liveness check can't walk the whole board; a real
  // scan (opts.maxPages unset) uses the configured cap.
  const probing = Number.isInteger(opts.maxPages) && opts.maxPages > 0;
  const pageLimit = probing ? Math.min(opts.maxPages, configuredMaxPages) : configuredMaxPages;

  /** @param {string} keyword */
  const fetchKeyword = async (keyword) => {
    const out = [];
    for (let page = 0; page < pageLimit; page++) {
      const json = await fetchJsonWithRetry(fetchImpl, `${endpoint}?limit=${size}&page=${page}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ search: keyword, sortBy: ['new_posting_date'], page }),
        redirect: 'error',
        signal,
      });
      const results = Array.isArray(json && json.results) ? json.results : [];
      out.push(...results);
      if (results.length < size) break; // short page → done
    }
    return out;
  };

  const byId = new Map();
  const errors = [];
  let succeeded = 0; // keywords whose request completed (i.e. the source answered)
  for (const keyword of keywords) {
    let raw;
    try {
      raw = await fetchKeyword(keyword);
      succeeded++;
    } catch (err) {
      if (probing) throw err;
      // Recall-first: tolerate a single failed keyword and keep going.
      errors.push(`"${keyword}": ${(err && err.message) || err}`);
      continue;
    }
    for (const r of raw) {
      const job = normalizeJob(r);
      if (job && !byId.has(job.id)) byId.set(job.id, job);
    }
  }

  // Total outage = every keyword request failed. A keyword that answered with
  // zero results is not an outage, so key off the success count, not the deduped
  // result size — otherwise a legitimately-empty search throws.
  if (succeeded === 0 && errors.length) {
    throw new Error(`mycareersfuture: all ${keywords.length} keyword request(s) failed — ${errors[0]}`);
  }

  return [...byId.values()].map(({ id, ...job }) => job);
}
