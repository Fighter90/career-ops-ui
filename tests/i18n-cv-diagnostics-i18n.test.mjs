/**
 * CAR-37 — cv-diagnostics.js must speak the ACTIVE locale.
 *
 * The lib shipped 16+ hard-coded English check labels/messages ("Length",
 * "Strong action verbs", "{n} words is long (≈2+ pages)…"), so a ru/ja/ar
 * user got an English diagnostics card inside an otherwise localized CV
 * Studio. The fix routes every label + message through window.I18n.t with
 * `diag.*` keys (structure identical — only the strings localize).
 *
 * Contract locked here:
 *   1. every `diag.*` key exists in all 17 locales with a real value;
 *   2. the en values are byte-identical to the pre-i18n English strings
 *      (the lib's inline fallbacks must agree with the en dict);
 *   3. with lang=ru the analyze() output is Russian (labels + interpolated
 *      details), with ids/statuses/score structure unchanged;
 *   4. with no window.I18n at all the lib still renders English (bare
 *      fallback) — no crash, same shape.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { I18N_LANGS, loadAssembledDict, runDictInto } from './helpers/i18n-vm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const LIB = resolve(ROOT, 'public', 'js', 'lib');

const DIAG_SOURCE = readFileSync(resolve(LIB, 'cv-diagnostics.js'), 'utf8');

/** window + dict + i18n.js + cv-diagnostics.js, exactly like the browser. */
function loadDiag(browserLang = 'en', storedLang = null) {
  const ctx = createContext({
    window: {},
    navigator: { language: browserLang },
    localStorage: {
      getItem: (k) => (k === 'career-ops-ui:lang' ? storedLang : null),
      setItem: () => {},
    },
    document: { documentElement: { lang: 'en' }, addEventListener: () => {} },
  });
  runDictInto(ctx);
  runInContext(readFileSync(resolve(LIB, 'i18n.js'), 'utf8'), ctx);
  runInContext(DIAG_SOURCE, ctx);
  return ctx.window;
}

/** Every diag.* key in the assembled dict. */
function diagKeys(dict) {
  return Object.keys(dict).filter((k) => k.startsWith('diag.'));
}

const STRONG_CV = `# Jane Public
jane@example.com · +1 (415) 555-0100

## Summary
Senior Backend Engineer.

## Experience
- Built a payments service that cut checkout latency 40%.
- Shipped 3 microservices handling 12k req/s.

## Education
- BSc Computer Science, MIT.

## Skills
Go, PostgreSQL, Kubernetes.
`;

// A CV that trips the "long" length branch (>1100 words) and the weak-verb
// warn branch, so the interpolated ru details can be asserted verbatim.
const LONG_CV = `# Long CV\n## Experience\n` +
  '- Responsible for the migration of many legacy services across three regional data centers.\n'.repeat(100) +
  '## Skills\nGo, Kubernetes.\n';

test('CAR-37: every diag.* key exists with a value in all 17 locales', () => {
  const dict = loadAssembledDict();
  const keys = diagKeys(dict);
  assert.ok(keys.length >= 20, `expected the full diag.* group, got ${keys.length}: ${keys.join(', ')}`);
  for (const key of keys) {
    for (const lang of I18N_LANGS) {
      assert.ok(typeof dict[key][lang] === 'string' && dict[key][lang].length > 0,
        `diag key ${key} missing/empty in ${lang}`);
    }
  }
});

test('CAR-37: en dict values are byte-identical to the legacy English strings', () => {
  const dict = loadAssembledDict();
  const legacy = {
    'diag.length.label': 'Length',
    'diag.length.empty': 'The CV is empty.',
    'diag.length.tooFew': "Only {n} words — there's almost nothing to evaluate yet.",
    'diag.length.short': 'Only {n} words — most one-page CVs run 300–600. Consider adding detail.',
    'diag.length.long': '{n} words is long (≈2+ pages). Tighten to the most relevant.',
    'diag.length.ok': '{n} words — a healthy one-to-two-page range.',
    'diag.quantified.label': 'Quantified impact',
    'diag.quantified.ok': '{pct}% of bullets include a number or metric.',
    'diag.quantified.warn': 'Only {pct}% of bullets are quantified. Add concrete numbers (%, $, time saved).',
    'diag.quantified.fail': 'Just {pct}% of bullets have a metric. Recruiters skim for numbers — add them.',
    'diag.quantified.noBullets': 'No bullet points detected — use bullets with metrics for experience.',
    'diag.weakVerbs.label': 'Strong action verbs',
    'diag.weakVerbs.ok': 'No weak "responsible for / helped" phrasing found.',
    'diag.weakVerbs.found': '{n} weak phrase(s) (e.g. "{eg}"). Lead bullets with strong verbs (built, shipped, cut, grew).',
    'diag.buzzwords.label': 'Buzzwords',
    'diag.buzzwords.ok': 'No empty clichés detected.',
    'diag.buzzwords.found': '{n} cliché(s) (e.g. "{eg}"). Replace with specifics.',
    'diag.sections.label': 'Core sections',
    'diag.sections.ok': 'Summary, Experience, Education, and Skills are all present.',
    'diag.sections.missing': 'Missing/undetected: {list}.',
    'diag.section.experience': 'Experience',
    'diag.section.education': 'Education',
    'diag.section.skills': 'Skills',
    'diag.section.summary': 'Summary',
    'diag.contact.label': 'Contact info',
    'diag.contact.both': 'Email and phone found.',
    'diag.contact.emailOnly': 'Email found (phone optional).',
    'diag.contact.noEmail': 'No email detected — make sure recruiters can reach you.',
  };
  for (const [key, expected] of Object.entries(legacy)) {
    assert.equal(dict[key] && dict[key].en, expected, `diag en text drifted for ${key}`);
  }
});

test('CAR-37: with lang=ru the checks come back in Russian, structure unchanged', () => {
  const w = loadDiag('en', 'ru'); // stored preference wins over browser lang
  assert.equal(w.I18n.getLang(), 'ru');
  const r = w.CvDiagnostics.analyze(STRONG_CV);
  assert.equal(typeof r.score, 'number');
  // Array.from copies out of the vm realm so deepEqual is not realm-strict.
  const ids = Array.from(r.checks, (c) => c.id).sort();
  assert.deepEqual(ids, ['buzzwords', 'contact', 'length', 'quantified', 'sections', 'weakVerbs']);
  const length = r.checks.find((c) => c.id === 'length');
  assert.equal(length.label, 'Объём');
  assert.match(length.detail, /слов/);
  // Interpolated {n} is filled with the real word count (Cyrillic, no raw placeholder).
  assert.ok(!/\{n\}|\{pct\}|\{eg\}|\{list\}/.test(JSON.stringify(r.checks)), 'raw placeholder leaked');
  const contact = r.checks.find((c) => c.id === 'contact');
  assert.equal(contact.label, 'Контакты');
  // Long-CV branch: the ru "long" template with the real count interpolated.
  const long = w.CvDiagnostics.analyze(LONG_CV);
  const words = long.words;
  const longCheck = long.checks.find((c) => c.id === 'length');
  assert.equal(longCheck.status, 'warn');
  assert.ok(longCheck.detail.includes(String(words)), `detail should contain the word count ${words}`);
  // Weak verbs: the matched English phrase is quoted inside the ru sentence.
  const weak = long.checks.find((c) => c.id === 'weakVerbs');
  assert.match(weak.detail, /responsible for/);
});

test('CAR-37: every analyze() branch is reachable and localized (ru)', () => {
  const w = loadDiag('en', 'ru');
  const A = (md) => w.CvDiagnostics.analyze(md);
  const byId = (r, id) => r.checks.find((c) => c.id === id);

  // length.tooFew — 10–19 words, non-empty (the <20 fail guard).
  const few = A('# CV\n\n' + 'word '.repeat(12));
  assert.equal(byId(few, 'length').status, 'fail');
  assert.ok(byId(few, 'length').detail.includes(`Всего ${few.words} слов`),
    `unexpected tooFew detail: ${byId(few, 'length').detail}`);

  // Filler prose: no digits, weak verbs, buzzwords, or section keywords.
  const PAD = 'Prose line to push the word count safely over the twenty word floor. ';

  // quantified.warn — a third of the bullets carry numbers.
  const warnQ = A('## Experience\n' + PAD.repeat(2) + '\n- Built the service.\n- Shipped 3 apps.\n- Led the team.\n');
  assert.equal(byId(warnQ, 'quantified').status, 'warn');
  assert.match(byId(warnQ, 'quantified').detail, /33%/);

  // quantified.noBullets — prose only, no bullet lines at all.
  const noBullets = A('## Experience\n' + PAD.repeat(4));
  assert.equal(byId(noBullets, 'quantified').status, 'warn');
  assert.match(byId(noBullets, 'quantified').detail, /Пункты не обнаружены/);

  // weakVerbs.found with 1–2 hits → warn (not fail).
  const weakWarn = A('## Experience\n' + PAD.repeat(2) + '\n- Responsible for the platform.\n- Shipped 3 apps.\n- Led 12 engineers.\n');
  assert.equal(byId(weakWarn, 'weakVerbs').status, 'warn');

  // contact.emailOnly — email but no phone.
  const mail = A('# CV\njane@example.com\n\n## Experience\n' + PAD.repeat(3) + '\n- Shipped 3 apps.\n');
  assert.equal(byId(mail, 'contact').status, 'pass');
  assert.equal(byId(mail, 'contact').detail, 'Найден email (телефон необязателен).');

  // contact.noEmail — neither channel.
  const none = A('# CV\n\n## Experience\n' + PAD.repeat(3) + '\n- Shipped 3 apps at scale.\n');
  assert.equal(byId(none, 'contact').status, 'warn');
  assert.match(byId(none, 'contact').detail, /Email не обнаружен/);

  // sections.missing lists the localized section names.
  const miss = A('# CV\n\n## Experience\n' + PAD.repeat(3) + '\n- Shipped 3 apps.\n');
  const sec = byId(miss, 'sections');
  assert.equal(sec.status, 'warn');
  assert.match(sec.detail, /Образование/);
});

test('CAR-37: non-English for every non-en locale (no Latin-only label leaks)', () => {
  for (const lang of I18N_LANGS) {
    if (lang === 'en') continue;
    const w = loadDiag('en', lang);
    const r = w.CvDiagnostics.analyze(STRONG_CV);
    const label = r.checks.find((c) => c.id === 'length').label;
    assert.notEqual(label, 'Length', `diag.length.label still English for ${lang}`);
  }
});

test('CAR-37: without window.I18n the lib falls back to English, no crash', () => {
  const w = {};
  new Function('window', DIAG_SOURCE)(w); // eslint-disable-line no-new-func
  const r = w.CvDiagnostics.analyze(STRONG_CV);
  assert.equal(r.checks.find((c) => c.id === 'length').label, 'Length');
  assert.equal(r.checks.find((c) => c.id === 'contact').detail, 'Email and phone found.');
});
