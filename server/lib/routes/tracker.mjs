/**
 * Tracker routes — viewer + writer for `data/applications.md`.
 *
 *   GET  /api/tracker → { rows: Application[] }
 *   POST /api/tracker → append a row (dedup by company+role, case-insensitive)
 *
 * The POST handler bridges the "scan → evaluate → save report → add to
 * tracker" loop into the UI. Status is whitelisted; score, date, notes,
 * and reportSlug are sanitized. The Markdown table is bootstrapped on
 * first write.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PATHS, path as projPath } from '../paths.mjs';
import { parseApplications, today } from '../parsers.mjs';
import { safeReadApps } from '../store.mjs';
import { withFileLock } from '../file-lock.mjs';
import { canonicalizeStatus } from '../states.mjs';

// v1.128.0 (parent web/ port #2) — the canonical status vocabulary is no
// longer hardcoded here. `server/lib/states.mjs` reads the parent's
// `templates/states.yml` live (id/label/aliases), so the whitelist — and
// alias folding (Spanish/legacy labels the parent writer may emit) — stays in
// sync with the parent automatically instead of needing a manual re-sync every
// release (the v1.118.0 'Hired' addition was one such sweep).

export function registerTrackerRoutes(app) {
  // v1.55.8 — UX-8: OPTIONAL server-side pagination + a whole-history
  // status `funnel`. Back-compat is strict: with NO query params the
  // response is exactly `{ rows: [...] }` as before (every existing
  // caller/test unaffected). Pass ?page / ?pageSize (and optionally
  // ?status) to get `{ rows: slice, total, page, pageSize, funnel }`.
  // The funnel is computed over the FULL history regardless of the
  // status filter so the #/tracker chips always show every bucket.
  app.get('/api/tracker', (req, res) => {
    const all = safeReadApps();
    const { page, pageSize, status } = req.query || {};
    if (page === undefined && pageSize === undefined && status === undefined) {
      return res.json({ rows: all }); // legacy shape — untouched
    }
    // Fold each raw status to its canonical bucket (parent web/ port #3) so a
    // Spanish/legacy label the parent writer may emit (e.g. "contratada",
    // "**Applied**") lands in the same bucket as its canonical form instead of
    // spawning a phantom funnel entry. Unknown labels keep their raw value.
    const funnel = {};
    for (const r of all) {
      const raw = (r && r.status) || 'Evaluated';
      const s = canonicalizeStatus(raw) || raw;
      funnel[s] = (funnel[s] || 0) + 1;
    }
    const wanted = status ? all.filter((r) => (r && r.status) === status) : all;
    const total = wanted.length;
    const ps = Math.min(500, Math.max(1, parseInt(pageSize, 10) || 25));
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const start = (pg - 1) * ps;
    const rows = wanted.slice(start, start + ps);
    res.json({ rows, total, page: pg, pageSize: ps, funnel });
  });

  app.post('/api/tracker', async (req, res) => {
    const { company, role, score, status, url, reportSlug, notes, date } = req.body || {};
    if (!company || !role) {
      return res.status(400).json({ error: 'company and role are required' });
    }
    // BF-1 — escape pipes + collapse newlines in every cell value, not
    // just notes. A pipe in company / role would break the markdown
    // table layout (the parser would split the cell into two), and a
    // newline would terminate the row mid-build.
    const cell = (s) => String(s || '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').trim();
    const safeCompany = cell(company);
    const safeRole = cell(role);
    // Fold any label/id/alias (case-insensitive, stray ** tolerated) to its
    // canonical label; unrecognized → 'Evaluated' (the safe default, as before).
    const safeStatus = canonicalizeStatus(status) || 'Evaluated';
    const safeScore = (score && /^[\d.]+\/?5?$/.test(String(score))) ? String(score).replace(/\/5$/, '') + '/5' : '—';
    const safeDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today();
    const safeReport = reportSlug ? `[${cell(reportSlug)}](reports/${cell(reportSlug).replace(/^reports\//, '').replace(/\.md$/, '')}.md)` : '';
    const safeNotes = cell(notes).slice(0, 200) || (url ? cell(url) : '');

    // v1.20.1 (H-6) — serialize read-modify-write on applications.md so
    // two concurrent POSTs cannot both compute the same `nextNum` and
    // race the file write. Express is single-process; an in-memory
    // mutex per-path is sufficient.
    const result = await withFileLock(PATHS.applications, async () => {
      let content = '';
      try { content = readFileSync(PATHS.applications, 'utf8'); } catch { content = ''; }
      // Dedup: skip if same company + role already present (case-insensitive).
      const existing = parseApplications(content);
      const dup = existing.find((r) => (r.company || '').toLowerCase() === company.toLowerCase()
        && (r.role || '').toLowerCase() === role.toLowerCase());
      if (dup) {
        return { ok: true, deduped: true, existingNum: dup.num };
      }

      // Compute next # under the lock — atomic w.r.t. other tracker writers.
      const nextNum = String((Math.max(0, ...existing.map((r) => parseInt(r.num, 10) || 0))) + 1).padStart(3, '0');

      // Build the row using the existing column order:
      //   # | Date | Company | Role | Score | Status | PDF | Report | Notes
      const row = `| ${nextNum} | ${safeDate} | ${safeCompany} | ${safeRole} | ${safeScore} | ${safeStatus} | ❌ | ${safeReport} | ${safeNotes} |`;

      let updated;
      if (!content || !/^\|\s*#/m.test(content)) {
        // Empty file or no table yet — bootstrap with header.
        updated = [
          '# Applications Tracker',
          '',
          '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
          '|---|------|---------|------|-------|--------|-----|--------|-------|',
          row,
          '',
        ].join('\n');
      } else {
        // Append to the end of the existing table — match trailing newlines.
        updated = content.replace(/\n*$/, '\n') + row + '\n';
      }
      mkdirSync(projPath('data'), { recursive: true });
      writeFileSync(PATHS.applications, updated);
      return { ok: true, num: nextNum };
    });
    res.json(result);
  });
}
