/**
 * Repost detector (v1.83.0 — parent career-ops v1.15.0 parity).
 * Pure logic; CI-isolated (no file/network unless a tmp file is written).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  roleFuzzyMatch,
  roleTokens,
  SUB_BASELINE_SENIORITY,
} from '../server/lib/role-matcher.mjs';
import {
  parseScanHistory,
  detectReposts,
  detectRepostsFromFile,
  DEFAULT_WINDOW_DAYS,
} from '../server/lib/detect-reposts.mjs';

// web-ui scan-history.tsv columns: date \t source \t id \t company \t title \t url
const TSV = [
  '2026-01-10\tgreenhouse\tgh-1\tAcme\tSenior Site Reliability Engineer\thttps://acme.com/jobs/sre-1',
  '2026-03-01\tgreenhouse\tgh-2\tAcme\tSenior Site Reliability Engineer\thttps://acme.com/jobs/sre-2',
  '2026-02-15\tgreenhouse\tgh-3\tAcme\tEngineering Manager Platform\thttps://acme.com/jobs/eng-mgr',
  '2026-03-20\tgreenhouse\tgh-1b\tAcme\tSenior Site Reliability Engineer\thttps://acme.com/jobs/sre-1', // same url → dedup, not repost
  '2026-12-01\tgreenhouse\tgh-4\tAcme\tSenior Site Reliability Engineer\thttps://acme.com/jobs/sre-3', // outside 90d
  'bad-date\tx\tid\tAcme\tRole\thttps://acme.com/x',                 // bad date → dropped
  '2026-04-01\tx\tid\tAcme\tRole\tnot-a-url',                        // bad url → dropped
].join('\n');

test('role-matcher: roleFuzzyMatch matches variants, rejects distinct roles & baseline-only overlap', () => {
  assert.equal(roleFuzzyMatch('Senior Site Reliability Engineer', 'Site Reliability Engineer'), true);
  assert.equal(roleFuzzyMatch('Backend Engineer', 'Product Manager'), false);
  // overlap only on baseline tokens (software/engineer) → not the same opening
  assert.equal(roleFuzzyMatch('Software Engineer', 'Software Engineer Frontend'), false);
  assert.deepEqual(roleTokens('Senior Backend Engineer (Remote)').includes('senior'), false);
  // parent #1922 (v1.21.0): a base title stays distinct from a
  // specialized-suffix sibling — the extra non-baseline token is the signal.
  assert.equal(
    roleFuzzyMatch('Senior Analytics Engineer', 'Senior Analytics Engineer, People Analytics'),
    false,
  );
  // …but reposting annotations are meta noise, not a specialization.
  assert.equal(roleFuzzyMatch('Data Engineer (Repost)', 'Data Engineer'), true);
});

test('role-matcher #1933: MTS prefix stripped so titles match on their suffix', () => {
  // The "Member of Technical Staff" boilerplate prefix is stripped, so two
  // MTS titles are matched on their suffix, not the shared boilerplate.
  assert.equal(
    roleFuzzyMatch(
      'Member of Technical Staff, Backend Platform',
      'Member of Technical Staff, Backend Platform',
    ),
    true,
  );
  // Different suffixes → different openings despite the identical prefix.
  assert.equal(
    roleFuzzyMatch(
      'Member of Technical Staff, Connector Platform',
      'Member of Technical Staff, Backend Platform',
    ),
    false,
  );
  // "member"/"technical" keep their normal discriminating role elsewhere:
  // the prefix is stripped only as the literal MTS phrase.
  assert.equal(roleTokens('Member of Technical Staff, Backend Platform').includes('member'), false);
  assert.equal(roleTokens('Technical Program Manager').includes('technical'), true);
});

test('role-matcher #2164: "product" is a baseline token — PM siblings stay distinct', () => {
  // "Product Manager - Marketplace" vs "Product Manager - AI": "ai" is dropped
  // by the tokenizer, leaving only [product, manager]. With "product" a
  // baseline token, the overlap is baseline-only → not the same opening.
  assert.equal(
    roleFuzzyMatch('Product Manager - Marketplace', 'Product Manager - AI'),
    false,
  );
});

test('role-matcher #2009: accent fold — "Sênior" leaves no phantom token', () => {
  // NFD accent folding keeps the accented spelling in the ASCII vocabulary:
  // "Sênior" folds to "senior" (a stopword) rather than splitting into
  // ["s", "nior"] and leaking a phantom "nior" token.
  assert.equal(roleTokens('Sênior Backend Engineer').includes('nior'), false);
  assert.equal(roleTokens('Sênior Backend Engineer').includes('backend'), true);
  // Folded, an accented repost still matches its plain-ASCII twin.
  assert.equal(roleFuzzyMatch('Sênior Data Engineer', 'Senior Data Engineer'), true);
});

test('role-matcher #2009: a lone sub-baseline qualifier is a disagreement', () => {
  assert.ok(SUB_BASELINE_SENIORITY.has('associate'));
  // "Associate X" and a bare "X" at one company are two real openings.
  assert.equal(
    roleFuzzyMatch('Associate Product Manager, Team', 'Product Manager, Team'),
    false,
  );
  // A lone above-baseline qualifier (senior) is NOT a disagreement — the same
  // opening is routinely reposted with/without it.
  assert.equal(
    roleFuzzyMatch('Senior Data Engineer, Analytics', 'Data Engineer, Analytics'),
    true,
  );
});

test('parseScanHistory: web-ui TSV → rows, drops bad date / bad url', () => {
  const rows = parseScanHistory(TSV);
  // 5 good rows (2× sre-1, sre-2, eng-mgr, sre-3); 2 bad dropped
  assert.equal(rows.length, 5);
  assert.ok(rows.every((r) => /^https?:\/\//.test(r.url) && r.date instanceof Date));
  assert.equal(rows[0].company, 'Acme');
  assert.equal(rows[0].source, 'greenhouse');
});

test('detectReposts: genuine repost flagged; same-url & distinct-role & out-of-window excluded', () => {
  const clusters = detectReposts(parseScanHistory(TSV), DEFAULT_WINDOW_DAYS);
  const sre = clusters.filter((c) => /Site Reliability/.test(c.role));
  assert.equal(sre.length, 1, 'one SRE repost cluster');
  assert.equal(sre[0].company, 'Acme');
  assert.equal(sre[0].repostCount, 2, 'sre-1 + sre-2 (sre-1 dup collapses; sre-3 out of window)');
  const urls = sre[0].appearances.map((a) => a.url);
  assert.equal(new Set(urls).size, urls.length, 'no duplicate urls within a cluster');
  assert.ok(urls.every((u) => u !== 'https://acme.com/jobs/sre-3'), 'outside-window url excluded');
  // distinct Engineering Manager role never clusters
  assert.equal(clusters.filter((c) => /Engineering Manager/.test(c.role)).length, 0);
});

test('detectReposts: empty / single-row inputs return no clusters (no crash)', () => {
  assert.deepEqual(detectReposts([]), []);
  assert.deepEqual(detectReposts(parseScanHistory('2026-01-01\tx\tid\tAcme\tRole\thttps://a.com/1')), []);
  assert.deepEqual(detectReposts(null), []);
});

test('detectReposts: window override narrows the cluster', () => {
  // Clean 2-sighting case: same role, two distinct urls 50 days apart.
  const tsv = [
    '2026-01-10\tgreenhouse\ta\tGlobex\tBackend Platform Engineer\thttps://globex.com/jobs/be-1',
    '2026-03-01\tgreenhouse\tb\tGlobex\tBackend Platform Engineer\thttps://globex.com/jobs/be-2',
  ].join('\n');
  const rows = parseScanHistory(tsv);
  assert.equal(detectReposts(rows, 90).length, 1, 'flagged within a 90-day window');
  assert.equal(detectReposts(rows, 30).length, 0, '50-day span excluded at window=30');
});

test('detectRepostsFromFile: absent path returns [] (no throw)', () => {
  assert.deepEqual(detectRepostsFromFile('/nonexistent/scan-history.tsv'), []);
});
