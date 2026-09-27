/**
 * Read-side helpers for project files plus a one-time bootstrap.
 *
 * Defensive readers — return empty results on missing / unreadable files
 * instead of crashing the server. Keeps the SPA usable when career-ops
 * is half-set-up (Health page surfaces the gaps).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, openSync, fstatSync, closeSync } from 'node:fs';
import { sep } from 'node:path';
import yaml from 'js-yaml';
import { PATHS, path as projPath } from './paths.mjs';
import { parseApplications, parsePipeline, parseReportHeader } from './parsers.mjs';

export function safeReadApps() {
  try {
    return parseApplications(readFileSync(PATHS.applications, 'utf8'));
  } catch {
    return [];
  }
}

export function safeReadPipeline() {
  try {
    return parsePipeline(readFileSync(PATHS.pipeline, 'utf8'));
  } catch {
    return [];
  }
}

// Parsed report headers, keyed by absolute path and invalidated on any change
// of mtime or size. Parsing every report on every call cost ~3.7 s per
// /api/reports or /api/dashboard on the production box (hundreds of reports),
// blocking the event loop — during a scan, page loads timed out at 30 s.
// Listing now costs one stat() per file once the cache is warm.
const reportCache = new Map();
export const __reportCache = { hits: 0, misses: 0, get size() { return reportCache.size; }, reset() { reportCache.clear(); this.hits = 0; this.misses = 0; } };

export function safeListReports() {
  if (!existsSync(PATHS.reportsDir)) return [];
  const files = readdirSync(PATHS.reportsDir).filter((f) => f.endsWith('.md'));
  const seen = new Set();
  const out = [];
  for (const f of files) {
    const file = projPath('reports', f);
    let fd;
    try {
      // One descriptor for both the stat and the read, so the header cached
      // for this mtime/size is the content that was actually read.
      fd = openSync(file, 'r');
      const stat = fstatSync(fd);
      seen.add(file);
      let hit = reportCache.get(file);
      if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) {
        __reportCache.hits++;
      } else {
        __reportCache.misses++;
        const text = readFileSync(fd, 'utf8');
        // FIX-1 (v1.159.0): pass the file mtime so a report whose body has no
        // parseable date (common in non-EN reports) still gets a date anchor.
        const header = parseReportHeader(text, { mtime: stat.mtime });
        hit = { mtimeMs: stat.mtimeMs, size: stat.size, entry: { slug: f.replace(/\.md$/, ''), file: f, mtime: stat.mtime, ...header } };
        reportCache.set(file, hit);
      }
      out.push({ ...hit.entry });
    } catch {
      // unreadable report: skip it, as before
    } finally {
      if (fd !== undefined) closeSync(fd);
    }
  }
  // Forget deleted reports (only entries under the directory just listed).
  const dir = projPath('reports') + sep;
  for (const k of reportCache.keys()) if (k.startsWith(dir) && !seen.has(k)) reportCache.delete(k);
  return out.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
}

/**
 * Detect template / placeholder profile data so the Health page can
 * nudge fresh installs. Conservative on YAML errors — if we can't read
 * the file we assume customization happened (no false alarms).
 */
export function checkProfileCustomized() {
  if (!existsSync(PATHS.profile)) return { ok: false, value: 'profile.yml missing' };
  let parsed;
  try {
    parsed = yaml.load(readFileSync(PATHS.profile, 'utf8')) || {};
  } catch (e) {
    return { ok: false, value: `profile.yml parse error: ${e.message}` };
  }
  const name = parsed?.candidate?.full_name?.trim();
  if (!name) return { ok: false, value: 'candidate.full_name missing' };
  // Known placeholder / test-fixture names from the shipped templates
  // and QA harnesses (QA BUG-002/UX-032 — an "Acceptance Test" profile
  // was reported "customized" and would leak into every prompt). Kept
  // to an explicit allow-list of synthetic names so a real candidate
  // whose name merely contains "test" is never false-flagged.
  if (/^(Jane Smith|Alex Doe|John Doe|Your Name|Test User?|Acceptance Test|Real Person|Sample User|QA|Test|Placeholder|Example User)$/i.test(name)) {
    return { ok: false, value: `still on template / test fixture ("${name}")` };
  }
  return { ok: true, value: name };
}

/**
 * FIX-H2 — first-boot bootstrap. If portals.yml exists but lacks the
 * russian_portals: block, append a documented default so the user has
 * something to edit instead of guessing the schema. Idempotent — second
 * boot is a no-op because the literal "russian_portals:" line is now there.
 */
export function ensureRussianPortalsDefaults() {
  if (!existsSync(PATHS.portals)) return;
  let text;
  try {
    text = readFileSync(PATHS.portals, 'utf8');
  } catch {
    return;
  }
  if (/^russian_portals\s*:/m.test(text)) return;
  const block = `

# ──────────────────────────────────────────────────────────────────────
# russian_portals (auto-generated by web-ui on first boot — edit freely)
# ──────────────────────────────────────────────────────────────────────
# sources:    which RU portals to scan ("hh" hh.ru, "habr" Habr Career)
# area:       hh.ru area code (1=Moscow, 2=SPb, 113=Russia-wide, 1001=remote)
# per_page:   results per query
# only_remote: filter to remote-only postings
# queries:    case-insensitive substring matches against vacancy titles
russian_portals:
  sources: ["hh", "habr"]
  area: 113
  per_page: 50
  only_remote: false
  queries:
    - "Senior PHP"
    - "PHP Symfony"
    - "PHP Laravel"
    - "Senior Go"
    - "Golang Backend"
    - "Tech Lead PHP"
    - "Tech Lead Go"
`;
  try {
    writeFileSync(PATHS.portals, text.replace(/\n*$/, '\n') + block);
    console.log('[startup] Added default russian_portals: block to portals.yml');
  } catch (e) {
    console.warn('[startup] Could not write russian_portals defaults to portals.yml:', e.message);
  }
}
