/**
 * v1.175.0 — guard the cvstart.org SEO description against per-locale drift.
 *
 * FIND-3 (v1.174.0) replaced a hard-coded "Scan ~55 job boards" in every
 * locale's `meta.desc` with a registry-derived `{adapters}` placeholder that
 * Landing.astro substitutes (→ "~75") into all three description metas
 * (name=description / og:description / twitter:description). Without a gate the
 * fix silently regresses the moment someone edits one locale and re-types a
 * literal number — exactly the "~55" it replaced. This test fails HERE if any
 * of the 17 site locales drops the placeholder or re-hard-codes a count, and if
 * Landing.astro stops interpolating it.
 *
 * CI-isolated: reads repo source files only; no server / parent / network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(__dirname, '..', 'site');
// Site i18n uses `ko` (ko.json), not ko-KR — mirrors tests/site-sources.test.mjs.
const SITE_LOCALES = ['en', 'es', 'fr', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi'];

const metaDesc = (loc) =>
  JSON.parse(readFileSync(resolve(SITE, 'src', 'i18n', `${loc}.json`), 'utf8'))['meta.desc'];

test('every one of the 17 site locales carries the {adapters} placeholder in meta.desc', () => {
  for (const loc of SITE_LOCALES) {
    const d = metaDesc(loc);
    assert.ok(typeof d === 'string' && d.length > 0, `${loc}.json missing meta.desc`);
    assert.ok(d.includes('{adapters}'), `${loc}.json meta.desc lost the {adapters} placeholder`);
  }
});

test('no site locale re-hard-codes an adapter count in meta.desc', () => {
  // The count MUST come from the placeholder, never a literal like ~55 / ~75.
  for (const loc of SITE_LOCALES) {
    const d = metaDesc(loc);
    assert.doesNotMatch(d, /~\s*\d{2,}/, `${loc}.json meta.desc hard-codes a "~NN" count`);
    // any bare 2-digit number adjacent to the placeholder region is suspicious
    assert.doesNotMatch(d.replace('{adapters}', ''), /\b(55|75|79|80)\b/, `${loc}.json meta.desc contains a stray literal count`);
  }
});

test('Landing.astro substitutes {adapters} into every description sink', () => {
  const landing = readFileSync(resolve(SITE, 'src', 'components', 'Landing.astro'), 'utf8');
  // registry-derived count + a substitution of the placeholder
  assert.match(landing, /facts\.adapters/, 'Landing.astro must derive the count from facts.adapters');
  assert.match(landing, /\.replace\(\s*['"]\{adapters\}['"]/, 'Landing.astro must substitute {adapters}');
  // the substituted value must reach BOTH the JSON-LD description and the <Base description=…>
  assert.match(landing, /description:\s*metaDesc/, 'JSON-LD description must use the substituted metaDesc');
  assert.match(landing, /description=\{metaDesc\}/, 'Base description prop must use the substituted metaDesc');
  // no raw t(locale, 'meta.desc') left un-substituted as a description sink
  assert.doesNotMatch(landing, /description[=:]\s*t\(locale,\s*['"]meta\.desc['"]\)/, 'a description sink still passes the un-substituted meta.desc');
});
