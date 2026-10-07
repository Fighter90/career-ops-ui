/**
 * Scanner bookkeeping: within-run dedup, the seen-set, quarantine keying, the
 * per-source cap and partial-result warnings.
 *
 *   - EN had no within-run dedup: a posting reached twice (a utm_ variant, two
 *     boards) was appended to pipeline + history twice. RU deduped the RAW url.
 *   - parent scan-history rows with status skipped_location / skipped_age only
 *     RECORD a cut; they must not pin the URL as seen (upstream backlog).
 *   - quarantine was keyed by name only: fixing a dead careers_url still left
 *     the company skipped for 14 days, and the skipped names were never logged.
 *   - maxPerSource sliced the RAW list before the filters, so irrelevant rows
 *     ate the quota.
 *   - ultiproTruncated / peoplesoftIncomplete flags were dropped silently.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT, stub fetchImpl, no network.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let dir;
let en;
let ru;
let q;
let ALL_ADAPTERS;

const data = (f) => resolve(dir, 'data', f);
const writePortals = (lines) => writeFileSync(resolve(dir, 'portals.yml'), lines.join('\n'));
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Greenhouse stub: slug → [{ title, url }]; a missing slug → 404. */
function ghFetch(boards, calls = []) {
  return async (url) => {
    const u = String(url);
    if (u.includes('/offices')) return json({ offices: [] });
    const slug = (u.match(/boards\/([^/]+)\//) || [])[1];
    calls.push(slug);
    if (!(slug in boards)) return new Response('gone', { status: 404 });
    return json({ jobs: boards[slug].map((j, i) => ({ id: i + 1, title: j.title, absolute_url: j.url, location: { name: 'Remote' } })) });
  };
}

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'scan-dedup-quarantine-'));
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# cv\n');
  writePortals(['tracked_companies: []']);
  process.env.CAREER_OPS_ROOT = dir;
  en = await import('../server/lib/en-scanner.mjs');
  ru = await import('../server/lib/ru-scanner.mjs');
  q = await import('../server/lib/scan-quarantine.mjs');
  ({ ALL_ADAPTERS } = await import('../server/lib/portals/registry.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  for (const f of readdirSync(resolve(dir, 'data'))) rmSync(data(f), { force: true });
});

test('EN: a utm variant of a posting reached twice in one run is ONE row', async () => {
  writePortals([
    'tracked_companies:',
    '  - name: A',
    '    api: https://boards-api.greenhouse.io/v1/boards/a/jobs',
    '  - name: B',
    '    api: https://boards-api.greenhouse.io/v1/boards/b/jobs',
  ]);
  const logs = [];
  const r = await en.runEnScan({
    fetchImpl: ghFetch({
      a: [{ title: 'Engineer', url: 'https://example.com/job/1?utm_source=a' }],
      b: [{ title: 'Engineer', url: 'https://example.com/job/1' }, { title: 'Lead', url: 'https://example.com/job/2' }],
    }),
    onLog: (_s, l) => logs.push(l),
  });
  assert.equal(r.fresh.length, 2);
  assert.equal(r.counts.runDup, 1);
  assert.ok(logs.some((l) => /Duplicate in run:\s+1/.test(l)));
  const history = readFileSync(data('scan-history.tsv'), 'utf8').trim().split('\n');
  assert.equal(history.length, 2, 'the posting is appended to history once');
});

test('RU: dedup is on the canonical URL — a utm variant across queries is one row', async () => {
  writePortals(['russian_portals:', '  sources: [trudvsem]', '  queries: ["Go", "Golang"]']);
  let n = 0;
  const fetchImpl = async () => {
    n += 1;
    const url = n === 1 ? 'https://trudvsem.ru/vacancy/v1?utm_campaign=x' : 'https://trudvsem.ru/vacancy/v1';
    return json({ results: { vacancies: [{ vacancy: { id: 'v1', 'job-name': 'Go developer', vac_url: url } }] } });
  };
  const r = await ru.runRuScan({ writeFiles: false, fetchImpl });
  assert.equal(r.counts.raw, 1, '"Total found" counts canonical URLs');
  assert.equal(r.fresh.length, 1);
});

test('loadSeenUrls: parent skipped_location / skipped_age rows do not count as seen', () => {
  writeFileSync(data('scan-history.tsv'), [
    'url\tfirst_seen\tportal\ttitle\tcompany\tstatus',
    'https://example.com/loc\t2026-06-01\tgreenhouse\tEng\tAcme\tskipped_location',
    'https://example.com/age\t2026-06-01\tgreenhouse\tEng\tAcme\tskipped_age',
    'https://example.com/added\t2026-06-01\tgreenhouse\tEng\tAcme\tadded',
    'https://example.com/expired\t2026-06-01\tgreenhouse\tEng\tAcme\tskipped_expired',
    '2026-06-02\tgreenhouse\t7\tAcme\tEng\thttps://example.com/webui?utm_source=x',
  ].join('\n'));
  writeFileSync(data('pipeline.md'), '- https://example.com/pipe\n');
  for (const seen of [en.loadSeenUrls(), ru.loadSeenUrls()]) {
    assert.equal(seen.has('https://example.com/loc'), false);
    assert.equal(seen.has('https://example.com/age'), false);
    assert.equal(seen.has('https://example.com/added'), true);
    assert.equal(seen.has('https://example.com/expired'), true, 'only the two observational statuses are exempt');
    assert.equal(seen.has('https://example.com/webui'), true, 'web-ui rows, normalised');
    assert.equal(seen.has('https://example.com/pipe'), true);
  }
});

test('isQuarantined: the entry only holds while the company resolves to the SAME url', () => {
  const now = Date.parse('2026-06-28T00:00:00Z');
  const qq = q.quarantineAdd({ entries: {} }, 'Acme', { url: 'https://old', status: 404 }, new Date(now).toISOString());
  assert.equal(q.isQuarantined(qq, 'Acme', now, 'https://old'), true);
  assert.equal(q.isQuarantined(qq, 'Acme', now, 'https://new'), false, 'a fixed url is retried at once');
  assert.equal(q.isQuarantined(qq, 'Acme', now), true, 'no url given → name-only (back-compat)');
  qq.entries.Legacy = { since: new Date(now).toISOString() };
  assert.equal(q.isQuarantined(qq, 'Legacy', now, 'https://any'), true, 'a legacy url-less entry still applies');
  qq.entries.Null = null;
  assert.equal(q.isQuarantined(qq, 'Null', now), false);
});

test('EN: quarantine skips the same url (and logs the name), retries a changed one', async () => {
  const since = new Date().toISOString();
  writeFileSync(q.QUARANTINE_PATH, JSON.stringify({ entries: {
    Dead: { url: 'https://boards-api.greenhouse.io/v1/boards/dead/jobs', status: 404, since },
    Fixed: { url: 'https://boards-api.greenhouse.io/v1/boards/old-slug/jobs', status: 404, since },
  } }));
  writePortals([
    'tracked_companies:',
    '  - name: Dead',
    '    api: https://boards-api.greenhouse.io/v1/boards/dead/jobs',
    '  - name: Fixed',
    '    api: https://boards-api.greenhouse.io/v1/boards/fixed/jobs',
  ]);
  const calls = [];
  const logs = [];
  await en.runEnScan({
    writeFiles: false,
    fetchImpl: ghFetch({ fixed: [{ title: 'Engineer', url: 'https://example.com/f/1' }] }, calls),
    onLog: (_s, l) => logs.push(l),
  });
  assert.deepEqual(calls, ['fixed'], 'Dead is skipped; Fixed (new url) is fetched');
  assert.ok(logs.some((l) => /Quarantined \(skipped\):1/.test(l)));
  assert.ok(logs.some((l) => /^\s+Dead$/.test(l)), 'the quarantined name is logged');
});

test('saveQuarantine: tmp + rename (no leftovers), round-trips; a `null` file loads as empty', () => {
  q.saveQuarantine({ entries: { A: { url: 'u', status: 404, since: '2026-01-01T00:00:00Z' } } });
  assert.deepEqual(readdirSync(resolve(dir, 'data')).filter((f) => f.endsWith('.tmp')), []);
  assert.equal(q.loadQuarantine().entries.A.url, 'u');
  writeFileSync(q.QUARANTINE_PATH, 'null');
  assert.deepEqual(q.loadQuarantine(), { entries: {} });
});

test('EN: maxPerSource caps MATCHING jobs — applied after the filters', async () => {
  writePortals([
    'tracked_companies:',
    '  - name: A',
    '    api: https://boards-api.greenhouse.io/v1/boards/a/jobs',
    'title_filter:',
    '  negative: ["Junior"]',
  ]);
  const jobs = [
    { title: 'Junior Dev 1', url: 'https://example.com/j1' },
    { title: 'Junior Dev 2', url: 'https://example.com/j2' },
    { title: 'Senior Dev 1', url: 'https://example.com/s1' },
    { title: 'Senior Dev 2', url: 'https://example.com/s2' },
    { title: 'Senior Dev 3', url: 'https://example.com/s3' },
  ];
  const logs = [];
  const r = await en.runEnScan({ writeFiles: false, maxPerSource: 2, fetchImpl: ghFetch({ a: jobs }), onLog: (_s, l) => logs.push(l) });
  assert.deepEqual(r.fresh.map((j) => j.title), ['Senior Dev 1', 'Senior Dev 2']);
  assert.equal(r.counts.removedTitle, 2);
  assert.equal(r.counts.capped, 1);
  assert.ok(logs.some((l) => /Per-source cap:\s+1 removed \(max 2 per source\)/.test(l)));
});

test('EN: ultiproTruncated / peoplesoftIncomplete result flags surface as onLog warnings', async () => {
  const flagged = (flags) => async () => Object.assign([{ title: 'Engineer', url: 'https://example.com/x' }], flags);
  const mk = (id, flags) => ({ id, matches: (c) => c.provider === id, buildEndpoint: () => 'https://example.com/api', fetch: flagged(flags) });
  ALL_ADAPTERS.unshift(
    mk('zz-ultipro', { ultiproTruncated: true }),
    mk('zz-ps', { peoplesoftIncomplete: { complete: false, reason: 'page-cap', collected: 1, reportedTotal: 40 } }),
    mk('zz-ps2', { peoplesoftIncomplete: { complete: false } }),
  );
  try {
    writePortals([
      'tracked_companies:',
      '  - { name: U, provider: zz-ultipro }',
      '  - { name: P, provider: zz-ps }',
      '  - { name: Q, provider: zz-ps2 }',
    ]);
    const warnings = [];
    await en.runEnScan({ writeFiles: false, onLog: (s, l) => { if (s === 'stderr') warnings.push(l); } });
    assert.ok(warnings.some((l) => /⚠ U: result list truncated/.test(l)), warnings.join('\n'));
    assert.ok(warnings.some((l) => /⚠ P: listing incomplete \(page-cap; 1 of 40 read\)/.test(l)), warnings.join('\n'));
    assert.ok(warnings.some((l) => /⚠ Q: listing incomplete \(stopped early; 1 read\)/.test(l)), warnings.join('\n'));
  } finally {
    ALL_ADAPTERS.splice(0, 3);
  }
});
