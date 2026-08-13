// @ts-check
/**
 * Gem source — per-tenant career board served by the public jobs.gem.com
 * GraphQL *batch* endpoint behind the `jobs.gem.com/<boardId>` SPA boards.
 *
 * Ported from parent career-ops `providers/gem.mjs` into the web-ui source
 * contract (rich job objects + `meta` for auto-discovery). The endpoint is a
 * single fixed host (`jobs.gem.com`) — NOT a per-tenant subdomain — and the
 * per-company board id comes from the entry's `careers_url`
 * (`https://jobs.gem.com/<boardId>`), threaded through the endpoint's
 * `?board=<boardId>` query param by the adapter.
 *
 * Two unauthenticated POSTs (no auth headers, no cookies — verified live in the
 * parent):
 *   - JobBoardList(boardId): the listing — title, locations, department,
 *     employment/location type, but NO date field.
 *   - ExternalJobPostingQuery(boardId, extId): per-job detail carrying
 *     firstPublishedTsSec (the postedAt source, unix SECONDS) plus
 *     descriptionHtml / jobPostSectionHtml / compensationHtml for the JD.
 *     Since the endpoint is literally a batch endpoint, every job's detail
 *     query is folded into ONE extra POST (one op per extId) — not N round
 *     trips. The detail batch is enrichment: if it fails the listing still
 *     stands, just without dates/description.
 *
 * SSRF defence: `assertGemUrl` pins the host to `jobs.gem.com` + HTTPS, and
 * both fetches use `redirect:'error'`. Used by the gem adapter
 * (server/lib/portals/adapters/gem.mjs).
 */
import { fetchJson } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';

const API_HOST = 'jobs.gem.com';
export const GEM_API_URL = `https://${API_HOST}/api/public/graphql/batch`;
const SNIPPET_CAP = 1000; // keep scan payloads sane — Gem JDs carry full-text HTML
const REMOTE_RE = /remote|anywhere|distributed|home\s*office/i;

export const meta = {
  value: 'gem',
  label: 'Gem',
  region: 'en',
};

const JOB_BOARD_LIST_QUERY = `query JobBoardList($boardId: String!) {
  oatsExternalJobPostings(boardId: $boardId) {
    jobPostings {
      id
      extId
      title
      locations {
        id
        name
        city
        isoCountry
        isRemote
        extId
        __typename
      }
      job {
        id
        department {
          id
          name
          extId
          __typename
        }
        locationType
        employmentType
        __typename
      }
      __typename
    }
    __typename
  }
}
`;

const JOB_DETAIL_QUERY = `query ExternalJobPostingQuery($boardId: String!, $extId: String!) {
  oatsExternalJobPosting(boardId: $boardId, extId: $extId) {
    extId
    firstPublishedTsSec
    descriptionHtml
    jobPostSectionHtml {
      introHtml
      outroHtml
    }
    compensationHtml
    __typename
  }
}
`;

/**
 * Defence-in-depth host guard on the endpoint built by the adapter. The Gem API
 * is a single fixed host, so this pins to `jobs.gem.com` + HTTPS.
 * @param {string} url
 */
export function assertGemUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`gem: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`gem: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== API_HOST) {
    throw new Error(`gem: untrusted hostname "${parsed.hostname}" — must be ${API_HOST}`);
  }
  return url;
}

/**
 * Parse the board id out of a `jobs.gem.com/<boardId>` careers URL. Uses
 * `new URL()` + an exact `hostname` compare so a path-, query-, or
 * suffix-spoofed host (`evil.example/jobs.gem.com/retool`,
 * `jobs.gem.com.evil.example/retool`) resolves to null rather than matching a
 * raw substring. Returns the first path segment, or null.
 * @param {unknown} rawUrl
 * @returns {string | null}
 */
export function resolveBoardId(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl) return null;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.hostname !== API_HOST) return null;
  const match = parsed.pathname.match(/^\/([^/?#]+)/);
  return match ? match[1] : null;
}

// firstPublishedTsSec is unix SECONDS (unlike most providers' ms epochs).
// NaN-safe → ISO date `YYYY-MM-DD`, or '' when absent/unparseable.
function toIsoDateFromSeconds(value) {
  if (value == null) return '';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Date(n * 1000).toISOString().slice(0, 10);
}

/** Strip tags → decode entities → collapse whitespace. @param {unknown} html */
function htmlToText(html) {
  if (typeof html !== 'string' || !html) return '';
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/**
 * Concatenate intro + body + outro in page order, then append compensationHtml
 * as a labeled trailing section (a distinct field, not prose flowing from the
 * outro). Absent fields are dropped rather than leaving a gap. Exported for
 * unit tests.
 * @param {any} posting
 */
export function buildJobDescriptionText(posting) {
  const intro = htmlToText(posting?.jobPostSectionHtml?.introHtml);
  const body = htmlToText(posting?.descriptionHtml);
  const outro = htmlToText(posting?.jobPostSectionHtml?.outroHtml);
  const compensation = htmlToText(posting?.compensationHtml);

  const text = [intro, body, outro].filter(Boolean).join('\n\n');
  return compensation ? [text, `Compensation: ${compensation}`].filter(Boolean).join('\n\n') : text;
}

/** "San Francisco" + isRemote → "San Francisco · Remote". @param {any} loc */
function formatLocation(loc) {
  const parts = [];
  if (typeof loc?.name === 'string' && loc.name.trim()) parts.push(loc.name.trim());
  if (loc?.isRemote) parts.push('Remote');
  return parts.join(' · ');
}

/** Normalize Gem's locationType enum into the web-ui workplaceType label. */
function mapWorkplaceType(locationType, isRemote) {
  const t = typeof locationType === 'string' ? locationType.toUpperCase() : '';
  if (t === 'REMOTE') return 'Remote';
  if (t === 'HYBRID') return 'Hybrid';
  if (t === 'ONSITE' || t === 'ON_SITE') return 'Onsite';
  return isRemote ? 'Remote' : 'Onsite';
}

/**
 * Normalize the JobBoardList postings into web-ui job objects. Enrichment
 * (postedAt / description, keyed by extId) is joined in from the detail batch.
 * Postings without both an extId and a title are dropped. Exported for tests.
 *
 * @param {any[]} postings raw jobPostings array
 * @param {{ boardId: string, companyName?: string,
 *           postedByExtId?: Map<string, string>,
 *           descByExtId?: Map<string, string> }} ctx
 */
export function parseGemPostings(postings, ctx) {
  if (!Array.isArray(postings)) return [];
  const boardId = ctx?.boardId || '';
  const companyName = (ctx && typeof ctx.companyName === 'string') ? ctx.companyName : '';
  const postedByExtId = ctx?.postedByExtId instanceof Map ? ctx.postedByExtId : new Map();
  const descByExtId = ctx?.descByExtId instanceof Map ? ctx.descByExtId : new Map();

  return postings
    .filter((p) => p && p.extId && p.title)
    .map((p) => {
      const locations = Array.isArray(p.locations) ? p.locations : [];
      const location = [...new Set(locations.map(formatLocation).filter(Boolean))].join(' · ');
      const locationType = p.job && typeof p.job === 'object' ? p.job.locationType : '';
      const isRemote =
        locations.some((l) => l && l.isRemote) ||
        String(locationType || '').toUpperCase() === 'REMOTE' ||
        REMOTE_RE.test(location) ||
        REMOTE_RE.test(p.title);
      const snippet = (descByExtId.get(p.extId) || '').slice(0, SNIPPET_CAP);

      return {
        id: `gem-${p.extId}`,
        title: p.title,
        company: companyName,
        url: `https://jobs.gem.com/${boardId}/${p.extId}`,
        salary: '',
        location,
        isRemote,
        workplaceType: mapWorkplaceType(locationType, isRemote),
        relocates: false,
        date: toIsoDateFromSeconds(postedByExtId.get(p.extId)),
        snippet,
        source: 'gem',
      };
    });
}

/**
 * Fetch + normalize a Gem board. The board id is carried on the endpoint's
 * `?board=` query param (set by buildEndpoint). Call 1 lists the board; call 2
 * batches one ExternalJobPostingQuery op per valid posting for postedAt +
 * description. The detail batch is best-effort — its failure never fails the
 * listing.
 *
 * @param {string} endpoint host-pinned Gem batch URL with `?board=<id>` (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchGem(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  assertGemUrl(endpoint);
  const boardId = new URL(endpoint).searchParams.get('board');
  const companyName = (company && typeof company.name === 'string') ? company.name : '';
  if (!boardId) throw new Error(`gem: cannot derive board id for ${companyName || 'entry'}`);

  const listBody = JSON.stringify([
    { operationName: 'JobBoardList', variables: { boardId }, query: JOB_BOARD_LIST_QUERY },
  ]);
  // redirect:'error' + assertGemUrl guarantee the final host stays jobs.gem.com.
  const json = await fetchJson(fetchImpl, GEM_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', batch: 'true' },
    body: listBody,
    signal,
    redirect: 'error',
  });

  const listResult = Array.isArray(json) ? json[0] : null;
  if (Array.isArray(listResult?.errors) && listResult.errors.length > 0) {
    throw new Error(`gem: JobBoardList failed: ${listResult.errors[0]?.message || 'unknown GraphQL error'}`);
  }
  const postings = listResult?.data?.oatsExternalJobPostings?.jobPostings;
  if (!Array.isArray(postings)) return [];

  const validPostings = postings.filter((p) => p && p.extId && p.title);

  const postedByExtId = new Map();
  const descByExtId = new Map();
  if (validPostings.length > 0) {
    try {
      const detailBody = JSON.stringify(
        validPostings.map((p) => ({
          operationName: 'ExternalJobPostingQuery',
          variables: { boardId, extId: p.extId },
          query: JOB_DETAIL_QUERY,
        })),
      );
      const detailJson = await fetchJson(fetchImpl, GEM_API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', batch: 'true' },
        body: detailBody,
        signal,
        redirect: 'error',
      });
      if (Array.isArray(detailJson)) {
        for (const entry of detailJson) {
          const posting = entry?.data?.oatsExternalJobPosting;
          if (posting?.extId) {
            postedByExtId.set(posting.extId, posting.firstPublishedTsSec);
            descByExtId.set(posting.extId, buildJobDescriptionText(posting));
          }
        }
      }
    } catch {
      // Listing still stands without dates/description — recency + content
      // filtering just won't apply to this board.
    }
  }

  return parseGemPostings(validPostings, { boardId, companyName, postedByExtId, descByExtId });
}
