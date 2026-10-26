#!/usr/bin/env node
/**
 * sync-assets.mjs — the ONLY asset-delivery path into site/.
 *
 * Copies from the repo root (single source of truth) into site/src + site/public:
 *   images/dashboard-<locale>.png  -> src/assets/screenshots/
 *   images/job-map-<locale>.png    -> src/assets/screenshots/
 *   public/favicon-16.png, favicon-32.png, favicon.ico,
 *   public/apple-touch-icon.png    -> public/ (site favicons) + src/assets/logo/
 *   docs/help/<locale>.md          -> src/content/help/ (relative links rewritten
 *                                     to absolute GitHub URLs)
 *
 * Also snapshots repo facts (version, adapter/test/provider counts, GitHub
 * star count best-effort) into src/generated/facts.json so every number on
 * the landing comes from the repo at build time — never from prose memory.
 *
 * Idempotent: safe to run repeatedly (predev/prebuild hooks + CI).
 */
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PAGE_BYTES,
  PAGE_MAX_RELEASES,
  buildMonthIndex,
  chunkByWeight,
  splitReleases,
  stripLeadingH1,
} from './lib/changelog-split.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(SITE, '..');
const REPO_URL = 'https://github.com/Fighter90/career-ops-ui';

function fail(msg) {
  console.error(`[sync-assets] ${msg}`);
  process.exit(1);
}

// --- 1. screenshots ---------------------------------------------------------
const shotsSrc = join(ROOT, 'images');
const shotsDst = join(SITE, 'src', 'assets', 'screenshots');
mkdirSync(shotsDst, { recursive: true });
// dashboard-<locale>.png (README + showcase) and job-map-<locale>.png (job-map section).
const shots = readdirSync(shotsSrc).filter((f) => /^(?:dashboard|job-map)-.+\.png$/.test(f));
if (shots.length === 0) fail(`no dashboard-*.png found in ${shotsSrc}`);
for (const f of shots) cpSync(join(shotsSrc, f), join(shotsDst, f));
console.log(`[sync-assets] ${shots.length} screenshots -> src/assets/screenshots/`);

// --- 2. favicons / logo -----------------------------------------------------
const FAVICONS = ['favicon-16.png', 'favicon-32.png', 'favicon.ico', 'apple-touch-icon.png'];
const pubDst = join(SITE, 'public');
const logoDst = join(SITE, 'src', 'assets', 'logo');
mkdirSync(pubDst, { recursive: true });
mkdirSync(logoDst, { recursive: true });
for (const f of FAVICONS) {
  const src = join(ROOT, 'public', f);
  if (!existsSync(src)) fail(`missing favicon source ${src}`);
  cpSync(src, join(pubDst, f));
}
cpSync(join(ROOT, 'public', 'apple-touch-icon.png'), join(logoDst, 'apple-touch-icon.png'));
console.log('[sync-assets] favicons -> public/, logo -> src/assets/logo/');

// --- 3. help guides (rewrite relative links to absolute GitHub URLs) --------
const helpSrc = join(ROOT, 'docs', 'help');
const helpDst = join(SITE, 'src', 'content', 'help');
mkdirSync(helpDst, { recursive: true });
const helpFiles = readdirSync(helpSrc).filter((f) => f.endsWith('.md'));
if (helpFiles.length < 18) fail(`expected >=18 help guides, found ${helpFiles.length}`);
const GH_HELP_BASE = `${REPO_URL}/blob/main/docs/help/`;

function rewriteLinks(md) {
  // [text](target) where target is relative (not http(s), not #anchor, not mailto:)
  return md.replace(/\]\((?!https?:\/\/|#|mailto:)([^)\s]+)\)/g, (_m, target) => {
    const abs = new URL(target, GH_HELP_BASE).href;
    return `](${abs})`;
  });
}

// The site page supplies its own <h1> (HelpArticle.astro); the guide's title
// line would render a second one (CAR-132 — exactly one h1 per page).
// stripLeadingH1 comes from scripts/lib/changelog-split.mjs (behavior-tested).

for (const f of helpFiles) {
  const md = readFileSync(join(helpSrc, f), 'utf8');
  writeFileSync(join(helpDst, f), rewriteLinks(stripLeadingH1(md)));
}
console.log(`[sync-assets] ${helpFiles.length} help guides -> src/content/help/`);

// --- 3b. changelogs (CAR-132 — paginated per-locale changelog) ---------------
// CHANGELOG.md -> en, CHANGELOG.<lang>.md -> <lang>. The full history used to
// render as ONE ~1 MB page; it is now split into weight-capped pages
// (`<lang>-p<NN>.md`, newest first) plus a month index
// (src/generated/changelog-index.json) the page component renders as static
// links — every release stays ≤2 clicks from /changelog/.
//
// Pages are capped by MARKDOWN BYTES, not release count: entries vary from a
// paragraph (patch releases) to several KB (trains), and CJK/Devanagari
// locales carry ~2× the bytes per release. 100 KB of md ≈ ≤190 KB of built
// HTML at the worst observed expansion (1.9×) — comfortably under the
// 250 KB/page gate in scripts/check-dist.mjs. (PAGE_BYTES /
// PAGE_MAX_RELEASES live in scripts/lib/changelog-split.mjs.)
const clDst = join(SITE, 'src', 'content', 'changelog');
mkdirSync(clDst, { recursive: true });
const GH_ROOT_BASE = `${REPO_URL}/blob/main/`;
function rewriteRootLinks(md) {
  return md.replace(/\]\((?!https?:\/\/|#|mailto:)([^)\s]+)\)/g, (_m, target) => {
    const abs = new URL(target, GH_ROOT_BASE).href;
    return `](${abs})`;
  });
}

// splitReleases / chunkByWeight / buildMonthIndex come from
// scripts/lib/changelog-split.mjs (behavior-tested by
// tests/site-changelog-split.test.mjs): Keep-a-Changelog `## [Unreleased]`
// becomes a page-1 pseudo-release, fence closers must match their opening
// marker, undated epilogues fold into the preceding chunk, and the month
// index records pages [first, last] across chunk boundaries.

const clIndex = {}; // lang -> { pages, months: [{ ym, page, lastPage, count }] }
const clFiles = readdirSync(ROOT).filter((f) => /^CHANGELOG(\.[A-Za-z-]+)?\.md$/.test(f));
if (clFiles.length < 18) fail(`expected >=18 CHANGELOG files, found ${clFiles.length}`);
// The sync owns this directory — clear stale files from previous formats
// (recursive: a stray subdirectory must not EISDIR the prebuild).
rmSync(clDst, { recursive: true, force: true });
mkdirSync(clDst, { recursive: true });

for (const f of clFiles) {
  const lang = f === 'CHANGELOG.md' ? 'en' : f.replace(/^CHANGELOG\./, '').replace(/\.md$/, '');
  const releases = splitReleases(readFileSync(join(ROOT, f), 'utf8'), { lang, fail });
  const chunks = chunkByWeight(releases);
  clIndex[lang] = { pages: chunks.length, months: buildMonthIndex(chunks) };
  chunks.forEach((chunk, p) => {
    const body = chunk.map((r) => r.lines.join('\n')).join('\n');
    writeFileSync(join(clDst, `${lang}-p${String(p + 1).padStart(2, '0')}.md`), rewriteRootLinks(`${body.trimStart()}\n`));
  });
}
const genDir2 = join(SITE, 'src', 'generated');
mkdirSync(genDir2, { recursive: true });
writeFileSync(join(genDir2, 'changelog-index.json'), JSON.stringify(clIndex, null, 2) + '\n');
console.log(`[sync-assets] ${clFiles.length} changelogs -> src/content/changelog/ (${PAGE_BYTES / 1024} KB md/page) + changelog-index.json`);

// --- 3c. license (v1.121.0 — /license/ page) ---------------------------------
// LICENSE is canonical English legal text; every locale renders it verbatim.
const licenseSrc = join(ROOT, 'LICENSE');
if (!existsSync(licenseSrc)) fail(`missing ${licenseSrc}`);
const licDir = join(SITE, 'src', 'generated');
mkdirSync(licDir, { recursive: true });
writeFileSync(join(licDir, 'license.txt'), readFileSync(licenseSrc, 'utf8'));
console.log('[sync-assets] LICENSE -> src/generated/license.txt');

// --- 3d. scan sources (v1.125.0 — the landing "Job sources" section) ---------
// Imported straight from the live registry so the section can never drift
// from the app: value + label + region for every adapter.
const { pathToFileURL } = await import('node:url');
const registry = await import(
  pathToFileURL(join(ROOT, 'server', 'lib', 'sources', 'registry.mjs')).href
);
const scanSources = registry.SOURCES.map(({ value, label, region }) => ({ value, label, region }));
if (scanSources.length < 67) fail(`expected >=67 scan sources, found ${scanSources.length}`);
console.log(`[sync-assets] ${scanSources.length} scan sources -> facts.sources`);

// --- 4. repo facts ----------------------------------------------------------
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

// Scanner adapters: every *.mjs in server/lib/sources/ except registry.mjs and
// `_`-prefixed helpers (`_safe-url.mjs`), which the registry itself skips.
const sourcesDir = join(ROOT, 'server', 'lib', 'sources');
const adapterFiles = readdirSync(sourcesDir).filter(
  (f) => f.endsWith('.mjs') && f !== 'registry.mjs' && !f.startsWith('_')
);
// RU adapters declare region 'ru' in their meta block.
let adaptersRu = 0;
for (const f of adapterFiles) {
  const src = readFileSync(join(sourcesDir, f), 'utf8');
  if (/region:\s*['"]ru['"]/.test(src)) adaptersRu += 1;
}
const adapters = adapterFiles.length;

// Guard: the registry enumeration (scanSources, via dynamic import) must match
// the number of adapter files on disk. A mismatch means a source file failed to
// import — almost always a third-party dep it top-level-imports that the Pages
// build's `npm ci` (site/ only) never installed (v1.212.0: jobbankca imported
// js-yaml at module top level, the registry silently dropped it, and the
// landing shipped 80 sources vs 81 everywhere else). Fail the build loudly here
// rather than ship a source count that disagrees with the app.
if (scanSources.length !== adapters) {
  fail(
    `source count mismatch: ${adapters} adapter files on disk but the registry ` +
      `enumerated only ${scanSources.length} — a source failed to import ` +
      `(check the [sources/registry] warnings above for a missing dependency). ` +
      `Source modules must import only node: builtins + relative modules at top ` +
      `level; lazy-load third-party deps inside functions.`,
  );
}

// Test count: the README badge is no longer maintained (owner decision,
// 2026-10-26 — stale badges are acceptable there), so read the count from
// docs/sdd/CONVENTIONS.md's "Current count as of **vX**: **N**" line, which
// the release train updates every release. The badge stays as a fallback;
// when neither parses (or the file is absent — e.g. a site-only checkout),
// `tests` is null and the landing hides the stat instead of shipping a stale
// number.
let convMatch = null;
const conventionsPath = join(ROOT, 'docs', 'sdd', 'CONVENTIONS.md');
if (existsSync(conventionsPath)) {
  convMatch = readFileSync(conventionsPath, 'utf8').match(/Current count as of \*\*v[\d.]+\*\*: \*\*(\d+)\*\*/);
}
const readmePath = join(ROOT, 'README.md');
const testsMatch = existsSync(readmePath)
  ? readFileSync(readmePath, 'utf8').match(/badge\/tests-(\d+)%20passed/)
  : null;
const tests = convMatch ? Number(convMatch[1]) : testsMatch ? Number(testsMatch[1]) : null;

// LLM providers: the canonical auto-order roster in env-config.mjs (v1.216.0 —
// the dispatch gate became map-driven, so we count the authoritative AUTO_ORDER
// list instead of grepping want<Provider> literals).
const envCfg = readFileSync(join(ROOT, 'server', 'lib', 'env-config.mjs'), 'utf8');
const autoOrderMatch = envCfg.match(/export const AUTO_ORDER = \[([\s\S]*?)\]/);
const providerSet = new Set(
  autoOrderMatch ? [...autoOrderMatch[1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]) : [],
);
const providers = providerSet.size;

// GitHub facts — best effort at build time; the star count is additionally
// refreshed client-side (site.js) so it never goes stale between deploys.
// CI passes GITHUB_TOKEN so shared-runner IPs don't hit the anonymous
// rate limit; locally the unauthenticated call is fine.
async function ghJson(path) {
  const headers = { accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com${path}`, {
    headers,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${path}`);
  return res.json();
}

let stars = null;
try {
  const data = await ghJson('/repos/Fighter90/career-ops-ui');
  if (typeof data.stargazers_count === 'number') stars = data.stargazers_count;
} catch {
  /* offline / rate-limited -> header falls back to a plain "GitHub" button */
}

// Contributors — humans only (bots add noise), top 24 by contribution count.
// Empty array on failure: the landing then hides the block; the weekly
// scheduled Pages rebuild (deploy-pages.yml) restores it on the next pass.
let contributors = [];
try {
  const data = await ghJson('/repos/Fighter90/career-ops-ui/contributors?per_page=24');
  if (Array.isArray(data)) {
    contributors = data
      .filter((c) => c && c.type !== 'Bot' && !/\[bot\]$/i.test(c.login || ''))
      .map((c) => ({
        login: c.login,
        avatar_url: c.avatar_url,
        html_url: c.html_url,
        contributions: c.contributions,
      }));
  }
} catch {
  /* best effort — see above */
}

const facts = {
  version: pkg.version,
  adapters,
  adaptersEn: adapters - adaptersRu,
  adaptersRu,
  tests,
  providers,
  locales: 19,
  stars,
  contributors,
  repoUrl: REPO_URL,
  parentUrl: 'https://career-ops.org',
  sources: scanSources,
  buildDate: new Date().toISOString().slice(0, 10),
};

const genDir = join(SITE, 'src', 'generated');
mkdirSync(genDir, { recursive: true });
writeFileSync(join(genDir, 'facts.json'), JSON.stringify(facts, null, 2) + '\n');
console.log('[sync-assets] facts:', JSON.stringify(facts));
