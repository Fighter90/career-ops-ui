/**
 * Scan dedup — language versions sharing a URL key (CAR-223, upstream #4789).
 *
 * Personio serves every language version of a posting at one URL that differs
 * only in a language param (`/job/<id>?language=<code>`). url-key.mjs strips
 * `language` / `lang` / `locale` from the canonical key, so those versions
 * collapse into ONE key — and without `scan_history.dedup_include_language`
 * a seen posting's other-language version dedups away, exactly as before.
 * With the switch on, the seen filter consults the versions each seen URL
 * recorded (scan-history / pipeline / applications) and keeps a language no
 * seen row was in; a seen row that recorded no language resolves against this
 * run's own versions of the posting — by title, else as the first version
 * (the provider emits a posting's default language first).
 *
 * Adapted from the parent's tests/scan-dedup-url-language.test.mjs to web-ui's
 * seams (runEnScan + collectSeenUrls over a temp CAREER_OPS_ROOT; a stub
 * adapter stands in for the per-language source).
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT, stub adapter, no network.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { normalizeUrl } from '../server/lib/url-key.mjs';

let dir;
let en;
let ALL_ADAPTERS;

const data = (f) => resolve(dir, 'data', f);
const writePortals = (lines) => writeFileSync(resolve(dir, 'portals.yml'), lines.join('\n'));

const URL_BARE = 'https://acme.jobs.personio.de/job/2825443';
const URL_DE = `${URL_BARE}?language=de`;
const URL_EN = `${URL_BARE}?language=en`;
const TITLE_DE = 'Quality Assurance Engineer (m/w/d) - remote DE';
const TITLE_EN = 'Quality Assurance Engineer (m/f/d) - remote GER';

/** Fold a title the way the seen-version machinery compares them. */
const titleKey = (t) => String(t ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

/** Row a language-aware source emits: same posting, one URL base, per language. */
const row = (title, url, language) => ({ title, url, language });

/**
 * Register a stub adapter that returns the given rows verbatim (they already
 * carry `language`), run `fn`, then unregister. No fetchImpl needed — the
 * rows are the fixture.
 */
async function withLangAdapter(rows, fn) {
  const adapter = {
    id: 'zz-lang-dedup',
    matches: (c) => c.provider === 'zz-lang-dedup',
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

/** Seed a parent-format seen row for `url` (title, status, optional language cell). */
function seedParentRow(url, title, status = 'added', language = '') {
  const cells = [url, '2026-09-01', 'personio-api', title, 'Acme', status,
    '', '', '', '', '', '', '', language, ''];
  writeFileSync(data('scan-history.tsv'), [
    'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\tfingerprint\tposted_at\ttrust_score\ttrust_flags\tnormalized_company\trequisition_id\tlanguage\tlisting_key',
    cells.join('\t'),
  ].join('\n'));
}

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'scan-dedup-url-language-'));
  mkdirSync(dir, { recursive: true });
  mkdirSync(data(''), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# cv\n');
  writePortals(['tracked_companies:', '  - { name: LangCo, provider: zz-lang-dedup }']);
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

// ── url-key: the language param stops carrying identity ─────────────

test('url-key: language/lang/locale params do not change the canonical key', () => {
  assert.equal(normalizeUrl(URL_DE), normalizeUrl(URL_EN));
  assert.equal(normalizeUrl(URL_DE), normalizeUrl(URL_BARE), 'the bare URL is the same posting');
  assert.equal(normalizeUrl('https://x.example/j/1?lang=en-GB'), normalizeUrl('https://x.example/j/1'));
  assert.equal(normalizeUrl('https://x.example/j/1?Locale=fr'), normalizeUrl('https://x.example/j/1'));
  // genuinely functional params keep splitting keys
  assert.notEqual(normalizeUrl('https://x.example/j/1?gh_jid=2'), normalizeUrl('https://x.example/j/1?gh_jid=3'));
  assert.notEqual(normalizeUrl('https://x.example/j/1'), normalizeUrl('https://x.example/j/2'));
});

// ── the opt-in switch ───────────────────────────────────────────────

test('resolveDedupIncludeLanguage: strict boolean true only', () => {
  assert.equal(en.resolveDedupIncludeLanguage({}), false);
  assert.equal(en.resolveDedupIncludeLanguage({ scan_history: {} }), false);
  assert.equal(en.resolveDedupIncludeLanguage({ scan_history: { dedup_include_language: true } }), true);
  for (const v of ['yes', 1, null]) {
    assert.equal(en.resolveDedupIncludeLanguage({ scan_history: { dedup_include_language: v } }), false, String(v));
  }
});

// ── collectSeenUrls records the seen versions ───────────────────────

test('collectSeenUrls: records a version for every pinned URL, from each source', () => {
  writeFileSync(data('scan-history.tsv'), [
    'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\tfingerprint\tposted_at\ttrust_score\ttrust_flags\tnormalized_company\trequisition_id\tlanguage\tlisting_key',
    // parent-format row with a language cell — the cell wins, region folded
    [URL_BARE, '2026-09-01', 'personio-api', TITLE_DE, 'Acme', 'added', '', '', '', '', '', '', '', 'de-DE', ''].join('\t'),
    // parent-format row without a language cell — its URL param speaks
    ['https://acme.jobs.personio.de/job/7?language=en', '2026-09-01', 'personio-api', 'Seven', 'Acme', 'added'].join('\t'),
    // web-ui-format row (url last): the title cell is recorded, no language cell
    ['2026-06-02\tgreenhouse\t8\tAcme\tEight\thttps://acme.jobs.personio.de/job/8'].join('\t'),
    // observational row: pins nothing, records nothing
    ['https://acme.jobs.personio.de/job/9', '2026-06-01', 'greenhouse', 'Nine', 'Acme', 'skipped_age'].join('\t'),
  ].join('\n'));
  writeFileSync(data('pipeline.md'), [
    '## Pending',
    `- [ ] ${URL_EN} | Acme | ${TITLE_EN}`,
    '```',
    'https://acme.jobs.personio.de/job/10?language=fr | 120k',
    '```',
  ].join('\n'));
  writeFileSync(data('applications.md'),
    '| 1 | 2026-09-01 | Acme | Role | 4.0/5 | Applied | ❌ | — | https://acme.jobs.personio.de/job/11?language=de |');

  const { seen, variants } = en.collectSeenUrls();
  const at = (url) => variants.get(normalizeUrl(url));

  assert.deepEqual(at(URL_BARE)[0], { languages: ['de'], title: titleKey(TITLE_DE) },
    'the language cell wins and folds the region; the title rides along');
  assert.deepEqual(at(URL_BARE)[1], { languages: ['en'], title: titleKey(TITLE_EN) },
    'the pipeline row shares the stripped key and rides on the same version list');
  assert.deepEqual(at('https://acme.jobs.personio.de/job/7'), [{ languages: ['en'], title: 'seven' }],
    'a row without a language cell falls back to its URL param');
  assert.deepEqual(at('https://acme.jobs.personio.de/job/8'), [{ languages: [], title: 'eight' }],
    'web-ui-format row: unknown language, its title recorded');
  assert.deepEqual(at('https://acme.jobs.personio.de/job/10'),
    [{ languages: ['fr'], title: '' }],
    'fenced pipeline row: language from the param, comp cell is not a title');
  assert.deepEqual(at('https://acme.jobs.personio.de/job/11'), [{ languages: ['de'], title: '' }],
    'applications.md URL: language from the param, no title');
  assert.equal(seen.has(normalizeUrl('https://acme.jobs.personio.de/job/9')), false);
  assert.equal(at('https://acme.jobs.personio.de/job/9'), undefined,
    'a row the observational statuses exempt records no version');
});

// ── (a) without the switch the behavior is unchanged ────────────────

test('dedup_include_language OFF: a ?language=de variant of a seen ?language=en posting is a duplicate', async () => {
  seedParentRow(URL_EN, TITLE_EN);
  await withLangAdapter([row(TITLE_DE, URL_DE, 'de')], async () => {
    const r = await en.runEnScan({ writeFiles: false });
    assert.deepEqual(r.fresh.map((j) => j.language), [], 'the variant dedups away');
    assert.equal(r.counts.dup, 1);
  });
});

// ── (b) with the switch the unseen language version is NEW ──────────

test('dedup_include_language ON: the de variant of a seen en posting is NEW', async () => {
  seedParentRow(URL_EN, TITLE_EN);
  writePortals([
    'tracked_companies:',
    '  - { name: LangCo, provider: zz-lang-dedup }',
    'scan_history:',
    '  dedup_include_language: true',
  ]);
  await withLangAdapter([row(TITLE_DE, URL_DE, 'de')], async () => {
    const r = await en.runEnScan({ writeFiles: false });
    assert.deepEqual(r.fresh.map((j) => j.language), ['de']);
    assert.equal(r.counts.dup, 0, 'nothing fetched was dropped — the seen en row was history, not a fetch');
  });
});

test('dedup_include_language ON: the seen language itself stays a duplicate', async () => {
  seedParentRow(URL_EN, TITLE_EN);
  writePortals([
    'tracked_companies:',
    '  - { name: LangCo, provider: zz-lang-dedup }',
    'scan_history:',
    '  dedup_include_language: true',
  ]);
  await withLangAdapter([row(TITLE_EN, URL_EN, 'en')], async () => {
    const r = await en.runEnScan({ writeFiles: false });
    assert.deepEqual(r.fresh.map((j) => j.language), []);
    assert.equal(r.counts.dup, 1);
  });
});

// ── resolving a seen row that recorded no language ──────────────────

test('a seen row without a language resolves by title: its language stays seen, the other is new', async () => {
  // web-ui-format row, param-less URL, German title: the row is a language
  // version of this posting, but which one only the title can say.
  writeFileSync(data('scan-history.tsv'),
    `2026-06-02\tgreenhouse\t8\tAcme\t${TITLE_DE}\t${URL_BARE}`);
  writePortals([
    'tracked_companies:',
    '  - { name: LangCo, provider: zz-lang-dedup }',
    'scan_history:',
    '  dedup_include_language: true',
  ]);
  await withLangAdapter([row(TITLE_DE, URL_DE, 'de'), row(TITLE_EN, URL_EN, 'en')], async () => {
    const r = await en.runEnScan({ writeFiles: false });
    assert.deepEqual(r.fresh.map((j) => j.language), ['en'],
      'the German row is the seen one; the English version is new');
    assert.equal(r.counts.dup, 1);
  });
});

test('a seen row without a language and without a title match resolves as the first version', async () => {
  writeFileSync(data('scan-history.tsv'),
    `2026-06-02\tgreenhouse\t8\tAcme\tRetitled since\t${URL_BARE}`);
  writePortals([
    'tracked_companies:',
    '  - { name: LangCo, provider: zz-lang-dedup }',
    'scan_history:',
    '  dedup_include_language: true',
  ]);
  // Provider order: the posting's default language (de) first.
  await withLangAdapter([row(TITLE_DE, URL_DE, 'de'), row(TITLE_EN, URL_EN, 'en')], async () => {
    const r = await en.runEnScan({ writeFiles: false });
    assert.deepEqual(r.fresh.map((j) => j.language), ['en'],
      'the row is the first version (de); the second is new');
    assert.equal(r.counts.dup, 1);
  });
});

// ── conservative answers ────────────────────────────────────────────

test('a candidate of unknown language stays a duplicate even with the switch on', async () => {
  seedParentRow(URL_EN, TITLE_EN);
  writePortals([
    'tracked_companies:',
    '  - { name: LangCo, provider: zz-lang-dedup }',
    'scan_history:',
    '  dedup_include_language: true',
  ]);
  await withLangAdapter([row('Whatever', URL_BARE, undefined)], async () => {
    const r = await en.runEnScan({ writeFiles: false });
    assert.deepEqual(r.fresh.map((j) => j.title), []);
    assert.equal(r.counts.dup, 1);
  });
});

test('dedup_include_language ON: same-run versions of one URL are BOTH kept', async () => {
  writePortals([
    'tracked_companies:',
    '  - { name: LangCo, provider: zz-lang-dedup }',
    'scan_history:',
    '  dedup_include_language: true',
  ]);
  // Same URL, two language fields — the key collides; the switch keeps both.
  await withLangAdapter([row(TITLE_DE, URL_BARE, 'de'), row(TITLE_EN, URL_BARE, 'en')], async () => {
    const r = await en.runEnScan({ writeFiles: false });
    assert.deepEqual(r.fresh.map((j) => j.language), ['de', 'en']);
    assert.equal(r.counts.runDup, 0);
  });
});
