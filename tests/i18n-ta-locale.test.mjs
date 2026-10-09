/**
 * Tamil (`ta`) locale onboarding (v1.245.0, Phase 5) — the 18th UI locale.
 *
 * Locks the full wiring end-to-end, the same way the browser experiences it:
 * the per-locale table assembles into window.__I18N_DICT via the real
 * assembler, t() returns Tamil (never the en fallback) after setLang('ta'),
 * detect() maps 'ta' / 'ta-IN' / 'ta-LK' → 'ta', the language switcher
 * entry carries the Tamil endonym + a flag emoji, and Tamil stays LTR
 * (unlike ar — RTL_LANGS must NOT grow 'ta').
 *
 * CI-isolated: loads the dictionary through tests/helpers/i18n-vm.mjs in a
 * vm context — no network, no parent project, no ports.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { I18N_LANGS, loadAssembledDict, loadI18n, runDictInto } from './helpers/i18n-vm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB = resolve(__dirname, '..', 'public', 'js', 'lib');

const DICT = loadAssembledDict();
const I18n = loadI18n();

/** Load i18n.js exactly like the browser, with a controlled navigator.language. */
function bootFor(browserLanguage) {
  const ctx = createContext({
    window: {},
    navigator: { language: browserLanguage },
    localStorage: { getItem: () => null, setItem: () => {} },
    document: { documentElement: { lang: 'en' }, addEventListener: () => {} },
  });
  runDictInto(ctx);
  runInContext(readFileSync(resolve(LIB, 'i18n.js'), 'utf8'), ctx);
  return ctx;
}

test('ta is a registered UI locale (I18N_LANGS + getLangs)', () => {
  assert.ok(I18N_LANGS.includes('ta'), 'I18N_LANGS must list ta');
  const entry = I18n.getLangs().find((l) => l.code === 'ta');
  assert.ok(entry, 'getLangs() must carry the ta entry');
  assert.equal(entry.label, 'தமிழ்', 'the switcher label is the Tamil endonym');
  assert.match(entry.flag, /\p{Regional_Indicator}/u, 'ta needs a flag emoji');
});

test('every non-alias dict key has a non-empty Tamil value', () => {
  const enKeys = Object.entries(DICT)
    .filter(([, row]) => !row['@alias'] && row.en !== undefined)
    .map(([k]) => k);
  assert.ok(enKeys.length > 1400, `sanity: en should carry ~1449 keys, got ${enKeys.length}`);
  const missing = enKeys.filter((k) => !DICT[k].ta || !String(DICT[k].ta).trim());
  assert.deepEqual(missing, [], `ta missing/empty for ${missing.length} keys (e.g. ${missing.slice(0, 8).join(', ')})`);
});

test("t('nav.dashboard') renders Tamil after setLang('ta') — no en fallback", () => {
  const en = DICT['nav.dashboard'].en;
  I18n.setLang('ta');
  assert.equal(I18n.getLang(), 'ta', 'setLang(ta) must stick');
  const rendered = I18n.t('nav.dashboard', 'Dashboard');
  assert.equal(rendered, DICT['nav.dashboard'].ta, 't() must return the ta table value');
  assert.notEqual(rendered, en, 'the ta value must not be the en string');
  assert.match(rendered, /[\u0B80-\u0BFF]/, 'the rendered dashboard label must be Tamil script');
});

test('a spread of UI keys carries real Tamil (Tamil script, not en copies)', () => {
  // Spot-check the whole app surface: nav, scan, tracker, config, help…
  // (nav.help is an @alias — it carries no per-locale strings of its own,
  // so its canonical target help.title stands in for it.)
  const SAMPLE = [
    'nav.scan', 'nav.pipeline', 'nav.evaluate', 'nav.tracker', 'help.title',
    'scan.title', 'track.title', 'rep.title', 'cv.title', 'config.title',
    'help.subtitle', 'pipe.hint', 'eval.placeholder', 'mock.subtitle',
    'usage.subtitle', 'portals.subtitle', 'asmt.title', 'digest.title',
  ];
  const TAMIL = /[\u0B80-\u0BFF]/;
  for (const key of SAMPLE) {
    const v = DICT[key].ta;
    assert.ok(v, `${key} missing for ta`);
    // Whitelisted tech keys (cv.title = "CV") are allowed to stay en-equal —
    // skip the Tamil-script requirement for them.
    if (v === DICT[key].en) {
      assert.match(v, /^(CV|API|URL|JD|PDF)$/, `${key} is a byte-identical en copy: "${v}"`);
      continue;
    }
    assert.match(v, TAMIL, `${key} carries no Tamil script: "${v}"`);
  }
});

test("detect() maps 'ta', 'ta-IN' and 'ta-LK' to 'ta'", () => {
  for (const browser of ['ta', 'ta-IN', 'ta-LK', 'ta-IN,uq,hi-IN']) {
    const ctx = bootFor(browser);
    assert.equal(ctx.window.I18n.getLang(), 'ta', `navigator.language "${browser}"`);
  }
});

test('Tamil stays LTR — RTL_LANGS does not grow ta', () => {
  // The setLang side-effect: <html dir> must stay 'ltr' for ta (only ar is RTL).
  const ctx = bootFor('ta-IN');
  ctx.window.I18n.setLang('ta');
  assert.equal(ctx.document.documentElement.dir, 'ltr', 'Tamil is an LTR script');
  // And the source-level guard: RTL_LANGS keeps exactly its 'ar' member.
  const src = readFileSync(resolve(LIB, 'i18n.js'), 'utf8');
  const rtl = src.match(/RTL_LANGS = new Set\(\[([^\]]*)\]\)/);
  assert.ok(rtl, 'RTL_LANGS declaration changed shape — update this test');
  const members = rtl[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  assert.deepEqual(members, ['ar'], 'only ar is RTL');
});
