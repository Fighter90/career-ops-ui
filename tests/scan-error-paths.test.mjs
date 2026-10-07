/**
 * Error / edge paths of the scanner support modules that the feature tests do
 * not reach: liveness classifier + API rung, trust validator on a bad URL, the
 * TSV sanitizers, cooldown config parsing, EN quarantine persistence and trust
 * annotation, and the RU dispatcher's unknown-source / trust / boost paths.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT, injected safeGet / fetchImpl, no network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let dir;
let mods;

const writePortals = (lines) => writeFileSync(resolve(dir, 'portals.yml'), lines.join('\n'));
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'scan-error-paths-'));
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# cv\n');
  writePortals(['tracked_companies: []']);
  process.env.CAREER_OPS_ROOT = dir;
  mods = {
    core: await import('../server/lib/liveness-core.mjs'),
    api: await import('../server/lib/liveness-api.mjs'),
    trust: await import('../server/lib/trust-validator.mjs'),
    sanitize: await import('../server/lib/scan-sanitize.mjs'),
    cooldown: await import('../server/lib/cooldown.mjs'),
    en: await import('../server/lib/en-scanner.mjs'),
    ru: await import('../server/lib/ru-scanner.mjs'),
    q: await import('../server/lib/scan-quarantine.mjs'),
  };
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  rmSync(dir, { recursive: true, force: true });
});

test('classifyLiveness: bot wall, error redirect, off-posting redirect, soft expiry, listing page', () => {
  const { classifyLiveness } = mods.core;
  const long = ' lorem ipsum'.repeat(40);
  assert.equal(classifyLiveness({ status: 200, bodyText: 'Just a moment...' }).code, 'bot_challenge');
  assert.equal(classifyLiveness({ status: 200, finalUrl: 'https://x.test/jobs?error=true', bodyText: long }).code, 'expired_url');
  assert.equal(classifyLiveness({
    status: 200, requestedUrl: 'https://x.test/jobs/1234567', finalUrl: 'https://x.test/search', bodyText: long,
  }).code, 'redirected_off_posting');
  assert.equal(classifyLiveness({ status: 200, bodyText: `Job expired. ${long}` }).code, 'expired_body_soft');
  assert.equal(classifyLiveness({ status: 200, bodyText: `120 jobs found ${long}` }).code, 'listing_page');
  assert.equal(classifyLiveness({ status: 200, bodyText: long, applyControls: 'not-an-array' }).code, 'no_apply_control');
});

test('checkLivenessViaApi: every inconclusive path returns null, never a false expired', async () => {
  const { checkLivenessViaApi } = mods.api;
  const gh = 'https://boards.greenhouse.io/acme/jobs/123';
  const sr = 'https://jobs.smartrecruiters.com/Acme/744000012345678-engineer';
  const ashby = 'https://jobs.ashbyhq.com/acme/0b6c1f9e-1234-4abc-8def-0123456789ab';
  const via = (res) => ({ safeGet: async () => (typeof res === 'function' ? res() : res) });
  assert.equal(await checkLivenessViaApi('https://example.com/careers', via({ status: 200 })), null, 'not an ATS');
  assert.equal(await checkLivenessViaApi(gh, via(() => { throw new Error('ETIMEDOUT'); })), null);
  assert.equal(await checkLivenessViaApi(gh, via(null)), null);
  assert.equal(await checkLivenessViaApi(gh, via({ status: 200, finalUrl: 'https://evil.test/x' })), null, 'cross-origin landing');
  assert.equal(await checkLivenessViaApi(gh, via({ status: 200, finalUrl: 'not a url' })), null);
  assert.equal(await checkLivenessViaApi(sr, via({ status: 404 })), null, 'SmartRecruiters 404 is not authoritative');
  assert.equal(await checkLivenessViaApi(ashby, via({ status: 200, text: '{not json' })), null);
  assert.equal(await checkLivenessViaApi(gh, via({ status: 503 })), null);
  assert.equal((await checkLivenessViaApi(gh, via({ status: 410 }))).result, 'expired');
  assert.equal((await checkLivenessViaApi(gh, via({ status: 200 }))).result, 'active');
});

test('trust validator: an invalid URL is flagged and scored down, not thrown on', () => {
  const v = mods.trust.buildTrustValidator({ enabled: true })({ title: 'Engineer', company: 'Acme', url: 'javascript:alert(1)' });
  assert.ok(v.flags.includes('invalid_url'));
  assert.ok(v.score >= 0);
});

test('scan sanitizers: nullish values, separators and formula prefixes', () => {
  const { normalizeScanScalar, normalizeScanUrl, sanitizeTsvField } = mods.sanitize;
  assert.equal(normalizeScanScalar(undefined), '');
  assert.equal(normalizeScanScalar('a\t\tb c'), 'a b c');
  assert.equal(normalizeScanUrl(null), '');
  assert.equal(normalizeScanUrl('  https://x.test/1\nInjected\trow '), 'https://x.test/1');
  assert.equal(sanitizeTsvField('=HYPERLINK("x")'), '\'=HYPERLINK("x")');
  assert.equal(sanitizeTsvField('-1'), "'-1");
  assert.equal(sanitizeTsvField('plain'), 'plain');
});

test('loadReApplyWindows: malformed YAML and a missing path are fail-soft {}', () => {
  const p = resolve(dir, 'config', 'profile.yml');
  writeFileSync(p, 're_apply_windows: [unclosed\n');
  assert.deepEqual(mods.cooldown.loadReApplyWindows(p), {});
  assert.deepEqual(mods.cooldown.loadReApplyWindows(''), {});
  writeFileSync(p, 'candidate: {}\n');
});

test('EN: a 404 source is quarantined on disk with its url; trust_filter annotates rows', async () => {
  writePortals([
    'tracked_companies:',
    '  - name: Gone',
    '    api: https://boards-api.greenhouse.io/v1/boards/gone/jobs',
    '  - name: Live',
    '    api: https://boards-api.greenhouse.io/v1/boards/live/jobs',
    'trust_filter:',
    '  enabled: true',
  ]);
  const fetchImpl = async (url) => {
    const u = String(url);
    if (u.includes('/offices')) return json({ offices: [] });
    if (u.includes('/gone/')) return new Response('nf', { status: 404 });
    return json({ jobs: [{ id: 1, title: 'Engineer', company_name: 'Live', absolute_url: 'https://boards.greenhouse.io/live/jobs/1', location: { name: 'Remote' } }] });
  };
  const r = await mods.en.runEnScan({ fetchImpl });
  assert.equal(typeof r.fresh[0]._trustScore, 'number');
  const saved = JSON.parse(readFileSync(mods.q.QUARANTINE_PATH, 'utf8'));
  assert.equal(saved.entries.Gone.url, 'https://boards-api.greenhouse.io/v1/boards/gone/jobs');
  assert.equal(saved.entries.Gone.status, 404);
  assert.match(readFileSync(resolve(dir, 'data', 'pipeline.md'), 'utf8'), /live\/jobs\/1/);
});

test('RU: unknown source is logged and skipped; trust + boost stamps applied', async () => {
  writePortals([
    'title_filter:',
    '  seniority_boost: ["Senior"]',
    'trust_filter:',
    '  enabled: true',
    'russian_portals:',
    '  sources: [nope, trudvsem]',
    '  queries: ["Go"]',
  ]);
  const logs = [];
  const fetchImpl = async () => json({ results: { vacancies: [
    { vacancy: { id: 'v1', 'job-name': 'Senior Go developer', vac_url: 'https://trudvsem.ru/vacancy/v1' } },
    { vacancy: { id: 'v2', 'job-name': 'Go developer', vac_url: 'https://trudvsem.ru/vacancy/v2' } },
  ] } });
  const r = await mods.ru.runRuScan({ writeFiles: false, fetchImpl, onLog: (_s, l) => logs.push(l) });
  assert.ok(logs.some((l) => /unknown source "nope"/.test(l)));
  const byTitle = Object.fromEntries(r.fresh.map((j) => [j.title, j]));
  assert.equal(byTitle['Senior Go developer']._boosted, true);
  assert.equal(byTitle['Go developer']._boosted, undefined);
  assert.equal(typeof byTitle['Go developer']._trustScore, 'number');
});

test('EN: no portals.yml is an empty scan, not a crash', async () => {
  rmSync(resolve(dir, 'portals.yml'));
  try {
    const r = await mods.en.runEnScan({ writeFiles: false });
    assert.equal(r.counts.raw, 0);
  } finally {
    writePortals(['tracked_companies: []']);
  }
});

test('EN: legacy `companies:` key, scan_quarantine off, nameless entry, message-only 404, cooldown, odd urls', async () => {
  writePortals([
    'scan_quarantine: false',
    'companies:',
    '  - api: https://boards-api.greenhouse.io/v1/boards/anon/jobs',
    '  - name: Acme',
    '    api: https://boards-api.greenhouse.io/v1/boards/acme/jobs',
  ]);
  writeFileSync(resolve(dir, 'config', 'profile.yml'), [
    're_apply_windows:',
    '  Acme:',
    '    last_apply_date: "2999-01-01"',
    '    applied_to: ["Recruiter"]',
  ].join('\n'));
  const logs = [];
  const fetchImpl = async (url) => {
    const u = String(url);
    if (u.includes('/offices')) return json({ offices: [] });
    if (u.includes('/anon/')) throw new Error('Greenhouse: HTTP 404 (no status field)');
    return json({ jobs: [
      { id: 1, title: 'Recruiter', company_name: 'Acme', absolute_url: 'https://example.com/r', location: { name: 'Remote' } },
      { id: 2, title: 'Engineer', company_name: 'Acme', absolute_url: 'https://example.com/e', location: { name: 'Remote' } },
    ] });
  };
  try {
    const r = await mods.en.runEnScan({ writeFiles: false, fetchImpl, onLog: (_s, l) => logs.push(l) });
    assert.equal(r.counts.cooldownSkipped, 1);
    assert.ok(logs.some((l) => /Cooldown skipped:\s+1/.test(l)));
    assert.equal(r.errors.length, 1, 'the nameless 404 is an error, and quarantine is off');
    assert.deepEqual(r.fresh.map((j) => j.title), ['Engineer']);
  } finally {
    writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate: {}\n');
  }
});

test('EN: companyName filter tolerates a nameless entry', async () => {
  writePortals([
    'tracked_companies:',
    '  - api: https://boards-api.greenhouse.io/v1/boards/anon/jobs',
    '  - name: Acme',
    '    api: https://boards-api.greenhouse.io/v1/boards/acme/jobs',
  ]);
  const seen = [];
  await mods.en.runEnScan({ writeFiles: false, companyName: 'acme', fetchImpl: async (url) => { seen.push(String(url)); return json({ jobs: [] }); } });
  assert.ok(seen.every((u) => u.includes('/acme/')));
});

test('saveLastScan merge: payload without fresh/filtered arrays and rows without url', () => {
  const p = resolve(dir, 'data', 'last-scan.json');
  writeFileSync(p, JSON.stringify({ en: { kind: 'en', filtered: [{ company: 'Keep', url: 'not-a-url' }] } }));
  mods.en.saveLastScan({ kind: 'en', errors: [] }, { mergeCompanies: [null, 'X'] });
  const snap = JSON.parse(readFileSync(p, 'utf8')).en;
  assert.deepEqual(snap.filtered, [{ company: 'Keep', url: 'not-a-url' }]);
  assert.deepEqual(snap.fresh, []);
});

test('quarantine helpers: add to a bare object, defaults, prune tolerates a missing map', () => {
  const qq = mods.q.quarantineAdd({}, 'A');
  assert.equal(qq.entries.A.url, '');
  assert.equal(qq.entries.A.status, 'permanent');
  assert.deepEqual(mods.q.pruneQuarantine({}), {});
});

test('cooldown: config validation and matcher edge cases', () => {
  const p = resolve(dir, 'config', 'profile.yml');
  writeFileSync(p, [
    're_apply_windows:',
    '  Dated: { last_apply_date: 2026-05-01, same_role_days: 30, cross_role_bucket: backend_roles }',
    '  NullWin: null',
    '  BadDate: { last_apply_date: "2026-13-45" }',
    '  NegDays: { last_apply_date: "2026-05-01", same_role_days: -1 }',
    '  NotArray: { last_apply_date: "2026-05-01", applied_to: "Engineer" }',
    '  NonString: { last_apply_date: "2026-05-01", applied_to: [1] }',
    '  BadBucket: { last_apply_date: "2026-05-01", cross_role_bucket: 5 }',
    '  Lead: { last_apply_date: "2026-05-01", same_role_days: 60, cross_role_bucket: em_all }',
  ].join('\n'));
  try {
    const w = mods.cooldown.loadReApplyWindows(p);
    assert.deepEqual(Object.keys(w).sort(), ['Dated', 'Lead'], 'an unquoted YAML date is coerced; invalid windows dropped');
    assert.equal(w.Dated.last_apply_date, '2026-05-01');
    const f = mods.cooldown.buildCooldownFilter({ ...w, NoDate: { last_apply_date: '' } }, '2026-05-10');
    assert.equal(f({ company: 'Dated', title: 'Backend Engineer' }).skip, true, 'bucket keyword');
    assert.equal(f({ company: 'Lead', title: 'EM, Payments' }).skip, true, '"em" is a whole word');
    assert.equal(f({ company: 'Lead', title: 'Engineering Manager' }).skip, true);
    assert.equal(f({ company: 'Lead', title: 'System Engineer' }).skip, false, '"em" inside a word is not a hit');
    assert.equal(f({ company: 'NoDate', title: 'x' }).skip, false);
    assert.equal(f(null).skip, false);
    assert.equal(mods.cooldown.buildCooldownFilter({}, '2026-05-10')({ company: 'x' }).skip, false);
  } finally {
    writeFileSync(p, 'candidate: {}\n');
  }
});

test('companyMatch: different corporate forms are different companies', () => {
  const { companyMatch } = mods.cooldown;
  assert.equal(companyMatch('株式会社メルカリ', 'メルカリ'), true);
  assert.equal(companyMatch('株式会社ゾロ', '合同会社ゾロ'), false);
  assert.equal(companyMatch('Acme Corp', 'Acme'), true);
});

test('collage / feishu adapters: non-object entries and auto-detect by host', async () => {
  const { collageAdapter } = await import('../server/lib/portals/adapters/collage.mjs');
  const { feishuJobsAdapter } = await import('../server/lib/portals/adapters/feishu-jobs.mjs');
  for (const a of [collageAdapter, feishuJobsAdapter]) {
    assert.equal(a.matches(null), false);
    assert.equal(a.matches('x'), false);
    assert.equal(a.buildEndpoint(null), null);
  }
  assert.equal(collageAdapter.matches({ careers_url: 'https://secure.collage.co/jobs/acme' }), true);
  assert.equal(collageAdapter.matches({ api: 'not a url' }), false);
  assert.equal(collageAdapter.matches({ api: 'https://api.collage.co.evil.test/v1' }), false);
  assert.equal(feishuJobsAdapter.matches({ careers_url: 'https://acme.jobs.feishu.cn' }), true);
  assert.equal(feishuJobsAdapter.matches({ careers_url: 'https://jobs.feishu.cn.evil.test' }), false);
});
