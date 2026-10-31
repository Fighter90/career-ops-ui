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
import { existsSync, readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, unlink } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { PATHS, PROJECT_ROOT, path as projPath } from '../paths.mjs';
import { runTrackedScript, streamNodeScript } from '../runner.mjs';
import { withFileLock } from '../file-lock.mjs';
import { sanitizePathName } from '../security.mjs';
import { writeRateLimit } from '../rate-limit.mjs';
import { parseJsonStdout, sanitizeDetail } from '../parent-relay.mjs';

/** True if `s` carries a C0 control char or DEL — spawn throws on NUL. */
function hasControlChar(s) {
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Spawn generate-pdf.mjs for an HTML file already rendered under output/.
 * `--format` is passed only when the client asked for one, so the profile's
 * page_format stays the default. Non-CV documents (reports, deep research,
 * ad-hoc markdown) skip the parent's CV fact check — it compares numbers
 * against cv.md and would block any report quoting a salary or a date. The
 * temp input HTML is removed once the stream closes (done or disconnect).
 */
function streamGeneratePdf(res, { slug, html, format, skipFactCheck }) {
  mkdirSync(PATHS.outputDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[^\dT]/g, '').slice(0, 15);
  const rand = randomBytes(3).toString('hex');
  // Unique per request: two same-second requests must not share an input.
  const inputPath = projPath('output', `${slug}-input-${ts}-${rand}.html`);
  let outputPath = projPath('output', `${slug}-${ts}.pdf`);
  if (existsSync(outputPath)) outputPath = projPath('output', `${slug}-${ts}-${rand}.pdf`);
  writeFileSync(inputPath, html);
  res.on('close', () => unlink(inputPath, () => {}));
  const args = [inputPath, outputPath];
  if (format === 'letter' || format === 'a4') args.push(`--format=${format}`);
  if (skipFactCheck) args.push('--skip-fact-check');
  streamNodeScript(res, 'generate-pdf.mjs', args);
}

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

/**
 * The jds/ capture belonging to report `num`, newest first when several
 * files share the number (collision suffixes -2, -3). Mirrors the parent
 * jd-capture.mjs prefix rule: padded and unpadded prefixes both resolve
 * (`064-`, `64-`), and matching compares the parsed integer, so report 64
 * never picks up report 640's capture. `statFn` is injectable for the
 * TOCTOU test. L262-R4 — a capture removed between the readdir and its
 * stat must not throw the route a 500: vanished files are skipped.
 * @param {string} jdsDir
 * @param {number|string} num
 * @param {(p: string) => { mtimeMs: number }} [statFn]
 * @returns {string|null}
 */
export function findCaptureByReport(jdsDir, num, statFn = statSync) {
  if (!existsSync(jdsDir)) return null;
  const wanted = String(num);
  const matches = readdirSync(jdsDir)
    .filter((f) => {
      const m = f.match(/^(\d+)-/);
      return m && String(parseInt(m[1], 10)) === wanted;
    })
    .map((f) => {
      try {
        return { f, mtime: statFn(resolve(jdsDir, f)).mtimeMs };
      } catch {
        return null; // vanished between the readdir and this stat — skip
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);
  return matches.length ? matches[0].f : null;
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
  // CAR-40 — bare GET /api/runners is a small self-description: the
  // buffered action index, derived from the BUFFERED registry above so
  // the two can never drift. Without it the bare path fell through to
  // the catch-all `app.all('/api/*')` and answered the misleading
  // {"error":"unknown api"} even though the surface exists and serves
  // real sub-paths.
  app.get('/api/runners', (_req, res) => {
    res.json({
      actions: BUFFERED.map((def) => ({
        name: def.route.replace('/api/run/', ''),
        method: 'POST',
        route: def.route,
      })),
    });
  });

  for (const def of BUFFERED) {
    app.post(def.route, async (_req, res) => {
      // FULL-M1 — merge/dedup/normalize are in TRACKER_MUTATING (they
      // rewrite data/applications.md): the spawn holds the tracker file
      // lock so it serializes with web-ui's own tracker writers. Read-only
      // runners (doctor/verify/sync-check/reconcile) pass through unwrapped.
      const result = await runTrackedScript(def.script, [], { timeoutMs: 60_000 });
      // stderr of a crashed script carries absolute-path stack frames.
      res.json({ ...result, stderr: result.stderr ? sanitizeDetail(result.stderr) : '' });
    });
  }

  // v1.12.0 — renamed from `/api/stream/scan` to `/api/stream/scan-parent`
  // so the namespace is free for the consolidated in-process scanner
  // (F-018 LITE) registered in `routes/scan.mjs`. The spawned
  // scan.mjs runner stays available for the kitchen-sink fallback.
  app.get('/api/stream/scan-parent', (req, res) => {
    const args = [];
    if (req.query.dryRun === '1') args.push('--dry-run');
    if (req.query.company) {
      const company = String(req.query.company);
      if (hasControlChar(company)) return res.status(400).json({ error: 'invalid company' });
      args.push('--company', company);
    }
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
    const md = readFileSync(PATHS.cv, 'utf8');
    // Use the H1 (first non-empty heading) as the rendered <title>; fall
    // back to "CV" so the PDF metadata is always populated.
    const firstHeading = (md.match(/^#\s+(.+)$/m) || [, 'CV'])[1].trim();
    const html = cvMarkdownToHtml(md, firstHeading);
    // The CV keeps the parent's fact check — it is exactly what it guards.
    streamGeneratePdf(res, { slug: 'cv', html, format: req.query.format, skipFactCheck: false });
  });

  // ─── CAR-182 — zero-token JD integrity gate (parent posting-guard.mjs) ───
  // Deterministic, read-only: `{ report }` resolves the report's jds/ capture
  // or `{ jdPath }` names one directly, then the route relays
  // `node posting-guard.mjs --in jds/<name> --json`. Both reach the child only
  // as argv array elements (never shell-interpolated); jdPath is
  // sanitizePathName'd first. Fail-soft {available:false} without the script
  // (CI / standalone installs).

  /**
   * The jds/ capture belonging to report `num` — the shared helper above
   * (L262-R4: a capture stat-failing ENOENT between the readdir and its
   * stat is skipped, never a 500).
   */
  const findCapture = (num) => findCaptureByReport(PATHS.jdsDir, num);

  app.post('/api/runners/posting-guard', async (req, res) => {
    const { report, jdPath } = req.body || {};
    const hasReport = report != null && report !== '';
    const hasPath = jdPath != null && jdPath !== '';
    if (!hasReport && !hasPath) return res.status(400).json({ error: 'report or jdPath required' });
    if (hasReport && hasPath) return res.status(400).json({ error: 'pass report or jdPath, not both' });

    let name = null;
    if (hasPath) {
      if (typeof jdPath !== 'string') return res.status(400).json({ error: 'jdPath must be a string' });
      name = sanitizePathName(jdPath);
      if (!name) return res.status(400).json({ error: 'invalid jdPath' });
    } else {
      if (typeof report !== 'number' && typeof report !== 'string') {
        return res.status(400).json({ error: 'report must be a number' });
      }
      const n = Number(report);
      if (!Number.isInteger(n) || n < 1 || n > 999_999) {
        return res.status(400).json({ error: 'report must be a positive integer' });
      }
      name = findCapture(n);
      if (!name) return res.status(404).json({ error: 'no jds/ capture for report', report: n });
    }

    if (!existsSync(projPath('jds', name))) {
      return res.status(404).json({ error: 'jd not found', file: `jds/${name}` });
    }

    const script = 'posting-guard.mjs';
    if (!existsSync(resolve(PROJECT_ROOT, script))) {
      return res.json({ available: false, reason: 'script-not-found' });
    }
    const r = await runTrackedScript(script, ['--in', `jds/${name}`, '--json'], { timeoutMs: 30_000 });
    const findings = parseJsonStdout(r.stdout);
    if (r.code !== 0 || !findings || typeof findings.verdict !== 'string') {
      return res.json({
        available: false,
        reason: r.killed ? 'timeout' : 'script-error',
        ...(r.stderr ? { detail: sanitizeDetail(r.stderr) } : {}),
      });
    }
    res.json({ available: true, file: `jds/${name}`, findings });
  });

  // ─── Report-links runner (v1.246.0 backlog #4, parent #4751) ───
  // Zero-LLM relay of the parent's canonical tracker repair:
  //   node fix-report-links.mjs --dry-run   (default — read-only preview)
  //   node fix-report-links.mjs             (apply — rewrite dead Report cells)
  // `{ mode: 'dry-run' | 'apply' }`, dry-run when omitted. The parent emits
  // PLAIN TEXT (no --json flag today), so an exit-0 run passes the text
  // through as `output` plus a light parse (rows / summary); a JSON stdout
  // (if the parent ever gains one) passes through structurally. A non-zero
  // exit or a missing script is a fail-soft 502. apply rewrites
  // data/applications.md, so the spawn holds the tracker lock
  // (withFileLock) — the same chain web-ui's own tracker writers use;
  // fix-report-links.mjs takes the parent's own OS-level transaction lock
  // on top. NOTE: the script is deliberately NOT in TRACKER_MUTATING —
  // the lock here would nest with a registry-driven one and deadlock the
  // non-reentrant mutex. Dry-run is read-only and takes no lock.
  const REPORT_LINKS = { script: 'fix-report-links.mjs', timeoutMs: 45_000 };

  // writeRateLimit (CodeQL #705) — the relay spawns a subprocess per call
  // (apply rewrites data/applications.md), so a runaway client loop must
  // hit the unconditional 60/min guard, not the parent's repair script.
  app.post('/api/runners/report-links', writeRateLimit, async (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    // Absent (undefined) means the default; an explicit null or any other
    // value is garbage and must be a 400, never a silent dry-run.
    const mode = body.mode === undefined ? 'dry-run' : body.mode;
    if (mode !== 'dry-run' && mode !== 'apply') {
      return res.status(400).json({ error: "mode must be 'dry-run' or 'apply'" });
    }
    if (!existsSync(resolve(PROJECT_ROOT, REPORT_LINKS.script))) {
      return res.status(502).json({ error: `${REPORT_LINKS.script} not found in the parent project` });
    }
    // Flag as an argv array element — never shell-interpolated.
    const args = mode === 'apply' ? [] : ['--dry-run'];
    const run = () => runTrackedScript(REPORT_LINKS.script, args, { timeoutMs: REPORT_LINKS.timeoutMs });
    const r = mode === 'apply' ? await withFileLock(PATHS.applications, run) : await run();

    const finish = (payload) => res.json({ mode, ...payload });
    if (r.code !== 0) {
      const data = parseJsonStdout(r.stdout);
      return res.status(502).json({
        mode,
        error: (data && data.error) || `${REPORT_LINKS.script} failed`,
        code: r.killed ? 'timeout' : 'script-error',
        ...(r.stdout ? { output: r.stdout } : {}),
        detail: r.stderr ? sanitizeDetail(r.stderr) : '',
      });
    }
    // JSON stdout (a future parent contract) passes through structurally.
    const data = parseJsonStdout(r.stdout);
    if (data) return finish(data);

    // Plain-text stdout (today's parent contract): pass the text through
    // and lift the stable lines into rows/summary for the client.
    const rows = [];
    const rowRe = /^(?:Would rewrite|Rewrote)\s+#(\d+)\s+(.*)$/gm;
    let m;
    while ((m = rowRe.exec(r.stdout)) !== null) rows.push({ num: Number(m[1]), detail: m[2].trim() });
    const countMatch = r.stdout.match(/(\d+)\s+dead report link/);
    finish({
      code: 0,
      output: r.stdout,
      rows,
      summary: {
        count: countMatch ? Number(countMatch[1]) : null,
        dryRun: /\(dry-run\b/.test(r.stdout),
      },
    });
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
    // Sanitize slug for filename use: only word chars + hyphen. Cap the length
    // FIRST so the trailing-dash trim regex can't backtrack on a huge all-dash
    // input (polynomial ReDoS on an uncapped slug).
    const safeSlug = String(slug || 'doc').slice(0, 200).replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'doc';
    streamGeneratePdf(res, {
      slug: safeSlug,
      html: cvMarkdownToHtml(markdown, title || safeSlug),
      format,
      skipFactCheck: true,
    });
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
