/**
 * detect-reposts + liveness edge cases (pure — no I/O, no network).
 *
 *   - repost clusters overlapped: the rows that survived a window cut seeded
 *     the next cluster, so one sighting was reported in two clusters;
 *   - a utm_ variant of the same posting read as a repost;
 *   - parent-format scan-history rows (URL first) were skipped outright;
 *   - a Workday `/apply` URL mapped to a CXS path that 404s → authoritative
 *     "expired" for a live posting;
 *   - classifyLiveness read 0 / 401 / 408 / 451 short bodies as `expired`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectReposts, parseScanHistory, detectRepostsFromFile } from '../server/lib/detect-reposts.mjs';
import { classifyLiveness } from '../server/lib/liveness-core.mjs';
import { resolveAtsApi } from '../server/lib/liveness-api.mjs';

const row = (dateStr, url, title = 'Senior Backend Engineer', company = 'Acme') => ({
  date: new Date(`${dateStr}T00:00:00Z`), dateStr, url, title, company, source: 'greenhouse',
});

test('detectReposts: clusters are disjoint — no sighting is reported twice', () => {
  // Window 30d. Day 0, 20, 40, 60: the old sliding cut emitted {0,20}, then
  // seeded the next cluster with day 20 again → {20,40,60}.
  const rows = [
    row('2026-01-01', 'https://x.test/1'),
    row('2026-01-21', 'https://x.test/2'),
    row('2026-02-10', 'https://x.test/3'),
    row('2026-03-02', 'https://x.test/4'),
  ];
  const clusters = detectReposts(rows, 30);
  const urls = clusters.flatMap((c) => c.appearances.map((a) => a.url));
  assert.equal(new Set(urls).size, urls.length, `a url appears in two clusters: ${urls.join(', ')}`);
  assert.equal(urls.length, 4);
});

test('detectReposts: a utm variant of the same posting is not a repost', () => {
  const rows = [
    row('2026-01-01', 'https://x.test/job/1?utm_source=linkedin'),
    row('2026-01-05', 'https://x.test/job/1'),
  ];
  assert.deepEqual(detectReposts(rows), []);
  rows.push(row('2026-01-09', 'https://x.test/job/2'));
  const [c] = detectReposts(rows);
  assert.equal(c.repostCount, 2, 'two distinct postings, the utm twin collapsed');
});

test('parseScanHistory: parent-format rows (URL first) are read; non-added parent rows are not appearances', () => {
  const text = [
    'url\tfirst_seen\tportal\ttitle\tcompany\tstatus',
    'https://x.test/p1\t2026-01-01\tgreenhouse\tSenior Backend Engineer\tAcme\tadded',
    'https://x.test/p2\t2026-01-10\tgreenhouse\tSenior Backend Engineer\tAcme',
    'https://x.test/p3\t2026-01-12\tgreenhouse\tSenior Backend Engineer\tAcme\tskipped_location',
    '2026-01-20\tlever\t9\tAcme\tSenior Backend Engineer\thttps://x.test/w1',
    'short\tline',
  ].join('\n');
  const rows = parseScanHistory(text);
  assert.deepEqual(rows.map((r) => r.url), ['https://x.test/p1', 'https://x.test/p2', 'https://x.test/w1']);
  assert.equal(rows[0].company, 'Acme');
  assert.equal(rows[0].title, 'Senior Backend Engineer');
  assert.equal(rows[0].source, 'greenhouse');
  assert.equal(detectReposts(rows)[0].repostCount, 3);
});

test('resolveAtsApi: a Workday /apply URL maps to the POSTING endpoint', () => {
  const base = 'https://acme.wd1.myworkdayjobs.com/en-US/careers/job/Remote/Engineer_R1';
  const want = 'https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/careers/job/Remote/Engineer_R1';
  for (const u of [base, `${base}/apply`, `${base}/apply/`, `${base}/apply/autofillWithResume`, `${base}/Apply`]) {
    assert.equal(resolveAtsApi(u)?.apiUrl, want, u);
  }
  assert.equal(resolveAtsApi('https://acme.wd1.myworkdayjobs.com/careers/job/apply'), null, 'nothing left once /apply is cut');
});

test('classifyLiveness: any non-2xx that is not 404/410 is uncertain, never expired', () => {
  for (const status of [0, 401, 408, 451, 302, 199]) {
    const r = classifyLiveness({ status, bodyText: 'Unauthorized' });
    assert.equal(r.result, 'uncertain', `status ${status}`);
    assert.equal(r.code, 'http_status');
  }
  assert.equal(classifyLiveness({ status: 0 }).reason, 'no HTTP response');
  assert.equal(classifyLiveness({}).result, 'uncertain', 'no status at all is not evidence of expiry');
  // 2xx still reaches the content heuristics.
  assert.equal(classifyLiveness({ status: 200, bodyText: 'short' }).code, 'insufficient_content');
  assert.equal(classifyLiveness({ status: 404 }).result, 'expired');
});

test('parseScanHistory / detectReposts: malformed input is skipped, never thrown on', () => {
  assert.deepEqual(parseScanHistory(null), []);
  const text = [
    '',
    '2026-02-30\tgh\t1\tAcme\tEng\thttps://x.test/1',          // impossible date
    '\tgh\t1\tAcme\tEng\thttps://x.test/1',                    // no date
    '2026-01-01\tgh\t1\tAcme\tEng\tftp://x.test/1',            // not http(s)
    '2026-01-01\tgh\t1\tAcme\tEng',                             // 5 cols, not parent-shaped
    '2026-01-01\tgh\t1\tAcme\tEng\t',                          // empty url
  ].join('\n');
  assert.deepEqual(parseScanHistory(text), []);
  assert.deepEqual(detectReposts('nope'), []);
  assert.deepEqual(detectReposts([null, { url: 'u' }]), []);
  assert.deepEqual(detectRepostsFromFile(''), []);
  assert.deepEqual(detectRepostsFromFile('/nonexistent/scan-history.tsv'), []);
});

test('detectReposts: punctuation-only company names still group; newest cluster first', () => {
  const rows = [
    row('2026-01-01', 'https://x.test/a1', 'Senior Backend Engineer', '???'),
    row('2026-01-03', 'https://x.test/a2', 'Senior Backend Engineer', '???'),
    row('2026-03-01', 'https://x.test/b1', 'Data Scientist', 'Beta'),
    row('2026-03-02', 'https://x.test/b2', 'Data Scientist', 'Beta'),
  ];
  const clusters = detectReposts(rows);
  assert.deepEqual(clusters.map((c) => c.company), ['Beta', '???']);
});
