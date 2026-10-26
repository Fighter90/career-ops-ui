/**
 * CAR-132 — cvstart.org build gate: exactly one <h1> per /help and
 * /changelog page ×19 locales, and a per-page changelog weight budget
 * (the full-history page used to weigh ~1 MB).
 *
 * Two layers:
 *   - Source wiring (always runs, CI has no site build): the page
 *     components own exactly one <h1> template and sync-assets strips the
 *     docs' leading H1 from the site copies, so the markdown can never
 *     contribute a second one.
 *   - Built output (runs whenever site/dist exists — also enforced on
 *     every Pages deploy as site's postbuild, scripts/check-dist.mjs).
 *
 * Conventions follow tests/site-pages.test.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE = resolve(ROOT, 'site');

test('page components own exactly one <h1> each', () => {
  for (const c of ['HelpArticle.astro', 'ChangelogPage.astro']) {
    const src = readFileSync(resolve(SITE, 'src', 'components', c), 'utf8');
    const n = (src.match(/<h1[\s>]/g) ?? []).length;
    assert.equal(n, 1, `${c} must contain exactly one <h1> (found ${n})`);
  }
});

test('sync-assets consumes the split lib and strips the help title H1', () => {
  const sync = readFileSync(resolve(SITE, 'scripts', 'sync-assets.mjs'), 'utf8');
  assert.ok(sync.includes('stripLeadingH1'), 'sync-assets must strip the docs title H1 (the page supplies its own)');
  assert.ok(sync.includes("from './lib/changelog-split.mjs'"), 'sync-assets must import the split lib (behavior-tested)');
});

/**
 * Built-output checks run ONLY with SITE_DIST_CHECK=1 (and on every Pages
 * deploy, where scripts/check-dist.mjs is wired as the postbuild). A stale
 * or absent dist must never red an unrelated `npm test` — review finding #5.
 */
test('built dist: one <h1> per /help and /changelog ×19 + changelog weight budget', async (t) => {
  const dist = resolve(SITE, 'dist');
  if (process.env.SITE_DIST_CHECK !== '1') {
    t.skip('SITE_DIST_CHECK=1 not set — built-output rules are enforced on every Pages deploy (postbuild) and locally via `SITE_DIST_CHECK=1 node --test tests/site-dist-headings.test.mjs`');
    return;
  }
  if (!existsSync(dist)) {
    t.skip('site/dist not built — run `cd site && npm run build` first');
    return;
  }
  const { checkDist } = await import(pathToFileURL(resolve(SITE, 'scripts', 'check-dist.mjs')).href);
  const errors = checkDist(dist);
  assert.deepEqual(errors, [], `built-HTML violations:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
});

test('built dist (SITE_DIST_CHECK=1): changelog pagination pages carry no hreflang alternates', async (t) => {
  const dist = resolve(SITE, 'dist');
  if (process.env.SITE_DIST_CHECK !== '1' || !existsSync(dist)) {
    t.skip('SITE_DIST_CHECK=1 + a built dist required');
    return;
  }
  // Self-canonical per page but hreflang alternates pointing at the locale
  // INDEX pages form a non-reciprocal cluster Google ignores (review #4) —
  // pagination pages must omit the alternates entirely.
  const { siteSlugs } = await import(pathToFileURL(resolve(SITE, 'scripts', 'check-dist.mjs')).href);
  const { readdirSync } = await import('node:fs');
  const violations = [];
  for (const slug of siteSlugs()) {
    const base = slug === '' ? dist : resolve(dist, slug);
    const clDir = resolve(base, 'changelog');
    if (!existsSync(clDir)) continue;
    for (const name of readdirSync(clDir)) {
      if (!/^\d+$/.test(name)) continue;
      const file = resolve(clDir, name, 'index.html');
      if (!existsSync(file)) continue;
      const html = readFileSync(file, 'utf8');
      // Count <link rel="alternate"> only — the language switcher's <a>
      // options carry hreflang attributes too, and those are fine here.
      const n = (html.match(/<link[^>]*rel="alternate"/g) ?? []).length;
      if (n > 0) violations.push(`${slug || 'en'}/changelog/${name}/ has ${n} hreflang alternates`);
    }
  }
  assert.deepEqual(violations, []);
});
