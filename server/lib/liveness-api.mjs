// @ts-check
/**
 * liveness-api.mjs — zero-token, zero-browser liveness check for ATS-hosted
 * job postings.
 *
 * Many postings live on ATS platforms (Greenhouse, Lever, Ashby, Workday,
 * SmartRecruiters) that expose a public JSON endpoint. We confirm whether a
 * posting is still live by hitting that endpoint directly — no browser, no LLM
 * tokens. This is the cheap first (and, in web-ui, ONLY) rung of the liveness
 * ladder: the parent falls back to a Playwright check for non-ATS pages, but
 * Playwright is forbidden here (CLAUDE.md), so an inconclusive check simply
 * returns null → the route reports `uncertain`.
 *
 * CONSERVATIVE BY DESIGN: a false "expired" is worse than the status quo (the
 * user misses a real job). So on a definitive 404/410 we return `expired`, and
 * for anything ambiguous (unknown ATS, redirect, 429/5xx, network/timeout) we
 * return `null` (→ caller reports uncertain).
 *
 * Endpoint shapes:
 *   - Per-job (Greenhouse, Lever, Workday): the URL maps to a single-job
 *     endpoint, so a 200 is itself proof the posting is live. A company page
 *     carrying only `gh_jid` resolves its board through Greenhouse's embed
 *     redirect first, then asks the same per-job endpoint.
 *   - Per-job with a body verdict (SmartRecruiters, Arbeitsagentur): a 200 can
 *     describe a closed posting, so `interpret` reads the body.
 *   - Org-level / feed (Ashby, We Work Remotely): the URL maps to the whole
 *     board or feed. A 200 only proves it exists, so `interpret` confirms THIS
 *     posting is still listed (WWR's feed is bounded: absence stays unknown).
 *
 * SSRF-safe by construction, TWO ways:
 *   1. The request URL is built from a FIXED, hard-coded API host plus path
 *      segments extracted from the posting URL with a strict charset (no
 *      slashes / traversal).
 *   2. The outbound GET goes through this repo's DNS-pinned, redirect-
 *      revalidating `safeGet` (server/lib/safe-fetch.mjs) — NEVER a raw global
 *      `fetch` on a user-influenced URL. `safeGet` follows redirects only to
 *      public hosts (per-hop `isValidJobUrl`), and we additionally treat a
 *      cross-origin landing as inconclusive to preserve the parent's
 *      `redirect: 'error'` intent.
 */

import { safeGet } from './safe-fetch.mjs';
import { parseWwrFeed } from './sources/weworkremotely.mjs';

const TIMEOUT_MS = 8_000;
// A polite, honest UA. `safeGet` supplies its own default; we set one explicitly
// so the ATS logs attribute the request to the liveness checker.
const LIVENESS_UA = 'career-ops-ui-liveness/1.0';
// Ashby org boards can be sizeable JSON; cap generously but bound. A body that
// overruns the cap is truncated → JSON.parse fails → inconclusive (safe).
const MAX_JSON_BYTES = 2 * 1024 * 1024;

// Strict path-segment charset. Anything with a slash, dot-dot, or other char is
// rejected before it can reach the fixed-host API URL template.
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

// Most providers extract single path segments (SAFE_SEGMENT covers those directly).
// Workday's job path is genuinely multi-segment (a location slug + a title slug,
// e.g. "Toronto-ON-CAN/Agentic-AI-Engineer_R260010125"), so a `parts` value may
// itself contain slashes. This still validates every individual segment against
// the same strict charset (and rejects ".." in any of them) — it only relaxes
// "no slash at all" to "no *unsafe* content between slashes", so the traversal/
// injection guarantee is unchanged.
function isSafeValue(v) {
  if (typeof v !== 'string' || v.length === 0) return false;
  // SAFE_SEGMENT's charset includes "." (some real segments use dots), so ".."
  // alone passes that regex — same as the single-segment guard in
  // resolveAtsApi below, the explicit `!includes('..')` check per segment is
  // load-bearing, not redundant with the regex test.
  return v.split('/').every((seg) => seg.length > 0 && SAFE_SEGMENT.test(seg) && !seg.includes('..'));
}

// Each ATS: detect its posting URL, then map to a public JSON API URL.
// `match` returns the extracted path params (or null); `api` builds the FIXED-host URL.
// Optional per-provider fields:
//   `timeoutMs`  — override the default fetch timeout (slow/rate-limited APIs).
//   `interpret`  — read the 200 response body (parsed JSON) to decide liveness
//                  (org-level APIs where a 200 alone doesn't prove THIS posting
//                  is live).
//   `api404Authoritative` — defaults to true (a 404/410 means gone). Set to
//                  false when the provider's public API can 404 a posting that
//                  is still genuinely live elsewhere (see the `lever` entry).
//   `accept` / `headers` — override the Accept header / add fixed headers.
//   `rawBody`    — `interpret` receives the response TEXT instead of parsed
//                  JSON (RSS feeds).
//   `followEmbed` — two-step lookup: map the FIRST response (after safeGet's
//                  redirect-revalidated chain) to a per-job API URL, or null.
//
// Parent parity, career-ops @ 4bc53fce (#4444): greenhouse-embedded,
// SmartRecruiters active flag, Arbeitsagentur and We Work Remotely rungs.
const ATS_PROVIDERS = [
  {
    id: 'greenhouse-embedded',
    // Company careers pages can expose only gh_jid, with no Greenhouse board.
    // The embed redirect supplies the board; a second per-job API request is
    // still required because even closed jobs can have an embed redirect.
    match(u) {
      if (/(^|\.)greenhouse\.io$/.test(u.hostname)) return null;
      const id = u.searchParams.get('gh_jid');
      return id && /^\d+$/.test(id) ? { id } : null;
    },
    api: ({ id }) => `https://boards.greenhouse.io/embed/job_app?token=${id}`,
    // web-ui adaptation: the parent fetches with `redirect: 'manual'` and reads
    // the Location header. safeGet instead follows the chain itself (each hop
    // isValidJobUrl-revalidated), so the redirect target is `res.finalUrl`. No
    // redirect at all → finalUrl is the embed URL, which carries no `for` → null.
    followEmbed(res, { id }) {
      let target;
      try { target = new URL(res.finalUrl); } catch { return null; }
      if (target.protocol !== 'https:' || !/(^|\.)greenhouse\.io$/.test(target.hostname)) return null;
      const board = target.searchParams.get('for');
      // The board is one URL path segment. isSafeValue also accepts Workday's
      // multi-segment paths, so reject a decoded slash here explicitly.
      if (!isSafeValue(board) || board.includes('/') || target.searchParams.get('token') !== id) return null;
      return `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}`;
    },
  },
  {
    id: 'greenhouse',
    // boards.greenhouse.io/{board}/jobs/{id} · job-boards[.eu].greenhouse.io/{board}/jobs/{id}
    match(u) {
      if (!/(^|\.)greenhouse\.io$/.test(u.hostname)) return null;
      const m = u.pathname.match(/^\/([^/]+)\/jobs\/(\d+)\/?$/);
      return m ? { board: m[1], id: m[2] } : null;
    },
    api: ({ board, id }) => `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}`,
  },
  {
    id: 'lever',
    // jobs.(eu.)?lever.co/{slug}/{id}
    match(u) {
      const host = u.hostname.match(/^jobs\.((?:eu\.)?lever\.co)$/);
      if (!host) return null;
      const m = u.pathname.match(/^\/([^/]+)\/([^/?#]+)\/?$/);
      return m ? { apiHost: `api.${host[1]}`, slug: m[1], id: m[2] } : null;
    },
    api: ({ apiHost, slug, id }) => `https://${apiHost}/v0/postings/${slug}/${id}`,
    // Lever's Confidential/Internal Postings feature explicitly excludes some
    // live postings from the public v0/postings API while the direct
    // jobs.lever.co page keeps serving them normally. A 404 here is NOT proof of
    // removal — report inconclusive (uncertain) instead of expired.
    api404Authoritative: false,
  },
  {
    id: 'ashby',
    // jobs.ashbyhq.com/{org}/{jobId}[/application]. Ashby's public posting API is
    // ORG-level (the whole job board), not per-job — so `api` maps to the board and
    // `interpret` confirms this {jobId} is still listed. Only {org} reaches the
    // fixed-host URL; {jobId} is used solely to filter the parsed board (SAFE_SEGMENT
    // still validates both).
    match(u) {
      if (u.hostname !== 'jobs.ashbyhq.com') return null;
      const m = u.pathname.match(/^\/([^/]+)\/([^/]+)(?:\/application)?\/?$/);
      return m ? { org: m[1], jobId: m[2] } : null;
    },
    api: ({ org }) => `https://api.ashbyhq.com/posting-api/job-board/${org}`,
    // Ashby's posting-api has a server-side latency floor and rate-limits repeated
    // unauthenticated hits. Give it more room than the ATS default so a
    // slow-but-live board doesn't time out into an uncertain result.
    timeoutMs: 20_000,
    // web-ui adaptation: interpret receives the PARSED JSON body (safeGet returns
    // text, not a Response with .json()). classifyAshbyBoard already null-guards
    // an unexpected shape.
    interpret(json, { jobId }) {
      return classifyAshbyBoard(json, jobId);
    },
  },
  {
    id: 'workday',
    // {tenant}.{shard}.myworkdayjobs.com[/{xx-XX}]/{site}/job/{jobPath...}
    // Workday's per-job CXS endpoint (`/wday/cxs/{tenant}/{site}/job/{jobPath}`)
    // is a genuinely PER-JOB API like Greenhouse/Lever — a 200 is itself proof
    // the posting is live; a garbage job id returns 404.
    //
    // jobPath is intentionally multi-segment (Workday encodes a location slug and
    // a title slug as separate path parts, e.g.
    // "Toronto-ON-CAN/Agentic-AI-Engineer_R260010125") — isSafeValue (not the
    // single-segment SAFE_SEGMENT check other providers use directly) validates
    // it component-by-component.
    match(u) {
      const m = `${u.hostname}${u.pathname}`.match(
        /^([\w-]+)\.(wd[\w-]*)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/?#]+)\/job\/(.+?)\/?$/
      );
      if (!m) return null;
      const [, tenant, shard, site, jobPath] = m;
      return { tenant, shard, site, jobPath };
    },
    api: ({ tenant, shard, site, jobPath }) =>
      `https://${tenant}.${shard}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/job/${jobPath}`,
  },
  {
    id: 'smartrecruiters',
    // jobs.smartrecruiters.com/{company}/{id}[-{title-slug}]. The public posting
    // id is the leading alphanumeric run of the second path segment (the
    // trailing title slug is cosmetic — SmartRecruiters resolves the page by id
    // alone). The API answers 200 for a CLOSED posting too, so liveness is read
    // from its `active` flag, never from status 200 alone (parent 4bc53fce).
    match(u) {
      if (u.hostname !== 'jobs.smartrecruiters.com') return null;
      const m = u.pathname.match(/^\/([^/]+)\/([A-Za-z0-9]+)(?:-[^/]*)?\/?$/);
      return m ? { company: m[1], id: m[2] } : null;
    },
    api: ({ company, id }) => `https://api.smartrecruiters.com/v1/companies/${company}/postings/${id}`,
    api404Authoritative: false, // the API also uses 400 for unknown IDs
    interpret(posting, { id }) {
      if (String(posting?.id) !== id || typeof posting.active !== 'boolean') return null;
      return posting.active
        ? { result: 'active', code: 'smartrecruiters_api_active', reason: 'SmartRecruiters marks the posting active' }
        : { result: 'expired', code: 'smartrecruiters_api_inactive', reason: 'SmartRecruiters marks the posting inactive' };
    },
  },
  {
    id: 'arbeitsagentur',
    match(u) {
      if (u.hostname !== 'www.arbeitsagentur.de') return null;
      const m = u.pathname.match(/^\/jobsuche\/jobdetail\/([^/]+)\/?$/);
      return m ? { refnr: m[1] } : null;
    },
    api: ({ refnr }) => `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobdetails/${Buffer.from(refnr).toString('base64url')}`,
    headers: { 'X-API-Key': 'jobboerse-jobsuche' },
    api404Authoritative: false, // no expired real-job control; absence stays unknown
    interpret(posting, { refnr }) {
      return posting?.referenznummer === refnr && posting?.stellenangebotsTitel
        ? { result: 'active', code: 'arbeitsagentur_api_active', reason: 'Arbeitsagentur returns the matching job detail' }
        : null;
    },
  },
  {
    id: 'weworkremotely',
    match(u) {
      if (u.hostname !== 'weworkremotely.com' || !/^\/remote-jobs\/[^/]+\/?$/.test(u.pathname)) return null;
      return { slug: u.pathname.split('/')[2] };
    },
    api: () => 'https://weworkremotely.com/remote-jobs.rss',
    accept: 'application/rss+xml',
    rawBody: true,
    api404Authoritative: false,
    interpret(feed, { slug }) {
      if (typeof feed !== 'string' || !/<rss\b/i.test(feed)) return null;
      const listed = parseWwrFeed(feed).some((job) => {
        try { return new URL(job.url).pathname.replace(/\/$/, '') === `/remote-jobs/${slug}`; } catch { return false; }
      });
      return listed
        ? { result: 'active', code: 'weworkremotely_feed_listed', reason: 'Posting is listed in the current RSS feed' }
        : null; // feed is bounded; absence cannot prove expiry
    },
  },
];

/**
 * Decide liveness for one Ashby posting from its org's job-board API payload.
 * Pure + deterministic (no I/O), mirroring classifyLiveness in liveness-core.mjs.
 *
 * The public board lists only currently-published postings, so a posting that is
 * absent (or explicitly `isListed: false`) has been removed/unlisted → expired.
 * A present, listed posting → active. An unexpected shape → null (inconclusive),
 * so a future API change degrades to an uncertain result rather than a false
 * "expired".
 *
 * @param {any} json - parsed job-board response, expected shape `{ jobs: [...] }`
 * @param {string} jobId - the {jobId} from jobs.ashbyhq.com/{org}/{jobId}
 * @returns {{ result: 'active' | 'expired', code: string, reason: string } | null}
 */
export function classifyAshbyBoard(json, jobId) {
  if (!json || !Array.isArray(json.jobs)) return null; // unexpected shape → fall back
  const target = String(jobId).toLowerCase();
  const job = json.jobs.find((j) => typeof j?.id === 'string' && j.id.toLowerCase() === target);
  if (job && job.isListed !== false) {
    return { result: 'active', code: 'ashby_api_ok', reason: 'Ashby posting is listed on the board (live)' };
  }
  return { result: 'expired', code: 'ashby_api_unlisted', reason: 'Ashby posting not listed on the board — removed/unlisted' };
}

/**
 * Map a posting URL to its ATS API URL, or null if it isn't a known ATS posting
 * (or any extracted segment fails the strict charset). Pure + deterministic.
 * @param {string} rawUrl
 * @returns {{ ats: string, apiUrl: string, parts: Record<string, string>, timeoutMs?: number, interpret?: (json: any, parts: Record<string, string>) => ({ result: 'active' | 'expired', code: string, reason: string } | null), api404Authoritative: boolean } | null}
 */
export function resolveAtsApi(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  for (const provider of ATS_PROVIDERS) {
    const parts = provider.match(u);
    if (!parts) continue;
    // SSRF guard: every derived value must be safe — a single path segment for
    // most providers, or (Workday) a slash-separated sequence of safe segments.
    // isSafeValue enforces the same charset + no-".." rule either way.
    if (!Object.values(parts).every(isSafeValue)) return null;
    return {
      ats: provider.id,
      apiUrl: provider.api(parts),
      parts,
      timeoutMs: provider.timeoutMs,
      accept: provider.accept,
      headers: provider.headers,
      rawBody: provider.rawBody === true,
      followEmbed: provider.followEmbed,
      interpret: provider.interpret,
      api404Authoritative: provider.api404Authoritative !== false,
    };
  }
  return null;
}

/** True if `url` is an ATS posting we can check via API (lets callers stay lazy about the browser). */
export function isAtsPosting(url) {
  return resolveAtsApi(url) !== null;
}

// Test seam: swap the SSRF-safe GET so the route's success/expired/uncertain
// paths are exercisable without live DNS/network (same pattern as
// safe-fetch `_setTransport` / logos `_setFaviconFetcher`).
let _get = safeGet;
export function _setSafeGet(fn) { _get = fn || safeGet; }

/**
 * Zero-token liveness check via the posting's ATS API.
 * @param {string} url
 * @param {{ safeGet?: typeof safeGet }} [deps]
 * @returns {Promise<{ result: 'active' | 'expired' | 'uncertain', code: string, reason: string, provider: string } | null>}
 *   null = not a known ATS posting, or inconclusive → caller reports `uncertain`.
 */
export async function checkLivenessViaApi(url, deps = {}) {
  const get = deps.safeGet || _get;
  const resolved = resolveAtsApi(url);
  if (!resolved) return null;
  const { ats, parts, interpret, timeoutMs, accept, headers, rawBody, followEmbed, api404Authoritative } = resolved;
  let { apiUrl } = resolved;
  const withProvider = (r) => (r ? { ...r, provider: ats } : r);
  const fetchOpts = (acceptHeader, extra) => ({
    timeoutMs: timeoutMs || TIMEOUT_MS,
    maxBytes: MAX_JSON_BYTES,
    userAgent: LIVENESS_UA,
    headers: { Accept: acceptHeader || 'application/json', ...(extra || {}) },
  });

  let res;
  try {
    res = await get(apiUrl, fetchOpts(accept, headers));
    if (res && followEmbed) {
      // Two-step (greenhouse-embedded): the first response only names the
      // board; the per-job API on the fixed host decides.
      const jobApiUrl = followEmbed(res, parts);
      if (!jobApiUrl) return null;
      apiUrl = jobApiUrl;
      res = await get(apiUrl, fetchOpts('application/json'));
    }
  } catch {
    return null; // network / timeout / SSRF-block / unsafe redirect → inconclusive
  }
  if (!res) return null;

  // safeGet follows redirects (per-hop isValidJobUrl-validated) and returns the
  // FINAL response. The parent refused server-side redirects outright
  // (`redirect: 'error'`) as an SSRF + ambiguity guard; preserve that intent by
  // treating a landing on a DIFFERENT origin than the fixed API host as
  // inconclusive (a same-host trailing-slash 301 is fine and kept).
  try {
    if (res.finalUrl && new URL(res.finalUrl).origin !== new URL(apiUrl).origin) {
      return null;
    }
  } catch {
    return null;
  }

  if (res.status === 404 || res.status === 410) {
    if (!api404Authoritative) return null; // inconclusive → report uncertain
    return withProvider({ result: 'expired', code: `${ats}_api_gone`, reason: `ATS API ${res.status} — posting removed` });
  }
  if (res.status === 200) {
    // Providers with `interpret` read the body to confirm THIS posting; plain
    // per-job APIs (Greenhouse, Lever, Workday) treat a 200 as proof.
    if (interpret) {
      if (rawBody) return withProvider(interpret(res.text || '', parts));
      let json;
      try {
        json = JSON.parse(res.text || '');
      } catch {
        return null; // unparseable body → inconclusive
      }
      return withProvider(interpret(json, parts));
    }
    return withProvider({ result: 'active', code: `${ats}_api_ok`, reason: 'ATS API returns the posting (live)' });
  }
  return null; // 429 / 5xx / other → inconclusive
}
