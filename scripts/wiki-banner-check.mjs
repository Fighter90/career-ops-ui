#!/usr/bin/env node
/**
 * wiki-banner-check.mjs — release gate: the wiki's Home*.md banner must name
 * the version the repo is about to ship.
 *
 * Found by the v1.252.0 regression: the wiki sweep that ships with every
 * release replaced badges and tag links but the "Current release:" banner in
 * the 18 Home*.md pages stayed at v1.251.0 with a stale test count — caught
 * only by hand, never by a gate. This script is that gate.
 *
 * The banner is LANGUAGE-AGNOSTIC by shape: `> <label>: **vX.Y.Z** · … ·
 * N <word> · N <word> · N <word> · N <word>` — the localized Home pages
 * translate the label and the counter words («Текущий релиз», «Aktuel
 * udgivelse», «адаптеров сканера», «enhedstests»), so the checker pins the
 * STRUCTURE (version + four counters in order) and never the words.
 *
 * The counters default to LIVE counts from this checkout:
 *   - adapters = ALL_ADAPTERS.length from server/lib/portals/registry.mjs
 *   - routes   = *.mjs files in server/lib/routes/
 *   - locales  = CHANGELOG.{*}.md count + 1 (the EN original)
 *   - unitTests — pass `--tests N` (the number a fresh `npm run test:ci`
 *     just printed); the release train forwards it automatically.
 *
 * Usage:
 *   node scripts/wiki-banner-check.mjs --wiki /path/to/wiki --tests 5261
 *   node scripts/wiki-banner-check.mjs --wiki dir --json
 *   node scripts/wiki-banner-check.mjs --check-only   (offline: no clone)
 *
 * Exit 0 = every Home page matches; exit 1 = mismatches listed; exit 2 =
 * wiki checkout absent under --check-only, or a refusal to clone into an
 * existing non-empty --wiki path (FULL-R3: a typoed --wiki is never wiped).
 */

import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

/** The SOURCES registry total — the banner's public "N scanner adapters" phrasing
 * carries the SOURCES count per CONTEXT.md (kept for historical continuity),
 * not ALL_ADAPTERS.length (which equals the EN sources only). */
function sourcesCount(rootOverride) {
  const root = rootOverride ?? ROOT;
  const dir = join(root, 'server', 'lib', 'sources');
  return readdirSync(dir).filter((f) => f.endsWith('.mjs') && !f.startsWith('_') && f !== 'registry.mjs').length;
}

/** Count the registry-driven counters from THIS repo checkout. */
export function registryCounters(rootOverride) {
  const root = rootOverride ?? ROOT;
  const routesDir = join(root, 'server', 'lib', 'routes');
  const routes = existsSync(routesDir) ? readdirSync(routesDir).filter((f) => f.endsWith('.mjs')).length : 0;
  const locales = readdirSync(root).filter((f) => /^CHANGELOG\..+\.md$/.test(f)).length + 1; // + EN CHANGELOG.md
  return { routes, locales };
}

/**
 * Pure checker over already-read Home page contents.
 * @param {Array<{file: string, text: string}>} pages
 * @param {{version: string, unitTests: number|string, adapters: number|string, routes: number|string, locales: number|string}} expected
 * @returns {string[]} problems, one per broken page (empty = pass)
 */
export function checkWikiBanners(pages, expected) {
  const problems = [];
  if (!pages.length) return ['no Home*.md pages found in the wiki checkout'];
  for (const { file, text } of pages) {
    const m = text.match(/^>[^\S\n]*[^*\n:·：]+[：:][^\S\n]*\*\*v([0-9][0-9.]*)\*\*[^\n·]*·[^·\n]*·[^·\n]*·[^·\n]*?(\d+)[^·\n]*·[^·\n]*?(\d+)[^·\n]*·[^·\n]*?(\d+)[^·\n]*·[^·\n]*?(\d+)/m);
    if (!m) {
      problems.push(`${file}: banner line not found or shape drifted (expected "> <label>: **vX.Y.Z** · … · N … · N … · N … · N …" — label colon, version, then four ·-separated counters)`);
      continue;
    }
    const [, ver, adapters, routes, locales, tests] = m;
    if (ver !== expected.version) problems.push(`${file}: banner version ${ver} != package.json ${expected.version}`);
    if (adapters !== String(expected.adapters)) problems.push(`${file}: scanner adapters ${adapters} != registry ${expected.adapters}`);
    if (routes !== String(expected.routes)) problems.push(`${file}: route modules ${routes} != registry ${expected.routes}`);
    if (locales !== String(expected.locales)) problems.push(`${file}: UI locales ${locales} != registry ${expected.locales}`);
    if (tests !== String(expected.unitTests)) problems.push(`${file}: unit tests ${tests} != expected ${expected.unitTests}`);
  }
  return problems;
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const wikiArg = argValue('--wiki');
  const jsonOut = process.argv.includes('--json');
  const checkOnly = process.argv.includes('--check-only');

  let wikiDir = wikiArg ? resolve(wikiArg) : join(ROOT, '..', 'career-ops-ui.wiki');
  if (!existsSync(join(wikiDir, 'Home.md'))) {
    if (checkOnly) {
      console.error(`wiki checkout not found at ${wikiDir} (--check-only forbids cloning)`);
      process.exit(2);
    }
    console.error(`cloning wiki into ${wikiDir} …`);
    // FULL-R3: a typoed --wiki (~/code, .) must never be wiped to make room
    // for the clone. The target must not exist, or be an empty directory —
    // an existing non-empty path is refused, never rmSync'd.
    if (existsSync(wikiDir) && readdirSync(wikiDir).length > 0) {
      console.error(`refusing: ${wikiDir} already exists and is not empty — the --wiki clone target must not exist (or be an empty directory); nothing was deleted`);
      process.exit(2);
    }
    execFileSync('git', ['clone', '-q', 'https://github.com/Fighter90/career-ops-ui.wiki', wikiDir], { stdio: 'inherit' });
  }

  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const { routes, locales } = registryCounters();

  const expected = {
    version: pkg.version,
    unitTests: argValue('--tests') ?? '?',
    adapters: sourcesCount(),
    routes,
    locales,
  };

  const pages = readdirSync(wikiDir)
    .filter((f) => /^Home.*\.md$/.test(f))
    .map((f) => ({ file: f, text: readFileSync(join(wikiDir, f), 'utf8') }));

  const problems = checkWikiBanners(pages, expected);
  if (jsonOut) {
    console.log(JSON.stringify({ expected, pages: pages.length, problems }, null, 2));
  } else if (problems.length) {
    console.error(`wiki banner gate FAILED (${problems.length} problem(s) across ${pages.length} Home pages):`);
    for (const p of problems) console.error('  - ' + p);
  } else {
    console.log(`wiki banner gate OK: ${pages.length} Home pages match v${expected.version} (adapters ${expected.adapters}, routes ${expected.routes}, locales ${expected.locales}, tests ${expected.unitTests})`);
  }
  process.exit(problems.length ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
