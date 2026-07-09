#!/usr/bin/env node
/**
 * sync-assets.mjs — the ONLY asset-delivery path into site/.
 *
 * Copies from the repo root (single source of truth) into site/src + site/public:
 *   images/dashboard-<locale>.png  -> src/assets/screenshots/
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
import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const shots = readdirSync(shotsSrc).filter((f) => /^dashboard-.+\.png$/.test(f));
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
if (helpFiles.length < 16) fail(`expected >=16 help guides, found ${helpFiles.length}`);
const GH_HELP_BASE = `${REPO_URL}/blob/main/docs/help/`;

function rewriteLinks(md) {
  // [text](target) where target is relative (not http(s), not #anchor, not mailto:)
  return md.replace(/\]\((?!https?:\/\/|#|mailto:)([^)\s]+)\)/g, (_m, target) => {
    const abs = new URL(target, GH_HELP_BASE).href;
    return `](${abs})`;
  });
}

for (const f of helpFiles) {
  const md = readFileSync(join(helpSrc, f), 'utf8');
  writeFileSync(join(helpDst, f), rewriteLinks(md));
}
console.log(`[sync-assets] ${helpFiles.length} help guides -> src/content/help/`);

// --- 4. repo facts ----------------------------------------------------------
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

// Scanner adapters: every *.mjs in server/lib/sources/ except registry.mjs.
const sourcesDir = join(ROOT, 'server', 'lib', 'sources');
const adapterFiles = readdirSync(sourcesDir).filter(
  (f) => f.endsWith('.mjs') && f !== 'registry.mjs'
);
// RU adapters declare region 'ru' in their meta block.
let adaptersRu = 0;
for (const f of adapterFiles) {
  const src = readFileSync(join(sourcesDir, f), 'utf8');
  if (/region:\s*['"]ru['"]/.test(src)) adaptersRu += 1;
}
const adapters = adapterFiles.length;

// Test count: parse the README badge (kept current by the release process).
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
const testsMatch = readme.match(/badge\/tests-(\d+)%20passed/);
const tests = testsMatch ? Number(testsMatch[1]) : null;

// LLM providers: distinct want<Provider> gates in the shared dispatch cascade.
const dispatch = readFileSync(join(ROOT, 'server', 'lib', 'llm-dispatch.mjs'), 'utf8');
const providerSet = new Set([...dispatch.matchAll(/want([A-Z][A-Za-z]+)/g)].map((m) => m[1]));
const providers = providerSet.size;

// GitHub stars — best effort at build time only (never client-side).
let stars = null;
try {
  const res = await fetch('https://api.github.com/repos/Fighter90/career-ops-ui', {
    headers: { accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(8000),
  });
  if (res.ok) {
    const data = await res.json();
    if (typeof data.stargazers_count === 'number') stars = data.stargazers_count;
  }
} catch {
  /* offline / rate-limited -> header falls back to a plain "GitHub" button */
}

const facts = {
  version: pkg.version,
  adapters,
  adaptersEn: adapters - adaptersRu,
  adaptersRu,
  tests,
  providers,
  locales: 16,
  stars,
  repoUrl: REPO_URL,
  parentUrl: 'https://career-ops.org',
  buildDate: new Date().toISOString().slice(0, 10),
};

const genDir = join(SITE, 'src', 'generated');
mkdirSync(genDir, { recursive: true });
writeFileSync(join(genDir, 'facts.json'), JSON.stringify(facts, null, 2) + '\n');
console.log('[sync-assets] facts:', JSON.stringify(facts));
