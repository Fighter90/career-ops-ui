/**
 * CAR-236 (P1 perf) — /api/map/jobs caching.
 *
 * The route used to rebuild its URL→location index per request: the FULL
 * text of every jds/*.md capture (the builder consumes only the first
 * 1500 chars), the whole scan-history TSV, and — per url-less tracker row —
 * an uncached full-report read + parseReportHeader. All three are now
 * memoized by (path, mtimeMs, size), so a warm request stats instead of
 * reads. A cache bug must degrade to the old behavior, so the payload
 * assertions below mirror tests/cov-map-routes.test.mjs exactly.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server, baseUrl, root, __mapCache;

before(async () => {
  root = mkdtempSync(resolve(tmpdir(), 'mapcache-'));
  mkdirSync(resolve(root, 'data'), { recursive: true });
  mkdirSync(resolve(root, 'config'), { recursive: true });
  mkdirSync(resolve(root, 'reports'), { recursive: true });
  mkdirSync(resolve(root, 'jds'), { recursive: true });
  writeFileSync(resolve(root, 'cv.md'), '# Jane\nEngineer\n');
  writeFileSync(resolve(root, 'config', 'profile.yml'), 'target_roles:\n  primary:\n    - Backend Engineer\n');
  writeFileSync(resolve(root, 'data', 'applications.md'), [
    '# Applications Tracker',
    '',
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes | URL |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|-----|',
    '| 1 | 2026-01-01 | Acme | Backend | 4.2/5 | Applied | ❌ | — | Leeds (West Yorkshire) – 40 min drive | https://example.com/a |',
    '| 2 | 2026-01-02 | Beta | Dev | 3/5 | Evaluated | ❌ | [043](reports/043-beta-2026-01-02.md) | no place here | |',
    '',
  ].join('\n'));
  writeFileSync(resolve(root, 'reports', '043-beta-2026-01-02.md'),
    '# Evaluation: Beta — Dev\n**URL:** https://beta.example.com/jobs/9\n**Score:** 3/5\n');
  writeFileSync(resolve(root, 'data', 'scan-history.tsv'), [
    'url\ttitle\tcompany\tlocation\tdate',
    'https://example.com/a\tBackend\tAcme\tLeeds, UK\t2026-01-01',
    'https://beta.example.com/jobs/9\tDev\tBeta\tMunich, Germany\t2026-01-01',
    '',
  ].join('\n'));
  writeFileSync(resolve(root, 'data', 'pipeline.md'), [
    '# Pipeline', '',
    '```',
    '- [ ] https://acme.example.com/jobs/1 | Acme | Backend Engineer | Berlin, Germany',
    '```', '',
  ].join('\n'));
  // A capture with a huge body — the builder must read only the head.
  writeFileSync(resolve(root, 'jds', 'job1.md'),
    '# Capture\n- URL: https://acme.example.com/jobs/1\n- Location: Berlin, Germany\n\n' + 'x'.repeat(200_000) + '\n- Location: far beyond the head window');

  process.env.CAREER_OPS_ROOT = root;
  ({ __mapCache } = await import('../server/lib/routes/map.mjs'));
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });

const getJson = async (path) => {
  const res = await fetch(`${baseUrl}${path}`);
  return { status: res.status, body: await res.json() };
};

test('payload: tracker rows resolve href/location/workplace exactly as before the cache', async () => {
  const { status, body } = await getJson('/api/map/jobs');
  assert.equal(status, 200);
  const byCompany = Object.fromEntries(body.tracker.map((r) => [r.company, r]));
  assert.equal(byCompany.Acme.href, 'https://example.com/a');
  assert.equal(byCompany.Acme.location, 'Leeds, UK');
  assert.equal(byCompany.Acme.workplace, 'Leeds');
  // url-less row → its report's **URL:** header (now via the mtime-keyed memo).
  assert.equal(byCompany.Beta.href, 'https://beta.example.com/jobs/9');
  assert.equal(byCompany.Beta.location, 'Munich, Germany');
  const fit = body.pipeline.find((r) => r.title === 'Backend Engineer');
  assert.equal(fit.fit.band, 'strong');
  assert.equal(fit.location, 'Berlin, Germany', 'JD-capture header resolves the pipeline URL');
});

test('two calls: the JD index and the scan-history index are each built once', async () => {
  __mapCache.reset();
  await getJson('/api/map/jobs');
  await getJson('/api/map/jobs');
  assert.equal(__mapCache.jdsBuilds, 1, 'the second call stats the jds dir instead of rebuilding');
  assert.equal(__mapCache.scanBuilds, 1, 'the second call stats scan-history.tsv instead of re-splitting it');
  assert.equal(__mapCache.reportParses, 1, 'the url-less row\u2019s report is parsed once, not per call');
});

test('a new JD capture invalidates the jds index and its location resolves', async () => {
  writeFileSync(resolve(root, 'jds', 'job2.md'),
    '# Capture 2\n- URL: https://gamma.example.com/jobs/3\n- Location: Karlsruhe, Germany\n');
  const { status, body } = await getJson('/api/map/jobs');
  assert.equal(status, 200);
  assert.equal(__mapCache.jdsBuilds, 2, 'dir mtime changed → one rebuild');
  assert.equal(__mapCache.scanBuilds, 1, 'untouched scan history stays cached');
  const gamma = body.pipeline.find((r) => r.href === 'https://gamma.example.com/jobs/3');
  assert.equal(gamma, undefined, 'pipeline rows unchanged — the new capture only feeds the index');
  assert.ok(body.tiles.url, 'payload still complete');
});

test('a scan-history append invalidates only the scan index', async () => {
  writeFileSync(resolve(root, 'data', 'scan-history.tsv'), [
    'url\ttitle\tcompany\tlocation\tdate',
    'https://example.com/a\tBackend\tAcme\tLeeds, UK\t2026-01-01',
    'https://beta.example.com/jobs/9\tDev\tBeta\tMunich, Germany\t2026-01-01',
    'https://delta.example.com/jobs/4\tOps\tDelta\tStuttgart, Germany\t2026-01-03',
    '',
  ].join('\n'));
  const { status, body } = await getJson('/api/map/jobs');
  assert.equal(status, 200);
  assert.equal(__mapCache.scanBuilds, 2);
  assert.equal(__mapCache.jdsBuilds, 2, 'the scan-history write does not rebuild the jds index');
  // Delta has no tracker/pipeline row here — prove the new entry exists by
  // pointing a tracker row at it.
  writeFileSync(resolve(root, 'data', 'applications.md'), [
    '# Applications Tracker', '',
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes | URL |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|-----|',
    '| 1 | 2026-01-03 | Delta | Ops | 3/5 | Applied | ❌ | — | Stuttgart office | https://delta.example.com/jobs/4 |',
    '',
  ].join('\n'));
  const after = await getJson('/api/map/jobs');
  const delta = after.body.tracker.find((r) => r.company === 'Delta');
  assert.equal(delta.location, 'Stuttgart, Germany');
});

test('an in-place capture rewrite (same name, dir mtime unchanged) keeps serving — documented write-once trade-off', async () => {
  const f = resolve(root, 'jds', 'job2.md');
  writeFileSync(f, '# Capture 2\n- URL: https://gamma.example.com/jobs/3\n- Location: CO-REWRITTEN, nowhere\n');
  const { status } = await getJson('/api/map/jobs');
  assert.equal(status, 200);
  assert.equal(__mapCache.jdsBuilds, 2, 'captures are write-once (archive-posting names are unique); no rebuild');
});

test('a rewritten report re-parses exactly once for the url-less row', async () => {
  writeFileSync(resolve(root, 'data', 'applications.md'), [
    '# Applications Tracker', '',
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes | URL |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|-----|',
    '| 2 | 2026-01-02 | Beta | Dev | 3/5 | Evaluated | ❌ | [043](reports/043-beta-2026-01-02.md) | no place here | |',
    '',
  ].join('\n'));
  __mapCache.reset();
  const first = await getJson('/api/map/jobs');
  assert.equal(first.body.tracker[0].href, 'https://beta.example.com/jobs/9');
  const second = await getJson('/api/map/jobs');
  assert.equal(second.body.tracker[0].href, 'https://beta.example.com/jobs/9');
  assert.equal(__mapCache.reportParses, 1, 'two rows-worth of lookups, one parse');
  // The parent's set-status/runner writes land as a content+mtime change:
  writeFileSync(resolve(root, 'reports', '043-beta-2026-01-02.md'),
    '# Evaluation: Beta — Dev\n**URL:** https://beta.example.com/jobs/NEW\n');
  const later = new Date(Date.now() + 5_000);
  utimesSync(resolve(root, 'reports', '043-beta-2026-01-02.md'), later, later);
  const third = await getJson('/api/map/jobs');
  assert.equal(third.body.tracker[0].href, 'https://beta.example.com/jobs/NEW', 'report mtime change → re-parse');
  assert.equal(__mapCache.reportParses, 2);
});
