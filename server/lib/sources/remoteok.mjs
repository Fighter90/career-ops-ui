/**
 * RemoteOK source — board-wide remote-jobs aggregator feed.
 *   GET https://remoteok.com/api
 *
 * Implements the
 * web-ui source contract (rich job objects + `meta` for auto-discovery).
 *
 * The feed is a JSON array whose first element is a `{ legal, … }` metadata
 * object (skipped). All postings are remote, so `isRemote` is always true and
 * the en-scanner's title_filter / location_filter gate the rows afterwards.
 *
 * Phase-2 URL pinning (v1.242.0 sources-6); FULL-R2 tightened the feed guard:
 * the feed URL must be https on the pinned remoteok.com host (a subdomain
 * mirror of the board itself stays allowed — an arbitrary https host does
 * not). Every job `url` is display-only but flows into scan history and
 * generated documents, so it is pinned to https on the exact remoteok.com
 * host; anything else is dropped.
 *
 * Used by the remoteok adapter (server/lib/portals/adapters/remoteok.mjs).
 */
import { fetchJson, labeledHttpError } from '../http-json.mjs';

const UA = 'career-ops-web-ui/1.0';

export const FEED_URL = 'https://remoteok.com/api';

// Anchored: `remoteok.com` itself or any subdomain — never a lookalike
// (`remoteok.com.evil.com`) or a substring (`evilremoteok.com`).
export const REMOTEOK_HOST_RE = /(?:^|\.)remoteok\.com$/i;

// v1.69.0 (P-14) — self-describing adapter metadata; see ashby.mjs.
export const meta = {
  value: 'remoteok',
  label: 'RemoteOK',
  region: 'en',
};

/**
 * Guard on the feed URL (the one server-fetched request): HTTPS on the pinned
 * board host — `remoteok.com` itself or a subdomain (FULL-R2: the old guard
 * accepted ANY https host, so an `api:` override pointing at an internal or
 * lookalike host was fetched with no resolve-time private-address check — a
 * live SSRF). The job-url pin below carries the exact-host rule for links.
 * @param {string} url
 */
export function assertRemoteOkUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`remoteok: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`remoteok: URL must use HTTPS: ${url}`);
  if (!REMOTEOK_HOST_RE.test(parsed.hostname)) {
    throw new Error(`remoteok: untrusted hostname "${parsed.hostname}" — must be on remoteok.com`);
  }
  return url;
}

/** https: + the exact pinned board host — the only accepted job URL shape. */
function isTrustedJobUrl(value) {
  if (typeof value !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }
  return parsed.protocol === 'https:' && REMOTEOK_HOST_RE.test(parsed.hostname);
}

/** tiny stable hash (djb2) → base36, for postings with no native id. */
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/**
 * Fetch + normalize the RemoteOK public feed.
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal }} [opts]
 */
export async function fetchRemoteOk(feedUrl = FEED_URL, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  assertRemoteOkUrl(feedUrl);
  // The guarded transport: redirect:'error' closes the SSRF-via-redirect
  // vector, and on the real network path the host is resolved and refused if
  // it points at a private/loopback address.
  const data = await fetchJson(fetchImpl, feedUrl, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  }).catch((e) => { throw labeledHttpError(e, 'RemoteOK'); });
  if (!Array.isArray(data)) {
    throw new Error(`RemoteOK: unexpected API response — expected a JSON array, got ${data === null ? 'null' : typeof data}`);
  }
  return data
    .filter((j) => j && typeof j === 'object'
      && typeof j.position === 'string' && j.position.trim() !== ''
      && isTrustedJobUrl(j.url))
    .map((j) => normalize(j));
}

function normalize(j) {
  const url = j.url.trim();
  const native = j.id != null ? String(j.id) : (j.slug || djb2(url));
  return {
    id: `remoteok-${native}`,
    title: j.position.trim(),
    company: typeof j.company === 'string' ? j.company.trim() : '',
    url,
    salary: '',
    location: typeof j.location === 'string' ? j.location.trim() : '',
    isRemote: true,
    workplaceType: 'Remote',
    relocates: false,
    date: typeof j.date === 'string' ? j.date : '',
    snippet: '',
    source: 'remoteok',
  };
}
