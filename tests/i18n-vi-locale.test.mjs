/**
 * Vietnamese (`vi`) locale onboarding — the 19th UI locale.
 *
 * Locks the full wiring end-to-end, the same way the browser experiences it:
 * the per-locale table assembles into window.__I18N_DICT via the real
 * assembler, t() returns Vietnamese (never the en fallback) after
 * setLang('vi'), detect() maps 'vi' / 'vi-VN' → 'vi', the language switcher
 * entry carries the Vietnamese endonym + a flag emoji, and Vietnamese stays
 * LTR (unlike ar — RTL_LANGS must NOT grow 'vi').
 *
 * Vietnamese is written in the Latin alphabet with tone marks, so it does
 * NOT join i18n-no-latin-leaks' NON_LATIN_LOCALES (that gate is about
 * non-Latin scripts rendering an English-only title). What this suite locks
 * instead is that the values are real Vietnamese prose: tone-marked
 * Vietnamese with correct diacritics, never byte-identical en copies
 * (outside the whitelisted tech labels), and never unmarked ASCII.
 *
 * CI-isolated: loads the dictionary through tests/helpers/i18n-vm.mjs in a
 * vm context — no network, no parent project, no ports.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { I18N_LANGS, loadAssembledDict, loadI18n, runDictInto } from './helpers/i18n-vm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB = resolve(__dirname, '..', 'public', 'js', 'lib');

const DICT = loadAssembledDict();
const I18n = loadI18n();

/** Vietnamese letters beyond plain ASCII (đ, ơ, ư, and the tone marks). */
const VIET = /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵĂÂĐÊÔƠƯÁÀẢÃẠẮẰẲẴẶẤẦẨẪẬÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴ]/;

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

test('vi is a registered UI locale (I18N_LANGS + getLangs)', () => {
  assert.ok(I18N_LANGS.includes('vi'), 'I18N_LANGS must list vi');
  const entry = I18n.getLangs().find((l) => l.code === 'vi');
  assert.ok(entry, 'getLangs() must carry the vi entry');
  assert.equal(entry.label, 'Tiếng Việt', 'the switcher label is the Vietnamese endonym');
  assert.match(entry.flag, /\p{Regional_Indicator}/u, 'vi needs a flag emoji');
});

test('every non-alias dict key has a non-empty Vietnamese value', () => {
  const enKeys = Object.entries(DICT)
    .filter(([, row]) => !row['@alias'] && row.en !== undefined)
    .map(([k]) => k);
  assert.ok(enKeys.length > 1400, `sanity: en should carry ~1525 keys, got ${enKeys.length}`);
  const missing = enKeys.filter((k) => !DICT[k].vi || !String(DICT[k].vi).trim());
  assert.deepEqual(missing, [], `vi missing/empty for ${missing.length} keys (e.g. ${missing.slice(0, 8).join(', ')})`);
});

test("t('nav.dashboard') renders Vietnamese after setLang('vi') — no en fallback", () => {
  const en = DICT['nav.dashboard'].en;
  I18n.setLang('vi');
  assert.equal(I18n.getLang(), 'vi', 'setLang(vi) must stick');
  const rendered = I18n.t('nav.dashboard', 'Dashboard');
  assert.equal(rendered, DICT['nav.dashboard'].vi, 't() must return the vi table value');
  assert.notEqual(rendered, en, 'the vi value must not be the en string');
  assert.match(rendered, VIET, 'the rendered dashboard label must be Vietnamese (tone-marked)');
});

test('a spread of UI keys carries real Vietnamese (tone-marked, not en copies)', () => {
  // Spot-check the whole app surface: nav, scan, tracker, config, help…
  // (nav.help is an @alias — it carries no per-locale strings of its own,
  // so its canonical target help.title stands in for it.)
  const SAMPLE = [
    'nav.scan', 'nav.pipeline', 'nav.evaluate', 'nav.tracker', 'help.title',
    'scan.title', 'track.title', 'rep.title', 'config.title',
    'help.subtitle', 'pipe.hint', 'eval.placeholder', 'mock.subtitle',
    'usage.subtitle', 'portals.subtitle', 'asmt.title', 'digest.title',
  ];
  for (const key of SAMPLE) {
    const v = DICT[key].vi;
    assert.ok(v, `${key} missing for vi`);
    // Whitelisted tech keys (cv.title = "CV") are allowed to stay en-equal —
    // skip the Vietnamese requirement for them. "Pipeline" stays too: it is
    // the standard Vietnamese tech loanword for the feature's own name.
    if (v === DICT[key].en) {
      assert.match(v, /^(CV|API|URL|JD|PDF|Pipeline)$/, `${key} is a byte-identical en copy: "${v}"`);
      continue;
    }
    assert.match(v, VIET, `${key} carries no Vietnamese diacritics: "${v}"`);
  }
});

test('placeholders survive the translation ({n}, {company}, {score}, …)', () => {
  const pairs = [
    ['track.outcome.previewResult', '{num}', '{company}', '{state}'],
    ['activity.truncated', '{n}'],
    ['map.visible', '{visible}', '{total}'],
    ['portals.counts', '{total}', '{enabled}'],
    ['scan.scoreIcon', '{score}'],
    ['notif.unread', '{n}'],
    ['stats.patSmallN', null], // no placeholder — just must stay non-empty
  ];
  for (const [key, ...placeholders] of pairs) {
    const v = DICT[key].vi;
    assert.ok(v, `${key} missing for vi`);
    for (const ph of placeholders) {
      if (ph) assert.ok(v.includes(ph), `${key} lost placeholder ${ph}: "${v}"`);
    }
  }
});

test("detect() maps 'vi' and 'vi-VN' to 'vi'", () => {
  for (const browser of ['vi', 'vi-VN', 'vi-vn']) {
    const ctx = bootFor(browser);
    assert.equal(ctx.window.I18n.getLang(), 'vi', `navigator.language "${browser}"`);
  }
});

test('Vietnamese stays LTR — RTL_LANGS does not grow vi', () => {
  // The setLang side-effect: <html dir> must stay 'ltr' for vi (only ar is RTL).
  const ctx = bootFor('vi-VN');
  ctx.window.I18n.setLang('vi');
  assert.equal(ctx.document.documentElement.dir, 'ltr', 'Vietnamese is an LTR script');
  // And the source-level guard: RTL_LANGS keeps exactly its 'ar' member.
  const src = readFileSync(resolve(LIB, 'i18n.js'), 'utf8');
  const rtl = src.match(/RTL_LANGS = new Set\(\[([^\]]*)\]\)/);
  assert.ok(rtl, 'RTL_LANGS declaration changed shape — update this test');
  const members = rtl[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  assert.deepEqual(members, ['ar'], 'only ar is RTL');
});

// ---------------------------------------------------------------------------
// vi review round (CAR-88 follow-up) — regression locks for the Opus review's
// must-fix findings. Each assertion below failed against the v1.255.0 dict.
// ---------------------------------------------------------------------------

/** CJK: Hangul jamo+syllables, kana, and the CJK unified ideographs. */
const CJK = /[\u3131-\uD7A3\u3040-\u30FF\u4E00-\u9FFF]/;

test('no CJK/Hangul glyph leaks into a vi value beyond what the en value itself carries', () => {
  // Brand names pass through (config.arkcnHint carries "Ark (方舟)" in en too).
  // A glyph present in vi but absent from en is a translation leak (the v1.255.0
  // dict shipped a Hangul 신 inside "độ 신 hiệu" in two project.* values).
  const leaked = Object.entries(DICT)
    .filter(([, row]) => row.vi && row.en !== undefined)
    .filter(([, row]) => CJK.test(row.vi) && !CJK.test(row.en))
    .map(([k]) => k);
  assert.deepEqual(leaked, [], `CJK/Hangul leaked into vi values: ${leaked.join(', ')}`);
});

test('help vi.md markdown links carry hyphenated slugs — no spaces inside any URL', () => {
  // Markdown link URLs containing spaces do not parse as links. The v1.255.0
  // bundle shipped "…/guides/apply for a job", "…/set up playwright" and four
  // "…/what-is career-ops" occurrences; en.md hyphenates all of them.
  const md = readFileSync(resolve(__dirname, '..', 'docs', 'help', 'vi.md'), 'utf8');
  const spaced = [...md.matchAll(/\]\((https?:\/\/[^()\s]*[ ][^()]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(spaced, [], `help links with spaces in the URL: ${spaced.join(' | ')}`);
  // And the three known guide slugs stay byte-equal to en.md.
  for (const slug of ['what-is-career-ops', 'guides/apply-for-a-job', 'guides/set-up-playwright']) {
    assert.ok(md.includes(`https://career-ops.org/docs/introduction/${slug})`), `vi.md must link ${slug}`);
  }
});

test('no vi value points at the English "Run live" button label', () => {
  // The button itself renders as mode.runLive / deep.runLive = "Chạy trực tiếp";
  // hint prose must reference the label the user actually sees.
  assert.equal(DICT['mode.runLive'].vi, 'Chạy trực tiếp', 'sanity: the button label is localized');
  const offenders = Object.entries(DICT)
    .filter(([, row]) => /Run live/.test(row.vi || ''))
    .map(([k]) => k);
  assert.deepEqual(offenders, [], `"Run live" leaked into vi values: ${offenders.join(', ')}`);
});

test('relocation reads "chuyển nơi ở" — it must not collide with the commute family', () => {
  // "di chuyển" is the word family the commute.* drive-time filters use on the
  // same page; relocation is a different feature (willing to move for the job).
  assert.match(DICT['scan.reloc'].vi, /chuyển nơi ở/);
  assert.match(DICT['scan.col.reloc'].vi, /[Cc]huyển nơi ở/);
  assert.match(DICT['scan.relocBadge'].vi, /chuyển nơi ở/);
  for (const key of ['scan.reloc', 'scan.relocBadge']) {
    assert.doesNotMatch(DICT[key].vi, /^[Dd]i chuyển$/, `${key} must not read "di chuyển"`);
  }
});

test('legitimacy reads "xác thực" (the posting is real), not the moral "chính đáng"', () => {
  assert.equal(DICT['track.col.legitimacy'].vi, 'Độ xác thực');
  assert.equal(DICT['auto.legitimacy'].vi, 'Độ xác thực');
  assert.equal(DICT['auto.legit'].vi, 'Xác thực');
});

test('nav.patterns / dash.quick.patternsCta are "Mẫu từ chối", never the Trend label', () => {
  // "Xu hướng" is stats.tabTrend / stats.trend — two sidebar/CTA entries must
  // not carry it, or the Patterns page reads as the Trend page.
  assert.equal(DICT['nav.patterns'].vi, 'Mẫu từ chối');
  assert.equal(DICT['dash.quick.patternsCta'].vi, 'Mẫu từ chối');
  assert.notEqual(DICT['nav.patterns'].vi, DICT['stats.tabTrend'].vi, 'Patterns must not share the Trend label');
});

test('the vi prompt scaffold is pinned: every key translated, tone-marked, {slug} intact', async () => {
  // prompts.mjs resolves PATHS at import time — point CAREER_OPS_ROOT at an
  // isolated temp root (with cv.md) before the dynamic import. This file does
  // not import any other server module, so the one-time resolution is safe.
  const ROOT = mkdtempSync(resolve(tmpdir(), 'i18n-vi-scaffold-'));
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  const saved = process.env.CAREER_OPS_ROOT;
  process.env.CAREER_OPS_ROOT = ROOT;
  try {
    const { scaffold } = await import('../server/lib/prompts.mjs');
    const keys = ['readFiles', 'userContext', 'modeTemplate', 'modeRoleLine', 'evalRoleLine'];
    for (const key of keys) {
      const vi = scaffold(key, 'vi');
      assert.ok(vi, `scaffold(${key}, 'vi') must not be empty`);
      assert.notEqual(vi, scaffold(key, 'en'), `scaffold(${key}, 'vi') fell back to en — the vi entry is missing`);
      assert.match(vi, VIET, `scaffold(${key}, 'vi') carries no Vietnamese diacritics: "${vi}"`);
    }
    assert.ok(scaffold('modeRoleLine', 'vi').includes('{slug}'), "modeRoleLine.vi must keep the {slug} placeholder");
  } finally {
    if (saved === undefined) delete process.env.CAREER_OPS_ROOT;
    else process.env.CAREER_OPS_ROOT = saved;
    try { rmSync(ROOT, { recursive: true, force: true }); } catch { /* temp dir */ }
  }
});
