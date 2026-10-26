#!/usr/bin/env node
/**
 * check-dist.mjs — build-output gate for cvstart.org (CAR-132).
 *
 * Two invariants over the BUILT HTML (site/dist):
 *   1. Exactly one <h1> per /help and /changelog page, all 19 locales —
 *      the page component owns the h1; the synced markdown copy must not
 *      contribute a second one.
 *   2. Every changelog page (index + pagination pages) stays under the
 *      per-page weight budget — the full-history page used to weigh ~1 MB.
 *
 * Wired as site's `postbuild`, so a Pages deploy fails loudly on a
 * regression; tests/site-dist-headings.test.mjs runs the same check
 * locally whenever dist exists (CI has no site build — there it checks
 * the source wiring instead).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Per-page changelog weight budget (bytes of built HTML). */
export const MAX_CHANGELOG_BYTES = 250 * 1024;

/** Locale URL slugs, read from the single source of truth (locales.ts). */
export function siteSlugs() {
  const src = readFileSync(join(SITE, 'src', 'i18n', 'locales.ts'), 'utf8');
  const slugs = [...src.matchAll(/slug:\s*'([^']*)'/g)].map((m) => m[1]);
  if (slugs.length < 19) throw new Error(`[check-dist] found only ${slugs.length} locale slugs in src/i18n/locales.ts`);
  return slugs;
}

function countH1(html) {
  return (html.match(/<h1[\s>]/g) ?? []).length;
}

function kb(bytes) {
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * Check the built dist. Returns a list of human-readable violations
 * (empty = green). `dist` defaults to site/dist.
 */
export function checkDist(dist = join(SITE, 'dist')) {
  const errors = [];
  for (const slug of siteSlugs()) {
    const id = slug === '' ? 'en' : slug;
    const base = slug === '' ? dist : join(dist, slug);

    for (const page of ['help', 'changelog']) {
      const file = join(base, page, 'index.html');
      if (!existsSync(file)) {
        errors.push(`${id}/${page}/: page missing from dist`);
        continue;
      }
      const n = countH1(readFileSync(file, 'utf8'));
      if (n !== 1) errors.push(`${id}/${page}/: ${n} <h1> elements (want exactly 1)`);
    }

    // Changelog index + every pagination page: one h1 + the weight budget.
    const clDir = join(base, 'changelog');
    if (!existsSync(clDir)) continue; // already reported missing above
    const pages = ['index.html', ...readdirSync(clDir)
      .filter((name) => /^\d+$/.test(name))
      .map((name) => join(name, 'index.html'))
      .filter((rel) => existsSync(join(clDir, rel)))];
    for (const rel of pages) {
      const file = join(clDir, rel);
      const url = `${id}/changelog/${rel === 'index.html' ? '' : rel.replace(/index\.html$/, '')}`;
      const html = readFileSync(file, 'utf8');
      const n = countH1(html);
      if (n !== 1) errors.push(`${url}: ${n} <h1> elements (want exactly 1)`);
      const bytes = statSync(file).size;
      if (bytes > MAX_CHANGELOG_BYTES) {
        errors.push(`${url}: ${kb(bytes)} exceeds the ${kb(MAX_CHANGELOG_BYTES)} changelog page budget`);
      }
    }
  }
  return errors;
}

function main() {
  const dist = process.argv[2] ? resolve(process.argv[2]) : undefined;
  if (dist && !existsSync(dist)) {
    console.error(`[check-dist] ${dist} does not exist — run the build first`);
    process.exit(1);
  }
  const errors = checkDist(dist);
  if (errors.length > 0) {
    console.error(`[check-dist] ${errors.length} violation(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log('[check-dist] ✓ one <h1> per help/changelog page ×19 · changelog pages within budget');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
