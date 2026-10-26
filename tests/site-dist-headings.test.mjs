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

test('sync-assets strips the leading H1 from the site help copy', () => {
  const sync = readFileSync(resolve(SITE, 'scripts', 'sync-assets.mjs'), 'utf8');
  assert.ok(sync.includes('stripLeadingH1'), 'sync-assets.mjs must strip the docs title H1 (the page supplies its own)');
});

test('built dist: one <h1> per /help and /changelog ×19 + changelog weight budget', async (t) => {
  const dist = resolve(SITE, 'dist');
  if (!existsSync(dist)) {
    t.skip('site/dist not built — run `cd site && npm run build` (the same rules gate every Pages deploy via postbuild)');
    return;
  }
  const { checkDist } = await import(pathToFileURL(resolve(SITE, 'scripts', 'check-dist.mjs')).href);
  const errors = checkDist(dist);
  assert.deepEqual(errors, [], `built-HTML violations:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
});
