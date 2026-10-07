/**
 * Malformed keyword lists in portals.yml / profile.yml must not flip a filter
 * into "match everything" (or crash it), and a broken portals.yml must not be
 * silently replaced by the RU scanner's built-in defaults.
 *
 *   - location_filter.block: [""]          rejected EVERY posting ("" ⊂ all)
 *   - re_apply_windows.*.applied_to: [""]  put the whole company on cooldown
 *   - title_filter.seniority_boost: [""]   boosted every row
 *   - title_filter.negative: [null]        threw in the RU loadConfig (500 on
 *                                          GET /api/scan/regional/config)
 *   - russian_portals.queries: "Senior Go" iterated one query per character
 *   - a whitespace-only location counted as "present"
 *   - malformed YAML → RU scanned with defaults and said nothing
 *
 * Plus the CJK word edge for short title keywords (parent title-keywords.mjs).
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT, stub fetchImpl, no network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let dir;
let lf;
let buildCooldownFilter;
let loadRuConfig;
let runRuScan;
let runEnScan;

const writePortals = (text) => writeFileSync(resolve(dir, 'portals.yml'), text);

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'scan-config-lists-'));
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# cv\n');
  writePortals('tracked_companies: []\n');
  process.env.CAREER_OPS_ROOT = dir;
  lf = await import('../server/lib/location-filter.mjs');
  ({ buildCooldownFilter } = await import('../server/lib/cooldown.mjs'));
  ({ loadConfig: loadRuConfig, runRuScan } = await import('../server/lib/ru-scanner.mjs'));
  ({ runEnScan } = await import('../server/lib/en-scanner.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  rmSync(dir, { recursive: true, force: true });
});

test('cleanStringList: strings only, trimmed, blanks dropped; a non-array is []', () => {
  assert.deepEqual(lf.cleanStringList(['  a ', '', '   ', null, 7, 'b']), ['a', 'b']);
  assert.deepEqual(lf.cleanStringList('a'), []);
  assert.deepEqual(lf.cleanStringList(undefined), []);
});

test('location_filter: a blank / null block entry no longer rejects every posting', () => {
  const ok = lf.buildLocationFilter({ block: ['', '  ', null, 'London'] });
  assert.equal(ok('Berlin'), true);
  assert.equal(ok('London, UK'), false);
});

test('location_filter: an allow list of only blanks restricts nothing', () => {
  const ok = lf.buildLocationFilter({ allow: [''], strict: true });
  assert.equal(ok('Anywhere'), true);
  assert.equal(ok(''), true, 'no restricting tier → strict stays inert');
});

test('location_filter: a whitespace-only location is "missing" (passes; rejected under strict)', () => {
  assert.equal(lf.buildLocationFilter({ allow: ['Remote'] })('   '), true);
  assert.equal(lf.buildLocationFilter({ allow: ['Remote'], strict: true })('  \t'), false);
});

test('cooldown: a blank applied_to entry no longer puts the whole company on cooldown', () => {
  const windows = { Acme: { last_apply_date: '2026-06-01', same_role_days: 90, applied_to: ['', '  ', 'Backend'] } };
  const f = buildCooldownFilter(windows, '2026-06-10');
  assert.equal(f({ company: 'Acme', title: 'Designer' }).skip, false);
  assert.equal(f({ company: 'Acme', title: 'Senior Backend Engineer' }).skip, true);
});

test('title keywords: a CJK character next to a short keyword is a word edge (parent parity)', () => {
  const ai = lf.compileKeyword('ai');
  for (const t of ['ai全栈工程师', 'aiエンジニア', 'ai엔지니어', '资深ai工程师', 'ai engineer']) {
    assert.equal(ai(t), true, t);
  }
  assert.equal(ai('aid worker'), false, 'a Latin continuation is still mid-word');
  assert.equal(ai('maintenance'), false);
  assert.equal(lf.compileKeyword('word:pm')('产品pm'), true);
  assert.equal(lf.compileKeyword('stem:dev')('高级devops'), true);
  // Accented Latin letters are still word characters.
  assert.equal(lf.compileKeyword('vp')('vpé'), false);
});

test('RU loadConfig: null / blank negatives and a string query are normalised, not thrown on', () => {
  writePortals([
    'title_filter:',
    '  negative: [null, "", "  ", "Java"]',
    '  seniority_boost: ["", null, "Senior"]',
    'russian_portals:',
    '  queries: "Senior Go"',
    '  sources: hh',
  ].join('\n'));
  const cfg = loadRuConfig();
  assert.deepEqual(cfg.negative, ['java']);
  assert.deepEqual(cfg.boosts, ['senior']);
  assert.deepEqual(cfg.queries, ['Senior Go'], 'one query, not one per character');
  assert.deepEqual(cfg.sources, ['hh']);
});

test('RU loadConfig: absent keys fall back to the defaults; a non-object section is ignored', () => {
  writePortals('title_filter: "oops"\nrussian_portals: 5\n');
  const cfg = loadRuConfig();
  assert.ok(cfg.queries.length > 0);
  assert.ok(cfg.negative.includes('junior'));
  assert.ok(cfg.sources.length > 0);
  writePortals('- just\n- a list\n');
  assert.ok(loadRuConfig().queries.length > 0, 'a top-level list reads as an empty config');
});

test('RU loadConfig: malformed YAML is an error, not a silent scan with defaults', async () => {
  writePortals('russian_portals:\n  queries: [unclosed\n');
  assert.throws(() => loadRuConfig(), /portals\.yml/);
  await assert.rejects(() => runRuScan({ writeFiles: false, fetchImpl: async () => { throw new Error('no fetch'); } }), /portals\.yml/);
});

test('EN: a blank seniority_boost entry no longer boosts every row', async () => {
  writePortals([
    'tracked_companies:',
    '  - name: Acme',
    '    api: https://boards-api.greenhouse.io/v1/boards/acme/jobs',
    'title_filter:',
    '  seniority_boost: ["", "  ", null, "Senior"]',
  ].join('\n'));
  const fetchImpl = async (url) => new Response(JSON.stringify(String(url).includes('/offices') ? { offices: [] } : {
    jobs: [
      { id: 1, title: 'Senior Engineer', absolute_url: 'https://example.com/1', location: { name: 'Remote' } },
      { id: 2, title: 'Engineer', absolute_url: 'https://example.com/2', location: { name: 'Remote' } },
    ],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  const r = await runEnScan({ writeFiles: false, fetchImpl });
  const boosted = Object.fromEntries(r.fresh.map((j) => [j.title, !!j._boosted]));
  assert.deepEqual(boosted, { 'Senior Engineer': true, Engineer: false });
});
