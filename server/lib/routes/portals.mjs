/**
 * Portals health routes (v1.99.0).
 *
 * The scanner watches a set of companies declared in the parent's `portals.yml`
 * (`tracked_companies:`). An ATS slug can quietly break — a company renames its
 * board or moves off Greenhouse — and then that employer silently vanishes from
 * every future scan with no error. This surfaces that: list the watched
 * companies and, on demand, HEAD/GET each `careers_url` to flag the dead ones.
 *
 *   POST /api/portals/health  → probe every enabled company's careers_url and
 *                               report { probed, dead, results:[{name,url,status,ok}] }.
 *
 * The company LIST is served by the existing `GET /api/portals` (content.mjs,
 * `{ portals, raw }`) — this module only adds the on-demand liveness probe.
 *
 * Read-only: never writes portals.yml. Every probe goes through the DNS-pinned
 * `safeGet` (SSRF envelope) with a short timeout + tiny body cap; concurrency is
 * chunked so a big portals.yml can't fan out into a request storm.
 */
import { readFileSync, existsSync } from 'node:fs';
import yaml from 'js-yaml';
import { PATHS } from '../paths.mjs';
import { safeGet } from '../safe-fetch.mjs';

const PROBE_TIMEOUT_MS = 12_000;
const PROBE_CHUNK = 8; // concurrent probes
const MAX_COMPANIES = 400; // safety cap

function loadTracked() {
  if (!existsSync(PATHS.portals)) return null;
  let doc;
  try {
    doc = yaml.load(readFileSync(PATHS.portals, 'utf8')) || {};
  } catch {
    return null;
  }
  const tracked = doc.tracked_companies || doc.companies || [];
  if (!Array.isArray(tracked)) return [];
  return tracked.slice(0, MAX_COMPANIES).map((c) => ({
    name: typeof c.name === 'string' ? c.name : '',
    careers_url: typeof c.careers_url === 'string' ? c.careers_url : (typeof c.api === 'string' ? c.api : ''),
    provider: typeof c.provider === 'string' ? c.provider : '',
    enabled: c.enabled !== false,
  })).filter((c) => c.name || c.careers_url);
}

async function probe(company) {
  const url = company.careers_url;
  if (!url) return { name: company.name, url: '', status: 0, ok: false, error: 'no careers_url' };
  try {
    const res = await safeGet(url, { timeoutMs: PROBE_TIMEOUT_MS, maxBytes: 4096 });
    const status = res.status || 0;
    return { name: company.name, url, status, ok: status >= 200 && status < 400 };
  } catch (e) {
    return { name: company.name, url, status: 0, ok: false, error: String((e && e.message) || e).slice(0, 120) };
  }
}

async function probeAll(companies) {
  const out = [];
  for (let i = 0; i < companies.length; i += PROBE_CHUNK) {
    const chunk = companies.slice(i, i + PROBE_CHUNK);
    // eslint-disable-next-line no-await-in-loop
    const res = await Promise.all(chunk.map(probe));
    out.push(...res);
  }
  return out;
}

export function registerPortalsRoutes(app) {
  app.post('/api/portals/health', async (_req, res) => {
    const tracked = loadTracked();
    if (tracked === null) return res.status(404).json({ error: 'portals.yml not found or unreadable' });
    const enabled = tracked.filter((c) => c.enabled && c.careers_url);
    try {
      const results = await probeAll(enabled);
      const dead = results.filter((r) => !r.ok);
      res.json({ probed: results.length, dead: dead.length, results });
    } catch (e) {
      res.status(500).json({ error: String((e && e.message) || e).slice(0, 200) });
    }
  });
}
