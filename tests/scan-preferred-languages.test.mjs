/**
 * preferred_languages — the scan keeps the version of a posting in a language
 * the candidate wants (CAR-223, upstream #5285).
 *
 * portals.yml may carry a top-level `preferred_languages` list, best first.
 * The scanner orders one provider's jobs preferred-language first (stable),
 * so the dedup — which keeps the FIRST version of a posting it meets when
 * dedup_include_language is off, and every version in this order when it is
 * on — keeps the preferred one. Ordering only: it never filters a posting
 * out.
 *
 * Adapted from the parent's tests/scan-preferred-languages.test.mjs to
 * web-ui's seams (the pure helpers live in language-preferences.mjs, the
 * scan-level pick is observable through runEnScan over a temp
 * CAREER_OPS_ROOT with a stub adapter).
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT, stub adapter, no network.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { resolvePreferredLanguages, preferredLanguagePick } from '../server/lib/language-preferences.mjs';

let dir;
let en;
let ALL_ADAPTERS;

const data = (f) => resolve(dir, 'data', f);
const writePortals = (lines) => writeFileSync(resolve(dir, 'portals.yml'), lines.join('\n'));

async function withLangAdapter(rows, fn) {
  const adapter = {
    id: 'zz-lang-pref',
    matches: (c) => c.provider === 'zz-lang-pref',
    buildEndpoint: () => 'https://lang.test/api',
    fetch: async () => rows.map((r, i) => ({ id: String(i + 1), location: 'Remote', ...r })),
  };
  ALL_ADAPTERS.unshift(adapter);
  try {
    return await fn();
  } finally {
    ALL_ADAPTERS.splice(ALL_ADAPTERS.indexOf(adapter), 1);
  }
}

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'scan-preferred-languages-'));
  mkdirSync(data(''), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# cv\n');
  writePortals(['tracked_companies:', '  - { name: LangCo, provider: zz-lang-pref }']);
  process.env.CAREER_OPS_ROOT = dir;
  en = await import('../server/lib/en-scanner.mjs');
  ({ ALL_ADAPTERS } = await import('../server/lib/portals/registry.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  for (const f of readdirSync(data(''))) rmSync(data(f), { force: true });
});

// ── reading the setting ─────────────────────────────────────────────

test('resolvePreferredLanguages: absent → no preference', () => {
  assert.deepEqual(resolvePreferredLanguages({}), []);
  assert.deepEqual(resolvePreferredLanguages({ preferred_languages: null }), []);
});

test('resolvePreferredLanguages: a list is reduced the way posting languages are', () => {
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

// ── the ordering ────────────────────────────────────────────────────

const rank = (rows, preferred) => preferredLanguagePick(rows, preferred);

test('preferredLanguagePick: preferred languages first, best first; the rest in provider order', () => {
  const jobs = [
    { url: 'https://acme.example/o/qa?lang=de', language: 'de', title: 'QA (m/w/d)' },
    { url: 'https://acme.example/o/qa?lang=en', language: 'en', title: 'QA (m/f/d)' },
    { url: 'https://acme.example/o/dev', title: 'Dev (no language)' },
    { url: 'https://acme.example/o/ops?lang=fr', language: 'fr', title: 'Ops (fr)' },
    { url: 'https://acme.example/o/pm?lang=en', language: 'en', title: 'PM (en)' },
  ];
  const ordered = rank(jobs, ['en', 'fr']);
  assert.deepEqual(ordered.map((j) => j.title),
    ['QA (m/f/d)', 'PM (en)', 'Ops (fr)', 'QA (m/w/d)', 'Dev (no language)']);
  assert.equal(jobs[0].title, 'QA (m/w/d)', 'the provider\'s array is left as it was');
});

test('preferredLanguagePick: the sort is stable — ties keep the provider\'s order', () => {
  const jobs = [
    { url: 'https://a.example/1', language: 'de', title: 'A1' },
    { url: 'https://a.example/2', language: 'en', title: 'A2' },
    { url: 'https://a.example/3', language: 'en', title: 'A3' },
    { url: 'https://a.example/4', language: 'fr', title: 'A4' },
  ];
  assert.deepEqual(rank(jobs, ['en']).map((j) => j.title), ['A2', 'A3', 'A1', 'A4']);
});

test('preferredLanguagePick: versions on separate URLs are ordered the same way', () => {
  const separateUrls = [
    { url: 'https://jobs.example.com/postings/1001', language: 'de', requisitionId: 'R-7', title: 'QA' },
    { url: 'https://jobs.example.com/postings/1002', language: 'en', requisitionId: 'R-7', title: 'QA' },
  ];
  assert.deepEqual(rank(separateUrls, ['en']).map((j) => j.language), ['en', 'de']);
});

// ── the scan-level pick ─────────────────────────────────────────────

const SWITCH_ON = [
  'tracked_companies:',
  '  - { name: LangCo, provider: zz-lang-pref }',
  'scan_history:',
  '  dedup_include_language: true',
];

test('preferred_languages + switch OFF: the scan keeps the preferred version', async () => {
  writePortals([
    'tracked_companies:',
    '  - { name: LangCo, provider: zz-lang-pref }',
    'preferred_languages: [en]',
  ]);
  await withLangAdapter([
    { title: 'QA (m/w/d)', url: 'https://acme.jobs.personio.de/job/1?language=de', language: 'de' },
    { title: 'QA (m/f/d)', url: 'https://acme.jobs.personio.de/job/1?language=en', language: 'en' },
  ], async () => {
    const r = await en.runEnScan({ writeFiles: false });
    assert.deepEqual(r.fresh.map((j) => j.language), ['en'], 'the dedup keeps the first row it meets — the preferred one');
    assert.equal(r.counts.runDup, 1);
  });
});

test('preferred_languages + switch ON: every version is kept, preferred order first', async () => {
  writePortals([...SWITCH_ON, 'preferred_languages: [en]']);
  await withLangAdapter([
    { title: 'QA (m/w/d)', url: 'https://acme.jobs.personio.de/job/1?language=de', language: 'de' },
    { title: 'QA (m/f/d)', url: 'https://acme.jobs.personio.de/job/1?language=en', language: 'en' },
  ], async () => {
    const r = await en.runEnScan({ writeFiles: false });
    assert.deepEqual(r.fresh.map((j) => j.language), ['en', 'de']);
    assert.equal(r.counts.runDup, 0);
  });
});

test('preferred_languages does not override the seen dedup: the seen language stays seen', async () => {
  writeFileSync(data('scan-history.tsv'), [
    'url\tfirst_seen\tportal\ttitle\tcompany\tstatus',
    'https://acme.jobs.personio.de/job/1?language=en\t2026-09-01\tpersonio-api\tQA (m/f/d)\tAcme\tadded',
  ].join('\n'));
  writePortals([...SWITCH_ON, 'preferred_languages: [en]']);
  await withLangAdapter([
    { title: 'QA (m/w/d)', url: 'https://acme.jobs.personio.de/job/1?language=de', language: 'de' },
    { title: 'QA (m/f/d)', url: 'https://acme.jobs.personio.de/job/1?language=en', language: 'en' },
  ], async () => {
    const r = await en.runEnScan({ writeFiles: false });
    assert.deepEqual(r.fresh.map((j) => j.language), ['de'],
      'ordering decides which version is kept, never whether one is');
    assert.equal(r.counts.dup, 1);
  });
});

test('preferred_languages with no language rows keeps the provider\'s order', async () => {
  writePortals([...SWITCH_ON, 'preferred_languages: [en]']);
  await withLangAdapter([
    { title: 'Dev A', url: 'https://acme.jobs.personio.de/job/a' },
    { title: 'Dev B', url: 'https://acme.jobs.personio.de/job/b' },
  ], async () => {
    const r = await en.runEnScan({ writeFiles: false });
    assert.deepEqual(r.fresh.map((j) => j.title), ['Dev A', 'Dev B']);
  });
});
