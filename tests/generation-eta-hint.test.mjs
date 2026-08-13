/**
 * P4-ETA (v1.170.0) — long AI generations (career-plan ~40 s observed,
 * orientation / market / networking ~30 s, two-pager AI-fill ~20 s) showed a
 * bare "Generating…" with no sense of how long to wait. Each now carries an
 * honest `⏱ ~Ns` hint next to its generate button, mirroring the #/auto ETA.
 *
 * Views are browser-only → asserted statically (same approach as the other
 * view canaries). The ×17 coverage of the two new keys is enforced by
 * i18n-coverage.test.mjs; here we check they exist and are wired.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadAssembledDict, I18N_LANGS } from './helpers/i18n-vm.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const view = (f) => readFileSync(resolve(ROOT, 'public', 'js', 'views', f), 'utf8');

const PAGES = ['career-plan.js', 'orientation.js', 'stats.js', 'two-pager.js', 'networking.js'];

test('P4-ETA: each long-generation view renders an eta-hint via common.eta', () => {
  for (const f of PAGES) {
    const src = view(f);
    assert.match(src, /className:\s*'eta-hint'/, `${f} renders an .eta-hint span`);
    assert.match(src, /t\(\s*'common\.eta'/, `${f} uses the localized common.eta`);
    assert.match(src, /t\(\s*'common\.etaTitle'/, `${f} sets the localized title`);
    // the {n} placeholder is substituted with a concrete duration
    assert.match(src, /replace\('\{n\}',\s*'\d+'\)/, `${f} fills a concrete ~Ns duration`);
  }
});

test('P4-ETA: common.eta / common.etaTitle exist in all 17 locales', () => {
  const D = loadAssembledDict();
  for (const key of ['common.eta', 'common.etaTitle']) {
    assert.ok(D[key], `${key} exists`);
    for (const lang of I18N_LANGS) {
      assert.ok(D[key][lang] && D[key][lang].trim(), `${key} present for ${lang}`);
    }
  }
  // the duration key keeps the {n} placeholder for per-page substitution
  for (const lang of I18N_LANGS) {
    assert.match(D['common.eta'][lang], /\{n\}/, `common.eta[${lang}] keeps the {n} placeholder`);
  }
});
