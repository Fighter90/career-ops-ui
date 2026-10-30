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
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PATHS, PROJECT_ROOT, path as projPath } from '../paths.mjs';
import { parseApplications, parseMarkdownTable, today } from '../parsers.mjs';
import { safeReadApps, safeListReports } from '../store.mjs';
import { withFileLock, atomicWrite } from '../file-lock.mjs';
import { canonicalizeStatus, readCanonicalStates, canonicalLabels } from '../states.mjs';
import { runTrackedScript } from '../runner.mjs';
import { llmRateLimit } from '../rate-limit.mjs';
import { parseJsonStdout, sanitizeDetail } from '../parent-relay.mjs';
// CAR-181 — import another tracker's CSV export. Pure planning lives in
// lib/tracker-import.mjs; this route only validates, locks and writes.
import {
  MAX_CSV_BYTES, MAX_IMPORT_ROWS, parseCsv, planImport,
} from '../tracker-import.mjs';

// v1.128.0 — the canonical status vocabulary is no
// longer hardcoded here. `server/lib/states.mjs` reads
// `templates/states.yml` live (id/label/aliases), so the whitelist — and
// alias folding (Spanish/legacy labels the writer may emit) — stays in
// sync with the states file automatically instead of needing a manual re-sync every
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
    // Fold each raw status to its canonical bucket so a
    // Spanish/legacy label the writer may emit (e.g. "contratada",
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

  // v1.131.0 — the #/tracker CRM stage-tab board
  // needs the FULL canonical funnel — labels in order, including zero-count
  // stages — plus an alias-fold map, so the client can bucket rows without ever
  // hardcoding the whitelist (the v1.128.0 doctrine). Read-only, no writes, no
  // user input, no external fetch; sourced from server/lib/states.mjs
  // (templates/states.yml, with the built-in fallback). Cacheable.
  app.get('/api/tracker/stages', (req, res) => {
    const states = readCanonicalStates();
    const stages = states.map((s) => s.label);
    // Fold key → canonical label. Keys are lowercased/trimmed to match the
    // client's TrackerStages.norm(); labels/ids/aliases never carry markdown.
    const aliases = {};
    const put = (key, label) => {
      const k = String(key == null ? '' : key).trim().toLowerCase();
      if (k) aliases[k] = label;
    };
    for (const s of states) {
      put(s.label, s.label);
      put(s.id, s.label);
      for (const a of (s.aliases || [])) put(a, s.label);
    }
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ stages, aliases });
  });

  app.post('/api/tracker', async (req, res) => {
    const { company, role, score, status, url, reportSlug, notes, date } = req.body || {};
    // Type-check before any string method: a non-string company/role used to
    // throw (.toLowerCase) inside the file lock -> unhandled rejection.
    if (typeof company !== 'string' || typeof role !== 'string' || !company.trim() || !role.trim()) {
      return res.status(400).json({ error: 'company and role are required' });
    }
    const optional = { status, url, reportSlug, notes, date };
    const badField = Object.keys(optional).find((k) => optional[k] != null && typeof optional[k] !== 'string');
    if (badField || (score != null && typeof score !== 'string' && typeof score !== 'number')) {
      return res.status(400).json({ error: `invalid field: ${badField || 'score'}` });
    }
    // BF-1 — escape pipes + collapse newlines in every cell value, not
    // just notes. A pipe in company / role would break the markdown
    // table layout (the parser would split the cell into two), and a
    // newline would terminate the row mid-build.
    const cell = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').trim();
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
      // Dedup: skip if same company + role already present. Compare the
      // stored cell and the incoming value through the same normalisation
      // (trim, collapsed whitespace, case-insensitive) so 'Acme ' or 'Acme
      // \nInc' matches the row this handler would have written for them.
      const existing = parseApplications(content);
      const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const wantCompany = norm(company);
      const wantRole = norm(role);
      const dup = existing.find((r) => norm(r.company) === wantCompany && norm(r.role) === wantRole);
      if (dup) {
        return { ok: true, deduped: true, existingNum: dup.num };
      }

      // Compute next # under the lock — atomic w.r.t. other tracker writers.
      const nextNum = String((existing.reduce((m, r) => Math.max(m, parseInt(r.num, 10) || 0), 0)) + 1).padStart(3, '0');

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
      // FULL-M1 hand-off (review F3) — lock ≠ crash safety: the write goes
      // through temp-then-rename like every other shared-file writer.
      atomicWrite(PATHS.applications, updated);
      return { ok: true, num: nextNum };
    });
    res.json(result);
  });

  // CAR-181 — import the applications in another tracker's CSV export
  // (Teal / Huntr / Simplify / a spreadsheet). Dry run by default: the body
  // is planned against the CURRENT tracker (dedup by normalized posting URL
  // via url-key, company+role fallback) and NOTHING is written. A second
  // call with { commit: true } re-plans inside withFileLock and appends the
  // import rows through the same markdown-table conventions as POST /api/tracker
  // (N/A score sentinel, escaped cells, temp-then-rename write).
  app.post('/api/tracker/import-csv', async (req, res) => {
    const { csv, commit, source } = req.body || {};
    if (typeof csv !== 'string' || !csv.trim()) {
      return res.status(400).json({ error: 'csv text is required' });
    }
    if (Buffer.byteLength(csv, 'utf8') > MAX_CSV_BYTES) {
      return res.status(413).json({ error: 'CSV is too large (limit 512KB). Split the export and import the parts.' });
    }
    const csvRows = parseCsv(csv);
    const dataRowCount = csvRows.slice(1).filter((r) => r.some((c) => String(c).trim())).length;
    if (dataRowCount > MAX_IMPORT_ROWS) {
      return res.status(400).json({ error: `CSV has ${dataRowCount} data rows (limit ${MAX_IMPORT_ROWS}). Split the export and import the parts.` });
    }
    const safeSource = typeof source === 'string'
      ? source.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 80)
      : '';
    const states = readCanonicalStates();

    const buildPlan = (trackerRows) => {
      try {
        return { ok: true, plan: planImport(csvRows, { trackerRows, today: today(), source: safeSource, states }) };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    };
    // Dry-run shape: counts + the per-row preview the UI renders.
    const summarize = (plan) => {
      const imported = [];
      const duplicates = [];
      const skipped = [];
      const rows = plan.entries.map((e) => {
        if (e.outcome === 'import') imported.push(e);
        else if (e.outcome === 'tracked' || e.outcome === 'repeat') {
          duplicates.push({ company: e.company, role: e.role, reason: e.reason });
        } else skipped.push(e);
        return {
          row: e.row, company: e.company, role: e.role, status: e.status || '',
          date: e.date || '', url: e.url, outcome: e.outcome, reason: e.reason || '',
        };
      });
      return { imported: imported.length, skipped: skipped.length, duplicates, rows };
    };

    if (!commit) {
      let content = '';
      try { content = readFileSync(PATHS.applications, 'utf8'); } catch { content = ''; }
      const planned = buildPlan(parseApplications(content));
      if (!planned.ok) return res.status(400).json({ error: planned.error });
      return res.json(summarize(planned.plan));
    }

    // Commit: re-plan INSIDE the lock against the file as it is right now
    // (a dry run may be stale by the time the user confirms), then append.
    const result = await withFileLock(PATHS.applications, async () => {
      let content = '';
      try { content = readFileSync(PATHS.applications, 'utf8'); } catch { content = ''; }
      const planned = buildPlan(parseApplications(content));
      if (!planned.ok) return { status: 400, body: { error: planned.error } };
      const toImport = planned.plan.entries.filter((e) => e.outcome === 'import');
      if (!toImport.length) return { status: 200, body: { ...summarize(planned.plan), written: 0 } };

      const hasUrlCol = parseMarkdownTable(content).headers
        .some((h) => String(h).trim().toLowerCase() === 'url');
      const cell = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').trim();
      const existing = parseApplications(content);
      let num = existing.reduce((m, r) => Math.max(m, parseInt(r.num, 10) || 0), 0);
      const newLines = toImport.map((e) => {
        num += 1;
        // No URL column → the posting URL rides in Notes (the same place
        // POST /api/tracker puts it), so a second import still dedups on it.
        const notes = [
          e.notes,
          !hasUrlCol && e.url ? e.url : '',
          !hasUrlCol && e.location ? e.location : '',
        ].filter(Boolean).join('; ').slice(0, 500);
        const row = [
          String(num).padStart(3, '0'), e.date, cell(e.company), cell(e.role),
          'N/A', e.status, '❌', '—', notes || '—',
        ].map(cell);
        if (hasUrlCol && e.url) row.push(cell(e.url));
        return `| ${row.join(' | ')} |`;
      });
      let updated;
      if (!content || !/^\|\s*#/m.test(content)) {
        updated = [
          '# Applications Tracker',
          '',
          hasUrlCol
            ? '| # | Date | Company | Role | Score | Status | PDF | Report | Notes | URL |'
            : '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
          hasUrlCol
            ? '|---|------|---------|------|-------|--------|-----|--------|-------|-----|'
            : '|---|------|---------|------|-------|--------|-----|--------|-------|',
          ...newLines,
          '',
        ].join('\n');
      } else {
        updated = content.replace(/\n*$/, '\n') + newLines.join('\n') + '\n';
      }
      mkdirSync(projPath('data'), { recursive: true });
      atomicWrite(PATHS.applications, updated);
      return { status: 200, body: { ...summarize(planned.plan), written: toImport.length } };
    });
    return res.status(result.status).json(result.body);
  });

  // CAR-129 (v1.256.0) — one-shot score backfill: rows carrying a report
  // link but an empty score cell get the score parsed from that report's
  // own header (store.safeListReports → parseReportHeader, mtime-cached).
  // Everything else is read-only: scored rows, explicit sentinels (N/A),
  // rows without a report link and reports without a parseable score are
  // left untouched. Only the Score cell of a matched row is rewritten.
  app.post('/api/tracker/backfill-scores', async (req, res) => {
    const result = await withFileLock(PATHS.applications, async () => {
      let content = '';
      try { content = readFileSync(PATHS.applications, 'utf8'); } catch {
        return { ok: true, updated: 0, missingReport: 0, reportScoreless: 0 };
      }
      const rows = parseApplications(content);
      const byReport = new Map();
      for (const rep of safeListReports()) {
        byReport.set(String(rep.slug || ''), rep);
        byReport.set(String(rep.file || ''), rep);
      }
      const updates = new Map();
      let missingReport = 0;
      let reportScoreless = 0;
      for (const row of rows) {
        const cellScore = String(row.score || '').trim();
        if (cellScore && cellScore !== '—' && cellScore !== '-') continue; // scored, or an explicit sentinel
        const slug = String(row.reportPath || '').replace(/^reports\//, '').replace(/\.md$/, '');
        if (!slug) continue; // no report link at all
        const rep = byReport.get(slug);
        if (!rep) { missingReport += 1; continue; }
        // Review round (opus r1 #5): only a bounded score shape reaches the
        // table — never a free-form header line (compactScore already
        // normalizes; this pins the contract at the write site).
        if (rep.scoreNum == null || !/^\d+(?:[.,]\d+)?(?:\s*\/\s*5)?$/.test(String(rep.score).trim())) {
          reportScoreless += 1;
          continue;
        }
        updates.set(String(row.num), String(rep.score).trim());
      }
      const done = (updated) => ({ ok: true, updated, missingReport, reportScoreless });
      if (!updates.size) return done(0);
      const lines = content.split('\n');
      const headerIdx = lines.findIndex((l) => /^\s*\|/.test(l));
      if (headerIdx === -1) return done(0);
      const headerCells = lines[headerIdx].split(/(?<!\\)\|/).map((c) => c.trim().toLowerCase());
      const scoreCol = headerCells.indexOf('score');
      if (scoreCol === -1) return done(0);
      let applied = 0;
      for (let i = headerIdx + 2; i < lines.length; i++) { // headerIdx+1 is the |---| separator
        if (!/^\s*\|/.test(lines[i])) break; // review r1 #6: the tracker table ends at the first non-table line
        const cells = lines[i].split(/(?<!\\)\|/);
        const num = (cells[1] || '').trim();
        if (!updates.has(num)) continue;
        if (scoreCol >= cells.length) continue; // review r2: a hand-malformed short row must keep its column count
        // Review r1 #3: re-check the TARGET cell before writing — a
        // duplicate # after manual edits must never clobber a real score.
        const current = (cells[scoreCol] || '').trim();
        if (current && current !== '—' && current !== '-') continue;
        // Review r2: the tracker convention is X[.X]/5 — a Machine-Summary
        // `score: 4.2` (no fraction) is normalized at the write site.
        const score = updates.get(num);
        cells[scoreCol] = ` ${/\/\s*5$/.test(score) ? score : score + '/5'} `;
        lines[i] = cells.join('|');
        applied += 1;
      }
      if (applied) atomicWrite(PATHS.applications, lines.join('\n'));
      return done(applied);
    });
    res.json(result);
  });

  // ─── Inline status edit (v1.246.0 backlog #2) ─────────────────────────────
  // The #/tracker row's status <select> writes through the parent's canonical
  // writer, never directly: the route relays
  //   node set-status.mjs --row N <State> [--note "..."] [--dry-run] --json
  // spawned via runTrackedScript (set-status.mjs is TRACKER_MUTATING, so the
  // spawn holds the applications.md lock and serializes with web-ui's own
  // tracker writers). The state whitelist is NOT duplicated here:
  // canonicalizeStatus() folds any label/id/alias to its canonical form via
  // templates/states.yml (server/lib/states.mjs). Fail-soft 502 { error } on a
  // missing script, a non-zero exit or an unparseable stdout — the client
  // reverts the select. web-ui never writes applications.md from a route body.
  // Registry-entry shape (FULL-M1 guard): the script name lives in a
  // `script:` entry, the same shape the TRACKER_MUTATING registry uses.
  const SET_STATUS = { script: 'set-status.mjs', timeoutMs: 30_000 };
  const MAX_NOTE = 200; // mirrors the POST /api/tracker notes-cell cap

  /** True if `s` carries a C0 control char or DEL — spawn throws on NUL. */
  function hasControlChar(s) {
    for (let i = 0; i < s.length; i += 1) {
      const code = s.charCodeAt(i);
      if (code < 0x20 || code === 0x7f) return true;
    }
    return false;
  }

  app.post('/api/tracker/status', llmRateLimit, async (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const { row, state } = body;
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    const dryRun = body.dryRun === true;

    if (typeof row !== 'number' || !Number.isInteger(row) || row < 1) {
      return res.status(400).json({ error: 'row must be a positive integer' });
    }
    if (typeof state !== 'string' || !state.trim()) {
      return res.status(400).json({ error: 'state is required' });
    }
    const canonical = canonicalizeStatus(state);
    if (!canonical) {
      return res.status(400).json({ error: `invalid state; valid: ${canonicalLabels().join(', ')}` });
    }
    if (hasControlChar(note)) {
      return res.status(400).json({ error: 'control characters are not allowed' });
    }
    if (note.length > MAX_NOTE) {
      return res.status(400).json({ error: `note must be ≤ ${MAX_NOTE} chars` });
    }
    if (!existsSync(resolve(PROJECT_ROOT, SET_STATUS.script))) {
      return res.status(502).json({ error: 'set-status.mjs not found in the parent project' });
    }

    // Flag + positional args as an argv array — never shell-interpolated.
    const args = ['--row', String(row), canonical];
    if (note) args.push('--note', note);
    if (dryRun) args.push('--dry-run');
    args.push('--json');

    const r = await runTrackedScript(SET_STATUS.script, args, { timeoutMs: SET_STATUS.timeoutMs });
    const data = parseJsonStdout(r.stdout);
    if (r.code !== 0 || !data) {
      return res.status(502).json({
        error: (data && data.error) || 'set-status.mjs failed',
        code: r.killed ? 'timeout' : 'script-error',
        detail: sanitizeDetail(r.stderr),
      });
    }
    return res.json({ ok: true, ...data });
  });
}
