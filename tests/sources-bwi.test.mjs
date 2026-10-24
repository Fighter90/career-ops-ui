/**
 * BWI source (v1.253.0 parent parity) — CI-isolated suite.
 * Ported from the parent's bwi provider cases: the SSRF guard on detail URLs
 * (they come out of remote page content — http, foreign, lookalike, userinfo
 * and metadata hosts all throw), the two JSON-LD parsers (the listing's
 * CollectionPage ItemList, deduped and on-host only; the detail page's
 * JobPosting found past malformed and unrelated blocks), slugToTitle (with
 * the (m/w/d) marker), the `bwi:` config block (fetchDetails is the only
 * switch; detailLimit is a cap, never a switch), and the opt-in detail
 * enrichment (relevant slugs only, budget counted at the transport so
 * retries count, failure never fatal). No network — every parser is pure;
 * fetchBwi runs on a fake fetchImpl.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseJobPosting,
  parseBwiConfig,
  slugToTitle,
  collectJobUrls,
  assertBwiUrl,
  fetchBwi,
  LIST_URL,
  ALLOWED_HOST,
  DETAIL_BUDGET,
} from '../server/lib/sources/bwi.mjs';
import { bwiAdapter } from '../server/lib/portals/adapters/bwi.mjs';
import { REDIRECT_REFUSAL_CAUSE_MESSAGE } from '../server/lib/http-json.mjs';

const LISTING = `<html><head><script type="application/ld+json">
  {"@context":"https://schema.org","@type":"CollectionPage","mainEntity":{"@type":"ItemList","itemListElement":[
    {"@type":"ListItem","position":1,"url":"https://www.bwi.de/karriere/stellenangebote/job/security-analyst-m-w-d-11111"},
    {"@type":"ListItem","position":2,"url":"https://www.bwi.de/karriere/stellenangebote/job/consultant-cloud-22222"},
    {"@type":"ListItem","position":3,"url":"https://www.bwi.de/karriere/stellenangebote/job/security-analyst-m-w-d-11111"}
  ]}}
  </script></head><body></body></html>`;

const DETAIL = `<html><head>
  <script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[]}</script>
  <script type="application/ld+json">{ not valid json </script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"JobPosting","title":"Security Analyst - Incident Response &amp; Detection (m/w/d)",
   "datePosted":"2026-08-20","jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Köln"}}}
  </script></head><body></body></html>`;

const OK_URL = 'https://www.bwi.de/karriere/stellenangebote/job/security-analyst-m-w-d-11111';

/** A fake fetchImpl serving the listing and DETAIL for /job/ URLs, recording every call. */
function makeFetch(extra = {}) {
  const requested = [];
  const fetchImpl = async (url, opts = {}) => {
    requested.push({ url, opts });
    return { ok: true, status: 200, text: async () => (url.endsWith('/stellenangebote') ? LISTING : DETAIL) };
  };
  return { requested, fetchImpl, ...extra };
}

test('bwi: assertBwiUrl — HTTPS on www.bwi.de only, default port only', () => {
  assert.equal(assertBwiUrl(OK_URL), OK_URL);
  assert.equal(assertBwiUrl(LIST_URL), LIST_URL);
  assert.throws(() => assertBwiUrl('https://www.bwi.de:8443/karriere/stellenangebote'), /non-default port/);
  for (const [label, url] of [
    ['a plain-HTTP URL', 'http://www.bwi.de/karriere/stellenangebote/job/security-analyst-11111'],
    ['a foreign host', 'https://attacker.example/karriere/stellenangebote/job/security-analyst-11111'],
    ['a lookalike host', 'https://www.bwi.de.attacker.example/karriere/stellenangebote/job/security-analyst-11111'],
    ['a userinfo spoof', 'https://www.bwi.de@attacker.example/karriere/stellenangebote/job/security-analyst-11111'],
    ['a cloud metadata address', 'https://169.254.169.254/karriere/stellenangebote/job/security-analyst-11111'],
    ['a non-URL string', 'not a url'],
  ]) {
    assert.throws(() => assertBwiUrl(url), undefined, label);
  }
  assert.equal(ALLOWED_HOST, 'www.bwi.de');
});

test('bwi: collectJobUrls — every ItemList entry, deduped; off-host and plain-HTTP URLs never collected', () => {
  const urls = collectJobUrls(LISTING);
  assert.equal(urls.length, 2);
  assert.equal(urls[0], OK_URL);
  assert.equal(urls[1].endsWith('consultant-cloud-22222'), true);

  const hostile = `<script type="application/ld+json">{"@type":"CollectionPage","mainEntity":{"@type":"ItemList","itemListElement":[
    {"@type":"ListItem","position":1,"url":"${OK_URL}"},
    {"@type":"ListItem","position":2,"url":"https://attacker.example/karriere/stellenangebote/job/security-engineer-m-w-d-33333"},
    {"@type":"ListItem","position":3,"url":"https://www.bwi.de.attacker.example/karriere/stellenangebote/job/soc-analyst-m-w-d-44444"},
    {"@type":"ListItem","position":4,"url":"http://www.bwi.de/karriere/stellenangebote/job/cyber-defense-m-w-d-55555"}
  ]}}</script>`;
  assert.deepEqual(collectJobUrls(hostile), [OK_URL], 'only the on-host https URL survives');
});

test('bwi: collectJobUrls — `\\/`-escaped JSON-LD URLs read exactly like bare ones', () => {
  // json_encode's default escapes the slashes: https:\/\/www.bwi.de\/...
  const escaped = `<html><head><script type="application/ld+json">
  {"@context":"https://schema.org","@type":"CollectionPage","mainEntity":{"@type":"ItemList","itemListElement":[
    {"@type":"ListItem","position":1,"url":"https:\\/\\/www.bwi.de\\/karriere\\/stellenangebote\\/job\\/security-analyst-m-w-d-11111"},
    {"@type":"ListItem","position":2,"url":"https:\\/\\/www.bwi.de\\/karriere\\/stellenangebote\\/job\\/consultant-cloud-22222"}
  ]}}
  </script></head><body></body></html>`;
  assert.deepEqual(collectJobUrls(escaped), [OK_URL, 'https://www.bwi.de/karriere/stellenangebote/job/consultant-cloud-22222']);
});

test('bwi: collectJobUrls — a non-URL value under a url key is skipped, the rest survives', () => {
  const mixed = `<script type="application/ld+json">{"@type":"CollectionPage","mainEntity":{"@type":"ItemList","itemListElement":[
    {"@type":"ListItem","position":1,"url":"not a url"},
    {"@type":"ListItem","position":2,"url":"${OK_URL}"}
  ]}}</script>`;
  assert.deepEqual(collectJobUrls(mixed), [OK_URL], 'the unparseable candidate never aborts the walk');
});

test('bwi: collectJobUrls — a block that fails JSON.parse falls back to the escape-tolerant regex', () => {
  const broken = `<script type="application/ld+json">{ "broken": true,
    "url": "https:\\/\\/www.bwi.de\\/karriere\\/stellenangebote\\/job\\/soc-analyst-m-w-d-77777"
  </script>`;
  assert.deepEqual(
    collectJobUrls(broken),
    ['https://www.bwi.de/karriere/stellenangebote/job/soc-analyst-m-w-d-77777'],
    'the `\\/` escapes decode exactly like a parsed block would read them');
});

test('bwi: a 200 listing with an ItemList but zero parsable job URLs throws (markup change)', async () => {
  // On-host but the job/ path segment moved — nothing collects, yet the page
  // still carries the structured listing.
  const moved = `<html><head><script type="application/ld+json">
  {"@type":"CollectionPage","mainEntity":{"@type":"ItemList","itemListElement":[
    {"@type":"ListItem","position":1,"url":"https://www.bwi.de/karriere/stellenangebote/security-analyst-11111"}
  ]}}</script></head><body></body></html>`;
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => moved });
  await assert.rejects(
    () => fetchBwi(LIST_URL, { fetchImpl }),
    /embeds a JSON-LD CollectionPage\/ItemList but no on-host job URL parsed/);
});

test('bwi: a 200 page with no structured listing at all stays a quiet empty board', async () => {
  const fetchImpl = async () => ({
    ok: true, status: 200,
    text: async () => '<html><body>closed for the holidays</body></html>',
  });
  const jobs = await fetchBwi(LIST_URL, { fetchImpl });
  assert.deepEqual(jobs, []);
});

test('bwi: slugToTitle rebuilds a readable title and restores the (m/w/d) marker', () => {
  assert.equal(slugToTitle('https://www.bwi.de/karriere/stellenangebote/job/senior-security-analyst-m-w-d-69624'), 'Senior Security Analyst (m/w/d)');
  assert.equal(slugToTitle('https://www.bwi.de/karriere/stellenangebote/job/consultant-cloud-22222'), 'Consultant Cloud');
  assert.equal(slugToTitle('https://www.bwi.de/karriere/stellenangebote/job/-69624'), '', 'a boilerplate-only slug is no title');
  assert.equal(slugToTitle('https://www.bwi.de/karriere/stellenangebote/'), '', 'a URL with no slug is no title');
  assert.equal(slugToTitle('not a url'), '');
});

test('bwi: parseJobPosting — finds the JobPosting past malformed and unrelated ld+json blocks', () => {
  const posting = parseJobPosting(DETAIL);
  assert.ok(posting);
  assert.ok(posting.title.includes('Incident Response'));
  assert.equal(posting.jobLocation.address.addressLocality, 'Köln');
  assert.equal(parseJobPosting('<html><body>no ld+json here</body></html>'), null);
});

test('bwi: parseBwiConfig — fetchDetails is the only switch; detailLimit is a bounded cap', () => {
  assert.deepEqual(parseBwiConfig({}), { fetchDetails: false, detailLimit: DETAIL_BUDGET });
  assert.deepEqual(parseBwiConfig({ bwi: { fetchDetails: true } }), { fetchDetails: true, detailLimit: DETAIL_BUDGET });
  assert.deepEqual(parseBwiConfig({ bwi: { detailLimit: 10 } }).fetchDetails, false, 'a cap alone never turns enrichment on');
  assert.equal(parseBwiConfig({ bwi: { fetchDetails: true, detailLimit: 3 } }).detailLimit, 3);
  assert.equal(parseBwiConfig({ bwi: { fetchDetails: true, detailLimit: 0 } }).detailLimit, DETAIL_BUDGET);
  assert.equal(parseBwiConfig({ bwi: { fetchDetails: true, detailLimit: 101 } }).detailLimit, DETAIL_BUDGET);
  assert.equal(parseBwiConfig({ bwi: { fetchDetails: true, detailLimit: '10' } }).detailLimit, 10,
    'a numeric string coerces (Number(value)) — pinned contract, not a coincidence with the default');
  assert.equal(parseBwiConfig({ bwi: { fetchDetails: true, detailLimit: 'abc' } }).detailLimit, DETAIL_BUDGET,
    'a non-numeric value falls back to the default');
  assert.equal(parseBwiConfig({ bwi: { fetchDetails: true, detailLimit: null } }).detailLimit, DETAIL_BUDGET);
});

test('bwi: fetchBwi default — ONE listing request, slug titles, empty location, web-ui rows', async () => {
  const { requested, fetchImpl } = makeFetch();
  const jobs = await fetchBwi(LIST_URL, { fetchImpl, company: { name: 'BWI GmbH' } });
  assert.equal(requested.length, 1, 'no detail request without bwi.fetchDetails');
  assert.equal(requested[0].url, LIST_URL);
  assert.equal(requested[0].opts.redirect, 'error', 'SSRF: redirects are refused');
  assert.ok(requested[0].opts.headers['User-Agent'], 'a browser-like UA is sent');
  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs.map((j) => j.title), ['Security Analyst (m/w/d)', 'Consultant Cloud']);
  assert.ok(jobs.every((j) => j.company === 'BWI GmbH' && j.location === '' && j.url && j.title));
  assert.equal(jobs[0].id, 'bwi-security-analyst-m-w-d-11111');
  assert.equal(jobs[0].source, 'bwi');
  assert.equal(jobs[0].date, '');
});

test('bwi: fetchBwi enrichment — relevant slugs get the real title and city; irrelevant keep the slug title', async () => {
  const { requested, fetchImpl } = makeFetch();
  const jobs = await fetchBwi(LIST_URL, { fetchImpl, detailDelayMs: 0, company: { name: 'BWI GmbH', bwi: { fetchDetails: true } } });
  assert.equal(jobs.length, 2);

  const analyst = jobs.find((j) => j.url.includes('security-analyst'));
  const consultant = jobs.find((j) => j.url.includes('consultant-cloud'));
  assert.equal(analyst.title, 'Security Analyst - Incident Response & Detection (m/w/d)', 'the ld+json title is entity-decoded');
  assert.equal(analyst.location, 'Köln');
  assert.equal(consultant.title, 'Consultant Cloud', 'an irrelevant slug is never enriched');
  assert.equal(consultant.location, '');
  assert.equal(requested.filter((r) => r.url.includes('/job/')).length, 1, 'exactly one detail request for one relevant posting');
  assert.ok(requested.every((r) => r.opts.redirect === 'error'));
});

test('bwi: fetchBwi — a failing detail page is never fatal (slug title kept)', async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    if (url.endsWith('/stellenangebote')) return { ok: true, status: 200, text: async () => LISTING };
    return { ok: false, status: 404, text: async () => '' };
  };
  const jobs = await fetchBwi(LIST_URL, { fetchImpl, detailDelayMs: 0, company: { name: 'BWI GmbH', bwi: { fetchDetails: true } } });
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((j) => j.title));
  assert.equal(jobs.find((j) => j.url.includes('security-analyst')).title, 'Security Analyst (m/w/d)');
});

test('bwi: fetchBwi — a transient detail failure is retried and still enriches', async () => {
  let attempts = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith('/stellenangebote')) return { ok: true, status: 200, text: async () => LISTING };
    attempts += 1;
    if (attempts === 1) {
      const err = new Error('HTTP 503');
      err.status = 503;
      throw err;
    }
    return { ok: true, status: 200, text: async () => DETAIL };
  };
  const jobs = await fetchBwi(LIST_URL, { fetchImpl, detailDelayMs: 0, retryDelayMs: 0, company: { name: 'BWI GmbH', bwi: { fetchDetails: true } } });
  assert.equal(attempts, 2);
  assert.equal(jobs.find((j) => j.url.includes('security-analyst')).location, 'Köln');
});

test('bwi: detail enrichment decodes-then-strips — an entity-escaped tag never survives as markup', async () => {
  const XSS_DETAIL = `<html><head>
  <script type="application/ld+json">
  {"@type":"JobPosting","title":"Security Analyst &lt;script&gt;alert(1)&lt;/script&gt; (m/w/d)",
   "jobLocation":{"address":{"addressLocality":"K&amp;#246;ln&lt;b&gt;"}}}
  </script></head><body></body></html>`;
  const fetchImpl = async (url) => ({
    ok: true,
    status: 200,
    text: async () => (url.endsWith('/stellenangebote') ? LISTING : XSS_DETAIL),
  });
  const jobs = await fetchBwi(LIST_URL, {
    fetchImpl, detailDelayMs: 0,
    company: { name: 'BWI GmbH', bwi: { fetchDetails: true } },
  });
  const analyst = jobs.find((j) => j.url.includes('security-analyst'));
  assert.equal(analyst.title, 'Security Analyst (m/w/d)',
    'the decoded <script> is stripped with its contents — strip-then-decode would have emitted it live');
  assert.ok(!analyst.title.includes('<'), 'no angle bracket survives in the title');
  assert.ok(!/script/i.test(analyst.title), 'no tag text survives in the title');
  assert.equal(analyst.location, 'Köln', 'the double-encoded locality decodes after the tag strip');
  assert.ok(!analyst.location.includes('<'), 'no angle bracket survives in the locality');
});

test('bwi: fetchBwi — the detail budget stops enrichment but returns every job', async () => {
  const manyItems = Array.from({ length: 46 }, (_, i) =>
    `{"@type":"ListItem","position":${i + 1},"url":"https://www.bwi.de/karriere/stellenangebote/job/security-analyst-m-w-d-${10000 + i}"}`
  ).join(',');
  const BIG_LISTING = `<script type="application/ld+json">{"@type":"CollectionPage","mainEntity":{"@type":"ItemList","itemListElement":[${manyItems}]}}</script>`;
  let bigDetails = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith('/stellenangebote')) return { ok: true, status: 200, text: async () => BIG_LISTING };
    bigDetails += 1;
    return { ok: true, status: 200, text: async () => DETAIL };
  };

  const jobs = await fetchBwi(LIST_URL, { fetchImpl, detailDelayMs: 0, company: { name: 'BWI GmbH', bwi: { fetchDetails: true } } });
  assert.equal(jobs.length, 46, 'every job is returned regardless of the budget');
  assert.equal(bigDetails, DETAIL_BUDGET, 'enrichment stops at the 45-request budget');

  bigDetails = 0;
  const capped = await fetchBwi(LIST_URL, { fetchImpl, detailDelayMs: 0, company: { name: 'BWI GmbH', bwi: { fetchDetails: true, detailLimit: 3 } } });
  assert.equal(capped.length, 46);
  assert.equal(bigDetails, 3, 'bwi.detailLimit caps the detail requests');
});

test('bwi: fetchBwi — retries count against the detail budget (transport-level, not per posting)', async () => {
  const manyItems = Array.from({ length: 46 }, (_, i) =>
    `{"@type":"ListItem","position":${i + 1},"url":"https://www.bwi.de/karriere/stellenangebote/job/security-analyst-m-w-d-${10000 + i}"}`
  ).join(',');
  const BIG_LISTING = `<script type="application/ld+json">{"@type":"CollectionPage","mainEntity":{"@type":"ItemList","itemListElement":[${manyItems}]}}</script>`;
  let failingDetails = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith('/stellenangebote')) return { ok: true, status: 200, text: async () => BIG_LISTING };
    failingDetails += 1;
    const err = new Error('HTTP 503');
    err.status = 503;
    throw err;
  };
  const jobs = await fetchBwi(LIST_URL, {
    fetchImpl, detailDelayMs: 0, retryDelayMs: 0, retries: 2,
    company: { name: 'BWI GmbH', bwi: { fetchDetails: true, detailLimit: 3 } },
  });
  assert.equal(jobs.length, 46);
  assert.equal(failingDetails, 3, '3 HTTP requests total, not 3 postings x 3 attempts');
});

test('bwi: fetchBwi — a retry outliving the budget draws the non-retryable budget error (400) mid-posting', async () => {
  const manyItems = Array.from({ length: 46 }, (_, i) =>
    `{"@type":"ListItem","position":${i + 1},"url":"https://www.bwi.de/karriere/stellenangebote/job/security-analyst-m-w-d-${10000 + i}"}`
  ).join(',');
  const BIG_LISTING = `<script type="application/ld+json">{"@type":"CollectionPage","mainEntity":{"@type":"ItemList","itemListElement":[${manyItems}]}}</script>`;
  let detailCalls = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith('/stellenangebote')) return { ok: true, status: 200, text: async () => BIG_LISTING };
    detailCalls += 1;
    const err = new Error('HTTP 503');
    err.status = 503;
    throw err;
  };
  const jobs = await fetchBwi(LIST_URL, {
    fetchImpl, detailDelayMs: 0, retryDelayMs: 0, retries: 3,
    company: { name: 'BWI GmbH', bwi: { fetchDetails: true, detailLimit: 2 } },
  });
  assert.equal(jobs.length, 46, 'every listing row is returned regardless of the budget');
  assert.equal(detailCalls, 2, 'the 2-request budget is spent inside ONE posting\'s retries; the next attempt fails fast');
  assert.ok(jobs.every((j) => j.title), 'every job keeps at least its slug title');
});

test('bwi: fetchBwi asserts the endpoint before any request', async () => {
  const fetchImpl = async () => { throw new Error('must not be called'); };
  await assert.rejects(
    () => fetchBwi('https://attacker.example/karriere/stellenangebote', { fetchImpl }),
    /untrusted hostname/);
});

test('bwi: fetchBwi enrichment — jobLocation as an array of places; a non-string locality reads as none', async () => {
  const detailFor = (loc) => `<html><head>
    <script type="application/ld+json">{"@type":"JobPosting","title":"T","jobLocation":${loc}}</script></head></html>`;
  const pairListing = `<script type="application/ld+json">{"@type":"CollectionPage","mainEntity":{"@type":"ItemList","itemListElement":[
    {"@type":"ListItem","position":1,"url":"https://www.bwi.de/karriere/stellenangebote/job/soc-analyst-90001"},
    {"@type":"ListItem","position":2,"url":"https://www.bwi.de/karriere/stellenangebote/job/soc-analyst-90002"}
  ]}}</script>`;
  const fetchImpl = async (url) => ({
    ok: true,
    status: 200,
    text: async () => (String(url).endsWith('/stellenangebote')
      ? pairListing
      : (String(url).endsWith('90001')
        ? detailFor('[{"address":{"addressLocality":"Berlin"}}]')
        : detailFor('{"address":{"addressLocality":42}}'))),
  });
  const jobs = await fetchBwi(LIST_URL, {
    fetchImpl, detailDelayMs: 1,
    company: { name: 'BWI GmbH', bwi: { fetchDetails: true } },
  });
  assert.equal(jobs[0].location, 'Berlin', 'the first place of an array jobLocation is the city');
  assert.equal(jobs[1].location, '', 'a non-string addressLocality is no city');
});

test('bwi: fetchBwi — a statusless network error retries; a refused redirect never does', async () => {
  let attempts = 0;
  const flaky = async (url) => {
    if (url.endsWith('/stellenangebote')) return { ok: true, status: 200, text: async () => LISTING };
    attempts += 1;
    if (attempts === 1) throw new Error('ECONNRESET'); // no .status — a network error
    return { ok: true, status: 200, text: async () => DETAIL };
  };
  const jobs = await fetchBwi(LIST_URL, {
    fetchImpl: flaky, detailDelayMs: 0, retryDelayMs: 0,
    signal: new AbortController().signal, // a live signal rides the retry delay
    company: { name: 'BWI GmbH', bwi: { fetchDetails: true } },
  });
  assert.equal(attempts, 2, 'a statusless error is transient');
  assert.equal(jobs.find((j) => j.url.includes('security-analyst')).location, 'Köln');

  let refused = 0;
  const redirectRefused = async (url) => {
    if (url.endsWith('/stellenangebote')) return { ok: true, status: 200, text: async () => LISTING };
    refused += 1;
    const err = new TypeError('fetch failed');
    err.cause = new Error(REDIRECT_REFUSAL_CAUSE_MESSAGE);
    throw err;
  };
  const kept = await fetchBwi(LIST_URL, {
    fetchImpl: redirectRefused, detailDelayMs: 0, retryDelayMs: 0, retries: 2,
    company: { name: 'BWI GmbH', bwi: { fetchDetails: true } },
  });
  assert.equal(refused, 1, 'the redirect refusal is rethrown at once, never retried');
  assert.equal(kept.length, 2, 'the failing detail never drops its listing row');
});

test('bwi: fetchBwi — an abort between detail requests stops enrichment, keeps the rows', async () => {
  const ac = new AbortController();
  let detailCalls = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith('/stellenangebote')) return { ok: true, status: 200, text: async () => LISTING };
    detailCalls += 1;
    ac.abort(); // aborted while the first detail is being processed
    return { ok: true, status: 200, text: async () => DETAIL };
  };
  const jobs = await fetchBwi(LIST_URL, {
    fetchImpl, signal: ac.signal, detailDelayMs: 0,
    company: { name: 'BWI GmbH', bwi: { fetchDetails: true } },
  });
  assert.equal(detailCalls, 1);
  assert.equal(jobs.length, 2, 'an aborted enrichment is not an empty board');
});

test('bwi: fetchBwi — a detail page without a JobPosting record keeps the slug row', async () => {
  const fetchImpl = async (url) => ({
    ok: true,
    status: 200,
    text: async () => (url.endsWith('/stellenangebote') ? LISTING : '<html><body>no posting here</body></html>'),
  });
  const jobs = await fetchBwi(LIST_URL, { fetchImpl, detailDelayMs: 0, company: { name: 'BWI GmbH', bwi: { fetchDetails: true } } });
  assert.equal(jobs.length, 2);
  assert.equal(jobs.find((j) => j.url.includes('security-analyst')).title, 'Security Analyst (m/w/d)');
});

test('bwi: fetchBwi — no entry (company: null) reads as an empty company on the rows', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => LISTING });
  const jobs = await fetchBwi(LIST_URL, { fetchImpl, company: null });
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((j) => j.company === ''), 'the entry name is never invented');
});

test('bwi adapter: provider- or host-selected; the endpoint is always the listing URL', () => {
  assert.equal(bwiAdapter.matches({ provider: 'bwi' }), true);
  assert.equal(bwiAdapter.matches({ careers_url: 'https://www.bwi.de/karriere' }), true);
  assert.equal(bwiAdapter.matches({ api: 'https://www.bwi.de/karriere/stellenangebote' }), true);
  assert.equal(bwiAdapter.matches({ careers_url: 'https://www.bwi.de.attacker.example/karriere' }), false, 'a lookalike host is never claimed');
  assert.equal(bwiAdapter.matches({ careers_url: 'http://www.bwi.de/karriere' }), false, 'http is refused');
  assert.equal(bwiAdapter.matches({ careers_url: 'https://example.com/jobs' }), false);
  assert.equal(bwiAdapter.matches({ careers_url: 'not a url' }), false, 'an unparseable careers_url is never claimed');
  assert.equal(bwiAdapter.matches({}), false);
  assert.equal(bwiAdapter.matches(null), false);

  assert.equal(bwiAdapter.buildEndpoint({ careers_url: 'https://www.bwi.de/karriere' }), LIST_URL);
  assert.equal(bwiAdapter.buildEndpoint({ provider: 'bwi' }), LIST_URL);
});
