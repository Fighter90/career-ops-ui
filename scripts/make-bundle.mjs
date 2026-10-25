#!/usr/bin/env node
/**
 * make-bundle.mjs — release-time SPA bundle (CAR-85).
 *
 * The SPA shell (public/index.html) loads ~86 classic <script src="/js/…">
 * tags; a cold load fetches them 6-at-a-time over HTTP/1.1 (~30 s on prod).
 * This script concatenates those files — in document order, no transform, no
 * minifier, no build step — into public/js/bundle.js. The server middleware
 * (server/index.mjs::bundleHtmlMiddleware) swaps the individual tags for one
 * bundle tag whenever the file exists, so dev (no bundle on disk) is
 * untouched and prod cold load drops to a handful of requests.
 *
 * Deliberately NOT bundled (they keep their individual tags):
 *   - <head> scripts (/js/lib/theme-bootstrap.js sets the theme pre-paint;
 *     /js/lib/logbuf.js captures errors from the first paint) — position IS
 *     the feature for both.
 *   - Anything outside /js/ (the vendored /vendor/leaflet/leaflet.js).
 *   - Any tag carrying the `data-no-bundle` attribute (escape hatch).
 *
 * CAR-104 additionally writes two precompressed siblings next to the identity
 * bundle — bundle.js.br (brotli, max quality) and bundle.js.gz (gzip 9) — so
 * server/index.mjs::bundleCompressionMiddleware can serve the bundle behind
 * content negotiation instead of shipping 3.1 MB of identity bytes per cold
 * load. Stale artifacts are removed BEFORE the new identity lands, so an
 * interrupted build leaves no compressed file at all (the server then serves
 * identity) rather than an old artifact beside a new bundle.
 *
 * Usage: node scripts/make-bundle.mjs [--root <web-ui checkout>]
 *   (default root: this checkout; --root exists for tests / odd layouts)
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync, constants as zlibConstants } from 'node:zlib';

const NO_BUNDLE_ATTR = 'data-no-bundle';
export const BUNDLE_SRC = '/js/bundle.js';

// Empty classic script tags only: `<script …></script>` with nothing between.
// Inline blocks (<script>code</script>) never match — CSP forbids them anyway.
const SCRIPT_TAG_RE = /<script\b([^>]*)><\/script>/gi;
const SRC_ATTR_RE = /\bsrc\s*=\s*"([^"]*)"/;

/**
 * Every classic script tag in the document, in order.
 * @returns {Array<{start: number, end: number, attrs: string, src: string|null}>}
 */
export function scanScriptTags(html) {
  const out = [];
  SCRIPT_TAG_RE.lastIndex = 0;
  let m;
  while ((m = SCRIPT_TAG_RE.exec(html)) !== null) {
    const srcM = SRC_ATTR_RE.exec(m[1]);
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      attrs: m[1],
      src: srcM ? srcM[1] : null,
    });
  }
  return out;
}

/**
 * The tags the bundle replaces: /js/ scripts after </head>, no escape hatch.
 * Order is document order — it is also the execution order inside the bundle.
 */
export function extractBundleScripts(html) {
  const headEnd = html.indexOf('</head>');
  const bundled = [];
  for (const tag of scanScriptTags(html)) {
    if (headEnd !== -1 && tag.start < headEnd) continue; // <head> scripts stay put
    if (!tag.src || !tag.src.startsWith('/js/')) continue; // vendored/vendor paths stay put
    if (tag.attrs.includes(NO_BUNDLE_ATTR)) continue; // explicit escape hatch
    bundled.push(tag.src);
  }
  return bundled;
}

/**
 * Swap the bundled tags for ONE bundle tag placed at the FIRST bundled
 * position (for the real shell: end of <body>, exactly where app.js runs
 * today, so execution order and DOM-readiness semantics are unchanged).
 * Returns null when there is nothing to bundle.
 */
export function rewriteIndexHtml(html, bundleSrc = BUNDLE_SRC) {
  const headEnd = html.indexOf('</head>');
  const isBundled = (tag) => {
    if (headEnd !== -1 && tag.start < headEnd) return false;
    if (!tag.src || !tag.src.startsWith('/js/')) return false;
    if (tag.attrs.includes(NO_BUNDLE_ATTR)) return false;
    return true;
  };
  const bundleTag = `<script src="${bundleSrc}"></script>`;
  let out = '';
  let pos = 0;
  let count = 0;
  for (const tag of scanScriptTags(html)) {
    if (!isBundled(tag)) continue; // head / data-no-bundle / non-/js/ tags stay verbatim
    out += html.slice(pos, tag.start);
    if (count === 0) {
      // ONE bundle tag, at the FIRST bundled position — for the real shell:
      // end of <body>, exactly where app.js runs today, so execution order
      // and DOM-readiness semantics are unchanged.
      out += bundleTag;
    }
    count += 1;
    pos = tag.end; // every later bundled tag is dropped — it lives in the bundle
  }
  if (count === 0) return null;
  out += html.slice(pos);
  return { html: out, count };
}

/**
 * Concatenate the scripts. Each chunk is preceded by a `//#src=` marker and
 * followed by a bare `;` statement terminator: file A ending mid-expression
 * (`var x = 1`) next to file B starting with `(` would otherwise parse as a
 * call — the classic ASI trap of naive concatenation. An empty statement is
 * legal anywhere at top level, so the terminator is inert otherwise.
 */
export function buildBundleHtml(scripts) {
  const parts = [
    '/*! career-ops-ui SPA bundle — GENERATED by scripts/make-bundle.mjs. DO NOT EDIT.\n'
    + ` *  ${scripts.length} classic scripts, document order preserved (CAR-85).\n`
    + ' *  Rebuild: npm run bundle · Serve individual scripts instead: NO_BUNDLE=1,'
    + ' or delete this file. */\n\n',
  ];
  for (const s of scripts) {
    if (/^(?:import|export)\b/m.test(s.content)) {
      throw new Error(`make-bundle: ${s.src} is an ES module (top-level import/export) — a classic-script bundle would break it`);
    }
    parts.push(`//#src=${s.src}\n${s.content.trimEnd()}\n;\n`);
  }
  return parts.join('');
}

/** Read the shell + every bundlable file under `root/public`. Throws loudly. */
export function collectScripts(root) {
  const publicDir = resolve(root, 'public');
  const html = readFileSync(resolve(publicDir, 'index.html'), 'utf8');
  const srcs = extractBundleScripts(html);
  if (srcs.length === 0) {
    throw new Error(`make-bundle: no bundlable <script src="/js/…"> tags in ${resolve(publicDir, 'index.html')}`);
  }
  return srcs.map((src) => ({
    src,
    content: readFileSync(resolve(publicDir, src.replace(/^\//, '')), 'utf8'),
  }));
}

/** Build + write public/js/bundle.js (+ its .br/.gz companions). Returns { count, bytes, outPath, brBytes, gzBytes }. */
export function writeBundle(root) {
  const scripts = collectScripts(root);
  const bundle = buildBundleHtml(scripts);
  const outPath = resolve(root, 'public', 'js', 'bundle.js');
  mkdirSync(dirname(outPath), { recursive: true });
  // CAR-104 — stale precompressed artifacts go BEFORE the identity write, so
  // an interrupted build can never pair a new bundle with an old companion
  // (the server also defends this with an mtime freshness check).
  rmSync(`${outPath}.br`, { force: true });
  rmSync(`${outPath}.gz`, { force: true });
  writeFileSync(outPath, bundle);
  const bundleBuf = Buffer.from(bundle, 'utf8');
  let brBytes = null;
  let gzBytes = null;
  // Compression is best-effort per companion: a failure here must not cost
  // the whole bundle — the server falls back to identity when a file is absent.
  try {
    const br = brotliCompressSync(bundleBuf, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 11, // max — the default today, pinned explicitly
        [zlibConstants.BROTLI_PARAM_SIZE_HINT]: bundleBuf.length,
      },
    });
    writeFileSync(`${outPath}.br`, br);
    brBytes = br.length;
  } catch (err) {
    console.warn(`make-bundle: brotli companion skipped (${err.message}) — serving identity only`);
  }
  try {
    const gz = gzipSync(bundleBuf, { level: 9 });
    writeFileSync(`${outPath}.gz`, gz);
    gzBytes = gz.length;
  } catch (err) {
    console.warn(`make-bundle: gzip companion skipped (${err.message}) — serving identity only`);
  }
  return { count: scripts.length, bytes: bundleBuf.length, outPath, brBytes, gzBytes };
}

// ───────────────────────────── CLI ─────────────────────────────

function repoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

async function main(argv) {
  let root = repoRoot();
  const rootFlag = argv.indexOf('--root');
  if (rootFlag !== -1 && argv[rootFlag + 1]) root = resolve(process.cwd(), argv[rootFlag + 1]);
  try {
    const { count, bytes, outPath, brBytes, gzBytes } = writeBundle(root);
    const kb = Math.max(1, Math.round(bytes / 1024));
    let line = `make-bundle: ${count} scripts, ${kb} KB → ${outPath}`;
    const companions = [];
    if (brBytes != null) companions.push(`br ${Math.max(1, Math.round(brBytes / 1024))} KB`);
    if (gzBytes != null) companions.push(`gz ${Math.max(1, Math.round(gzBytes / 1024))} KB`);
    if (companions.length > 0) line += ` (${companions.join(', ')})`;
    console.log(line);
  } catch (err) {
    console.error(`make-bundle failed: ${err.message}`);
    console.error('(the server falls back to the individual <script> tags when no bundle exists)');
    process.exit(1);
  }
}

const isMain = fileURLToPath(import.meta.url) === resolve(process.argv[1] || '');
if (isMain) await main(process.argv.slice(2));
