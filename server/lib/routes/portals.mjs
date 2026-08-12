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
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import yaml from 'js-yaml';
import { PATHS } from '../paths.mjs';
import { safeGet } from '../safe-fetch.mjs';
import { withFileLock } from '../file-lock.mjs';

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

/**
 * Surgically set (or insert) a tracked company's `enabled:` flag in the RAW
 * portals.yml text, keyed by an exact careers_url match. Text-based (not a yaml
 * round-trip) so the user's file — comments, ordering, quoting — is preserved
 * byte-for-byte outside the single line we touch, matching store.mjs's
 * append-only write pattern. Returns the new text, or null if the company's
 * careers_url isn't found. Exported for tests.
 */
export function setEnabledInRaw(raw, careersUrl, enabled) {
  if (typeof raw !== 'string' || typeof careersUrl !== 'string' || !careersUrl) return null;
  const lines = raw.split('\n');
  const idx = lines.findIndex((l) => l.includes(careersUrl));
  if (idx === -1) return null;
  // Walk up to the list-item start ("- " at some indent) that owns this line.
  let start = idx;
  while (start > 0 && !/^\s*-\s/.test(lines[start])) start -= 1;
  if (!/^\s*-\s/.test(lines[start])) return null;
  const baseIndent = (lines[start].match(/^(\s*)-\s/) || [, ''])[1];
  const keyIndent = baseIndent + '  ';
  // Block end = first non-blank line dedented to/below the list-item indent.
  let end = start + 1;
  for (; end < lines.length; end += 1) {
    const l = lines[end];
    if (l.trim() === '') continue;
    const ind = (l.match(/^(\s*)/) || [, ''])[1].length;
    if (ind <= baseIndent.length) break;
  }
  // Existing `enabled:` within the block → flip its value; else insert one.
  let enabledLine = -1;
  for (let i = start; i < end; i += 1) { if (/^\s*enabled\s*:/.test(lines[i])) { enabledLine = i; break; } }
  if (enabledLine !== -1) {
    lines[enabledLine] = lines[enabledLine].replace(/^(\s*enabled\s*:\s*)\S.*$/, `$1${enabled}`);
  } else {
    lines.splice(start + 1, 0, `${keyIndent}enabled: ${enabled}`);
  }
  return lines.join('\n');
}

export function registerPortalsRoutes(app) {
  // POST /api/portals/toggle { careers_url, enabled } — explicit user write:
  // flip a watched company's enabled flag in portals.yml so the scanner
  // (en-scanner filters `c.enabled !== false`) skips or resumes it. Surgical +
  // parse-validated: if the edit wouldn't re-parse to valid YAML, we refuse to
  // write. Same write-through contract as POST /api/tracker / PUT /api/cv.
  app.post('/api/portals/toggle', async (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const careersUrl = typeof body.careers_url === 'string' ? body.careers_url : '';
    const enabled = body.enabled !== false; // default true
    if (!careersUrl) return res.status(400).json({ error: 'careers_url is required' });
    if (!existsSync(PATHS.portals)) return res.status(404).json({ error: 'portals.yml not found' });
    try {
      let ok = false;
      await withFileLock(PATHS.portals, async () => {
        const raw = readFileSync(PATHS.portals, 'utf8');
        const next = setEnabledInRaw(raw, careersUrl, enabled);
        if (next === null) return; // company not found — leave ok=false
        // safety net: the edited text MUST still parse, or we don't write it.
        try { yaml.load(next); } catch { return; }
        writeFileSync(PATHS.portals, next);
        ok = true;
      });
      if (!ok) return res.status(404).json({ error: 'company not found in portals.yml (or the edit would not parse)' });
      return res.json({ ok: true, careers_url: careersUrl, enabled });
    } catch (e) {
      return res.status(500).json({ error: String((e && e.message) || e).slice(0, 200) });
    }
  });

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
