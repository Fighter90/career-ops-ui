/**
 * Script-runner routes — buffered + streaming wrappers around parent
 * project Node scripts, plus generated-PDF list/download.
 *
 * Buffered (POST /api/run/*):
 *   doctor / verify / normalize / dedup / merge / sync-check
 *
 * Streaming (GET /api/stream/*):
 *   scan       → spawns parent scan.mjs (the SSE sibling of the
 *                in-process /api/stream/scan?source= in routes/scan.mjs)
 *   liveness   → check-liveness.mjs
 *   pdf        → generate-pdf.mjs
 *
 * Generated PDFs:
 *   GET /api/output/pdfs         → list { name, size, mtime }[]
 *   GET /api/output/pdfs/:name   → download (attachment); `?inline=1` → inline preview (D-5)
 */
import { existsSync, readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PATHS, path as projPath } from '../paths.mjs';
import { runNodeScript, streamNodeScript } from '../runner.mjs';
import { sanitizePathName } from '../security.mjs';

/**
 * Minimal markdown → HTML for PDF rendering. Mirrors what the SPA's
 * UI.md does but server-side and lightly styled. We don't pull a full
 * markdown library because the CV format is constrained (headings,
 * lists, paragraphs, occasional bold/italic) and adding a dep just for
 * this would be scope creep. Output is escaped first; only the
 * renderer's own tags reach the HTML.
 */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cvMarkdownToHtml(md, title) {
  // Escape everything first so user text can't inject HTML.
  let s = escapeHtml(md).replace(/\r\n/g, '\n');

  // Headings — H1 through H4 only.
  s = s
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Lists — collapse consecutive `- ` lines into a single <ul>.
  s = s.replace(/(^- .+(\n- .+)*)/gm, (block) => {
    const items = block.split('\n').map((l) => l.replace(/^- /, ''));
    return '<ul>' + items.map((i) => `<li>${i}</li>`).join('') + '</ul>';
  });

  // Bold/italic inside running text.
  s = s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s])\*([^*]+)\*/g, '$1<em>$2</em>');

  // Paragraphs — wrap remaining text blocks that aren't already tagged.
  s = s
    .split('\n\n')
    .map((p) => (/^<(h\d|ul|p|hr)/.test(p.trim()) || !p.trim()) ? p : `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('\n');

  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(title || 'CV')}</title>
<style>
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; max-width: 720px; margin: 32px auto; padding: 0 24px; color: #222; line-height: 1.45; }
  h1 { font-size: 22pt; margin: 0 0 4pt; }
  h2 { font-size: 13pt; margin: 16pt 0 6pt; border-bottom: 1pt solid #ddd; padding-bottom: 2pt; }
  h3 { font-size: 11pt; margin: 12pt 0 4pt; }
  h4 { font-size: 10.5pt; margin: 8pt 0 2pt; }
  p, li { font-size: 10.5pt; }
  ul { margin: 4pt 0 8pt; padding-left: 18pt; }
  li { margin: 1pt 0; }
  strong { font-weight: 600; }
  em { font-style: italic; }
</style>
</head><body>${s}</body></html>`;
}

const BUFFERED = [
  { route: '/api/run/doctor',     script: 'doctor.mjs' },
  { route: '/api/run/verify',     script: 'verify-pipeline.mjs' },
  { route: '/api/run/normalize',  script: 'normalize-statuses.mjs' },
  { route: '/api/run/dedup',      script: 'dedup-tracker.mjs' },
  { route: '/api/run/merge',      script: 'merge-tracker.mjs' },
  { route: '/api/run/sync-check', script: 'cv-sync-check.mjs' },
  // v1.117.0 — sync pipeline.md "Pendientes" with batch-state.tsv
  { route: '/api/run/reconcile',  script: 'reconcile-pipeline.mjs' },
];

export function registerRunnerRoutes(app) {
  for (const def of BUFFERED) {
    app.post(def.route, async (_req, res) => {
      const result = await runNodeScript(def.script, [], { timeoutMs: 60_000 });
      res.json(result);
    });
  }

  // v1.12.0 — renamed from `/api/stream/scan` to `/api/stream/scan-parent`
  // so the namespace is free for the consolidated in-process scanner
  // (F-018 LITE) registered in `routes/scan.mjs`. The spawned
  // scan.mjs runner stays available for the kitchen-sink fallback.
  app.get('/api/stream/scan-parent', (req, res) => {
    const args = [];
    if (req.query.dryRun === '1') args.push('--dry-run');
    if (req.query.company) args.push('--company', String(req.query.company));
    streamNodeScript(res, 'scan.mjs', args);
  });

  app.get('/api/stream/liveness', (_req, res) => {
    streamNodeScript(res, 'check-liveness.mjs', []);
  });

  // `generate-pdf.mjs` requires positional <input.html> <output.pdf>.
  // Render the current cv.md to a temp HTML file under output/ and pass
  // its absolute path to the script along with a timestamped output
  // filename. Without this, the script printed its usage line and exited
  // with code 1 — silently no-op'ing the SPA's Generate PDF button.
  app.get('/api/stream/pdf', (req, res) => {
    if (!existsSync(PATHS.cv)) {
      // Stream a single error frame then close — don't emit a fake start
      // since we never invoke the script in this branch.
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'cv.md not found in project root' })}\n\n`);
      res.write(`event: done\ndata: ${JSON.stringify({ code: 2 })}\n\n`);
      return res.end();
    }
    mkdirSync(PATHS.outputDir, { recursive: true });
    const md = readFileSync(PATHS.cv, 'utf8');
    // Use the H1 (first non-empty heading) as the rendered <title>; fall
    // back to "CV" so the PDF metadata is always populated.
    const firstHeading = (md.match(/^#\s+(.+)$/m) || [, 'CV'])[1].trim();
    const html = cvMarkdownToHtml(md, firstHeading);
    const ts = new Date().toISOString().replace(/[^\dT]/g, '').slice(0, 15);
    const inputPath = projPath('output', `cv-input-${ts}.html`);
    const outputPath = projPath('output', `cv-${ts}.pdf`);
    writeFileSync(inputPath, html);
    const format = (req.query.format === 'letter') ? 'letter' : 'a4';
    streamNodeScript(res, 'generate-pdf.mjs', [inputPath, outputPath, `--format=${format}`]);
  });

  // ─── List + download generated PDFs (output/*.pdf) ───
  app.get('/api/output/pdfs', (_req, res) => {
    if (!existsSync(PATHS.outputDir)) return res.json({ files: [] });
    const files = readdirSync(PATHS.outputDir)
      .filter((f) => f.endsWith('.pdf'))
      .map((f) => {
        const stat = statSync(projPath('output', f));
        return { name: f, size: stat.size, mtime: stat.mtime };
      })
      .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    res.json({ files });
  });

  app.get('/api/output/pdfs/:name', (req, res) => {
    const safe = sanitizePathName(req.params.name);
    if (!safe || !safe.endsWith('.pdf')) return res.status(400).json({ error: 'invalid name' });
    const file = projPath('output', safe);
    if (!existsSync(file)) return res.status(404).json({ error: 'not found' });
    res.setHeader('Content-Type', 'application/pdf');
    // D-5 (v1.169.0) — default is a download (attachment, original filename).
    // `?inline=1` serves the SAME sanitized file with `Content-Disposition:
    // inline` so the browser renders it in a new tab for a review-before-send
    // PREVIEW (the docs stress "Review it before sending it anywhere"). No new
    // route, no new surface — same path validation.
    const inline = req.query.inline === '1' || req.query.disposition === 'inline';
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${safe}"`);
    res.sendFile(file);
  });

  // ─── F-015 — Generate PDF on surfaces beyond #/cv ───
  // Same wire pattern as /api/stream/pdf: render markdown → HTML → temp
  // file under output/ → spawn generate-pdf.mjs with positional args.
  // The shared helper below keeps the three new endpoints small.
  function streamPdfFor({ res, slug, markdown, title, format }) {
    if (!markdown || !markdown.trim()) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'empty markdown' })}\n\n`);
      res.write(`event: done\ndata: ${JSON.stringify({ code: 2 })}\n\n`);
      return res.end();
    }
    mkdirSync(PATHS.outputDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[^\dT]/g, '').slice(0, 15);
    // Sanitize slug for filename use: only word chars + hyphen. Cap the length
    // FIRST so the trailing-dash trim regex can't backtrack on a huge all-dash
    // input (polynomial ReDoS on an uncapped slug).
    const safeSlug = String(slug || 'doc').slice(0, 200).replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'doc';
    const inputPath = projPath('output', `${safeSlug}-input-${ts}.html`);
    const outputPath = projPath('output', `${safeSlug}-${ts}.pdf`);
    writeFileSync(inputPath, cvMarkdownToHtml(markdown, title || safeSlug));
    const fmt = (format === 'letter') ? 'letter' : 'a4';
    streamNodeScript(res, 'generate-pdf.mjs', [inputPath, outputPath, `--format=${fmt}`]);
  }

  // GET /api/stream/pdf/report?slug=<slug> — renders reports/<slug>.md
  app.get('/api/stream/pdf/report', (req, res) => {
    const slug = sanitizePathName(req.query.slug);
    if (!slug) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'slug required' }));
    }
    const file = projPath('reports', slug.endsWith('.md') ? slug : `${slug}.md`);
    if (!existsSync(file)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'report not found', slug }));
    }
    streamPdfFor({
      res,
      slug: `report-${slug.replace(/\.md$/, '')}`,
      markdown: readFileSync(file, 'utf8'),
      title: `Report: ${slug.replace(/\.md$/, '')}`,
      format: req.query.format,
    });
  });

  // GET /api/stream/pdf/deep?name=<name> — renders interview-prep/<name>
  app.get('/api/stream/pdf/deep', (req, res) => {
    const name = sanitizePathName(req.query.name);
    if (!name || !name.endsWith('.md')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'name required (must end with .md)' }));
    }
    const file = projPath('interview-prep', name);
    if (!existsSync(file)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'interview-prep file not found', name }));
    }
    streamPdfFor({
      res,
      slug: `deep-${name.replace(/\.md$/, '')}`,
      markdown: readFileSync(file, 'utf8'),
      title: `Deep research: ${name.replace(/\.md$/, '')}`,
      format: req.query.format,
    });
  });

  // POST /api/stream/pdf/inline { markdown, title?, slug? } — ad-hoc PDF
  // for unsaved content (e.g. /#/evaluate result before persisting). SSE
  // works through POST too: EventSource doesn't, but the SPA fetches with
  // ReadableStream parsing for this endpoint.
  app.post('/api/stream/pdf/inline', (req, res) => {
    const { markdown, title, slug, format } = req.body || {};
    if (!markdown || typeof markdown !== 'string') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'markdown required' }));
    }
    streamPdfFor({
      res,
      slug: slug || 'inline',
      markdown,
      title: title || 'Document',
      format,
    });
  });
}
