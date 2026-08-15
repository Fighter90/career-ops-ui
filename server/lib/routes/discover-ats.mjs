// @ts-check
/**
 * Discover-ATS routes.
 *
 *   POST /api/portals/discover { company }
 *     Read-only preview. Probe Greenhouse / Ashby / Lever for a company NAME and
 *     return the boards that exist AND list ≥1 job:
 *       { company, results: [{ vendor, label, slug, careers_url, jobCount }] }
 *     Zero writes, zero LLM, zero browser. Every probe rides the DNS-pinned
 *     `safeGet` from a FIXED vendor host (see server/lib/discover-ats.mjs).
 *
 *   POST /api/portals/track { name, careers_url, provider? }
 *     Explicit user WRITE — append one discovered board to portals.yml
 *     `tracked_companies:` so the scanner starts watching it. Same write-through
 *     contract as POST /api/portals/toggle: withFileLock + a surgical text
 *     splice (comments/ordering preserved) + a re-parse guard + atomic
 *     temp-then-rename. Idempotent (dedupe by name/careers_url). The careers_url
 *     MUST reference a known ATS host we can discover — arbitrary URLs are refused.
 */
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import yaml from 'js-yaml';
import { PATHS } from '../paths.mjs';
import { withFileLock } from '../file-lock.mjs';
import { resolveAdapter } from '../portals/registry.mjs';
import {
  discoverAts,
  renderPortalEntry,
  insertIntoTrackedCompanies,
  isDuplicateCompany,
  KNOWN_CAREERS_HOSTS,
} from '../discover-ats.mjs';

const MAX_NAME_LEN = 120;
const MAX_URL_LEN = 400;
const MAX_PROVIDER_LEN = 40;

/** Validate a careers_url the WRITE is allowed to append: https + a known ATS host. */
function isAllowedCareersUrl(url) {
  if (typeof url !== 'string' || !url || url.length > MAX_URL_LEN) return false;
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;
  return KNOWN_CAREERS_HOSTS.has(u.hostname.toLowerCase());
}

export function registerDiscoverAtsRoutes(app) {
  // ── Read-only preview ────────────────────────────────────────────────
  app.post('/api/portals/discover', async (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const company = typeof body.company === 'string' ? body.company.trim() : '';
    if (!company) return res.status(400).json({ error: 'company is required' });
    if (company.length > MAX_NAME_LEN) {
      return res.status(400).json({ error: `company name too long (max ${MAX_NAME_LEN} chars)` });
    }
    try {
      const out = await discoverAts(company);
      return res.json({ company: out.company, results: out.results });
    } catch (e) {
      return res.status(500).json({ error: String((e && e.message) || e).slice(0, 200) });
    }
  });

  // ── Explicit write: add a discovered board to tracked_companies ───────
  app.post('/api/portals/track', async (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const careersUrl = typeof body.careers_url === 'string' ? body.careers_url.trim() : '';
    const provider = typeof body.provider === 'string' ? body.provider.trim().slice(0, MAX_PROVIDER_LEN) : '';

    // Reject control characters (especially newlines) in every written field. A
    // newline could splice an arbitrary EXTRA line into portals.yml that still
    // PARSES — a valid-YAML injection that sails straight past the `yaml.load`
    // re-parse guard below (which only rejects syntactically BROKEN YAML).
    const hasCtrl = (s) => {
      for (let i = 0; i < s.length; i += 1) { const c = s.charCodeAt(i); if (c < 0x20 || c === 0x7f) return true; }
      return false;
    };
    if (hasCtrl(name) || hasCtrl(careersUrl) || hasCtrl(provider)) {
      return res.status(400).json({ error: 'control characters are not allowed' });
    }

    if (!name) return res.status(400).json({ error: 'name is required' });
    if (name.length > MAX_NAME_LEN) return res.status(400).json({ error: `name too long (max ${MAX_NAME_LEN} chars)` });
    if (!isAllowedCareersUrl(careersUrl)) {
      return res.status(400).json({ error: 'careers_url must be an https URL on a known ATS host (Greenhouse/Ashby/Lever)' });
    }
    // Defense-in-depth: the URL must be one a scanner adapter actually claims.
    if (!resolveAdapter({ name, careers_url: careersUrl })) {
      return res.status(400).json({ error: 'careers_url is not a recognized ATS board' });
    }
    if (!existsSync(PATHS.portals)) return res.status(404).json({ error: 'portals.yml not found' });

    try {
      let outcome = 'error'; // 'added' | 'duplicate' | 'parse-error' | 'error'
      await withFileLock(PATHS.portals, async () => {
        const raw = readFileSync(PATHS.portals, 'utf8');
        let existing = [];
        try {
          const doc = yaml.load(raw) || {};
          existing = Array.isArray(doc.tracked_companies) ? doc.tracked_companies
            : (Array.isArray(doc.companies) ? doc.companies : []);
        } catch { existing = []; }

        if (isDuplicateCompany(existing, name, careersUrl)) { outcome = 'duplicate'; return; }

        const snippet = renderPortalEntry({ name, careers_url: careersUrl, provider: provider || undefined });
        const next = insertIntoTrackedCompanies(raw, [snippet]);
        // Safety net: the surgical splice MUST still parse, or we refuse to write.
        try { yaml.load(next); } catch { outcome = 'parse-error'; return; }
        const tmp = PATHS.portals + '.tmp-' + process.pid;
        writeFileSync(tmp, next);
        renameSync(tmp, PATHS.portals);
        outcome = 'added';
      });

      if (outcome === 'parse-error') {
        console.warn('[portals/track] surgical splice produced invalid YAML — refused to write');
        return res.status(500).json({ error: 'internal error: the edit would not re-parse; portals.yml left unchanged' });
      }
      if (outcome === 'duplicate') return res.json({ ok: true, added: false, duplicate: true, name, careers_url: careersUrl });
      if (outcome === 'added') return res.json({ ok: true, added: true, name, careers_url: careersUrl });
      return res.status(500).json({ error: 'could not add the company' });
    } catch (e) {
      return res.status(500).json({ error: String((e && e.message) || e).slice(0, 200) });
    }
  });
}
