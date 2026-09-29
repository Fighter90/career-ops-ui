/**
 * Greenhouse adapter (v1.13.0 registry contract).
 *
 * Detects Greenhouse boards from a `careers_url` like
 * `job-boards.greenhouse.io/<slug>` or `job-boards.eu.greenhouse.io/<slug>`
 * (or an embed board `…greenhouse.io/embed/job_board?for=<slug>`),
 * also honours an explicit `api:` field pointing at the boards-api endpoint.
 *
 * The actual HTTP fetch + response normalization lives in
 * server/lib/sources/greenhouse.mjs (kept intact for backwards compat).
 * This adapter is a thin wrapper that exposes the uniform registry contract
 * the new consolidated /api/stream/scan endpoint expects.
 */
import { fetchGreenhouse } from '../../sources/greenhouse.mjs';

// Hosts whose FIRST path segment is the board slug (`/<slug>[/jobs/<id>]`).
const PATH_SLUG_HOSTS = new Set([
  'job-boards.greenhouse.io',
  'job-boards.eu.greenhouse.io',
]);

// Hosts on which a `?for=<slug>` query names a Greenhouse board (embed boards).
// Both sets are checked by EXACT hostname on the PARSED URL — never a substring
// test — so `https://example.com/jobs?for=stripe`,
// `https://example.com/job-boards.greenhouse.io/embed/job_board?for=stripe` and
// `https://evil.com/?x=job-boards.greenhouse.io/stripe` select no board.
const EMBED_HOSTS = new Set([
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
  'job-boards.eu.greenhouse.io',
]);

// A board token is a plain identifier; anything else would be spliced into the
// boards-api path, so it is refused rather than encoded.
// First character alphanumeric: `.` / `..` would normalise the API path (`/v1/boards/../jobs` → `/v1/jobs`).
const SLUG_RE = /^\w[\w.-]*$/;

function parseCareersUrl(raw) {
  try { return new URL(raw); } catch { /* maybe scheme-less */ }
  // Tolerate a scheme-less `job-boards.greenhouse.io/<slug>` as the old
  // substring regex did — parsed, so the host check below still applies.
  if (/^[\w.-]+\//.test(raw)) {
    try { return new URL(`https://${raw}`); } catch { /* fall through */ }
  }
  return null;
}

/**
 * Board slug for a Greenhouse careers_url, or null.
 *
 * `job-boards[.eu].greenhouse.io/<slug>` → `<slug>`. Embed boards
 * (`…greenhouse.io/embed/job_board?for=<slug>`) carry the token in `?for=`: the
 * path segment is literally `embed`, which names no board and 404s, so `?for=`
 * is read instead — but only on a genuine Greenhouse host over HTTPS (parent
 * 3e028d9). `embed` itself is never a slug. Exported for tests.
 * @param {string} careersUrl
 */
export function greenhouseSlugFromUrl(careersUrl) {
  const raw = typeof careersUrl === 'string' ? careersUrl.trim() : '';
  if (!raw) return null;
  const u = parseCareersUrl(raw);
  if (!u || (u.protocol !== 'https:' && u.protocol !== 'http:')) return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  let slug = null;
  if (PATH_SLUG_HOSTS.has(host)) {
    slug = u.pathname.split('/').filter(Boolean)[0] || null;
  }
  if ((!slug || slug === 'embed') && u.protocol === 'https:' && EMBED_HOSTS.has(host)) {
    slug = u.searchParams.get('for');
  }
  if (!slug || slug === 'embed' || !SLUG_RE.test(slug)) return null;
  return slug;
}

export const greenhouseAdapter = {
  id: 'greenhouse',
  label: 'Greenhouse',
  matches(company) {
    if (company.api && company.api.includes('greenhouse')) return true;
    return greenhouseSlugFromUrl(company.careers_url) !== null;
  },
  buildEndpoint(company) {
    if (company.api && company.api.includes('greenhouse')) return company.api;
    const slug = greenhouseSlugFromUrl(company.careers_url);
    if (!slug) return null;
    return `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
  },
  fetch: fetchGreenhouse,
};
