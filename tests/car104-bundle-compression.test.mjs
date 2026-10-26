/**
 * CAR-104 — the release-time bundle ships compressed + cacheable.
 *
 * Prod cold load pulled public/js/bundle.js (~3.1 MB) UNCOMPRESSED and with
 * `Cache-Control: no-store` — the express.static setHeaders that protects the
 * un-hashed W-001 assets also covered the bundle, so every cold visit paid
 * the full 3.1 MB again. Fix:
 *   - scripts/make-bundle.mjs additionally emits bundle.js.br (brotli q11)
 *     and bundle.js.gz (gzip level 9) next to the identity bundle, and
 *     replaces any stale artifacts before each build (same-build ordering).
 *   - server/index.mjs::bundleCompressionMiddleware serves GET/HEAD
 *     /js/bundle.js from the precompressed file when the client's
 *     Accept-Encoding allows it (br preferred over gz), with
 *     Content-Encoding + Vary: Accept-Encoding + correct Content-Length +
 *     a safe cache policy (`public, max-age=300, must-revalidate`) + a weak
 *     ETag shared by every variant. The artifacts themselves are NEVER
 *     served directly (a direct /js/bundle.js.br is a 404), a stale
 *     variant (older than the identity bundle) falls back to identity, and
 *     a missing bundle falls through to express.static exactly as before.
 *
 * CI-isolated: dynamic imports inside before(), CAREER_OPS_ROOT = temp dir
 * with cv.md, no network (servers bind 127.0.0.1:0), the CLI runs against a
 * temp --root so the repo tree is never written to.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync,
  existsSync, utimesSync, statSync, chmodSync, openSync, closeSync,
  renameSync, readdirSync, fstatSync, ftruncateSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import http from 'node:http';
import express from 'express';

const execFileP = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const MAKE_BUNDLE = resolve(REPO_ROOT, 'scripts', 'make-bundle.mjs');

let mod = null;       // scripts/make-bundle.mjs (writeBundle)
let serverMod = null; // server/index.mjs (createApp + bundleCompressionMiddleware)
const scratch = [];

function makeScratch(name) {
  const dir = mkdtempSync(join(tmpdir(), `car104-${name}-`));
  scratch.push(dir);
  return dir;
}

after(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

// A tiny fixture shell (same grammar as the real public/index.html — see
// tests/car85-bundle.test.mjs) with three bundlable /js/ body scripts.
const FIXTURE_HTML = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '  <head>',
  '    <script src="/js/lib/theme-bootstrap.js"></script>',
  '  </head>',
  '  <body>',
  '    <script src="/js/first.js"></script>',
  '    <script src="/js/middle.js"></script>',
  '    <script src="/js/last.js"></script>',
  '  </body>',
  '</html>',
  '',
].join('\n');

function writeFixturePublic(root, { content = 'var CAR104_X = 1;' } = {}) {
  const pub = join(root, 'public');
  const js = join(pub, 'js');
  mkdirSync(join(js, 'lib'), { recursive: true });
  writeFileSync(join(pub, 'index.html'), FIXTURE_HTML);
  writeFileSync(join(js, 'first.js'), `// first\n${content}\n`);
  writeFileSync(join(js, 'middle.js'), '// middle\n(function () { globalThis.CAR104_M = 2; })();\n');
  writeFileSync(join(js, 'last.js'), '// last\nglobalThis.CAR104_L = 3;\n');
  writeFileSync(join(js, 'lib', 'theme-bootstrap.js'), '// head\n');
  return pub;
}

async function buildFixtureBundle(name, opts) {
  const root = makeScratch(name);
  writeFixturePublic(root, opts);
  await execFileP(process.execPath, [MAKE_BUNDLE, '--root', root]);
  return root;
}

function listen(app) {
  return new Promise((resolveListen) => {
    const srv = app.listen(0, '127.0.0.1', () => resolveListen(srv));
  });
}

// Mirrors the real createApp wiring: negotiation → express.static (with the
// W-001 no-store setHeaders) → fallthrough.
function miniApp(publicDir) {
  const app = express();
  app.use(serverMod.bundleCompressionMiddleware({ publicDir }));
  app.use(express.static(publicDir, {
    setHeaders: (res, filePath) => {
      if (/\.(?:js|mjs|css|html)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'no-store');
      }
    },
  }));
  app.use((_req, res) => res.status(404).send('nope'));
  return app;
}

// Raw HTTP over node:http — byte-exact bodies (fetch transparently decompresses
// gzip/br in some runtimes, which would defeat the assertions).
function reqRaw(port, path, { headers = {}, method = 'GET' } = {}) {
  return new Promise((resolveReq, reject) => {
    const r = http.request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolveReq({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks),
      }));
    });
    r.on('error', reject);
    r.end();
  });
}

before(async () => {
  const root = makeScratch('env-root');
  // paths.mjs resolves once per process — isolate BEFORE the first server import.
  writeFileSync(join(root, 'cv.md'), '# Test CV\n');
  process.env.CAREER_OPS_ROOT = root;
  mod = await import('../scripts/make-bundle.mjs');
  serverMod = await import('../server/index.mjs');
});

// ─────────────── make-bundle emits the precompressed siblings ───────────────

test('CAR-145 r3: make-bundle temp names are DOT-prefixed (serve-static never serves dotfiles)', () => {
  // Structural gate — weak by TRACEABILITY rule 2 (greps the source, does not
  // run the writer): a SIGKILL between the temp write and the rename leaves
  // the temp file on disk, and a bare `bundle.js.tmp-<pid>` would be SERVED by
  // express.static for as long as it lingers; a dot-prefixed name hits
  // serve-static's dotfiles default and is never served.
  const src = readFileSync(MAKE_BUNDLE, 'utf8');
  assert.match(
    src,
    /`\.\$\{basename\(path\)\}\.tmp-\$\{process\.pid\}`/,
    'the atomic-write temp template must be .<basename>.tmp-<pid>',
  );
});

test('CAR-145 r3: writeBundle stages ALL artifacts to temps BEFORE any rename (one generation per swap)', () => {
  // Structural gate — weak by TRACEABILITY rule 2 (the writer cannot be
  // observed mid-flight deterministically): per-file atomic renames still
  // allowed a MIXED generation on disk (identity = new, .br = old or missing)
  // when the build died between renames. Phase 1 must materialize every
  // artifact under a temp; only then may the swap renames run.
  const src = readFileSync(MAKE_BUNDLE, 'utf8');
  const fn = src.slice(src.indexOf('export function writeBundle'));
  const stageIdentity = fn.indexOf('writeTempFile(outPath');
  const stageBr = fn.indexOf('writeTempFile(`${outPath}.br`');
  const stageGz = fn.indexOf('writeTempFile(`${outPath}.gz`');
  assert.ok(stageIdentity !== -1, 'identity is staged to a temp via writeTempFile');
  assert.ok(stageBr !== -1, 'the brotli companion is staged to a temp');
  assert.ok(stageGz !== -1, 'the gzip companion is staged to a temp');
  const firstRename = fn.indexOf('renameSync(');
  assert.ok(
    firstRename !== -1 && firstRename > stageIdentity && firstRename > stageBr && firstRename > stageGz,
    'no rename may run before every artifact has a staged temp',
  );
  // Identity FIRST: the server's companion mtime-freshness guard skips a
  // companion OLDER than the identity, so a crash residue of (new identity +
  // old companions) is served consistently as identity — while the reverse
  // order would leave (old identity + NEW companion), which the guard counts
  // as fresh and would serve against the OLD identity's ETag.
  const identityPush = fn.indexOf('staged.push({ tmp: writeTempFile(outPath');
  const brPush = fn.indexOf('staged.push({ tmp: writeTempFile(`${outPath}.br`');
  assert.ok(identityPush !== -1 && identityPush < brPush, 'identity is staged (and so renamed) first');
  assert.match(fn, /for \(let i = 0; i < staged\.length; i\+\+\)/, 'the swap is one quick forward pass');
});

test('CLI: emits bundle.js.br and bundle.js.gz that decompress to the identity bundle', async () => {
  const root = await buildFixtureBundle('cli-artifacts');
  const js = join(root, 'public', 'js');
  const identity = readFileSync(join(js, 'bundle.js'));
  assert.ok(existsSync(join(js, 'bundle.js.br')), 'bundle.js.br must exist');
  assert.ok(existsSync(join(js, 'bundle.js.gz')), 'bundle.js.gz must exist');
  assert.deepEqual(brotliDecompressSync(readFileSync(join(js, 'bundle.js.br'))), identity);
  assert.deepEqual(gunzipSync(readFileSync(join(js, 'bundle.js.gz'))), identity);
});

test('CLI: a rebuild replaces stale precompressed artifacts (never a mixed build)', async () => {
  const root = await buildFixtureBundle('cli-rebuild', { content: 'var CAR104_V1 = 1;' });
  writeFixturePublic(root, { content: 'var CAR104_V2 = 2;' }); // same paths, new content
  await execFileP(process.execPath, [MAKE_BUNDLE, '--root', root]);
  const js = join(root, 'public', 'js');
  const identity = readFileSync(join(js, 'bundle.js'));
  assert.ok(identity.includes('CAR104_V2'), 'identity rebuilt');
  assert.deepEqual(brotliDecompressSync(readFileSync(join(js, 'bundle.js.br'))), identity);
  assert.deepEqual(gunzipSync(readFileSync(join(js, 'bundle.js.gz'))), identity);
});

test('writeBundle reports the compressed sizes alongside the identity size', () => {
  const root = makeScratch('write-bundle-report');
  writeFixturePublic(root);
  const out = mod.writeBundle(root);
  assert.equal(out.count, 3);
  assert.ok(out.bytes > 0 && out.brBytes > 0 && out.gzBytes > 0, 'brBytes/gzBytes reported');
  assert.ok(out.brBytes < out.bytes, 'brotli must actually shrink the bundle');
});

test('CAR-145 r2: the build writes ATOMICALLY — a fresh inode per rebuild, no temp leftovers', async () => {
  // The server hashes AND streams this file concurrently with builds; an
  // in-place write would let a reader observe torn bytes. Renaming a fully
  // written temp file over the target means the published inode is never
  // mutated — pinning the inode change pins that contract.
  const root = makeScratch('write-bundle-atomic');
  writeFixturePublic(root, { content: 'var CAR145_A1 = 1;' });
  await execFileP(process.execPath, [MAKE_BUNDLE, '--root', root]);
  const js = join(root, 'public', 'js');
  const ino1 = statSync(join(js, 'bundle.js')).ino;
  assert.equal(readdirSync(js).filter((f) => /\.tmp-/.test(f)).length, 0, 'no temp files left behind');

  writeFixturePublic(root, { content: 'var CAR145_A2 = 2;' });
  await execFileP(process.execPath, [MAKE_BUNDLE, '--root', root]);
  const ino2 = statSync(join(js, 'bundle.js')).ino;
  assert.notEqual(ino1, ino2, 'a rebuild must publish a NEW inode (temp + rename), never rewrite in place');
  assert.equal(readdirSync(js).filter((f) => /\.tmp-/.test(f)).length, 0, 'no temp files left behind');
  assert.ok(readFileSync(join(js, 'bundle.js')).includes('CAR145_A2'), 'the renamed file is the new build');
});

// ─────────────── negotiation over the real wiring order ───────────────

async function bootNegotiation(publicDir) {
  const srv = await listen(miniApp(publicDir));
  return { srv, port: srv.address().port };
}

test('Accept-Encoding: br → Content-Encoding: br + Vary + cacheable + correct Content-Length', async () => {
  const root = await buildFixtureBundle('neg-br');
  const pub = join(root, 'public');
  const { srv, port } = await bootNegotiation(pub);
  try {
    const res = await reqRaw(port, '/js/bundle.js', { headers: { 'accept-encoding': 'br, gzip' } });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-encoding'], 'br');
    assert.match(res.headers.vary || '', /accept-encoding/i);
    assert.ok(!/no-store/.test(res.headers['cache-control'] || ''), 'CAR-104: the negotiated bundle must not be no-store');
    assert.match(res.headers['cache-control'] || '', /max-age=\d+/);
    assert.match(res.headers['cache-control'] || '', /must-revalidate/);
    assert.ok(res.headers.etag, 'weak ETag present for revalidation');
    assert.equal(Number(res.headers['content-length']), readFileSync(join(pub, 'js', 'bundle.js.br')).length);
    assert.deepEqual(brotliDecompressSync(res.body), readFileSync(join(pub, 'js', 'bundle.js')));
    assert.match((res.headers['content-type'] || ''), /application\/javascript/);
  } finally { srv.close(); }
});

test('Accept-Encoding: gzip only → the gz variant', async () => {
  const root = await buildFixtureBundle('neg-gz');
  const pub = join(root, 'public');
  const { srv, port } = await bootNegotiation(pub);
  try {
    const res = await reqRaw(port, '/js/bundle.js', { headers: { 'accept-encoding': 'gzip' } });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-encoding'], 'gzip');
    assert.equal(Number(res.headers['content-length']), readFileSync(join(pub, 'js', 'bundle.js.gz')).length);
    assert.deepEqual(gunzipSync(res.body), readFileSync(join(pub, 'js', 'bundle.js')));
  } finally { srv.close(); }
});

test('br wins over gzip when the client accepts both', async () => {
  const root = await buildFixtureBundle('neg-prefer-br');
  const { srv, port } = await bootNegotiation(join(root, 'public'));
  try {
    const res = await reqRaw(port, '/js/bundle.js', { headers: { 'accept-encoding': 'gzip, deflate, br, zstd' } });
    assert.equal(res.headers['content-encoding'], 'br');
  } finally { srv.close(); }
});

test('no Accept-Encoding → identity body (no Content-Encoding), still cacheable + Vary', async () => {
  const root = await buildFixtureBundle('neg-identity');
  const pub = join(root, 'public');
  const { srv, port } = await bootNegotiation(pub);
  try {
    const res = await reqRaw(port, '/js/bundle.js', { headers: { 'accept-encoding': 'identity' } });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-encoding'], undefined);
    assert.match(res.headers.vary || '', /accept-encoding/i);
    assert.ok(!/no-store/.test(res.headers['cache-control'] || ''), 'identity bundle joins the safe policy');
    assert.deepEqual(res.body, readFileSync(join(pub, 'js', 'bundle.js')));
  } finally { srv.close(); }
});

test('HEAD works and carries the negotiated headers with no body', async () => {
  const root = await buildFixtureBundle('neg-head');
  const pub = join(root, 'public');
  const { srv, port } = await bootNegotiation(pub);
  try {
    const res = await reqRaw(port, '/js/bundle.js', {
      method: 'HEAD',
      headers: { 'accept-encoding': 'br' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-encoding'], 'br');
    assert.equal(res.body.length, 0, 'HEAD must not ship a body');
    assert.equal(Number(res.headers['content-length']), readFileSync(join(pub, 'js', 'bundle.js.br')).length);
  } finally { srv.close(); }
});

test('If-None-Match on the served ETag → 304 (revalidation works)', async () => {
  const root = await buildFixtureBundle('neg-304');
  const { srv, port } = await bootNegotiation(join(root, 'public'));
  try {
    const first = await reqRaw(port, '/js/bundle.js', { headers: { 'accept-encoding': 'br' } });
    const etag = first.headers.etag;
    assert.ok(etag, 'first response carries an ETag');
    const second = await reqRaw(port, '/js/bundle.js', {
      headers: { 'accept-encoding': 'br', 'if-none-match': etag },
    });
    assert.equal(second.status, 304);
    assert.equal(second.body.length, 0);
  } finally { srv.close(); }
});

test('direct fetches of the artifacts themselves are never served (404)', async () => {
  const root = await buildFixtureBundle('direct-404');
  const { srv, port } = await bootNegotiation(join(root, 'public'));
  try {
    for (const p of ['/js/bundle.js.br', '/js/bundle.js.gz']) {
      const res = await reqRaw(port, p);
      assert.equal(res.status, 404, `${p} must 404 — variants live only behind negotiation`);
    }
  } finally { srv.close(); }
});

test('stale variants (older than the identity bundle) fall back to identity', async () => {
  const root = await buildFixtureBundle('stale-variant');
  const pub = join(root, 'public');
  const js = join(pub, 'js');
  // Simulate an interrupted/rolled-back rebuild: BOTH companions on disk
  // predate the identity bundle, so they compress DIFFERENT bytes.
  // Deterministic via utimesSync — no sleeps.
  const past = new Date('2020-01-01T00:00:00Z');
  utimesSync(join(js, 'bundle.js.br'), past, past);
  utimesSync(join(js, 'bundle.js.gz'), past, past);
  const { srv, port } = await bootNegotiation(pub);
  try {
    const res = await reqRaw(port, '/js/bundle.js', { headers: { 'accept-encoding': 'br, gzip' } });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-encoding'], undefined, 'stale variants must not be served');
    assert.deepEqual(res.body, readFileSync(join(js, 'bundle.js')));
  } finally { srv.close(); }
});

test('only the stale companion is skipped — a fresh gz still serves when br is stale', async () => {
  const root = await buildFixtureBundle('stale-br-fresh-gz');
  const pub = join(root, 'public');
  const js = join(pub, 'js');
  const past = new Date('2020-01-01T00:00:00Z');
  utimesSync(join(js, 'bundle.js.br'), past, past); // br stale, gz fresh
  const { srv, port } = await bootNegotiation(pub);
  try {
    const res = await reqRaw(port, '/js/bundle.js', { headers: { 'accept-encoding': 'br, gzip' } });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-encoding'], 'gzip', 'freshness is judged per variant');
    assert.deepEqual(gunzipSync(res.body), readFileSync(join(js, 'bundle.js')));
  } finally { srv.close(); }
});

test('no precompressed files on disk (dev) → identity passes through gracefully', async () => {
  const root = makeScratch('dev-no-variants');
  const pub = writeFixturePublic(root);
  writeFileSync(join(pub, 'js', 'bundle.js'), '/* identity only, as before CAR-104 */\n');
  const { srv, port } = await bootNegotiation(pub);
  try {
    const res = await reqRaw(port, '/js/bundle.js', { headers: { 'accept-encoding': 'br, gzip' } });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-encoding'], undefined);
    assert.match(res.body.toString('utf8'), /identity only/);
  } finally { srv.close(); }
});

test('no bundle at all → falls through to the static 404 path (dev untouched)', async () => {
  const root = makeScratch('dev-no-bundle');
  const pub = writeFixturePublic(root);
  const { srv, port } = await bootNegotiation(pub);
  try {
    const res = await reqRaw(port, '/js/bundle.js', { headers: { 'accept-encoding': 'br' } });
    assert.equal(res.status, 404);
    // Individual scripts are untouched and keep their W-001 no-store policy:
    const api = await reqRaw(port, '/js/first.js');
    assert.equal(api.status, 200);
    assert.equal(api.headers['cache-control'], 'no-store');
    assert.equal(api.headers['content-encoding'], undefined);
  } finally { srv.close(); }
});

// ─────────────── createApp wiring (real app, read-only) ───────────────

test('createApp registers bundleCompression BEFORE express.static', () => {
  const app = serverMod.createApp();
  const stack = app._router.stack;
  const names = stack.map((l) => l.name);
  const comp = names.indexOf('bundleCompression');
  const stat = names.indexOf('serveStatic');
  assert.ok(comp !== -1, 'bundleCompressionMiddleware must be mounted');
  assert.ok(stat !== -1, 'express.static must be mounted');
  assert.ok(comp < stat, 'negotiation must run before express.static so the bundle response is its own');
});

// ─────────────── full-app: security headers stay on the bundle too ───────────────

test('createApp: CSP headers are still applied to /js/bundle.js responses (mini shell)', async () => {
  // The repo PUBLIC_DIR is read-only for tests, so reproduce the full-app
  // layering (CSP header middleware + negotiation + static) over a temp dir —
  // the point is that negotiation does not bypass the global header middleware.
  const root = await buildFixtureBundle('csp-layering');
  const app = express();
  app.use((_req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'");
    next();
  });
  app.use(serverMod.bundleCompressionMiddleware({ publicDir: join(root, 'public') }));
  app.use(express.static(join(root, 'public')));
  const srv = await listen(app);
  try {
    const res = await reqRaw(srv.address().port, '/js/bundle.js', { headers: { 'accept-encoding': 'br' } });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-encoding'], 'br');
    assert.match(res.headers['content-security-policy'] || '', /script-src 'self'/);
  } finally { srv.close(); }
});

// ─────────────── CAR-145 — the shell cache-busts the bundle URL ───────────────
// index.html is no-store but the bundle is `public, max-age=300` — without a
// versioned URL a browser can pair a NEW shell with a CACHED OLD bundle for up
// to 5 minutes after a deploy. The shell must therefore reference
// /js/bundle.js?v=<content-hash>, and the negotiation middleware must keep
// matching (and revalidating) on the PATHNAME so the versioned URL behaves.

/** The real wiring order: shell rewrite → negotiation → static. */
function shellApp(publicDir) {
  const app = express();
  app.use(serverMod.bundleHtmlMiddleware({ publicDir }));
  app.use(serverMod.bundleCompressionMiddleware({ publicDir }));
  app.use(express.static(publicDir, {
    setHeaders: (res, filePath) => {
      if (/\.(?:js|mjs|css|html)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'no-store');
      }
    },
  }));
  app.use((_req, res) => res.status(404).send('nope'));
  return app;
}

/** The ?v= value the shell must cite for a bundle with these exact bytes. */
function expectedVersion(publicDir) {
  return createHash('sha256')
    .update(readFileSync(join(publicDir, 'js', 'bundle.js')))
    .digest('hex')
    .slice(0, 12);
}

// (The old "bundleVersionOf: content hash … mtime fallback" unit test was
// superseded by the CAR-145 r3 test below — null-stat contract, provenance
// via bundleContentHash, and the 12-hex fallback are all covered there.)

test('CAR-145 r3: bundleVersionOf — null stat → null; real stat → content hash; unreadable → fallback', () => {
  const root = makeScratch('car145-r3-version');
  const pub = writeFixturePublic(root);
  writeFileSync(join(pub, 'js', 'bundle.js'), 'var CAR145 = 1;\n');
  const bundlePath = join(pub, 'js', 'bundle.js');
  const contentHashV = expectedVersion(pub); // computed BEFORE the file goes unreadable
  // finding 6 — a null stat must not become a constant masquerading as a
  // version ('undefined:undefined:undefined'): the shell then omits ?v= and
  // the negotiation middleware treats the URL as unversioned.
  assert.equal(serverMod.bundleVersionOf(bundlePath, null), null);
  assert.equal(serverMod.bundleVersionOf(bundlePath, statSync(bundlePath)), contentHashV);

  // finding 1 — provenance is observable: content hash vs stat fallback.
  assert.equal(serverMod.bundleContentHash(bundlePath), contentHashV, 'readable → content hash');
  chmodSync(bundlePath, 0o000);
  try {
    assert.equal(serverMod.bundleContentHash(bundlePath), null, 'unreadable → null (must never be cached)');
    const fallback = serverMod.bundleVersionOf(bundlePath, statSync(bundlePath));
    assert.match(fallback, /^[0-9a-f]{12}$/, 'fallback still 12 hex');
    assert.notEqual(fallback, contentHashV, 'fallback is NOT the content hash');
  } finally {
    chmodSync(bundlePath, 0o644);
  }
  assert.equal(serverMod.bundleContentHash(bundlePath), contentHashV, 'readable again → content hash');
});

test('CAR-145 r3: bundleContentHashFromFd — the hash belongs to the fd, not the path (rename swap)', () => {
  const root = makeScratch('car145-r3-fd');
  const dir = join(root, 'fd');
  mkdirSync(dir, { recursive: true });
  const pathA = join(dir, 'file.js');
  writeFileSync(pathA, 'AAA');
  writeFileSync(join(dir, 'swap.js'), 'BBB');
  const fd = openSync(pathA, 'r');
  try {
    // CodeQL js/file-system-race: no stat-then-use — the size of the opened
    // inode is statically known from the fixture content ('AAA').
    const sizeA = Buffer.byteLength('AAA');
    const h1 = serverMod.bundleContentHashFromFd(fd, sizeA);
    assert.equal(h1, createHash('sha256').update('AAA').digest('hex').slice(0, 12));
    // A rename-based build swaps the inode under the path mid-flight. The
    // swap is proven BY the assertion below — a path-following (broken)
    // implementation would hash 'BBB' here and fail; no path-based re-read
    // is needed (and any open-then-reread of this path is exactly the TOCTOU
    // pattern CodeQL js/file-system-race flags).
    renameSync(join(dir, 'swap.js'), pathA);
    assert.equal(serverMod.bundleContentHashFromFd(fd, sizeA), h1,
      'the hash must keep belonging to the ORIGINAL inode behind this fd');
  } finally {
    closeSync(fd);
  }
});

test('CAR-145 r3: a short read (file truncated after the size was taken) → null, never a prefix hash', () => {
  const root = makeScratch('car145-r3-shortread');
  const pub = writeFixturePublic(root);
  const bundlePath = join(pub, 'js', 'bundle.js');
  writeFileSync(bundlePath, 'var CAR145_TRUNC = 1;\n');
  // 'r+' (not 'r') — POSIX ftruncate on a read-only fd is EINVAL; the
  // truncation must happen on the SAME fd/inode so no path re-lookup
  // reintroduces the js/file-system-race pattern.
  const fd = openSync(bundlePath, 'r+');
  try {
    // CodeQL js/file-system-race: the size comes from the FD (fstatSync), not
    // from a path stat that could drift from the opened inode.
    const st = fstatSync(fd);
    // Control — the whole file reads to the content hash.
    assert.match(serverMod.bundleContentHashFromFd(fd, st.size), /^[0-9a-f]{12}$/);
    // Truncate AFTER the size was taken: the promised bytes are no longer all
    // there. A prefix hash here would be valid-looking 12-hex and callers
    // would cache/serve it as THE content hash — it must be null (the
    // uncached no-store path).
    ftruncateSync(fd, 4);
    assert.equal(serverMod.bundleContentHashFromFd(fd, st.size), null);
  } finally {
    closeSync(fd);
  }
});

test('CAR-145 r3: the un-versioned bundle ETag is the content hash (rsync -p gap closed)', async () => {
  const root = await buildFixtureBundle('car145-r3-etag');
  const pub = join(root, 'public');
  const { srv, port } = await bootNegotiation(pub);
  try {
    const res = await reqRaw(port, '/js/bundle.js', { headers: { 'accept-encoding': 'identity' } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.etag, `W/"${expectedVersion(pub)}"`,
      'ETag = W/"<content hash>" — a size+mtime ETag 304s through identical-stat rebuilds');
  } finally { srv.close(); }
});

test('CAR-145: the served shell references the bundle with a content-hash query', async () => {
  const root = await buildFixtureBundle('car145-shell');
  const pub = join(root, 'public');
  const srv = await listen(shellApp(pub));
  const port = srv.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store', 'shell stays always-revalidate');
    assert.match(
      body,
      new RegExp(`<script src="/js/bundle\\.js\\?v=${expectedVersion(pub)}"></script>`),
      'the ?v= hash must be the sha256 of the served identity bundle',
    );
    assert.doesNotMatch(body, /<script src="\/js\/bundle\.js"><\/script>/, 'un-versioned tag is gone');
  } finally { srv.close(); }
});

test('CAR-145: ONE server, after a same-size same-mtime rebuild, cites the NEW hash (cache invalidation)', async () => {
  const root = await buildFixtureBundle('car145-skew', { content: 'var CAR145_V1 = 1;' });
  const pub = join(root, 'public');
  const bundlePath = join(pub, 'js', 'bundle.js');
  // ONE app/server — the middleware's shell cache must invalidate across the
  // rebuild; two shellApp() calls would give the second one a fresh cache and
  // prove nothing about invalidation.
  const srv = await listen(shellApp(pub));
  try {
    // Pin the mtime BEFORE the first fetch so the cached shell key carries the
    // pinned value (pinning only after would change the key by itself and
    // invalidate the cache for the wrong reason).
    const pinned = new Date(1700000000000);
    utimesSync(bundlePath, pinned, pinned);
    const st1 = statSync(bundlePath);
    assert.equal(st1.mtimeMs, 1700000000000, 'fixture: pinned mtime is exact');
    const before = await fetch(`http://127.0.0.1:${srv.address().port}/`).then((r) => r.text());
    const v1 = expectedVersion(pub);
    assert.match(before, new RegExp(`src="/js/bundle\\.js\\?v=${v1}"`));

    // A deploy lands with the rsync -p / cp -p shape: SAME byte length and the
    // old mtime restored — size:mtimeMs alone cannot tell the rebuild happened,
    // only the inode identity (ino/ctimeMs) still can.
    // Rewrite ONLY the bundle's variable input — touching index.html would
    // change the other half of the shell cache key and prove nothing. V2 is
    // derived from the file the build actually consumed (equal length by
    // construction), not from re-typing the fixture layout (r3, finding 7).
    const firstV1 = readFileSync(join(pub, 'js', 'first.js'), 'utf8');
    const firstV2 = firstV1.replace('CAR145_V1 = 1', 'CAR145_V2 = 2');
    assert.notEqual(firstV2, firstV1, 'fixture: the replacement must have matched');
    assert.equal(firstV2.length, firstV1.length, 'fixture: same byte length');
    writeFileSync(join(pub, 'js', 'first.js'), firstV2);
    await execFileP(process.execPath, [MAKE_BUNDLE, '--root', root]);
    utimesSync(bundlePath, pinned, pinned);
    const st2 = statSync(bundlePath);
    assert.equal(st2.size, st1.size, 'fixture: same byte length');
    assert.equal(st2.mtimeMs, st1.mtimeMs, 'fixture: mtime restored exactly');
    const v2 = expectedVersion(pub);
    assert.notEqual(v1, v2, 'different content must mean a different version');

    const after = await fetch(`http://127.0.0.1:${srv.address().port}/`).then((r) => r.text());
    assert.match(after, new RegExp(`src="/js/bundle\\.js\\?v=${v2}"`),
      'the served shell must point at the new bundle URL — never the cached old one');
    assert.ok(!after.includes(`?v=${v1}`), 'the old versioned URL must disappear from the shell');
  } finally { srv.close(); }
});

test('CAR-145: the versioned URL is served by negotiation (pathname-only matching)', async () => {
  const root = await buildFixtureBundle('car145-versioned-served');
  const pub = join(root, 'public');
  const { srv, port } = await bootNegotiation(pub);
  try {
    const res = await reqRaw(port, `/js/bundle.js?v=${expectedVersion(pub)}`, {
      headers: { 'accept-encoding': 'br, gzip' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-encoding'], 'br');
    assert.equal(Number(res.headers['content-length']), readFileSync(join(pub, 'js', 'bundle.js.br')).length);
    assert.deepEqual(brotliDecompressSync(res.body), readFileSync(join(pub, 'js', 'bundle.js')));
    // CAR-145 r2 — a ?v= that MATCHES the current hash is content-addressed:
    // correctness comes from the hash, so the cache policy can be immutable.
    assert.equal(
      res.headers['cache-control'],
      'public, max-age=31536000, immutable',
      'matching ?v= → immutable (the hash is the correctness guarantee)',
    );
  } finally { srv.close(); }
});

test('CAR-145: a MISMATCHED ?v= is served but marked no-store (rolling-deploy cache poisoning closed)', async () => {
  const root = await buildFixtureBundle('car145-mismatch-nostore');
  const pub = join(root, 'public');
  const { srv, port } = await bootNegotiation(pub);
  try {
    // During a rolling deploy an old instance can still hold the OLD bundle
    // under a NEW instance's ?v= — if that answer were cacheable, a shared
    // cache would pin NEW-URL→OLD-bytes for max-age and defeat the buster.
    const res = await reqRaw(port, '/js/bundle.js?v=deadbeefdead', {
      headers: { 'accept-encoding': 'identity' },
    });
    assert.equal(res.status, 200, 'the bytes are still served');
    assert.equal(res.headers['cache-control'], 'no-store', '…but uncacheable');
    assert.deepEqual(res.body, readFileSync(join(pub, 'js', 'bundle.js')), 'current bytes, not the claimed version');
    // Empty / garbage v= values are mismatches too.
    const empty = await reqRaw(port, '/js/bundle.js?v=', { headers: { 'accept-encoding': 'identity' } });
    assert.equal(empty.headers['cache-control'], 'no-store');
  } finally { srv.close(); }
});

test('CAR-145: ETag/304 revalidation keeps working for the CURRENT ?v= value', async () => {
  const root = await buildFixtureBundle('car145-304-versioned');
  const pub = join(root, 'public');
  const { srv, port } = await bootNegotiation(pub);
  try {
    const url = `/js/bundle.js?v=${expectedVersion(pub)}`;
    const first = await reqRaw(port, url, { headers: { 'accept-encoding': 'br' } });
    assert.equal(first.status, 200);
    assert.ok(first.headers.etag, 'versioned response carries an ETag');
    const second = await reqRaw(port, url, {
      headers: { 'accept-encoding': 'br', 'if-none-match': first.headers.etag },
    });
    assert.equal(second.status, 304);
    assert.equal(second.body.length, 0);
  } finally { srv.close(); }
});

test('CAR-145: direct artifact fetches still 404 even with a query string', async () => {
  const root = await buildFixtureBundle('car145-artifact-404');
  const { srv, port } = await bootNegotiation(join(root, 'public'));
  try {
    for (const p of ['/js/bundle.js.br?v=1', '/js/bundle.js.gz?v=1']) {
      const res = await reqRaw(port, p);
      assert.equal(res.status, 404, `${p} must 404 — the query does not open a hole`);
    }
  } finally { srv.close(); }
});
