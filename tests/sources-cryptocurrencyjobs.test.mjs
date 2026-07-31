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
  // Description → snippet: HTML stripped, entities double-decoded.
  assert.equal(jobs[0].snippet, 'We build web3 & DeFi. 100% remote.');
  assert.ok(!jobs[0].snippet.includes('&amp;'), `snippet still double-encoded: ${jobs[0].snippet}`);
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
