/**
 * Cryptocurrency Jobs source — parent career-ops `providers/cryptocurrencyjobs.mjs`
 * parity. Board-wide Web3/crypto remote RSS feed; provider-selected.
 * CI-isolated: no network, a fake fetchImpl serves canned XML.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCryptocurrencyJobsRss,
  fetchCryptocurrencyJobs,
  splitTitle,
  teaserLocationClause,
  assertCryptocurrencyJobsUrl,
  FEED_URL,
  meta,
} from '../server/lib/sources/cryptocurrencyjobs.mjs';
import { cryptocurrencyjobsAdapter } from '../server/lib/portals/adapters/cryptocurrencyjobs.mjs';

// The feed's generator double-encodes entities at the source: the title carries
// `&amp;amp;` and the description carries `&amp;amp;` too. A single decode pass
// would leave `&amp;`; the source must decode EXACTLY TWICE → a bare `&`.
const RSS = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>
  <title>Cryptocurrency Jobs</title>
  <item>
    <title><![CDATA[Social Media &amp;amp; Growth Lead at Acme &amp;amp; Co]]></title>
    <link>https://cryptocurrencyjobs.co/marketing/acme-growth/</link>
    <description><![CDATA[<p>We build web3 &amp;amp; DeFi. 100% remote.</p>]]></description>
    <pubDate>Wed, 01 Apr 2026 10:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Solidity Engineer at Beta Labs</title>
    <guid>https://cryptocurrencyjobs.co/engineering/beta-solidity/</guid>
  </item>
  <item>
    <title>Just A Solo Title</title>
    <link>https://cryptocurrencyjobs.co/misc/solo/</link>
  </item>
  <item>
    <title>Item With No Link at Nowhere</title>
  </item>
  <item>
    <title>Off Host Role at Evil</title>
    <link>https://evil.com/crypto/x</link>
  </item>
</channel></rss>`;

test('parseCryptocurrencyJobsRss: title→{role,company} via last " at ", CDATA, drops linkless/off-host rows', () => {
  const jobs = parseCryptocurrencyJobsRss(RSS);
  // 5 items in feed → evil.com (off-host) + no-link item dropped → 3 kept.
  assert.equal(jobs.length, 3);

  // Row 0: CDATA title, split on the last " at ", double-decoded entities.
  assert.equal(jobs[0].title, 'Social Media & Growth Lead');
  assert.equal(jobs[0].company, 'Acme & Co');
  assert.equal(jobs[0].url, 'https://cryptocurrencyjobs.co/marketing/acme-growth/');
  assert.equal(jobs[0].date, '2026-04-01');
  assert.equal(jobs[0].source, 'cryptocurrencyjobs');
  assert.equal(jobs[0].id, 'cryptocurrencyjobs-https://cryptocurrencyjobs.co/marketing/acme-growth/');

  // Row 2: no " at " separator → company falls back to '' (parent behavior).
  assert.equal(jobs[2].title, 'Just A Solo Title');
  assert.equal(jobs[2].company, '');
});

test('parseCryptocurrencyJobsRss: DOUBLE-decodes the feed (a single pass would leave "&amp;")', () => {
  const jobs = parseCryptocurrencyJobsRss(RSS);
  // Two passes turn `&amp;amp;` → `&`; assert no stray `&amp;` survives.
  assert.ok(!jobs[0].title.includes('&amp;'), `title still double-encoded: ${jobs[0].title}`);
  assert.ok(!jobs[0].company.includes('&amp;'), `company still double-encoded: ${jobs[0].company}`);
  assert.equal(jobs[0].title, 'Social Media & Growth Lead');
  assert.equal(jobs[0].company, 'Acme & Co');
});

// CAR-257 (parent parity, upstream #6746) — the feed's <description> is NOT the
// job description: every item carries the same one-sentence teaser template
// ("{Company} is looking to hire a {Role} to join their team. This is a
// full-time position…", 54 of 54 live items, 96-253 chars) that never names a
// stack. The en-scanner's content filter reads `description ?? snippet`, so the
// teaser would drop EVERY posting from this board for a user with
// `content_filter.positive` set. The teaser is therefore never emitted as
// description-like text at all (same decision as the parent's
// _wp-job-feed.mjs refusing WordPress's excerpt).
test('parseCryptocurrencyJobsRss: the feed teaser is NOT passed as the job description/snippet', () => {
  const jobs = parseCryptocurrencyJobsRss(RSS);
  assert.ok(jobs.length > 0);
  for (const j of jobs) {
    assert.equal(j.snippet, '', `teaser leaked into snippet: "${j.snippet}"`);
    assert.equal(j.description, undefined, 'no description field may be emitted');
  }
});

test('parseCryptocurrencyJobsRss: a teaser template item still parses (title/company/date survive)', () => {
  // The exact teaser shape the live feed ships (parent #6746, verified
  // 2026-11-09: 96-253 characters, never names a stack).
  const teaser = '<rss><channel>'
    + '<item><title>Protocol Engineer at Acme Protocol</title>'
    + '<link>https://cryptocurrencyjobs.co/engineering/acme-protocol/</link>'
    + '<description><![CDATA[<p>Acme Protocol is looking to hire a Protocol Engineer to join their team. This is a full-time position that is 100% remote with no geographic restrictions or requirements.</p>]]></description>'
    + '<pubDate>Mon, 09 Nov 2026 10:00:00 GMT</pubDate></item>'
    + '</channel></rss>';
  const jobs = parseCryptocurrencyJobsRss(teaser);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Protocol Engineer');
  assert.equal(jobs[0].company, 'Acme Protocol');
  assert.equal(jobs[0].date, '2026-11-09');
  assert.equal(jobs[0].snippet, '', 'the teaser must not become the snippet');
});

// CAR-268 (parent parity, upstream #6765+#6747) — the teaser's location clause
// ("can be done remotely anywhere in the United States, or Canada") is the
// feed's ONLY country signal. After CAR-257 stopped emitting the teaser as
// description-like text, that clause was lost with it. It now travels as
// `eligibilityText` — a field NO description-like consumer reads (web-ui's
// content filter reads `description ?? snippet`; eligibilityText is never
// either), so carrying the clause cannot make a posting look like it has a
// JD. Only the clause goes there: the rest of the teaser names the company,
// and a company called "Canada Crypto" would pass a candidate-country check.
// Live feed verified 2026-11-11: teasers are plain text (no HTML wrappers).
const TEASER_FEED = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>
  <item>
    <title>Protocol Engineer at Acme Protocol</title>
    <link>https://cryptocurrencyjobs.co/engineering/acme-protocol/</link>
    <description>Acme Protocol is looking to hire a Protocol Engineer to join their team. This is a full-time position that can be done remotely anywhere in the United States, or Canada.</description>
  </item>
  <item>
    <title>Platform Engineer at Beta Labs</title>
    <link>https://cryptocurrencyjobs.co/engineering/beta-platform/</link>
    <description>Beta Labs is looking to hire a Platform Engineer to join their team. This is a contract position that is 100% remote with no geographical restrictions. Work remotely from anywhere.</description>
  </item>
  <item>
    <title>Data Engineer at Gamma Chain</title>
    <link>https://cryptocurrencyjobs.co/engineering/gamma-data/</link>
    <description>Gamma Chain is looking to hire a Data Engineer to join their team. This is a full-time position</description>
  </item>
  <item>
    <title>Security Engineer at Delta Labs</title>
    <link>https://cryptocurrencyjobs.co/engineering/delta-security/</link>
  </item>
</channel></rss>`;

test('parseCryptocurrencyJobsRss: the teaser location clause travels as eligibilityText, a separate signal', () => {
  const jobs = parseCryptocurrencyJobsRss(TEASER_FEED);
  assert.equal(jobs.length, 4);
  assert.equal(
    jobs[0].eligibilityText,
    'can be done remotely anywhere in the United States, or Canada',
    'the "that …" clause must become eligibilityText',
  );
  assert.equal(
    jobs[1].eligibilityText,
    'is 100% remote with no geographical restrictions. Work remotely from anywhere',
    'a multi-sentence clause keeps its inner sentence, final period stripped',
  );
  // The teaser is STILL never description-like text (CAR-257 invariant).
  for (const j of jobs) {
    assert.equal(j.description, undefined, 'no description field may be emitted');
    assert.equal(j.snippet, '', 'no snippet may be emitted');
  }
});

test('parseCryptocurrencyJobsRss: no eligibilityText key when the teaser has no clause (or no teaser)', () => {
  const jobs = parseCryptocurrencyJobsRss(TEASER_FEED);
  // Item 2's teaser ends at "This is a full-time position" (8 of 54 live items
  // upstream); item 3 has no <description> at all. Neither may carry the key.
  assert.equal('eligibilityText' in jobs[2], false, 'a clause-less teaser must omit the key');
  assert.equal('eligibilityText' in jobs[3], false, 'a missing teaser must omit the key');
});

test('teaserLocationClause: extracts every live clause shape, "" without one', () => {
  const teaser = (rest) => `Acme is looking to hire a Rust Engineer to join their team. ${rest}`;
  const cases = [
    ['This is a full-time position that is 100% remote with no geographical restrictions. Work remotely from anywhere.',
      'is 100% remote with no geographical restrictions. Work remotely from anywhere'],
    ['This is a full-time position that can be done remotely anywhere in the United States, or Canada.',
      'can be done remotely anywhere in the United States, or Canada'],
    ['This is a contract position that can be done remotely anywhere in Philippines or Vietnam.',
      'can be done remotely anywhere in Philippines or Vietnam'],
    ['This is a part-time position that is based in New York NY.', 'is based in New York NY'],
    ['This is a full-time position that can be based in London, or New York NY.', 'can be based in London, or New York NY'],
    ['This is a full-time position that can be done remotely anywhere in the United States or on-site in New York NY, or San Francisco CA.',
      'can be done remotely anywhere in the United States or on-site in New York NY, or San Francisco CA'],
    // Live 2026-11-11 shape.
    ['This is a full-time position that is remote or can be based in Palo Alto CA.',
      'is remote or can be based in Palo Alto CA'],
    // Clause-less teaser ends at "This is a full-time position".
    ['This is a full-time position', ''],
  ];
  for (const [rest, want] of cases) {
    assert.equal(teaserLocationClause(teaser(rest)), want, `clause shape: "${rest.slice(0, 60)}…"`);
  }
  assert.equal(teaserLocationClause(''), '');
  assert.equal(teaserLocationClause(null), '');
  assert.equal(teaserLocationClause(undefined), '');
});

test('parseCryptocurrencyJobsRss: every listing is flagged remote', () => {
  const jobs = parseCryptocurrencyJobsRss(RSS);
  assert.ok(jobs.length > 0);
  assert.ok(jobs.every((j) => j.isRemote === true), 'all jobs must be isRemote');
  assert.ok(jobs.every((j) => j.workplaceType === 'Remote'), 'all jobs must be workplaceType Remote');
  assert.ok(jobs.every((j) => j.location === ''), 'remote-only board leaves location empty');
});

test('parseCryptocurrencyJobsRss: splits on the LAST " at "', () => {
  const xml = '<rss><channel><item><title>Engineer at Data at Scale</title>' +
              '<link>https://cryptocurrencyjobs.co/x/</link></item></channel></rss>';
  const jobs = parseCryptocurrencyJobsRss(xml);
  assert.equal(jobs[0].title, 'Engineer at Data');
  assert.equal(jobs[0].company, 'Scale');
});

test('parseCryptocurrencyJobsRss: falls back to <guid> when <link> is absent', () => {
  const jobs = parseCryptocurrencyJobsRss(RSS);
  const beta = jobs.find((j) => j.company === 'Beta Labs');
  assert.ok(beta, 'guid-only item must be kept');
  assert.equal(beta.title, 'Solidity Engineer');
  assert.equal(beta.url, 'https://cryptocurrencyjobs.co/engineering/beta-solidity/');
});

test('parseCryptocurrencyJobsRss: honors maxResults cap', () => {
  const jobs = parseCryptocurrencyJobsRss(RSS, 1);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'Acme & Co');
});

test('parseCryptocurrencyJobsRss: empty/malformed feed is fail-soft (no crash)', () => {
  assert.deepEqual(parseCryptocurrencyJobsRss(''), []);
  assert.deepEqual(parseCryptocurrencyJobsRss(null), []);
  assert.deepEqual(parseCryptocurrencyJobsRss(undefined), []);
  assert.deepEqual(parseCryptocurrencyJobsRss('not xml at all'), []);
  assert.deepEqual(parseCryptocurrencyJobsRss('<rss><channel></channel></rss>'), []);
});

test('splitTitle: splits on the last " at " and handles the no-separator case', () => {
  assert.deepEqual(splitTitle('Senior Backend Engineer at Acme Protocol'), {
    title: 'Senior Backend Engineer',
    company: 'Acme Protocol',
  });
  assert.deepEqual(splitTitle('Role with no separator'), { title: 'Role with no separator', company: '' });
});

test('parseCryptocurrencyJobsRss: a subdomain link is dropped (parser is exact-host, never looser than the SSRF guard)', () => {
  // A link on sub.cryptocurrencyjobs.co is NOT the trusted apex host. The
  // parser's cleanUrl now uses the same exact-match guard as
  // assertCryptocurrencyJobsUrl + the adapter override, so it drops the row
  // rather than accepting a host the override slot would reject (the v1.131.1
  // asymmetry fix).
  const rss = '<?xml version="1.0"?><rss><channel>'
    + '<item><title>Apex Role at Acme</title><link>https://cryptocurrencyjobs.co/x/apex/</link></item>'
    + '<item><title>Sub Role at Bad</title><link>https://sub.cryptocurrencyjobs.co/x/sub/</link></item>'
    + '</channel></rss>';
  const jobs = parseCryptocurrencyJobsRss(rss);
  assert.equal(jobs.length, 1, 'only the apex-host row survives');
  assert.equal(jobs[0].url, 'https://cryptocurrencyjobs.co/x/apex/');
  assert.ok(jobs.every((j) => new URL(j.url).hostname === 'cryptocurrencyjobs.co'));
});

test('fetchCryptocurrencyJobs: normalizes via fake fetchImpl (fetchText path)', async () => {
  let capturedOpts = null;
  const fetchImpl = async (_url, opts) => { capturedOpts = opts; return { ok: true, text: async () => RSS }; };
  const jobs = await fetchCryptocurrencyJobs(FEED_URL, { fetchImpl });
  assert.equal(jobs.length, 3);
  assert.ok(jobs.every((j) => j.isRemote && j.source === 'cryptocurrencyjobs'));
  assert.ok(jobs.every((j) => new URL(j.url).hostname === 'cryptocurrencyjobs.co'));
  // SSRF hardening — the feed fetch refuses server-side redirects.
  assert.equal(capturedOpts.redirect, 'error');
});

test('fetchCryptocurrencyJobs: threads maxResults through to the parser', async () => {
  const fetchImpl = async () => ({ ok: true, text: async () => RSS });
  const jobs = await fetchCryptocurrencyJobs(FEED_URL, { fetchImpl, maxResults: 2 });
  assert.equal(jobs.length, 2);
});

test('fetchCryptocurrencyJobs: THROWS on a transport failure (dead board ≠ empty board)', async () => {
  // A failed feed fetch must REJECT, not resolve to []: scan/portal-health then
  // record a failure, whereas [] would read as "live but empty" and a dead
  // board would never trip escalation (meituan/tencent contract). Single fetch,
  // so this outage is the only request — nothing ever resolved.
  await assert.rejects(
    () => fetchCryptocurrencyJobs(FEED_URL, { fetchImpl: async () => { throw new Error('network down'); } }),
    /network down/,
  );
});

test('assertCryptocurrencyJobsUrl: pins host to cryptocurrencyjobs.co over HTTPS', () => {
  assert.equal(assertCryptocurrencyJobsUrl(FEED_URL), FEED_URL);
  assert.throws(() => assertCryptocurrencyJobsUrl('https://evil.com/index.xml'), /untrusted hostname/);
  assert.throws(() => assertCryptocurrencyJobsUrl('http://cryptocurrencyjobs.co/index.xml'), /must use HTTPS/);
  assert.throws(() => assertCryptocurrencyJobsUrl('not a url'), /invalid URL/);
});

test('adapter: matches only on provider=cryptocurrencyjobs; never careers_url', () => {
  assert.ok(cryptocurrencyjobsAdapter.matches({ provider: 'cryptocurrencyjobs' }));
  assert.equal(cryptocurrencyjobsAdapter.matches({ careers_url: 'https://cryptocurrencyjobs.co' }), false);
  assert.equal(cryptocurrencyjobsAdapter.matches({}), false);
});

test('adapter.buildEndpoint: FEED_URL by default; honors on-host override; rejects off-host', () => {
  assert.equal(cryptocurrencyjobsAdapter.buildEndpoint({ provider: 'cryptocurrencyjobs' }), FEED_URL);
  const mirror = 'https://cryptocurrencyjobs.co/index.xml?mirror=1';
  assert.equal(cryptocurrencyjobsAdapter.buildEndpoint({ cryptocurrencyjobs: mirror }), mirror);
  assert.equal(cryptocurrencyjobsAdapter.buildEndpoint({ api: 'https://evil.com/index.xml' }), FEED_URL);
  assert.equal(cryptocurrencyjobsAdapter.buildEndpoint({ api: 'http://cryptocurrencyjobs.co/index.xml' }), FEED_URL);
  assert.equal(cryptocurrencyjobsAdapter.buildEndpoint({ cryptocurrencyjobs: 'https://sub.cryptocurrencyjobs.co/index.xml' }), FEED_URL);
});

test('meta: id/label/region', () => {
  assert.equal(meta.value, 'cryptocurrencyjobs');
  assert.equal(meta.label, 'Cryptocurrency Jobs');
  assert.equal(meta.region, 'en');
  assert.equal(cryptocurrencyjobsAdapter.id, 'cryptocurrencyjobs');
});
