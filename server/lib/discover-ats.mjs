// @ts-check
/**
 * discover-ats.mjs — company-name → scannable ATS board resolver (web-ui port).
 *
 * Given a bare company NAME, probe the public JSON boards of the slug-resolvable
 * ATS vendors (Greenhouse, Ashby, Lever) and report which one hosts that
 * company's board AND currently lists ≥1 job. Zero LLM, zero browser. It reuses
 * the SAME board-recognition + job-count code the scanner already trusts: the
 * portals adapter registry (`resolveAdapter`) maps a careers_url to a
 * fixed-host API endpoint, and each adapter's `fetch()` normalizes the board's
 * jobs — we just count them.
 *
 * Ported from the parent CLI (career-ops/discover-ats.mjs) — the CORE resolve
 * logic only (slug generation, per-vendor probe-URL shape, and the "board exists
 * AND lists ≥1 job" decision). The CLI shell (arg parsing, YAML batch I/O,
 * concurrency tuning, portals.yml write) is intentionally left out; the write
 * lives in the route via a small text splice, and the parent's `providers/*`
 * layer is replaced by the web-ui's own adapters.
 *
 * ── SSRF envelope (the whole reason this is a separate, careful module) ──
 *   1. FIXED vendor hosts. Every probe URL is `https://<constant host>/<slug>`;
 *      the host is a hard-coded constant per vendor and is re-asserted with
 *      `new URL(...).hostname === host` AFTER building — a slug can never change
 *      the host.
 *   2. Strict slug charset. A candidate slug is derived from the company name
 *      and must match `SLUG_RE` (`^[a-z0-9-]+$`) with no `..` — no dots, no
 *      slashes, no traversal, no `@`.
 *   3. DNS-pinned GET only. The actual fetch rides `safeGet`
 *      (server/lib/safe-fetch.mjs) — never a raw global `fetch` on a
 *      name-derived URL. A redirect that lands off the fixed vendor API origin
 *      is treated as "not resolved". Non-GET requests are refused outright
 *      (Workday's CXS feed is POST-only, so it can't ride this GET seam — see
 *      the note on VENDORS below).
 *   4. Bounded fan-out. ≤2 slug candidates × 3 vendors of live HTTP, with a hard
 *      `MAX_PROBES` ceiling on the total number of safeGet calls per discover.
 */

import { resolveAdapter } from './portals/registry.mjs';
import { safeGet } from './safe-fetch.mjs';

// ── Probe budget / limits ──────────────────────────────────────────────
const PROBE_TIMEOUT_MS = 8_000;                 // per outbound GET
const MAX_JSON_BYTES = 2 * 1024 * 1024;         // board JSON can be sizeable; cap hard
const PROBE_UA = 'career-ops-ui-discover/1.0';
// Overall live-HTTP ceiling for one discover call. 3 vendors × up to 2 slug
// candidates = 6 primary probes; Greenhouse may add one /offices lookup per
// board, so 12 gives headroom while still forbidding a request storm. Every
// safeGet call (primary + secondary) counts against this.
const MAX_PROBES = 12;

// Strict slug charset — the SSRF choke point for the path segment. `deriveSlugs`
// only ever produces `[a-z0-9-]`, but the guard is enforced again before every
// interpolation so a future caller can't smuggle in a dot/slash/@.
export const SLUG_RE = /^[a-z0-9-]+$/;

/**
 * Slug-resolvable vendors. `host` is the FIXED careers host; `buildCareersUrl`
 * produces a careers_url in the exact shape the vendor's adapter `matches()`
 * recognizes, so the probe reuses the real scan path — a board we confirm here
 * is exactly one the scanner can later read.
 *
 * Workday is deliberately absent: (a) its unauthenticated jobs feed is a POST
 * to the CXS endpoint, which the GET-only `safeGet` seam cannot reach, and
 * (b) a company NAME alone can't derive a Workday site (the site name is
 * unguessable, e.g. "NVIDIAExternalCareerSite"). The parent CLI resolves
 * Workday only from an explicit coordinate hint, which this name-only UI does
 * not collect.
 */
const VENDORS = [
  { id: 'greenhouse', label: 'Greenhouse', host: 'job-boards.greenhouse.io', buildCareersUrl: (s) => `https://job-boards.greenhouse.io/${s}` },
  { id: 'ashby',      label: 'Ashby',      host: 'jobs.ashbyhq.com',         buildCareersUrl: (s) => `https://jobs.ashbyhq.com/${s}` },
  { id: 'lever',      label: 'Lever',      host: 'jobs.lever.co',            buildCareersUrl: (s) => `https://jobs.lever.co/${s}` },
];

// Careers hosts a tracked-company WRITE is allowed to reference — exactly the
// hosts this module's discover can emit. Binds the explicit-add write to real
// discover output; anything else is rejected upstream.
export const KNOWN_CAREERS_HOSTS = new Set(VENDORS.map((v) => v.host));

// ── Pure helpers (exported for tests) ──────────────────────────────────

/**
 * Derive up to two URL-safe slug candidates from a company name:
 *   - hyphenated: lowercase, non-alnum → '-', collapsed, trimmed  ("Trade Republic" → "trade-republic")
 *   - concatenated: lowercase, all non-alnum stripped            ("Trade Republic" → "traderepublic")
 * Deduped, each validated against SLUG_RE (no dots/slashes/traversal). Bounded
 * to ≤2 entries by construction — this is the M in the N×M fan-out cap.
 * @param {string} name
 * @returns {string[]}
 */
export function deriveSlugs(name) {
  const base = String(name || '').toLowerCase().trim();
  const hyphen = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const concat = base.replace(/[^a-z0-9]+/g, '');
  const out = [];
  for (const s of [hyphen, concat]) {
    if (s && !s.includes('..') && SLUG_RE.test(s) && !out.includes(s)) out.push(s);
  }
  return out;
}

/**
 * Build a vendor's careers_url from a validated slug, re-asserting the host is
 * EXACTLY the fixed vendor host (defense-in-depth — SLUG_RE already forbids the
 * characters that could change a host, this makes the guarantee explicit and
 * survives any future edit to buildCareersUrl). Returns null on any rejection.
 * @param {{host:string, buildCareersUrl:(s:string)=>string}} vendor
 * @param {string} slug
 * @returns {string|null}
 */
export function buildProbeUrl(vendor, slug) {
  if (!SLUG_RE.test(slug) || slug.includes('..')) return null;
  const careersUrl = vendor.buildCareersUrl(slug);
  let host;
  try { host = new URL(careersUrl).hostname; } catch { return null; }
  if (host !== vendor.host) return null;
  return careersUrl;
}

/** Normalize a careers_url for dedupe comparison: lowercase, strip trailing slash. */
function normalizeUrl(u) {
  return String(u || '').trim().toLowerCase().replace(/\/+$/, '');
}

/**
 * True when a tracked-companies list already contains this name (case-insensitive)
 * or careers_url (normalized). Used by the write path for idempotency.
 * @param {any[]} existing  parsed portals.yml `tracked_companies` (or [])
 * @param {string} name
 * @param {string} careersUrl
 */
export function isDuplicateCompany(existing, name, careersUrl) {
  const nameKey = String(name || '').trim().toLowerCase();
  const urlKey = normalizeUrl(careersUrl);
  for (const e of Array.isArray(existing) ? existing : []) {
    if (!e || typeof e !== 'object') continue;
    if (typeof e.name === 'string' && e.name.trim().toLowerCase() === nameKey && nameKey) return true;
    if (e.careers_url && normalizeUrl(e.careers_url) === urlKey && urlKey) return true;
    if (e.api && normalizeUrl(e.api) === urlKey && urlKey) return true;
  }
  return false;
}

/**
 * Quote a YAML scalar only when it needs it (ported from the parent). Bare
 * values stay bare to match the hand-written portals.yml style.
 * @param {string} value
 */
export function yamlScalar(value) {
  const s = String(value ?? '');
  const needsQuote = s === '' || /^\s|\s$/.test(s) || /[:#"'{}[\],&*!|>%@`]/.test(s);
  if (!needsQuote) return s;
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Render one board as a portals.yml `tracked_companies` entry snippet (ported
 * from the parent, trimmed to the web-ui adapter contract). Leads with a newline
 * so it slots cleanly against surrounding entries. careers_url alone is enough
 * for the web-ui scanner to detect the vendor, so no `api:` line is emitted;
 * `provider:` is written when known for readability.
 * @param {{name:string, careers_url:string, provider?:string}} match
 */
export function renderPortalEntry(match) {
  const lines = [`  - name: ${yamlScalar(match.name)}`];
  lines.push(`    careers_url: ${match.careers_url}`);
  if (match.provider) lines.push(`    provider: ${match.provider}`);
  lines.push('    enabled: true');
  return '\n' + lines.join('\n') + '\n';
}

/**
 * Splice rendered entry snippets into the `tracked_companies:` block of a
 * portals.yml TEXT, preserving every other byte (comments, other blocks,
 * ordering). Never re-serializes the document. Ported verbatim in intent from
 * the parent CLI. Returns the new text.
 * @param {string} fileText
 * @param {string[]} snippets  output of renderPortalEntry(), one per entry
 */
export function insertIntoTrackedCompanies(fileText, snippets) {
  if (!snippets.length) return fileText;
  const block = snippets.join('');

  const header = fileText.match(/^tracked_companies:[ \t]*$/m);
  if (!header) {
    const sep = fileText.endsWith('\n') ? '\n' : '\n\n';
    return `${fileText}${sep}tracked_companies:${block}`;
  }

  const headerEnd = header.index + header[0].length; // index of the newline after the header
  const rest = fileText.slice(headerEnd);
  // Block end = the next top-level key (a line starting with a non-space,
  // non-# char and containing a colon). Comments + indented lines stay in-block.
  const boundary = rest.match(/\n[^\s#][^\n]*:/);
  const insertAt = boundary ? headerEnd + boundary.index : fileText.length;

  let before = fileText.slice(0, insertAt);
  const after = fileText.slice(insertAt);
  // Trim trailing block-owned blank lines so our leading-newline snippets don't
  // stack extra blanks before the next key.
  before = before.replace(/\n[ \t]*(?=\n*$)/g, (m2, off) => (off >= headerEnd ? '\n' : m2));

  return before + block + after;
}

// ── Network layer ──────────────────────────────────────────────────────

// Test seam: swap the SSRF-safe GET so the resolver's match/empty/none paths are
// exercisable without live DNS/network (same pattern as liveness `_setSafeGet`
// / logos `_setFaviconFetcher`).
let _get = safeGet;
export function _setSafeGet(fn) { _get = fn || safeGet; }

/**
 * Wrap the DNS-pinned `safeGet` into the fetch-like `fetchImpl` the adapters
 * expect (`(url, init) => { ok, status, json(), text() }`), enforcing:
 *   - GET only (a non-GET arriving here is refused, never silently GET-ed),
 *   - the shared probe budget (`MAX_PROBES`),
 *   - a same-origin landing (a redirect off the fixed API origin → thrown,
 *     which the caller treats as "not resolved").
 * @param {typeof safeGet} get
 * @param {{count:number}} budget
 * @param {AbortSignal} [signal]
 */
function makeSafeFetchImpl(get, budget, signal) {
  return async (url, init = {}) => {
    if (init.method && String(init.method).toUpperCase() !== 'GET') {
      throw new Error('discover-ats: non-GET probe refused');
    }
    if (budget.count >= MAX_PROBES) throw new Error('discover-ats: probe budget exhausted');
    budget.count += 1;
    const target = new URL(url); // throws on garbage → caught by the vendor probe
    const res = await get(url, {
      timeoutMs: PROBE_TIMEOUT_MS,
      maxBytes: MAX_JSON_BYTES,
      userAgent: PROBE_UA,
      signal: init.signal || signal,
      headers: { Accept: 'application/json', ...(init.headers || {}) },
    });
    // Preserve the parent providers' redirect-refusal intent: safeGet follows
    // redirects (each hop isValidJobUrl-validated), but a landing on a DIFFERENT
    // origin than the fixed API host is inconclusive → not resolved.
    if (res && res.finalUrl && new URL(res.finalUrl).origin !== target.origin) {
      throw new Error('discover-ats: cross-origin redirect');
    }
    const status = res ? res.status : 0;
    const text = res ? (res.text || '') : '';
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => JSON.parse(text),
      text: async () => text,
    };
  };
}

/**
 * Probe one vendor with one slug. Builds the fixed-host careers_url, confirms
 * the SAME adapter claims it (a slug can't reroute to a different adapter
 * because the host is fixed), then fetches + counts jobs via the adapter.
 * @returns {Promise<{status:'match'|'empty'|'error'|'skipped', jobCount:number, careers_url?:string}>}
 */
async function probeVendorSlug(vendor, slug, fetchImpl, signal) {
  const careers_url = buildProbeUrl(vendor, slug);
  if (!careers_url) return { status: 'skipped', jobCount: 0 };
  const resolved = resolveAdapter({ name: '', careers_url });
  if (!resolved || resolved.adapter.id !== vendor.id) return { status: 'skipped', jobCount: 0 };
  try {
    const jobs = await resolved.adapter.fetch(resolved.endpoint, { fetchImpl, signal });
    const jobCount = Array.isArray(jobs) ? jobs.length : 0;
    return { status: jobCount > 0 ? 'match' : 'empty', jobCount, careers_url };
  } catch {
    // 404 (no such board), timeout, SSRF-block, cross-origin redirect, non-JSON:
    // all "not resolved" for this candidate.
    return { status: 'error', jobCount: 0, careers_url };
  }
}

/**
 * Resolve a company NAME to its scannable ATS board(s). For each vendor, probe
 * the slug candidates in order and take the FIRST that lists ≥1 job (one result
 * per vendor). Bounded by MAX_PROBES.
 *
 * @param {string} name
 * @param {{ safeGet?: typeof safeGet, signal?: AbortSignal }} [deps]
 * @returns {Promise<{ company:string, slugsTried:string[], results: {vendor:string,label:string,slug:string,careers_url:string,jobCount:number}[] }>}
 */
export async function discoverAts(name, deps = {}) {
  const company = String(name || '').trim();
  const slugsTried = deriveSlugs(company);
  const results = [];
  if (!company || !slugsTried.length) return { company, slugsTried, results };

  const get = deps.safeGet || _get;
  const budget = { count: 0 };
  const fetchImpl = makeSafeFetchImpl(get, budget, deps.signal);

  for (const vendor of VENDORS) {
    if (budget.count >= MAX_PROBES) break;
    for (const slug of slugsTried) {
      if (budget.count >= MAX_PROBES) break;
      // eslint-disable-next-line no-await-in-loop
      const r = await probeVendorSlug(vendor, slug, fetchImpl, deps.signal);
      if (r.status === 'match') {
        results.push({ vendor: vendor.id, label: vendor.label, slug, careers_url: r.careers_url, jobCount: r.jobCount });
        break; // first slug that resolves this vendor wins
      }
    }
  }
  return { company, slugsTried, results };
}
