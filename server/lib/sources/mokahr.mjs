// @ts-check
/**
 * MokaHR (Moka, 国内 HR SaaS/ATS) source.
 *
 *   POST https://app.mokahr.com/api/outer/ats-apply/website/jobs/v2
 *        { siteId, orgId, locale, limit, offset[, keyword] }
 *
 * There is no official third-party developer API; this is the tenant careers
 * site's own private endpoint, which is what the page itself calls.
 *
 * THE RESPONSE IS ENCRYPTED. The envelope is `{ data, necromancer }` where
 * `data` is base64 AES-128-CBC ciphertext and `necromancer` is the 16-byte key
 * the server ships alongside it. That is obfuscation rather than security — the
 * key travels with the payload — but it means a plain JSON parse sees nothing,
 * so the decryption is part of reading the board at all. A wrong-length key or
 * a missing field throws rather than yielding an empty list.
 *
 * Two tenants are deliberately NOT scannable: their robots.txt excludes the
 * careers path, and `ROBOTS_EXCLUDED_PATHS` refuses them at config time rather
 * than fetching and discarding.
 *
 * Ported from parent career-ops v1.31.0 (`providers/mokahr.mjs`).
 */
import { createDecipheriv } from 'node:crypto';
import { fetchJson, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';
import { htmlToText } from '../html-to-text.mjs';
import { safeEncodeURIComponent } from './_safe-url.mjs';

export const meta = {
  value: 'mokahr',
  label: 'MokaHR',
  region: 'en',
};

const API_PATH = '/api/outer/ats-apply/website/jobs/v2';
// Explicit allowlist, not a `*.mokahr.com` wildcard: hire-r1-ats.mokahr.com is a
// static CDN (403 on the API). hire-r1 is Moka's international deployment: same
// API path and body, plaintext `data`. A tenant is unknown to the other host, so
// the API call must go to the careers_url's own host (parent 993085ce..HEAD).
const ALLOWED_HOSTS = new Set(['app.mokahr.com', 'hire-r1.mokahr.com']);
const AES_IV = Buffer.from('de7c21ed8d6f50fe', 'utf8');
const MAX_LIMIT = 50;              // hard server-side ceiling
const DEFAULT_KEYWORDS = [''];     // empty keyword = whole board, no topical bias
const DEFAULT_MAX_PAGES = 10;      // 10 × MAX_LIMIT = 500 postings per keyword
const HARD_MAX_PAGES = 40;
const INTER_PAGE_DELAY_MS = 400;

const TENANT_PATH_RE = /^\/(?:social-recruitment|campus-recruitment|apply)\/([^/]+)\/(\d+)\/?$/;

// Tenants whose robots.txt excludes the careers path. Refused at config time
// rather than fetched and discarded.
const ROBOTS_EXCLUDED_PATHS = new Set([
  '/social-recruitment/lingjuninvest/46355',
  '/social-recruitment/shopee/74378',
]);

/**
 * Parse a tenant careers URL into `{ orgId, siteId, baseUrl }`, or null when it
 * is not an allowed MokaHR tenant. HTTPS-only and the host pinned to
 * an explicit allowlist (`app.mokahr.com`, `hire-r1.mokahr.com`) — the siteId reaches a request body, so a loose
 * check here would be the SSRF hole.
 * @param {unknown} url
 */
export function parseTenantUrl(url) {
  let u;
  try {
    u = new URL(String(url));
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || !ALLOWED_HOSTS.has(u.hostname)) return null;
  const m = TENANT_PATH_RE.exec(u.pathname);
  if (!m) return null;
  const siteId = Number(m[2]);
  if (!Number.isSafeInteger(siteId) || siteId <= 0) return null;
  const pathname = u.pathname.replace(/\/$/, '');
  if (ROBOTS_EXCLUDED_PATHS.has(pathname)) return null;
  return { orgId: m[1], siteId, baseUrl: `${u.origin}${pathname}`, apiUrl: `${u.origin}${API_PATH}` };
}

/**
 * Decrypt the `{ data, necromancer }` envelope.
 *
 * Throws on a missing field or a wrong-length key: a board that cannot be
 * decrypted is a broken source, and returning `[]` would render it as a tenant
 * with no openings.
 * @param {any} envelope
 */
export function decryptMokaHrEnvelope(envelope) {
  if (!envelope?.data || !envelope?.necromancer) {
    throw new Error('mokahr: response missing data/necromancer — not the expected envelope shape');
  }
  const key = Buffer.from(envelope.necromancer, 'utf8');
  if (key.length !== 16) {
    throw new Error(`mokahr: necromancer key is ${key.length} bytes, expected 16 (aes-128-cbc)`);
  }
  const ciphertext = Buffer.from(envelope.data, 'base64');
  const decipher = createDecipheriv('aes-128-cbc', key, AES_IV);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}

/**
 * Plaintext body: hire-r1 sends `data` as a JSON object already; app.mokahr.com
 * sends a ciphertext string to decrypt.
 * @param {any} envelope
 */
export function unwrapMokaHrResponse(envelope) {
  const data = envelope?.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) return envelope;
  return decryptMokaHrEnvelope(envelope);
}

/**
 * Normalize the decrypted payload into web-ui job objects.
 * @param {any} decrypted
 * @param {string} companyName
 * @param {string} tenantBaseUrl
 */
export function parseMokaHrJobs(decrypted, companyName, tenantBaseUrl) {
  const list = decrypted?.data?.jobs;
  if (!Array.isArray(list)) return [];

  const jobs = [];
  for (const j of list) {
    const title = j?.title;
    const id = j?.id;
    if (!title || id == null) continue;

    const cities = Array.isArray(j.locations)
      ? j.locations
        .map((l) => [l?.provinceName, l?.cityName].filter(Boolean).join(' '))
        .filter(Boolean)
        .join('/')
      : '';
    // Only an offset-bearing timestamp is trusted: a bare local string would be
    // parsed in the server's zone and silently shift the posting date.
    const createdAt = typeof j.createdAt === 'string' ? j.createdAt.trim() : '';
    const ts = /(?:Z|[+-]\d{2}:\d{2})$/i.test(createdAt) ? Date.parse(createdAt) : NaN;
    const description = [
      j.commitment && `类型: ${j.commitment}`,
      j.department?.name && `部门: ${j.department.name}`,
      htmlToText(j.jobDescription),
    ].filter(Boolean).join('\n').slice(0, 4000);

    // A lone surrogate in id throws URIError out of encodeURIComponent and
    // aborts this loop, losing every job on the page. Drop just this one.
    const encodedId = safeEncodeURIComponent(id);
    if (encodedId === null) continue;
    jobs.push({
      id: `mokahr-${id}`,
      title,
      company: companyName,
      url: `${tenantBaseUrl}#/job/${encodedId}`,
      salary: '',
      location: cities,
      isRemote: /remote|远程/i.test(cities),
      workplaceType: '',
      relocates: false,
      date: Number.isFinite(ts) ? new Date(ts).toISOString() : '',
      snippet: description.slice(0, 400),
      description,
      source: 'mokahr',
    });
  }
  return jobs;
}

/** @param {object} [company] */
export function buildMokaHrUrl(company = {}) {
  const tenant = parseTenantUrl(company?.careers_url ?? company?.api);
  if (!tenant) {
    throw new Error(`mokahr: careers_url must be an allowed HTTPS tenant URL on ${[...ALLOWED_HOSTS].join(' or ')} with a positive site ID`);
  }
  return tenant.apiUrl;
}

const sleep = (ms, signal) => new Promise((resolve) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener?.('abort', () => { clearTimeout(t); resolve(undefined); }, { once: true });
});

/**
 * Fetch + normalize one MokaHR tenant.
 * @param {string} _url from buildEndpoint (always the shared API)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchMokaHr(_url, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const tenant = parseTenantUrl(company?.careers_url ?? company?.api);
  if (!tenant) {
    throw new Error(`mokahr: careers_url must be an allowed HTTPS tenant URL on ${[...ALLOWED_HOSTS].join(' or ')} with a positive site ID`);
  }

  const keywords = Array.isArray(company?.keywords) && company.keywords.length
    ? company.keywords
    : DEFAULT_KEYWORDS;
  const rawMax = Number(company?.max_pages);
  const maxPages = rawMax > 0 ? Math.min(rawMax, HARD_MAX_PAGES) : DEFAULT_MAX_PAGES;
  const companyName = company?.name || tenant.orgId;

  /** @type {Map<string, object>} */
  const seen = new Map();
  let firstRequest = true;
  let succeededOnce = false;

  for (const keyword of keywords) {
    for (let page = 1; page <= maxPages; page++) {
      if (firstRequest) firstRequest = false;
      else await sleep(INTER_PAGE_DELAY_MS, signal);

      const offset = (page - 1) * MAX_LIMIT;
      let envelope;
      let decrypted;
      try {
        envelope = await fetchJson(fetchImpl, tenant.apiUrl, {
          method: 'POST',
          signal,
          headers: {
            'content-type': 'application/json',
            'user-agent': BROWSER_LIKE_USER_AGENT,
            referer: `${tenant.baseUrl}/`,
          },
          body: JSON.stringify({
            siteId: tenant.siteId,
            orgId: tenant.orgId,
            locale: 'zh-CN',
            limit: MAX_LIMIT,
            offset,
            ...(keyword ? { keyword } : {}),
          }),
          redirect: 'error',
        });
        // hire-r1 answers HTTP 200 with plaintext in-band errors
        // ({ code: 102, success: false, msg }) that carry no data/necromancer.
        // Read success BEFORE unwrapping, inside this try: unwrapping first
        // lost the API's own error text AND threw outside the walk's catch,
        // discarding every page already collected. (v1.242.0)
        if (envelope && typeof envelope === 'object' && envelope.success === false) {
          throw new Error(`mokahr: API error: ${envelope.msg || envelope.code || 'success=false'}`);
        }
        decrypted = unwrapMokaHrResponse(envelope);
        // The same in-band failure can also arrive inside the decrypted payload.
        if (decrypted?.success === false) {
          throw new Error(`mokahr: API error: ${decrypted.msg || decrypted.code || 'success=false'}`);
        }
      } catch (err) {
        // Nothing collected yet means the tenant or endpoint is wrong — surface
        // it. After a success, a later failure is a partial result worth
        // keeping rather than a tenant reported as empty.
        if (!succeededOnce) throw err;
        console.error(`  ⚠ mokahr: keyword "${keyword}" page ${page} failed (${err.message}) — keeping the ${seen.size} jobs collected so far`);
        return [...seen.values()];
      }

      succeededOnce = true;
      const jobs = parseMokaHrJobs(decrypted, companyName, tenant.baseUrl);
      for (const job of jobs) if (!seen.has(job.url)) seen.set(job.url, job);
      // Stop on the RAW page length: rows without a title/id are dropped by
      // the normalizer, so a full 50-row page that normalizes to 1 job is
      // still a full page. (The normalized count regressed the parent's
      // rawJobs.length < MAX_LIMIT fix and cut every full-but-dirty page.)
      const rawJobs = decrypted?.data?.jobs;
      const rawLen = Array.isArray(rawJobs) ? rawJobs.length : 0;
      if (rawLen === 0 || rawLen < MAX_LIMIT) break;
    }
  }

  return [...seen.values()];
}
