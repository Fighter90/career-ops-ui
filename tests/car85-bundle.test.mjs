/**
 * CAR-85 — release-time SPA bundle.
 *
 * Prod cold-load fetched ~89 classic <script src> tags 6-at-a-time over
 * HTTP/1.1 (~30 s). The repo-side fix is a build-less concat:
 *   - scripts/make-bundle.mjs concatenates every body <script src="/js/…">
 *     from public/index.html into public/js/bundle.js (document order kept,
 *     `//#src=` separators, `;` statement terminators between chunks).
 *   - server/index.mjs::bundleHtmlMiddleware swaps the individual tags for
 *     one bundle tag on GET / — only when the bundle file exists, so dev
 *     (no bundle on disk) is untouched; NO_BUNDLE=1 disables at runtime.
 *
 * Deliberately NOT bundled: <head> scripts (theme-bootstrap pre-paint theme,
 * logbuf first-paint error capture — load-order critical) and the vendored
 * /vendor/leaflet/leaflet.js. Cold load: 89 script requests → 4.
 *
 * CI-isolated: dynamic imports inside before(), CAREER_OPS_ROOT = temp dir
 * with cv.md, no network (servers bind 127.0.0.1:0), CLI runs against a temp
 * --root so the repo tree is never written to.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const execFileP = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const MAKE_BUNDLE = resolve(REPO_ROOT, 'scripts', 'make-bundle.mjs');

let mod = null;       // scripts/make-bundle.mjs (helpers)
let serverMod = null; // server/index.mjs (createApp + bundleHtmlMiddleware)
let pathsMod = null;  // server/lib/paths.mjs (PUBLIC_DIR)
let tmpRoot = null;
const scratch = [];

function makeScratch(name) {
  const dir = mkdtempSync(join(tmpdir(), `car85-${name}-`));
  scratch.push(dir);
  return dir;
}

after(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

// A fixture shell with the same grammar as the real public/index.html:
// two load-order-critical <head> scripts, body /js/ scripts (one tagged
// data-no-bundle), a vendored script, and a trailing app entrypoint.
const FIXTURE_HTML = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '  <head>',
  '    <script src="/js/lib/theme-bootstrap.js"></script>',
  '    <script src="/js/lib/logbuf.js"></script>',
  '  </head>',
  '  <body>',
  '    <script src="/js/first.js"></script>',
  '    <script src="/js/lib/locales/i18n-dict.en.js" data-no-bundle></script>',
  '    <script src="/js/middle.js"></script>',
  '    <script src="/vendor/leaflet/leaflet.js"></script>',
  '    <script src="/js/last.js"></script>',
  '  </body>',
  '</html>',
  '',
].join('\n');

function writeFixturePublic(root, { withBundle = false, html = FIXTURE_HTML } = {}) {
  const pub = join(root, 'public');
  const js = join(pub, 'js');
  mkdirSync(join(js, 'lib', 'locales'), { recursive: true });
  writeFileSync(join(pub, 'index.html'), html);
  writeFileSync(join(js, 'first.js'), '// first — no trailing semicolon\nvar CAR85_X = 1');
  writeFileSync(join(js, 'middle.js'), '// middle — leading paren (classic ASI trap)\n(function () { globalThis.CAR85_M = 2; })()');
  writeFileSync(join(js, 'last.js'), '// last\nglobalThis.CAR85_L = 3;\n');
  writeFileSync(join(js, 'lib', 'theme-bootstrap.js'), '// head\n');
  writeFileSync(join(js, 'lib', 'logbuf.js'), '// head\n');
  writeFileSync(join(js, 'lib', 'locales', 'i18n-dict.en.js'), '// dict\n');
  if (withBundle) writeFileSync(join(js, 'bundle.js'), '/* bundle */\n');
  return pub;
}

// `mkdirSync` import (hoisted; declared with the other fs imports above).
import { mkdirSync } from 'node:fs';

function listen(app) {
  return new Promise((resolveListen) => {
    const srv = app.listen(0, '127.0.0.1', () => resolveListen(srv));
  });
}

function miniApp(publicDir) {
  const app = express();
  app.use(serverMod.bundleHtmlMiddleware({ publicDir }));
  app.use(express.static(publicDir));
  app.use((_req, res) => res.status(404).send('nope'));
  return app;
}

before(async () => {
  tmpRoot = makeScratch('root');
  // paths.mjs resolves once per process — isolate BEFORE the first server import.
  writeFileSync(join(tmpRoot, 'cv.md'), '# Test CV\n');
  process.env.CAREER_OPS_ROOT = tmpRoot;
  mod = await import('../scripts/make-bundle.mjs');
  serverMod = await import('../server/index.mjs');
  pathsMod = await import('../server/lib/paths.mjs');
});

// ─────────────── tag extraction (shared grammar) ───────────────

test('extractBundleScripts: body /js/ tags only, document order, skips head + data-no-bundle + non-/js/', () => {
  const srcs = mod.extractBundleScripts(FIXTURE_HTML);
  assert.deepEqual(srcs, ['/js/first.js', '/js/middle.js', '/js/last.js']);
});

test('extractBundleScripts: inline <script> blocks are never candidates', () => {
  const html = FIXTURE_HTML.replace(
    '<script src="/js/first.js"></script>',
    '<script>var inline = 1;</script>\n    <script src="/js/first.js"></script>',
  );
  assert.deepEqual(mod.extractBundleScripts(html), ['/js/first.js', '/js/middle.js', '/js/last.js']);
});

test('rewriteIndexHtml: one bundle tag at the FIRST bundled position, the rest removed', () => {
  const out = mod.rewriteIndexHtml(FIXTURE_HTML, '/js/bundle.js');
  assert.ok(out, 'returns a result');
  assert.equal(out.count, 3);
  assert.match(out.html, /<script src="\/js\/lib\/theme-bootstrap\.js"><\/script>/);
  assert.match(out.html, /<script src="\/js\/lib\/logbuf\.js"><\/script>/);
  assert.match(out.html, /<script src="\/vendor\/leaflet\/leaflet\.js"><\/script>/);
  assert.match(out.html, /<script src="\/js\/lib\/locales\/i18n-dict\.en\.js" data-no-bundle><\/script>/);
  assert.equal((out.html.match(/<script src="\/js\/bundle\.js"><\/script>/g) || []).length, 1);
  // The bundle tag sits where first.js was — before the survivors that follow it.
  const bundleAt = out.html.indexOf('<script src="/js/bundle.js">');
  assert.ok(bundleAt > out.html.indexOf('</head>') && bundleAt < out.html.indexOf('/vendor/leaflet'));
  assert.doesNotMatch(out.html, /<script src="\/js\/(first|middle|last)\.js"><\/script>/);
});

test('rewriteIndexHtml: null when there is nothing to bundle', () => {
  const headOnly = '<html><head><script src="/js/a.js"></script></head><body></body></html>';
  assert.equal(mod.rewriteIndexHtml(headOnly), null);
});

test('drift guard: rewrite removes exactly the tags extractBundleScripts returns', () => {
  const srcs = mod.extractBundleScripts(FIXTURE_HTML);
  const out = mod.rewriteIndexHtml(FIXTURE_HTML, '/js/bundle.js');
  for (const src of srcs) {
    assert.ok(!out.html.includes(`<script src="${src}"`), `${src} must be gone from the rewritten shell`);
  }
});

// ─────────────── bundle assembly ───────────────

test('buildBundleHtml: order kept, //#src= separators, ; terminator defeats the ASI trap', () => {
  const bundle = mod.buildBundleHtml([
    { src: '/js/first.js', content: 'var CAR85_X = 1' }, // no trailing semicolon
    { src: '/js/middle.js', content: '(function () { globalThis.CAR85_M = 2; })()' }, // leading paren
  ]);
  assert.match(bundle, /\/\/#src=\/js\/first\.js/);
  assert.match(bundle, /\n;\n\/\/#src=\/js\/middle\.js/);
  // Negative control: WITHOUT the `;` terminator this parses as a call on 1 —
  // the exact hazard the separator exists to prevent.
  assert.throws(() => {
    // eslint-disable-next-line no-new-func
    (0, eval)('var CAR85_X = 1\n//#src=/js/middle.js\n(function () { throw new Error("ran"); })()');
  }, TypeError);
  // With the separator the same pair evaluates cleanly and in order.
  const ctx = { out: null };
  vm.runInNewContext(bundle + '\nout = (globalThis.CAR85_M === 2)', ctx);
  assert.equal(ctx.out, true);
});

test('buildBundleHtml: refuses ES-module sources loudly', () => {
  assert.throws(() => mod.buildBundleHtml([{ src: '/js/a.js', content: "import x from 'y';\n" }]), /ES module/);
  assert.throws(() => mod.buildBundleHtml([{ src: '/js/a.js', content: 'export const x = 1;\n' }]), /ES module/);
});

// ─────────────── CLI end-to-end (temp --root, never the repo tree) ───────────────

test('CLI: builds public/js/bundle.js in document order from a temp root', async () => {
  const root = makeScratch('cli');
  writeFixturePublic(root);
  const { stdout } = await execFileP(process.execPath, [MAKE_BUNDLE, '--root', root]);
  assert.match(stdout, /3 scripts/);
  const bundle = readFileSync(join(root, 'public', 'js', 'bundle.js'), 'utf8');
  const iFirst = bundle.indexOf('//#src=/js/first.js');
  const iMiddle = bundle.indexOf('//#src=/js/middle.js');
  const iLast = bundle.indexOf('//#src=/js/last.js');
  assert.ok(iFirst !== -1 && iMiddle !== -1 && iLast !== -1, 'all three src markers present');
  assert.ok(iFirst < iMiddle && iMiddle < iLast, 'document order preserved');
  assert.ok(bundle.includes('var CAR85_X = 1') && bundle.includes('globalThis.CAR85_L = 3;'));
});

test('CLI: the built bundle parses as a CLASSIC script (node --check on .cjs)', async () => {
  const root = makeScratch('cli-check');
  writeFixturePublic(root);
  await execFileP(process.execPath, [MAKE_BUNDLE, '--root', root]);
  // .cjs = CommonJS/Script goal. The repo package.json is "type": "module", so
  // --check on a .js copy would parse the bundle as an ES MODULE — where legal
  // classic-script duplicate top-level function declarations become SyntaxErrors.
  const bundlePath = join(root, 'public', 'js', 'bundle.cjs');
  writeFileSync(bundlePath, readFileSync(join(root, 'public', 'js', 'bundle.js')));
  await execFileP(process.execPath, ['--check', bundlePath]); // throws on syntax error
});

test('CLI: a missing script file fails loudly (exit 1, ENOENT on stderr)', async () => {
  const root = makeScratch('cli-missing');
  writeFixturePublic(root);
  const html = readFileSync(join(root, 'public', 'index.html'), 'utf8')
    .replace('/js/middle.js', '/js/ghost.js');
  writeFileSync(join(root, 'public', 'index.html'), html);
  await assert.rejects(
    execFileP(process.execPath, [MAKE_BUNDLE, '--root', root]),
    (err) => err.code === 1 && /ENOENT/.test(err.stderr),
  );
  assert.ok(!existsSync(join(root, 'public', 'js', 'bundle.js')), 'no bundle written on failure');
});

// ─────────────── real shell contract (read-only drift gates) ───────────────

const REAL_HTML = readFileSync(join(REPO_ROOT, 'public', 'index.html'), 'utf8');

test('real index.html: 92 script tags, 89 bundlable /js/ body scripts (regenerate when the shell changes)', () => {
  const all = mod.scanScriptTags(REAL_HTML);
  assert.equal(all.length, 92, 'total classic <script src> tags (89 /js/ body + 2 head + 1 leaflet)');
  const srcs = mod.extractBundleScripts(REAL_HTML);
  assert.equal(srcs.length, 89);
  assert.equal(srcs[0], '/js/lib/locales/i18n-dict.en.js');
  assert.equal(srcs[srcs.length - 1], '/js/app.js');
  assert.ok(srcs.includes('/js/lib/i18n.js'));
  // CAR-116 — the pipeline v2 lib is an ordinary bundlable body script:
  // document order puts it immediately before views/pipeline.js.
  const pv = srcs.indexOf('/js/lib/pipeline-view.js');
  const pipe = srcs.indexOf('/js/views/pipeline.js');
  assert.ok(pv > -1 && pipe > -1 && pv === pipe - 1,
    'pipeline-view.js must load directly before the pipeline view');
  for (const mustStay of ['/js/lib/theme-bootstrap.js', '/js/lib/logbuf.js', '/vendor/leaflet/leaflet.js']) {
    assert.ok(!srcs.includes(mustStay), `${mustStay} must stay individual`);
  }
});

test('real bundle assembly: first dict → i18n.js → app.js in order, and it parses', async () => {
  const srcs = mod.extractBundleScripts(REAL_HTML);
  const scripts = srcs.map((src) => ({
    src,
    content: readFileSync(join(REPO_ROOT, 'public', src.replace(/^\//, '')), 'utf8'),
  }));
  const bundle = mod.buildBundleHtml(scripts);
  const iDict = bundle.indexOf('//#src=/js/lib/locales/i18n-dict.en.js');
  const i18n = bundle.indexOf('//#src=/js/lib/i18n.js');
  const iApp = bundle.indexOf('//#src=/js/app.js');
  assert.ok(iDict < i18n && i18n < iApp, 'first dict → i18n.js → app.js document order');
  // Syntax check the real concat as a CLASSIC script (.cjs — see the CLI test
  // above: "type": "module" would make --check parse a .js copy as a module,
  // rejecting the legal sloppy-script function redeclarations). Writes only
  // to the OS temp dir.
  const tmp = join(makeScratch('realcheck'), 'bundle.cjs');
  writeFileSync(tmp, bundle);
  await execFileP(process.execPath, ['--check', tmp]);
});

// ─────────────── middleware (temp public dir) ───────────────

test('middleware: GET / serves the bundle-tagged shell when bundle.js exists', async () => {
  const dir = makeScratch('mw');
  writeFixturePublic(dir, { withBundle: true });
  const srv = await listen(miniApp(join(dir, 'public')));
  try {
    const res = await fetch(`http://127.0.0.1:${srv.address().port}/`);
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/html/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    // CAR-145 — the shell's bundle tag carries a content-hash ?v= query.
    assert.match(body, /<script src="\/js\/bundle\.js\?v=[0-9a-f]+"><\/script>/);
    assert.doesNotMatch(body, /<script src="\/js\/first\.js"><\/script>/);
    assert.match(body, /<script src="\/js\/lib\/theme-bootstrap\.js"><\/script>/);
  } finally { srv.close(); }
});

test('middleware: no bundle file → the original individual-script shell passes through', async () => {
  const dir = makeScratch('mw-nobundle');
  writeFixturePublic(dir, { withBundle: false });
  const srv = await listen(miniApp(join(dir, 'public')));
  try {
    const res = await fetch(`http://127.0.0.1:${srv.address().port}/`);
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.doesNotMatch(body, /\/js\/bundle\.js/);
    assert.match(body, /<script src="\/js\/first\.js"><\/script>/);
    assert.match(body, /<script src="\/js\/middle\.js"><\/script>/);
  } finally { srv.close(); }
});

test('middleware: NO_BUNDLE=1 disables the rewrite even with a bundle on disk', async () => {
  const dir = makeScratch('mw-disabled');
  writeFixturePublic(dir, { withBundle: true });
  process.env.NO_BUNDLE = '1';
  try {
    const srv = await listen(miniApp(join(dir, 'public')));
    try {
      const res = await fetch(`http://127.0.0.1:${srv.address().port}/`);
      const body = await res.text();
      assert.doesNotMatch(body, /\/js\/bundle\.js/);
      assert.match(body, /<script src="\/js\/first\.js"><\/script>/);
    } finally { srv.close(); }
  } finally { delete process.env.NO_BUNDLE; }
});

test('middleware: only GET / is rewritten — assets pass through, other paths and verbs are untouched', async () => {
  const dir = makeScratch('mw-scope');
  writeFixturePublic(dir, { withBundle: true });
  const srv = await listen(miniApp(join(dir, 'public')));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    const asset = await fetch(`${base}/js/first.js`);
    assert.equal(asset.status, 200);
    assert.match(await asset.text(), /var CAR85_X = 1/);
    const spa = await fetch(`${base}/some-spa-path`, { headers: { accept: 'text/html' } });
    assert.equal(spa.status, 404); // mini-app has no SPA fallback — proves no interception off "/"
    const post = await fetch(`${base}/`, { method: 'POST' });
    assert.equal(post.status, 404);
  } finally { srv.close(); }
});

// ─────────────── full-app integration (real PUBLIC_DIR, read-only) ───────────────

test('createApp: / keeps CSP + no-store and serves the shell (bundled or not, theme-bootstrap always present)', async () => {
  const app = serverMod.createApp();
  const srv = await listen(app);
  try {
    const base = `http://127.0.0.1:${srv.address().port}`;
    const res = await fetch(`${base}/`);
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-security-policy') || '', /script-src 'self'/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.match(body, /<script src="\/js\/lib\/theme-bootstrap\.js"><\/script>/);
    const bundleOnDisk = existsSync(join(pathsMod.PUBLIC_DIR, 'js', 'bundle.js'));
    if (bundleOnDisk) {
      // CAR-145 — the ?v= content-hash query is part of the tag now.
      assert.match(body, /<script src="\/js\/bundle\.js(\?v=[0-9a-f]+)?"><\/script>/);
      assert.doesNotMatch(body, /<script src="\/js\/lib\/locales\/i18n-dict\.en\.js"><\/script>/);
    } else {
      assert.match(body, /<script src="\/js\/lib\/locales\/i18n-dict\.en\.js"><\/script>/);
      assert.doesNotMatch(body, /\/js\/bundle\.js/);
    }
  } finally { srv.close(); }
});

test('createApp: the SPA fallback and POST / are never bundle-rewritten', async () => {
  const app = serverMod.createApp();
  const srv = await listen(app);
  try {
    const base = `http://127.0.0.1:${srv.address().port}`;
    const spa = await fetch(`${base}/spa-fallback-check`, { headers: { accept: 'text/html' } });
    assert.equal(spa.status, 200);
    const spaBody = await spa.text();
    assert.match(spaBody, /<script src="\/js\/lib\/locales\/i18n-dict\.en\.js"><\/script>/);
    assert.doesNotMatch(spaBody, /\/js\/bundle\.js/);
    const post = await fetch(`${base}/`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(post.status, 404);
  } finally { srv.close(); }
});

// ─────────────── helpers ───────────────
