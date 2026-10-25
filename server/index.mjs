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
import { resolve, dirname } from 'node:path';
import { readFileSync, statSync, createReadStream, openSync, closeSync, fstatSync, readSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PATHS, PROJECT_ROOT, PUBLIC_DIR, WEB_UI_ROOT } from './lib/paths.mjs';
import { rewriteIndexHtml, BUNDLE_SRC } from '../scripts/make-bundle.mjs';
import { activityMiddleware } from './lib/activity-log.mjs';
import { loadEnvFile } from './lib/dotenv.mjs';
import { isValidJobUrl, sanitizeJobDescription, stripDangerousMarkdown } from './lib/security.mjs';
import { ensureRussianPortalsDefaults } from './lib/store.mjs';
// Route modules — each exports `register<Topic>Routes(app)`.
import { registerActivityRoutes } from './lib/routes/activity.mjs';
import { registerConfigRoutes } from './lib/routes/config.mjs';
import { registerContentRoutes } from './lib/routes/content.mjs';
import { registerTwoPagerRoutes } from './lib/routes/two-pager.mjs';
import { registerInterviewRoutes } from './lib/routes/interview.mjs';
import { registerNetworkingRoutes } from './lib/routes/networking.mjs';
import { registerCvStudioRoutes } from './lib/routes/cv-studio.mjs';
import { registerMemoryRoutes } from './lib/routes/memory.mjs';
import { registerCareerPlanRoutes } from './lib/routes/career-plan.mjs';
import { registerOrientationRoutes } from './lib/routes/orientation.mjs';
import { registerHealthRoutes } from './lib/routes/health.mjs';
import { registerHelpRoutes } from './lib/routes/help.mjs';
import { registerJdsRoutes } from './lib/routes/jds.mjs';
import { registerBatchRoutes } from './lib/routes/batch.mjs';
import { registerLlmRoutes } from './lib/routes/llm.mjs';
import { registerOpenrouterRoutes } from './lib/routes/openrouter.mjs';
import { registerAutoPipelineRoutes } from './lib/routes/auto-pipeline.mjs';
import { registerPortalsRoutes } from './lib/routes/portals.mjs';
import { registerDiscoverAtsRoutes } from './lib/routes/discover-ats.mjs';
import { registerExportRoutes } from './lib/routes/export.mjs';
import { registerDocsAssistantRoutes } from './lib/routes/docs-assistant.mjs';
import { registerCliDetectRoutes } from './lib/routes/cli-detect.mjs';
import { registerLogoRoutes } from './lib/routes/logos.mjs';
import { registerUsageRoutes } from './lib/routes/usage.mjs';
import { registerFollowupRoutes } from './lib/routes/followup.mjs';
import { registerAssessmentsRoutes } from './lib/routes/assessments.mjs';
import { registerOutcomeRoutes } from './lib/routes/outcome.mjs';
import { registerFundedRoutes } from './lib/routes/funded.mjs';
import { registerLivenessRoutes } from './lib/routes/liveness.mjs';
import { registerPipelineRoutes } from './lib/routes/pipeline.mjs';
import { registerReportsRoutes } from './lib/routes/reports.mjs';
import { registerRunnerRoutes } from './lib/routes/runners.mjs';
import { registerScanRoutes } from './lib/routes/scan.mjs';
import { registerStatsRoutes } from './lib/routes/stats.mjs';
import { registerMarketRoutes } from './lib/routes/market.mjs';
import { registerTrackerRoutes } from './lib/routes/tracker.mjs';
import { registerCvSyncRoutes } from './lib/routes/cv-sync.mjs';
import { registerGeocodeRoutes } from './lib/routes/geocode.mjs';
import { registerMapRoutes, tileConfig } from './lib/routes/map.mjs';
import { listen } from './lib/http-timeouts.mjs';
import { requestGuard } from './lib/request-guard.mjs';
import { installAsyncRouteSafety } from './lib/async-safety.mjs';
import { createRequire } from 'node:module';

// A missing Leaflet must only break the map view, never the server boot.
const LEAFLET_DIST = (() => {
  try { return dirname(createRequire(import.meta.url).resolve('leaflet/dist/leaflet.js')); }
  catch { return resolve(WEB_UI_ROOT, 'node_modules', 'leaflet', 'dist'); }
})();

// Re-exports preserved for backward compatibility — earlier tests
// (and any external consumers) imported these from server/index.mjs.
// New code should import from the lib/ modules directly.
export { isValidJobUrl, sanitizeJobDescription, stripDangerousMarkdown };

// Load parent's .env (GEMINI_API_KEY, ANTHROPIC_API_KEY, …) BEFORE createApp
// runs so health checks and scanner config see the real values.
loadEnvFile(PATHS.envFile);

/**
 * CAR-145 — the cache-busting ?v= value the shell cites for the bundle URL.
 * The bundle's UN-versioned URL is `public, max-age=300, must-revalidate`
 * (CAR-104): without a versioned URL a deploy could serve a NEW no-store
 * shell against a CACHED OLD bundle for up to 5 minutes. A short content
 * hash of the identity bundle makes the versioned URL content-addressed (a
 * matched ?v= may cache immutably); the negotiation middleware matches on
 * the pathname, so the versioned URL reuses the same ETag/negotiation path.
 *
 * Provenance matters (CAR-145 r3): a hash derived from the STAT fallback —
 * the file unreadable during a rebuild race — must never be cached, or the
 * shell and the negotiation middleware can disagree on what ?v= means for a
 * whole deploy (every cold load then gets no-store on ~3 MB). Callers use
 * bundleContentHash() to tell the two apart and cache only content hashes.
 * A null stat yields null so the shell omits ?v= entirely (r3, finding 6);
 * the fallback itself is a sha256 of the stat identity — 12 hex, never a
 * fractional token (r2, finding 2).
 */

/** The bundle's content hash, or null when the bytes cannot be read. */
export function bundleContentHash(bundlePath) {
  try {
    return createHash('sha256').update(readFileSync(bundlePath)).digest('hex').slice(0, 12);
  } catch {
    return null;
  }
}

/**
 * Content hash straight from an OPEN fd — positioned reads, no path lookup.
 * The hash belongs to the inode the fd points at, so a rename-based build
 * swapping the file under the path mid-flight cannot change the verdict
 * (r3, finding 3). Null when a read fails (never cached by callers).
 */
export function bundleContentHashFromFd(fd, size) {
  try {
    const buf = Buffer.alloc(size);
    let read = 0;
    while (read < size) {
      const n = readSync(fd, buf, read, size - read, read);
      if (n <= 0) break;
      read += n;
    }
    return createHash('sha256').update(buf.subarray(0, read)).digest('hex').slice(0, 12);
  } catch {
    return null;
  }
}

/** Stat-identity fallback hash — 12 hex, deterministic per stat. */
function statVersionHash(st) {
  return createHash('sha256')
    .update(`${st.size}:${st.mtimeMs}:${st.ino}`)
    .digest('hex')
    .slice(0, 12);
}

/** The ?v= for the shell: content hash, stat fallback — or null (no ?v=). */
export function bundleVersionOf(bundlePath, st) {
  if (!st) return null;
  return bundleContentHash(bundlePath) ?? statVersionHash(st);
}

// ──────────────── CAR-85 — release-time SPA bundle ────────────────
// Prod cold load fetched ~89 classic <script src> tags 6-at-a-time over
// HTTP/1.1 (~30 s). scripts/make-bundle.mjs (run by the deploy) concatenates
// the body scripts into public/js/bundle.js; this middleware swaps the
// individual tags for ONE bundle tag on GET /. Dev stays untouched: with no
// bundle file on disk (or NO_BUNDLE=1) it passes straight through to
// express.static and the shell keeps its individual tags. Only "/" is
// rewritten — the SPA is hash-routed, so "/" is the cold-load path; the
// rare SPA fallback further down keeps serving the original shell.
// CSP-safe by construction: same files, same order, one classic script.
export function bundleHtmlMiddleware({ publicDir }) {
  const disabled = process.env.NO_BUNDLE === '1';
  const indexHtmlPath = resolve(publicDir, 'index.html');
  const bundlePath = resolve(publicDir, 'js', 'bundle.js');
  // Cached rewritten shell, re-derived when either file changes on disk
  // (a dev rebuilding the bundle picks up without a server restart).
  // html === null means "nothing to rewrite" — pass through.
  let cache = null;
  return function bundleHtml(req, res, next) {
    if (disabled || req.method !== 'GET' || req.path !== '/' || !req.accepts('html')) return next();
    let key;
    let bundleStat;
    try {
      const st = statSync(indexHtmlPath);
      const sb = statSync(bundlePath);
      bundleStat = sb;
      // CAR-145 r2 — size+mtimeMs alone miss the rsync -p / cp -p shape (same
      // bytes length, mtime preserved by the copy): the cached shell would keep
      // citing the OLD ?v= hash — the exact skew CAR-145 closes. ino/ctimeMs
      // cannot survive a content rewrite (ctime bumps on any write; a
      // rename-based build replaces the inode).
      key = `${st.size}:${st.mtimeMs}:${sb.size}:${sb.mtimeMs}:${sb.ino}:${sb.ctimeMs}`;
    } catch {
      return next(); // no shell or no bundle → individual scripts
    }
    if (!cache || cache.key !== key) {
      try {
        // CAR-145 — reference the bundle with a content-hash query so the
        // long-cache bundle URL changes on every rebuild: a fresh (no-store)
        // shell can then never point at a cached OLD bundle after a deploy.
        // CAR-145 r3 (finding 1) — only a successfully READ content hash may
        // be pinned into the cache; a stat-fallback shell is served once,
        // uncached, so the next request re-reads and the two middlewares
        // agree on what ?v= means.
        const contentHash = bundleContentHash(bundlePath);
        const version = contentHash ?? statVersionHash(bundleStat);
        const versionedSrc = version ? `${BUNDLE_SRC}?v=${version}` : BUNDLE_SRC;
        const rewritten = rewriteIndexHtml(readFileSync(indexHtmlPath, 'utf8'), versionedSrc);
        const html = rewritten ? rewritten.html : null;
        if (!contentHash) {
          if (!html) return next();
          res.setHeader('Cache-Control', 'no-store');
          res.type('html').send(html);
          return;
        }
        cache = { key, html };
      } catch (err) {
        console.warn(`[bundle] shell rewrite failed, serving individual scripts: ${err.message}`);
        cache = { key, html: null };
      }
    }
    if (!cache.html) return next();
    // W-001 — the shell references un-hashed code assets, so it must
    // always-revalidate (same policy express.static applies to HTML).
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(cache.html);
  };
}

// ──────────────── CAR-104 — precompressed bundle, served negotiated ────────────────
// scripts/make-bundle.mjs writes bundle.js.br (brotli, max quality) and
// bundle.js.gz (gzip 9) next to public/js/bundle.js at release time. The
// ~3.1 MB identity file shipped UNCOMPRESSED and with Cache-Control: no-store,
// so every cold visit re-paid the full transfer (~5.9 s on prod).
//
// This middleware owns GET/HEAD /js/bundle.js:
//   - br preferred over gz, per the client's Accept-Encoding (an absent
//     header means identity);
//   - Content-Encoding + Vary: Accept-Encoding + exact Content-Length;
//   - a weak ETag derived from the identity file — shared by every variant,
//     so revalidation (If-None-Match → 304) stays cheap after max-age;
//   - the cache policy is decided by the ?v= the request presents
//     (CAR-145/CAR-145 r2): the SHELL cites /js/bundle.js?v=<content-hash>
//     (bundleHtmlMiddleware), so the URL changes on every rebuild and a fresh
//     shell can never pair with a cached OLD bundle.
//       ?v= absent        → public, max-age=300, must-revalidate (the
//                           bounded revalidating window; the pre-CAR-145 shape)
//       ?v= current hash  → public, max-age=31536000, immutable (content-
//                           addressed: the hash is the correctness guarantee)
//       ?v= anything else → no-store (a rolling deploy's old instance could
//                           otherwise pin NEW-URL→OLD-bytes into a shared
//                           cache; the bytes still ship, uncacheable)
//     Individual scripts keep express.static's no-store (the setHeaders on
//     the static mount below). Matching is on the PATHNAME (req.path is
//     query-free), so versioned URLs share this response path and the
//     direct-artifact 404 rule holds for them too.
// Guard rails: a companion is used only when it exists, is non-empty, and is
// at least as new as the identity bundle — an interrupted build or the
// deploy's rollback path can leave stale artifacts on disk and they are
// never served (identity falls back). The artifacts themselves are an
// internal representation: a direct fetch of /js/bundle.js.br|gz is a 404.
// No bundle file at all → express.static exactly as before (dev).
const BUNDLE_ROUTE = '/js/bundle.js';
const BUNDLE_VARIANTS = [
  { enc: 'br', ext: '.br' },
  { enc: 'gzip', ext: '.gz' },
];
const BUNDLE_CONTENT_TYPE = 'application/javascript; charset=UTF-8';
const BUNDLE_CACHE_CONTROL = 'public, max-age=300, must-revalidate';
// CAR-145 r2 — a ?v= that MATCHES the current hash is content-addressed: the
// hash IS the correctness guarantee, so the URL may cache for a year.
const BUNDLE_CACHE_CONTROL_IMMUTABLE = 'public, max-age=31536000, immutable';

/** Weak ETag wrapper — the payload is the CONTENT hash (CAR-145 r3, finding 2:
 * a size+mtime ETag 304s straight through an identical-stat rebuild). */
function bundleETag(hash) {
  return `W/"${hash}"`;
}

/** If-None-Match comparison — weak by RFC 7232 (W/ prefixes fold away). */
function ifNoneMatchSatisfied(header, etag) {
  if (!header) return false;
  const bare = etag.replace(/^W\//, '');
  return header.split(',').some((candidate) => candidate.trim().replace(/^W\//, '') === bare)
    || header.trim() === '*';
}

export function bundleCompressionMiddleware({ publicDir }) {
  const identityPath = resolve(publicDir, 'js', 'bundle.js');
  const variants = BUNDLE_VARIANTS.map((v) => ({ ...v, path: `${identityPath}${v.ext}` }));
  // CAR-145 r3 (finding 1) — the cache holds ONLY content hashes. A stat-
  // fallback hash (unreadable during a rebuild race) is returned uncached, so
  // the next request re-reads instead of pinning a version the shell will
  // never cite.
  let hashCache = null;
  return function bundleCompression(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path !== BUNDLE_ROUTE) {
      // The precompressed artifacts exist ONLY behind content negotiation.
      if (req.path === `${BUNDLE_ROUTE}.br` || req.path === `${BUNDLE_ROUTE}.gz`) {
        return res.status(404).type('text').send('Not Found');
      }
      return next();
    }
    // CAR-145 r3 (finding 3) — ONE open drives the whole decision: fstat the
    // fd, hash from the fd, and (for identity) stream from the SAME fd, so
    // the ?v= verdict can never belong to a different file than the bytes
    // served (rename-based builds swap the inode under the path mid-request;
    // stat-then-reopen would earn immutable for foreign bytes).
    let fd;
    try {
      fd = openSync(identityPath, 'r');
    } catch {
      return next(); // no bundle on disk → dev / rolled-back deploy
    }
    let st;
    try {
      st = fstatSync(fd);
    } catch {
      closeSync(fd);
      return next();
    }
    const statKey = `${st.size}:${st.mtimeMs}:${st.ino}:${st.ctimeMs}`;
    let hash = hashCache && hashCache.key === statKey ? hashCache.hash : null;
    if (hash == null) {
      const contentHash = bundleContentHashFromFd(fd, st.size);
      if (contentHash) {
        hashCache = { key: statKey, hash: contentHash };
        hash = contentHash;
      } else {
        hash = statVersionHash(st); // uncached fallback — re-read next request
      }
    }
    // CAR-145 r2/r3 — the presented ?v= decides the cache policy:
    //   - absent          → `public, max-age=300, must-revalidate` (the
    //                       bounded revalidating window; the pre-CAR-145 URL
    //                       shape keeps its cheap revalidation contract)
    //   - current hash    → `public, max-age=31536000, immutable` — the URL is
    //                       content-addressed, so a match can never go stale;
    //                       correctness comes from the hash, not the window
    //   - anything else   → `no-store`: during a rolling deploy an old
    //                       instance can still hold the OLD bytes under a NEW
    //                       ?v=; a cacheable answer would pin NEW-URL→
    //                       OLD-bytes into a shared cache for max-age (cache
    //                       poisoning that would defeat the buster). The bytes
    //                       are still served — just uncacheable. (Chosen over
    //                       a redirect so browsers mid-reload keep working.)
    const presented = new URL(req.url, 'http://localhost').searchParams.get('v');
    const etag = bundleETag(hash);
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('ETag', etag);
    if (presented === null) {
      res.setHeader('Cache-Control', BUNDLE_CACHE_CONTROL);
    } else if (presented === hash) {
      res.setHeader('Cache-Control', BUNDLE_CACHE_CONTROL_IMMUTABLE);
    } else {
      res.setHeader('Cache-Control', 'no-store');
    }
    if (ifNoneMatchSatisfied(req.headers['if-none-match'], etag)) {
      closeSync(fd);
      return res.status(304).end();
    }
    const accept = req.headers['accept-encoding'];
    const negotiable = typeof accept === 'string' && accept.length > 0;
    let chosen = null;
    if (negotiable) {
      const identityMs = st.mtime.getTime();
      for (const v of variants) {
        if (!req.acceptsEncodings(v.enc)) continue;
        try {
          const vs = statSync(v.path);
          // Same-build freshness: an older companion is a stale artifact.
          if (vs.size > 0 && vs.mtime.getTime() >= identityMs) {
            chosen = { path: v.path, enc: v.enc, size: vs.size };
            break;
          }
        } catch { /* companion absent (dev build) — try the next encoding */ }
      }
    }
    res.setHeader('Content-Type', BUNDLE_CONTENT_TYPE);
    if (chosen) res.setHeader('Content-Encoding', chosen.enc);
    res.setHeader('Content-Length', String(chosen ? chosen.size : st.size));
    if (req.method === 'HEAD') {
      closeSync(fd);
      return res.end();
    }
    if (chosen) {
      closeSync(fd); // the identity fd is not the file being streamed
      const stream = createReadStream(chosen.path);
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      return stream.pipe(res);
    }
    if (st.size === 0) {
      closeSync(fd);
      return res.end();
    }
    // Identity: stream the hashed fd itself — positioned reads from offset 0,
    // autoClose releases the fd at end/error/destroy.
    const stream = createReadStream(null, { fd, autoClose: true, start: 0, end: st.size - 1 });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  };
}

export function createApp() {
  ensureRussianPortalsDefaults();
  // Express 4 ignores a rejected promise from an async handler; without this a
  // malformed body in any of them exits the whole process (see async-safety.mjs).
  installAsyncRouteSafety();
  const app = express();
  app.disable('x-powered-by'); // don't advertise the framework (issue #29 / v1.69.5 API hygiene)
  // First middleware: Host allowlist (DNS rebinding) + same-origin check (CSRF)
  // — the loopback bind is the only access control this server has (request-guard.mjs).
  app.use(requestGuard({ bindHost: process.env.HOST, allowedHosts: process.env.ALLOWED_HOSTS }));
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
  // CAR-57 (v1.247.0) — img-src carries BOTH tile hosts: the light basemap
  // (OpenStreetMap, or MAP_TILE_URL's origin) and CARTO's dark-matter tiles
  // the client swaps in under dark themes. Attribution renders as an anchor,
  // so carto.com needs no img-src entry. This widening is the single
  // sanctioned CSP change of the design-tail pass — no other directive moves.
  const TILE_CSP_ORIGINS = `${tileConfig().origin} ${tileConfig().darkOrigin}`;
  const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com",
    // Raster tiles for the #/map view (light + dark basemaps).
    `img-src 'self' data: ${TILE_CSP_ORIGINS}`,
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
  // Leaflet for #/map, served from node_modules so script-src stays 'self'.
  // Resolve Leaflet through Node's resolver, not a fixed path: in an `npm i` /
  // `npx` install npm hoists it into the parent node_modules, where the old
  // WEB_UI_ROOT/node_modules path 404'd and the map failed silently.
  // CAR-85 — must run BEFORE express.static so the bundled shell wins on "/".
  app.use(bundleHtmlMiddleware({ publicDir: PUBLIC_DIR }));
  // CAR-104 — the precompressed bundle behind content negotiation (see the
  // middleware's header for the full contract). Must run BEFORE express.static
  // so the negotiated response wins; direct artifact fetches 404 here, and
  // everything else falls through untouched.
  app.use(bundleCompressionMiddleware({ publicDir: PUBLIC_DIR }));
  app.use('/vendor/leaflet', express.static(LEAFLET_DIST));
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
  registerTwoPagerRoutes(app);        // v1.89.0 — two-pager (candidate market fit)
  registerInterviewRoutes(app);       // v1.90.0 — mock interview 2.0
  registerNetworkingRoutes(app);      // v1.91.0 — networking & deep company research
  registerCvStudioRoutes(app);        // v1.92.0 — CV Studio (humanize / voice match)
  registerMemoryRoutes(app);          // v1.93.0 — memory layer (about-me note → every AI request)
  registerCareerPlanRoutes(app);      // v1.95.0 — AI career development plan (save to config/career-plan.md)
  registerOrientationRoutes(app);     // v1.96.0 — AI career-orientation profile (generate + export, no writes)
  registerRunnerRoutes(app);          // buffered /api/run/* + streaming /api/stream/{scan,liveness,pdf} + /api/output/pdfs
  registerScanRoutes(app);            // in-process /api/stream/scan-{ru,en} + /api/scan-results
  registerStatsRoutes(app);           // v1.86.0 — target-roles stats snapshot store + trend
  registerMarketRoutes(app);          // v1.94.0 — AI salary/market report for target roles
  registerBatchRoutes(app);           // v1.13.0 — /api/batch + /api/stream/batch + /api/batch/merge
  registerLlmRoutes(app);             // /api/evaluate, /api/deep, /api/mode/:slug, /api/apply-helper, /api/interview-prep
  registerOpenrouterRoutes(app);      // v1.57.0 — GET /api/openrouter/models (model catalogue proxy)
  registerAutoPipelineRoutes(app);    // v1.16.0 — server-side SSE auto-pipeline (G-007 follow-up)
  registerPortalsRoutes(app);         // v1.99.0 — GET /api/portals + POST /api/portals/health (watched companies + liveness)
  registerDiscoverAtsRoutes(app);     // POST /api/portals/discover (name → ATS board, read-only) + POST /api/portals/track (explicit add)
  registerExportRoutes(app);          // v1.100.0 — POST /api/export/docx (dependency-free .docx from markdown)
  registerDocsAssistantRoutes(app);   // v1.102.0 — POST /api/docs-assistant/ask (grounded help-guide chat)
  registerCliDetectRoutes(app);       // v1.103.0 — GET /api/cli-detect (which AI CLIs are installed; PATH scan, no exec)
  registerCvSyncRoutes(app);          // GET /api/cv-sync-check (read-only setup doctor: cv.md/profile completeness + leftover example/metric warnings)
  registerLogoRoutes(app);            // v1.104.0 — GET /api/logo?domain= (company favicon proxy; SSRF-safe, in-mem cache)
  registerUsageRoutes(app);           // v1.105.0 — GET /api/usage (LLM token/cost rollups from data/llm-usage.jsonl)
  registerFollowupRoutes(app);        // v1.117.0 — GET /api/followup (cadence shell-out) + POST /api/followup/seed
  registerAssessmentsRoutes(app);     // GET /api/assessments (list relay) + POST /api/assessments (explicit append to data/assessments.tsv via assessment-log.mjs)
  registerOutcomeRoutes(app);         // POST /api/outcome (dryRun preview + explicit write) — record an application outcome via outcome.mjs (archives artifacts + syncs tracker)
  registerFundedRoutes(app);          // v1.133.0 — GET /api/company-funded (funded-company discovery relay; read-only, --dry-run)
  registerLivenessRoutes(app);        // GET /api/liveness?url= (ATS "still live?" check; zero-token/zero-browser, SSRF-safe)
  registerGeocodeRoutes(app);         // GET /api/geocode?q= (Nominatim, rate-limited + cached) for #/map
  registerMapRoutes(app);             // GET /api/map/jobs (pipeline + tracker rows with resolved locations) for #/map
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
  // CAR-39 — the SPA fallback answers only NAVIGATION requests for
  // extension-less paths. Previously EVERY unmatched GET — including
  // mistyped/stale asset URLs like /app.js or /style.css that
  // express.static did not find — fell through to here and returned
  // 200 + the HTML shell, so a browser silently parsed HTML as JS/CSS.
  // Now a last path segment that carries a file extension (a missing
  // static file; existing assets never reach this handler) or a client
  // that does not accept HTML (not a navigation) gets a plain 404.
  app.get('*', (req, res) => {
    const lastSegment = req.path.split('/').pop() || '';
    const looksLikeFile = /\.[a-z0-9]+$/i.test(lastSegment);
    if (looksLikeFile || !req.accepts('html')) {
      return res.status(404).type('text').send('Not Found');
    }
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
  listen(app, port, host, () => {
    console.log('');
    console.log('  🛫  career-ops web UI');
    console.log(`     http://${host}:${port}`);
    console.log(`     project: ${PROJECT_ROOT}`);
    console.log('');
  });
}
