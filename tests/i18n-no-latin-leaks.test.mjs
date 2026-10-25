/**
 * v1.58.37 (NEW-D1) — Catch Latin-only page-title leaks on non-Latin
 * locales.
 *
 * The spirit of the v1.58.18 (I-3) closure was: page H1s must read in
 * the user's language, not English. The same principle applies to any
 * `*.title` key — if the value on a non-Latin locale is pure Latin
 * letters (with no whitelisted proper noun, acronym, or product name),
 * it's a leak.
 *
 * v1.60.0 (I18N-SPLIT) — the dictionary is now assembled from per-locale
 * files. We load the REAL assembled DICT (via tests/helpers/i18n-vm.mjs)
 * instead of regex-parsing a monolithic file, so the guard sees exactly
 * what the browser sees.
 *
 * Whitelisted tokens stay Latin in every locale by design (proper nouns,
 * acronyms, product names). Anything else in `*.title` keys on the 5
 * non-Latin locales is a failure.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAssembledDict } from './helpers/i18n-vm.mjs';

const DICT = loadAssembledDict();

// Tokens that legitimately read as Latin in every locale.
const WHITELIST = new Set([
  'CV', 'API', 'URL', 'JD', 'PDF', 'TSV', 'CSV',
  'LinkedIn', 'OpenAI', 'OpenRouter', 'Anthropic', 'Gemini', 'Qwen', 'GitHub',
  'Pipeline', // — exception: en-locale row, others are tested below
]);

// A "pure Latin" value contains only ASCII letters, digits, spaces,
// and a small set of punctuation. CJK / Cyrillic / Hangul / Hiragana /
// Katakana / Hangeul / non-Latin scripts all fail this test.
const PURE_LATIN = /^[A-Za-z][A-Za-z0-9\s\-/·:.,()&]*$/;

// Locales whose UX expects native (non-Latin) script. ta joins with
// v1.245.0 — Tamil script, like Devanagari for hi.
const NON_LATIN_LOCALES = ['ru', 'ko', 'ja', 'zh-CN', 'zh-TW', 'uk', 'ar', 'hi', 'ta'];

// Adapt the assembled key-major DICT into Map<key, Map<locale, value>>.
// Alias keys (`{ '@alias': … }`) carry no per-locale strings of their own
// and are skipped — their canonical target is checked under its own key.
function parseDict() {
  const map = new Map();
  for (const [key, row] of Object.entries(DICT)) {
    if (row['@alias']) continue;
    map.set(key, new Map(Object.entries(row)));
  }
  return map;
}

test('NEW-D1: no Latin-only *.title leaks on ru / ja / ko / zh-CN / zh-TW / uk / ar / hi / ta', () => {
  const dict = parseDict();
  const failures = [];
  for (const [key, locales] of dict.entries()) {
    if (!/\.title$/.test(key)) continue;
    for (const loc of NON_LATIN_LOCALES) {
      const v = locales.get(loc);
      if (!v) continue;
      if (PURE_LATIN.test(v) && !WHITELIST.has(v)) {
        failures.push(`${loc}.${key} = "${v}"`);
      }
    }
  }
  assert.deepEqual(
    failures,
    [],
    'Latin-only *.title leaks found in non-Latin locales:\n  ' + failures.join('\n  '),
  );
});

// ─── CAR-108 (2026-10-25) — no mixed-language fragments in localized UI sentences ───
// The reporter's leads: «ready. press «запустить scan»», «все matching», «только
// remote», «Открыть Scan», and status words like «Evaluated» leaking into ru prose.
// Every fix reuses the locale's OWN dictionary vocabulary (nav.scan «Поиск»/搜索/検索,
// scan.btnRun «Сканировать»/扫描/スキャン, track.status.*, nav.tracker трекер/跟踪器,
// «Настройки»), so each guard below pins exactly that: the offending English
// fragment is gone and the value reads as one complete sentence in the locale.
const CAR108 = parseDict();

// A value made only of Cyrillic words + the punctuation those labels legitimately
// carry (quotes, parens, the "> " console marker, arrows). Includes the
// Ukrainian letters і/ї/є/ґ that sit outside the А-Яа-яЁё ranges.
const CYRILLIC_ONLY = (v) =>
  /[А-Яа-яЁёІіЇїЄєҐґ]/.test(v) &&
  /^[\s>«»()[\]…,:.;!?→—·–-]*$/.test(v.replace(/[А-Яа-яЁёІіЇїЄєҐґ\s]/g, ''));

// [key, locale, check] — check is either 'cyrillic' (whole value must be
// Cyrillic + punctuation) or a RegExp whose match is the leaked fragment.
const CAR108_ROWS = [
  // The four leads from the ticket.
  ['top.quickscan', 'ru', 'cyrillic'],
  ['scan.scopeAll', 'ru', 'cyrillic'],
  ['scan.remoteOnly', 'ru', 'cyrillic'],
  ['scan.remoteOnly', 'uk', 'cyrillic'],
  ['scan.consoleReady', 'ru', 'cyrillic'],
  // scan.hybrid was the bare English word; uk already reads «гібридний».
  ['scan.hybrid', 'ru', 'cyrillic'],
  // web-search → веб-поиск (ru already uses «веб-интерфейс» elsewhere).
  ['scan.websearchBacked', 'ru', 'cyrillic'],
  // Workday hint: «резерв:» prefix (uk precedent); /career-ops scan (Playwright)
  // is a literal CLI command and "tenant" stays in uk too — only the English
  // "fallback:" opener is the leak.
  ['scan.workdayFallbackHint', 'ru', /fallback/i],
  // "запустите Scan" → «запустите сканирование» ("Pipeline" + "URL" stay: product term).
  ['pipe.empty', 'ru', /\bScan\b/],
  // Latin "tracker" where the dict's own term is «трекер» (ru) / 跟踪器/追蹤器 (zh).
  ['auto.intro', 'ru', /\btracker\b/i],
  ['auto.step.tracker', 'ru', 'cyrillic'],
  ['auto.openTracker', 'ru', 'cyrillic'],
  ['batch.additionsTitle', 'ru', 'cyrillic'],
  ['batch.pendingAdditions', 'ru', 'cyrillic'],
  ['batch.merge', 'ru', 'cyrillic'],
  ['batch.merged', 'ru', 'cyrillic'],
  // "Read-only сводка" / "Открыть read-only сводку" → «(только чтение)».
  ['config.viewProfile', 'ru', 'cyrillic'],
  ['set.subtitle', 'ru', 'cyrillic'],
  // CJK: "Scan"/"scan" fragments → the dict's own 扫描/掃描/スキャン/스캔/搜索 spellings.
  ['top.quickscan', 'es', /Scan/],
  ['top.quickscan', 'pt-BR', /Scan/],
  ['top.quickscan', 'ja', /Scan/i],
  ['top.quickscan', 'ko', /Scan/i],
  ['top.quickscan', 'zh-CN', /Scan/i],
  ['top.quickscan', 'zh-TW', /Scan/i],
  ['scan.consoleReady', 'es', /scan/i],
  ['scan.consoleReady', 'pt-BR', /scan/i],
  ['scan.consoleReady', 'ja', /scan/i],
  ['scan.consoleReady', 'ko', /scan/i],
  ['scan.consoleReady', 'zh-CN', /scan/i],
  ['scan.consoleReady', 'zh-TW', /scan/i],
  ['pipe.empty', 'ja', /scan/i],
  ['pipe.empty', 'ko', /scan/i],
  ['pipe.empty', 'zh-CN', /scan/i],
  ['pipe.empty', 'zh-TW', /scan/i],
  // CJK + ru "tracker" leaks (zh dicts use 跟蹤器/跟踪器 12+ times elsewhere).
  ['followup.companyHint', 'ja', /\bTracker\b/],
  ['followup.companyHint', 'ko', /\bTracker\b/],
  ['followup.companyHint', 'zh-CN', /\btracker\b/],
  ['followup.companyHint', 'zh-TW', /\btracker\b/],
  ['interviewPrep.companyHint', 'ja', /\bTracker\b/],
  // ko translates "CV match" as «CV 일치» in eval.subtitle — same spelling here.
  ['interviewPrep.companyHint', 'ko', /\bTracker\b|CV match/],
  ['interviewPrep.companyHint', 'zh-CN', /\btracker\b/],
  ['interviewPrep.companyHint', 'zh-TW', /\btracker\b/],
  ['auto.intro', 'zh-CN', /\btracker\b/],
  ['auto.intro', 'zh-TW', /\btracker\b/],
  ['auto.step.tracker', 'zh-CN', /\btracker\b/],
  ['auto.step.tracker', 'zh-TW', /\btracker\b/],
  ['auto.openTracker', 'zh-CN', /\btracker\b/],
  ['auto.openTracker', 'zh-TW', /\btracker\b/],
  ['track.fixEmpty', 'zh-CN', /\btracker\b/],
  ['track.fixEmpty', 'zh-TW', /\btracker\b/],
  ['batch.additionsTitle', 'ja', /\bTracker\b/],
  ['batch.additionsTitle', 'ko', /\bTracker\b/],
  ['batch.additionsTitle', 'zh-CN', /\bTracker\b/],
  ['batch.additionsTitle', 'zh-TW', /\bTracker\b/],
  ['batch.pendingAdditions', 'ja', /\btracker\b/],
  ['batch.pendingAdditions', 'ko', /\btracker\b/],
  ['batch.pendingAdditions', 'zh-CN', /\btracker\b/],
  ['batch.pendingAdditions', 'zh-TW', /\btracker\b/],
  ['batch.merge', 'ja', /\bTracker\b/],
  ['batch.merge', 'ko', /\bTracker\b/],
  ['batch.merge', 'zh-CN', /\btracker\b/],
  ['batch.merge', 'zh-TW', /\btracker\b/],
  ['batch.merged', 'ja', /\bTracker\b/],
  ['batch.merged', 'ko', /\bTracker\b/],
  ['batch.merged', 'zh-CN', /\btracker\b/],
  ['batch.merged', 'zh-TW', /\btracker\b/],
  // uk «Переваги щодо remote, …» → «віддаленого» (ru already reads «удалённо»).
  ['config.modesDescLocationPolicy', 'uk', /\bremote\b/i],
  // ta quotes the EN conversion labels; its own stats.conv* spellings exist.
  ['stats.convCaveat', 'ta', /Applied|Responded|Interview|Offer/],
];

test('CAR-108: no mixed-language fragments in the fixed UI sentences', () => {
  const failures = [];
  for (const [key, loc, check] of CAR108_ROWS) {
    const v = CAR108.get(key)?.get(loc);
    if (!v) { failures.push(`${loc}.${key}: key/locale missing`); continue; }
    if (check === 'cyrillic') {
      if (!CYRILLIC_ONLY(v)) failures.push(`${loc}.${key} = "${v}" (must be Cyrillic-only)`);
    } else if (check.test(v)) {
      failures.push(`${loc}.${key} = "${v}" (matches leaked fragment ${check})`);
    }
  }
  assert.deepEqual(failures, [],
    'Mixed-language fragments found:\n  ' + failures.join('\n  '));
});

test('CAR-108: help.hint.tracker funnel reads in the locale (no EN status words)', () => {
  // The 17 locales fixed by CAR-108 — every one shows localized stage tabs
  // (track.status.*, v1.248.2), so the help hint must name the same words.
  // vi already localized its funnel and en is the source — both excluded.
  // Two locales legitimately spell a stage exactly like the EN word (their own
  // track.status.* spelling), so the probe is built per locale from the
  // forbidden-elsewhere set: da/de keep "Interview", zh-CN/zh-TW keep "Offer".
  const FIXED = ['ru','uk','es','pt-BR','ko','ja','fr','pl','ar','da','de','hi','it','ta','tr','zh-CN','zh-TW'];
  const OWN_INTERVIEW = new Set(['da', 'de']);
  const OWN_OFFER = new Set(['zh-CN', 'zh-TW']);
  const row = CAR108.get('help.hint.tracker');
  assert.ok(row, 'help.hint.tracker row must exist');
  const failures = [];
  for (const loc of FIXED) {
    const v = row.get(loc);
    if (!v) { failures.push(`${loc}: help.hint.tracker missing`); continue; }
    const parts = ['Evaluated', 'Applied', 'Hired'];
    if (!OWN_INTERVIEW.has(loc)) parts.push('Interview');
    if (!OWN_OFFER.has(loc)) parts.push('Offer');
    const probe = new RegExp('\\b(' + parts.join('|') + ')\\b');
    if (probe.test(v)) failures.push(`${loc}.help.hint.tracker = "${v}"`);
    // The funnel arrows must still be there (shape preserved).
    if (!v.includes('→')) failures.push(`${loc}.help.hint.tracker lost its funnel arrows`);
  }
  assert.deepEqual(failures, [],
    'EN status words still leaking into localized funnel prose:\n  ' + failures.join('\n  '));
});

test('NEW-D1: pipe.title is fully localized on the 3 previously-leaking locales (es / pt-BR / ru)', () => {
  const dict = parseDict();
  const row = dict.get('pipe.title');
  assert.ok(row, 'pipe.title row must exist');
  // RU must be fully Cyrillic — no Latin letters at all.
  assert.match(row.get('ru'), /^[А-Яа-яЁё\s]+$/,
    `pipe.title[ru] must be Cyrillic, got "${row.get('ru')}"`);
  // ES must not be just "Pipeline" — has to add a noun.
  // UX-A11 (v1.58.64) refined the es copy from "Pipeline de vacantes"
  // to "Pipeline de candidaturas" (candidate-side perspective is the
  // user's mental model). Both are acceptable; the guard accepts either
  // contextualizing noun ("vacantes/vacant" employer-side, or
  // "candidaturas" candidate-side).
  assert.notEqual(row.get('es'), 'Pipeline',
    'pipe.title[es] must contextualize (e.g. "Pipeline de candidaturas")');
  assert.match(row.get('es'), /vacant|vaca|candidatur/i,
    'pipe.title[es] must mention "vacantes" OR "candidaturas"');
  // pt-BR must add Portuguese "vagas".
  assert.notEqual(row.get('pt-BR'), 'Pipeline',
    'pipe.title[pt-BR] must contextualize (e.g. "Pipeline de vagas")');
  assert.match(row.get('pt-BR'), /vaga/i,
    'pipe.title[pt-BR] must mention "vagas"');
});
