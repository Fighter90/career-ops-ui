/**
 * Reports routes — list + read + write for the parent's reports/*.md tree.
 *
 *   GET  /api/reports        → { reports: ReportSummary[] }
 *   GET  /api/reports/:slug  → { slug, ...parsedHeader, markdown }
 *   POST /api/reports        → { slug, markdown, overwrite? } writes
 *                              reports/<slug>.md atomically (v1.16.0)
 *
 * `:slug` is sanitized to [^\w\-.]/g and may include or omit the .md
 * suffix. Header fields (date, archetype, score, url, legitimacy, pdf)
 * come from parseReportHeader.
 *
 * v1.16.0 (G-007 follow-up): POST /api/reports is the missing primitive
 * for auto-pipeline. Until v1.15.0 auto-pipeline could generate a PDF
 * and add a tracker row but couldn't persist the markdown report — so
 * the user lost the source of the PDF on browser refresh. This route
 * fills that gap. Writes go through stripDangerousMarkdown (same XSS
 * pass as cv.md). 1 MB cap. Atomic write.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { PATHS, path as projPath } from '../paths.mjs';
import { parseReportHeader } from '../parsers.mjs';
import { safeListReports } from '../store.mjs';
import { stripDangerousMarkdown, sanitizePathName } from '../security.mjs';
import { logActivity } from '../activity-log.mjs';

const MAX_REPORT_BYTES = 1024 * 1024; // 1 MB

// v1.20.1 (H-4) — local helper folds in reports-specific `.md` suffix
// stripping on top of the canonical sanitizePathName from security.mjs.
// All other call sites use sanitizePathName directly.
function sanitizeSlug(s) {
  return sanitizePathName(String(s || '').replace(/\.md$/, ''));
}

export function registerReportsRoutes(app) {
  app.get('/api/reports', (_req, res) => {
    res.json({ reports: safeListReports() });
  });

  app.get('/api/reports/:slug', (req, res) => {
    const slug = sanitizeSlug(req.params.slug);
    if (!slug) return res.status(400).json({ error: 'invalid slug' });
    const file = projPath('reports', `${slug}.md`);
    if (!existsSync(file)) return res.status(404).json({ error: 'not found' });
    const text = readFileSync(file, 'utf8');
    // FIX-1 (v1.159.0): mtime date fallback, same as the list builder.
    const mtime = statSync(file).mtime;
    res.json({ slug, ...parseReportHeader(text, { mtime }), markdown: text });
  });

  // v1.16.0 (G-007 follow-up): write the report markdown to
  // reports/<slug>.md. User-triggered only — auto-pipeline calls this
  // step 4 after a successful evaluate. Per CLAUDE.md hard rule #1,
  // the server writes parent files ONLY on explicit user actions like
  // this one.
  app.post('/api/reports', (req, res) => {
    const { slug: rawSlug, markdown, overwrite } = req.body || {};
    const slug = sanitizeSlug(rawSlug);
    if (!slug) {
      return res.status(400).json({ error: 'slug required (alphanumeric + dash/underscore/dot)' });
    }
    if (typeof markdown !== 'string') {
      return res.status(400).json({ error: 'markdown body required (string under "markdown" key)' });
    }
    if (Buffer.byteLength(markdown) > MAX_REPORT_BYTES) {
      return res.status(413).json({ error: `report markdown too large (max ${MAX_REPORT_BYTES} bytes)` });
    }
    const file = projPath('reports', `${slug}.md`);
    if (existsSync(file) && !overwrite) {
      return res.status(409).json({ error: 'report already exists; pass overwrite:true to replace', slug });
    }
    const sanitized = stripDangerousMarkdown(markdown);
    mkdirSync(PATHS.reportsDir, { recursive: true });
    writeFileSync(file, sanitized);
    logActivity({
      type: 'reports.save',
      target: `reports/${slug}.md`,
      bytes: Buffer.byteLength(sanitized),
      overwrite: !!overwrite,
    });
    res.json({
      ok: true,
      slug,
      path: `reports/${slug}.md`,
      bytes: Buffer.byteLength(sanitized),
      sanitized: sanitized !== markdown,
    });
  });
}
