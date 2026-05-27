/**
 * career-ops web UI — Express server
 *
 * Serves the Airbnb-styled SPA from /public and exposes /api/* endpoints
 * that wrap the underlying career-ops Node scripts and data files.
 *
 * Run from the web-ui/ folder:
 *   node server/index.mjs
 *
 * Env:
 *   PORT       (default 4317)
 *   HOST       (default 127.0.0.1)
 *   GEMINI_API_KEY   forwarded to gemini-eval.mjs if present
 */
import express from 'express';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { PATHS, PROJECT_ROOT, PUBLIC_DIR } from './lib/paths.mjs';
import { activityMiddleware } from './lib/activity-log.mjs';
import { loadEnvFile } from './lib/dotenv.mjs';
import { isValidJobUrl, sanitizeJobDescription, stripDangerousMarkdown } from './lib/security.mjs';
import { ensureRussianPortalsDefaults } from './lib/store.mjs';
// Route modules — each exports `register<Topic>Routes(app)`.
import { registerActivityRoutes } from './lib/routes/activity.mjs';
import { registerConfigRoutes } from './lib/routes/config.mjs';
import { registerContentRoutes } from './lib/routes/content.mjs';
import { registerHealthRoutes } from './lib/routes/health.mjs';
import { registerHelpRoutes } from './lib/routes/help.mjs';
import { registerJdsRoutes } from './lib/routes/jds.mjs';
import { registerBatchRoutes } from './lib/routes/batch.mjs';
import { registerLlmRoutes } from './lib/routes/llm.mjs';
import { registerOpenrouterRoutes } from './lib/routes/openrouter.mjs';
import { registerAutoPipelineRoutes } from './lib/routes/auto-pipeline.mjs';
import { registerPipelineRoutes } from './lib/routes/pipeline.mjs';
import { registerReportsRoutes } from './lib/routes/reports.mjs';
import { registerRunnerRoutes } from './lib/routes/runners.mjs';
import { registerScanRoutes } from './lib/routes/scan.mjs';
import { registerTrackerRoutes } from './lib/routes/tracker.mjs';

// Re-exports preserved for backward compatibility — earlier tests
// (and any external consumers) imported these from server/index.mjs.
// New code should import from the lib/ modules directly.
export { isValidJobUrl, sanitizeJobDescription, stripDangerousMarkdown };

// Load parent's .env (GEMINI_API_KEY, ANTHROPIC_API_KEY, …) BEFORE createApp
// runs so health checks and scanner config see the real values.
loadEnvFile(PATHS.envFile);

export function createApp() {
  ensureRussianPortalsDefaults();
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(express.text({ limit: '5mb', type: ['text/plain', 'text/markdown'] }));

  // ──────────────── Security headers ────────────────
  // NEW-1 (v1.58.4) — CSP is now unconditional. Previously it was layered on
  // only when HOST exposed the server beyond loopback; the regression
  // (MASTER §5) flagged that `/` and `/api/health` returned NO CSP header
  // over loopback, leaving `UI.md()`'s escape-first contract as the sole XSS
  // defence. Defense-in-depth must not depend on the bind address — an XSS
  // escalation is just as fatal on 127.0.0.1. The directive set is unchanged
  // from the prior exposed-only policy (it was already SPA-correct):
  //   - Google Fonts CSS at fonts.googleapis.com (Inter, loaded in index.html)
  //   - Google Fonts WOFF2 at fonts.gstatic.com
  //   - inline style="..." attrs in router error template (style-src 'unsafe-inline')
  //   - inline favicon as data: URI (img-src 'self' data:)
  // 'unsafe-inline' is intentionally NOT in script-src — all event handlers
  // are addEventListener; 'unsafe-eval' is never granted.
  const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ');
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  // Activity log — records every state-changing request so the UI can show
  // a history page. Must come BEFORE express.static so the same middleware
  // covers both API and asset routes (asset GETs are filtered out).
  app.use(activityMiddleware);

  // W-001 (v1.54.7, regression run) — the SPA loads `api.js` /
  // `router.js` / views via plain `<script src>` with no version
  // query string, so after a deploy a browser could serve a cached
  // old bundle for hours → stale-cache 404s on query-string routes
  // (observed live during the v1.29.2 regression). No build step =
  // no content hashing, so the robust fix is to make the HTML +
  // code/style assets always-revalidate. Other static assets (fonts,
  // images, favicon) keep express.static's default caching.
  app.use(express.static(PUBLIC_DIR, {
    setHeaders: (res, filePath) => {
      if (/\.(?:js|mjs|css|html)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'no-store');
      }
    },
  }));

  // NEW-F1-sub-r1 (v1.59.10) — raw `../` path-traversal guard.
  // MUST run BEFORE any /api route handler. Express normalises
  // `req.url` (collapsing `..` segments) BEFORE matching routes,
  // so a raw `/api/jds/../../../etc/passwd` is rewritten to
  // `/etc/passwd` and falls through to the SPA static handler
  // (200 OK on `index.html`) rather than the JSON-404 fallback.
  // The v1.59.8 middleware was placed AFTER `app.all('/api/*')`,
  // which made it un-reachable for any request whose normalised
  // path no longer started with `/api`. This guard fires first,
  // inspects `req.originalUrl` (the verbatim request URL Express
  // has NOT yet normalised), and bounces any `/api`-prefixed raw
  // `../` traversal as JSON 404 `{error: 'invalid path'}`.
  //
  // Pattern: `/^\/api(\/|$)/.test` ensures the path starts with
  // `/api` followed by `/` or end-of-string (exact prefix, not
  // `/apiknown`). `/\.\.\//.test` requires a literal `../`
  // segment (not just `..` in a query string or anchor).
  app.use((req, res, next) => {
    if (/^\/api(\/|$)/.test(req.originalUrl) && /\.\.\//.test(req.originalUrl)) {
      return res.status(404).type('application/json').json({ error: 'invalid path' });
    }
    next();
  });

  // --- Route modules (P-2 phase 2 split) ---
  // Each topic lives in server/lib/routes/<topic>.mjs and exports
  // register<Topic>Routes(app). Order grouped by surface for readability.
  registerConfigRoutes(app);
  registerHelpRoutes(app);
  registerActivityRoutes(app);
  registerHealthRoutes(app);          // includes /api/dashboard
  registerTrackerRoutes(app);
  registerPipelineRoutes(app);        // includes /api/pipeline/preview
  registerReportsRoutes(app);
  registerJdsRoutes(app);
  registerContentRoutes(app);         // CV / Profile / Portals / Modes
  registerRunnerRoutes(app);          // buffered /api/run/* + streaming /api/stream/{scan,liveness,pdf} + /api/output/pdfs
  registerScanRoutes(app);            // in-process /api/stream/scan-{ru,en} + /api/scan-results
  registerBatchRoutes(app);           // v1.13.0 — /api/batch + /api/stream/batch + /api/batch/merge
  registerLlmRoutes(app);             // /api/evaluate, /api/deep, /api/mode/:slug, /api/apply-helper, /api/interview-prep
  registerOpenrouterRoutes(app);      // v1.57.0 — GET /api/openrouter/models (model catalogue proxy)
  registerAutoPipelineRoutes(app);    // v1.16.0 — server-side SSE auto-pipeline (G-007 follow-up)
  // ───────────────────────────── Catch-all → SPA ─────────────────────────────

  // NEW-F1 (v1.59.5) — the previous `app.get('/api/*', …)` was GET-only,
  // so a POST/PUT/DELETE to an unknown /api/* path fell through to the
  // SPA catch-all and returned HTML 404 — breaking the SPA's
  // `try { res.json() } catch {}` clients. `app.all` ensures every
  // verb gets the JSON `{error: 'unknown api'}` response. Sandbox /
  // SSRF / DOC-1 (English-by-policy) all preserved.
  app.all('/api/*', (_req, res) => res.status(404).json({ error: 'unknown api' }));

  // NEW-F1-sub (v1.59.8) MIDDLEWARE MOVED — v1.59.10 hoisted the
  // `req.originalUrl` `..` guard up above all route registrations so
  // it actually fires before Express's path normalisation. See the
  // top of createApp() for the new placement. The late-placed copy
  // here was never reached on un-encoded `..` because Express had
  // already rewritten the URL to a non-`/api` path by then.
  app.get('*', (_req, res) => {
    // W-001 — the SPA shell must always revalidate (it references the
    // un-hashed code assets); sendFile bypasses the static setHeaders.
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile('index.html', { root: PUBLIC_DIR });
  });

  // ─────────── Global error handler (F-019) ───────────
  // Express's body parsers (express.json / express.raw / multer-like) throw
  // PayloadTooLargeError / SyntaxError outside of any route handler. Without
  // this middleware they bubble to the default handler, which returns an
  // HTML stack trace — useless to the SPA's `try { res.json() } catch {}`
  // path. We convert the well-known cases to JSON so the SPA can show a
  // localized toast (`payload too large`, `malformed body`, etc.). Must be
  // the LAST middleware so it catches errors from every route + parser.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (res.headersSent) return res.end();
    // Body parser limits (express.json / express.raw / express.text):
    if (err && (err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE')) {
      return res.status(413).json({
        error: 'request body too large',
        limit: err.limit,
        length: err.length,
      });
    }
    // Malformed JSON / multipart:
    if (err && (err.type === 'entity.parse.failed' || err.type === 'charset.unsupported')) {
      return res.status(400).json({ error: 'malformed request body' });
    }
    // SyntaxError from a manual JSON.parse leaking out:
    if (err instanceof SyntaxError && 'body' in (err || {})) {
      return res.status(400).json({ error: 'malformed JSON body' });
    }
    // Last resort — log server-side, return a sanitized 500 to the client.
    // We don't leak err.message in case it contains a stack trace, query
    // strings with tokens, etc.
    // eslint-disable-next-line no-console
    console.error('[unhandled]', err);
    return res.status(500).json({ error: 'internal server error' });
  });

  return app;
}

// ───────────────────────────── boot ─────────────────────────────

// v1.22.0 (L-3) — Windows-safe entrypoint check. The string-template
// `file://${argv[1]}` form mishandles drive letters and backslashes on
// Windows. fileURLToPath + path.resolve normalize both sides.
const isMain = fileURLToPath(import.meta.url) === resolve(process.argv[1] || '');
if (isMain) {
  const port = parseInt(process.env.PORT || '4317', 10);
  const host = process.env.HOST || '127.0.0.1';
  const app = createApp();
  app.listen(port, host, () => {
    console.log('');
    console.log('  🛫  career-ops web UI');
    console.log(`     http://${host}:${port}`);
    console.log(`     project: ${PROJECT_ROOT}`);
    console.log('');
  });
}
