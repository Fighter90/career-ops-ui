/**
 * language-preferences — the shared posting-language module (CAR-223).
 *
 * Ports the parent's preferred_languages stack (career-ops #5285 ff092313,
 * #4789 66314d3a) to web-ui:
 *   - the setting is read and reduced the way posting languages are;
 *   - a language ranks by its place in the list, -1 when absent or unknown;
 *   - one provider's jobs are ordered preferred-language first, stably, so the
 *     dedup that keeps the first version keeps the preferred one, and the kept
 *     row of one posting's version group is pickable directly;
 *   - the language a posting URL names is readable back from the URL;
 *   - validatePreferredLanguages mirrors the parent validate-portals.mjs
 *     checks (a list of non-empty language codes; junk rejected with a named
 *     path).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  languageSubtag,
  languageFormsForDedup,
  languageFormsFromUrl,
  resolvePreferredLanguages,
  preferredLanguageRanker,
  orderByPreferredLanguage,
  preferredLanguagePick,
  validatePreferredLanguages,
} from '../server/lib/language-preferences.mjs';

// ── languageSubtag ──────────────────────────────────────────────────
test('languageSubtag reduces a tag to its canonical language subtag', () => {
  assert.equal(languageSubtag('en-GB'), 'en');
  assert.equal(languageSubtag('EN-gb'), 'en');
  assert.equal(languageSubtag('deu'), 'de');
  assert.equal(languageSubtag('en_GB'), 'en');
  assert.equal(languageSubtag('fr_CA'), 'fr');
  assert.equal(languageSubtag('iw'), 'he'); // legacy code → current one
});

test('languageSubtag: anything that is not a tag is compared whole, case-folded', () => {
  assert.equal(languageSubtag('German'), 'german');
  assert.equal(languageSubtag('English (US)'), 'english (us)');
});

test('languageSubtag: empty and non-string values reduce to the empty string', () => {
  assert.equal(languageSubtag(''), '');
  assert.equal(languageSubtag('   '), '');
  assert.equal(languageSubtag(7), '');
  assert.equal(languageSubtag(null), '');
  assert.equal(languageSubtag(undefined), '');
});

// ── languageFormsForDedup ───────────────────────────────────────────
test('languageFormsForDedup: one form for a value, none for junk', () => {
  assert.deepEqual(languageFormsForDedup('en'), ['en']);
  assert.deepEqual(languageFormsForDedup('en-GB'), ['en']);
  assert.deepEqual(languageFormsForDedup(''), []);
  assert.deepEqual(languageFormsForDedup(7), []);
});

// ── languageFormsFromUrl ────────────────────────────────────────────
test('languageFormsFromUrl reads ?lang= (Recruitee)', () => {
  assert.deepEqual(languageFormsFromUrl('https://acme.example/o/qa?lang=en'), ['en']);
});

test('languageFormsFromUrl reads ?language= (Personio) and folds regional variants', () => {
  assert.deepEqual(languageFormsFromUrl('https://acme.example/job/1?language=en-GB'), ['en']);
});

test('languageFormsFromUrl reads ?locale= and folds underscores', () => {
  assert.deepEqual(languageFormsFromUrl('https://acme.example/o/qa?locale=de_DE'), ['de']);
});

test('languageFormsFromUrl: the param name is case-insensitive; the first language param wins', () => {
  assert.deepEqual(languageFormsFromUrl('https://acme.example/o/qa?LANG=en'), ['en']);
  assert.deepEqual(languageFormsFromUrl('https://acme.example/o/qa?lang=de&language=en'), ['de']);
});

test('languageFormsFromUrl: no language param → no form', () => {
  assert.deepEqual(languageFormsFromUrl('https://acme.example/o/qa'), []);
  assert.deepEqual(languageFormsFromUrl('https://acme.example/o/qa?gh_jid=42'), []);
});

test('languageFormsFromUrl: loose values still reduce the way posting languages are compared', () => {
  assert.deepEqual(languageFormsFromUrl('https://acme.example/o/qa?language=German'), ['german']);
});

test('languageFormsFromUrl: junk input → no form, never a throw', () => {
  assert.deepEqual(languageFormsFromUrl(''), []);
  assert.deepEqual(languageFormsFromUrl('not a url'), []);
  assert.deepEqual(languageFormsFromUrl(42), []);
  assert.deepEqual(languageFormsFromUrl(null), []);
  assert.deepEqual(languageFormsFromUrl(undefined), []);
});

// ── resolvePreferredLanguages ───────────────────────────────────────
test('resolvePreferredLanguages: absent → no preference', () => {
  assert.deepEqual(resolvePreferredLanguages({}), []);
  assert.deepEqual(resolvePreferredLanguages(undefined), []);
});

test('resolvePreferredLanguages: a list, best first, reduced to language forms', () => {
  assert.deepEqual(resolvePreferredLanguages({ preferred_languages: ['en-GB', 'deu'] }), ['en', 'de']);
});

test('resolvePreferredLanguages: a single string counts as a one-entry list', () => {
  assert.deepEqual(resolvePreferredLanguages({ preferred_languages: 'en' }), ['en']);
});

test('resolvePreferredLanguages: a repeated language keeps its first place', () => {
  assert.deepEqual(resolvePreferredLanguages({ preferred_languages: ['en', 'fr', 'en-US'] }), ['en', 'fr']);
});

test('resolvePreferredLanguages: entries that are not non-empty strings are skipped', () => {
  assert.deepEqual(resolvePreferredLanguages({ preferred_languages: ['', 7, null, 'fr'] }), ['fr']);
});

// ── preferredLanguageRanker ─────────────────────────────────────────
test('a preferred language ranks by its place, region and case folded', () => {
  const rank = preferredLanguageRanker(['en', 'fr']);
  assert.deepEqual([rank('en'), rank('EN-gb'), rank('fr_CA')], [0, 0, 1]);
});

test('a language not in the list, or none, ranks -1', () => {
  const rank = preferredLanguageRanker(['en', 'fr']);
  assert.deepEqual([rank('de'), rank(''), rank(undefined)], [-1, -1, -1]);
});

// ── orderByPreferredLanguage ────────────────────────────────────────
// Personio / Recruitee shape: the language versions of one posting share a
// URL, the default language first.
const jobs = [
  { url: 'https://acme.example/o/qa?lang=de', language: 'de', title: 'QA (m/w/d)' },
  { url: 'https://acme.example/o/qa?lang=en', language: 'en', title: 'QA (m/f/d)' },
  { url: 'https://acme.example/o/dev', title: 'Dev (no language)' },
  { url: 'https://acme.example/o/ops?lang=fr', language: 'fr', title: 'Ops (fr)' },
  { url: 'https://acme.example/o/pm?lang=en', language: 'en', title: 'PM (en)' },
];

test('orderByPreferredLanguage: preferred languages first, best first; the rest in provider order', () => {
  const rank = preferredLanguageRanker(['en', 'fr']);
  const ordered = orderByPreferredLanguage(jobs, rank);
  assert.deepEqual(ordered.map((j) => j.title), [
    'QA (m/f/d)', 'PM (en)', 'Ops (fr)', 'QA (m/w/d)', 'Dev (no language)',
  ]);
});

test('orderByPreferredLanguage: the provider\'s array is left as it was', () => {
  const rank = preferredLanguageRanker(['en', 'fr']);
  orderByPreferredLanguage(jobs, rank);
  assert.equal(jobs[0].title, 'QA (m/w/d)');
});

test('orderByPreferredLanguage: versions on separate URLs are ordered the same way', () => {
  const rank = preferredLanguageRanker(['en', 'fr']);
  const separateUrls = [
    { url: 'https://jobs.example.com/postings/1001', language: 'de', title: 'QA' },
    { url: 'https://jobs.example.com/postings/1002', language: 'en', title: 'QA' },
  ];
  assert.deepEqual(orderByPreferredLanguage(separateUrls, rank).map((j) => j.language), ['en', 'de']);
});

test('orderByPreferredLanguage: no rank hits → provider order unchanged', () => {
  const rank = preferredLanguageRanker(['ja']);
  assert.deepEqual(orderByPreferredLanguage(jobs, rank).map((j) => j.title), jobs.map((j) => j.title));
});

// ── preferredLanguagePick ───────────────────────────────────────────
test('preferredLanguagePick: the best-ranked version of one posting is the kept row', () => {
  const rows = [
    { language: 'de', title: 'QA (m/w/d)' },
    { language: 'en', title: 'QA (m/f/d)' },
    { language: 'fr', title: 'QA (fr)' },
  ];
  assert.equal(preferredLanguagePick(rows, ['en', 'fr']), rows[1]);
  assert.equal(preferredLanguagePick(rows, ['fr', 'en']), rows[2]);
});

test('preferredLanguagePick: no preferred list → the default-kept rule (the first row)', () => {
  const rows = [{ language: 'de' }, { language: 'en' }];
  assert.equal(preferredLanguagePick(rows, []), rows[0]);
  assert.equal(preferredLanguagePick(rows, undefined), rows[0]);
  assert.equal(preferredLanguagePick(rows, null), rows[0]);
});

test('preferredLanguagePick: no row in a preferred language → the default-kept rule', () => {
  const rows = [{ language: 'de' }, { language: 'fr' }];
  assert.equal(preferredLanguagePick(rows, ['en']), rows[0]);
});

test('preferredLanguagePick: unknown-language rows never beat a preferred one', () => {
  const rows = [{ title: 'untagged' }, { language: 'en', title: 'en' }];
  assert.equal(preferredLanguagePick(rows, ['en']), rows[1]);
});

test('preferredLanguagePick: regional variants and loose spellings fold to the same form', () => {
  const rows = [{ language: 'en-GB' }, { language: 'EN' }];
  assert.equal(preferredLanguagePick(rows, ['en']), rows[0]);
});

test('preferredLanguagePick: stable on ties — the provider\'s first row wins', () => {
  const rows = [{ language: 'en', title: 'first' }, { language: 'en', title: 'second' }];
  assert.equal(preferredLanguagePick(rows, ['en']), rows[0]);
});

test('preferredLanguagePick: empty or non-array input → undefined', () => {
  assert.equal(preferredLanguagePick([], ['en']), undefined);
  assert.equal(preferredLanguagePick(undefined, ['en']), undefined);
  assert.equal(preferredLanguagePick('nope', ['en']), undefined);
});

// ── validatePreferredLanguages (validate-portals.mjs port) ──────────
test('validatePreferredLanguages: a list of codes or a single code is valid', () => {
  assert.deepEqual(validatePreferredLanguages(['en', 'fr']), { ok: true, errors: [] });
  assert.deepEqual(validatePreferredLanguages('en'), { ok: true, errors: [] });
});

test('validatePreferredLanguages: unset is valid (the setting is optional)', () => {
  assert.deepEqual(validatePreferredLanguages(undefined), { ok: true, errors: [] });
});

test('validatePreferredLanguages: a mapping instead of a list is reported at the key', () => {
  const result = validatePreferredLanguages({ en: true });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map((e) => e.path), ['preferred_languages']);
});

test('validatePreferredLanguages: each empty or non-string entry is reported by index', () => {
  const result = validatePreferredLanguages(['en', '', 3]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map((e) => e.path), ['preferred_languages[1]', 'preferred_languages[2]']);
});

test('validatePreferredLanguages: an empty single string is reported at index 0', () => {
  const result = validatePreferredLanguages('   ');
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map((e) => e.path), ['preferred_languages[0]']);
});

test('validatePreferredLanguages: errors name the defect, not just the path', () => {
  const result = validatePreferredLanguages({ en: true });
  assert.match(result.errors[0].message, /list of language codes/i);
  const perEntry = validatePreferredLanguages(['en', '']);
  assert.match(perEntry.errors[0].message, /non-empty language code/i);
});
