/**
 * CareerViet source + adapter — board-wide HTML listing for careerviet.vn
 * (https://careerviet.vn/viec-lam/…-vi.html). Provider-selected, host-pinned
 * public HTML. CI-isolated (fake fetchImpl, no network, no parent).
 *
 * Ported from the parent career-ops tests/providers/careerviet.test.mjs,
 * adapted to the web-ui source contract (rich job objects + a fake fetch that
 * returns a Response-like shape for http-json.mjs's fetchText).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildListUrl,
  buildPageUrl,
  citySegment,
  visibleText,
  parsePostedAt,
  parseListingPage,
  assertParsedSomething,
  assertCareerVietUrl,
  fetchCareerviet,
  BASE_URL,
  TRUSTED_HOST,
  meta,
} from '../server/lib/sources/careerviet.mjs';
import { careervietAdapter } from '../server/lib/portals/adapters/careerviet.mjs';

// One full card, trimmed from the live page: job-item id, doubled job_link
// anchor, company-name anchor, location list, salary block, and a .time block
// carrying BOTH the deadline ("Hạn nộp") and the updated date ("Cập nhật").
const CARD_FULL = `
<div class="job-item  " id="job-item-35C82AFA"><div class="figure"><div class="asset-wrapper"><div class="image"><a target="_blank" title="CÔNG TY CỔ PHẦN CC1 - HOLDINGS" href="/vi/nha-tuyen-dung/cong-ty-co-phan-cc1-holdings.35AA2C04.html"><img alt="logo"/></a></div></div><div class="figcaption"><div class="title "><h2><a class="job_link" data-id="35C82AFA" target="_blank" title="Backend Developer &amp; API" rel="noopener noreferrer" href="/vi/tim-viec-lam/backend-developer.35C82AFA.html">Backend Developer &amp; API</a></h2></div><div class="caption"><a class="company-name" target="_blank" title="CÔNG TY CỔ PHẦN CC1 - HOLDINGS" href="/vi/nha-tuyen-dung/cong-ty-co-phan-cc1-holdings.35AA2C04.html">CÔNG TY CỔ PHẦN CC1 - HOLDINGS</a><a class="job_link" data-id="35C82AFA" target="_blank" title="Backend Developer &amp; API" rel="noopener noreferrer" href="/vi/tim-viec-lam/backend-developer.35C82AFA.html"><div class="salary"><p><em class="fa fa-usd"></em>Lương<!-- -->: <!-- -->Cạnh tranh</p></div><div class="location"><em class="mdi mdi-map-marker"></em><ul><li>Hồ Chí Minh</li></ul></div><div class="time"><ul><li><em class="fa fa-clock-o"></em> <span>Hạn nộp<!-- -->: </span><time>10-09-2026</time></li><li><em class="mdi mdi-calendar"></em> <span>Cập nhật<!-- -->:</span> <time>16-08-2026</time></li></ul></div></a></div></div></div>`;

// A minimal card: no company link, no location block, no time block. Every
// optional field must come out empty rather than leak in from a NEIGHBOURING
// card — the reason the parser slices per-card windows instead of scanning
// the whole page once.
const CARD_MINIMAL = `
<div class="job-item  " id="job-item-35C90001"><div class="figcaption"><div class="title "><h2><a class="job_link" data-id="35C90001" title="Middle Java Developer" href="/vi/tim-viec-lam/middle-java-developer.35C90001.html">Middle Java Developer</a></h2></div></div></div>`;

const PAGE = `<html><body><div class="jobs-side-list">${CARD_FULL}${CARD_MINIMAL}</div></body></html>`;
const NO_RESULTS_PAGE = '<html><body>Không tìm thấy việc làm phù hợp.</body></html>';

// A fetchImpl that returns http-json's expected Response-like shape.
const textResponder = (byUrl, fallback = NO_RESULTS_PAGE) => (url) =>
  Promise.resolve({ ok: true, status: 200, text: async () => byUrl.get(url) ?? fallback });

test('meta + adapter surface: provider-selected, host-pinned', () => {
  assert.equal(meta.value, 'careerviet');
  assert.equal(meta.label, 'CareerViet');
  assert.equal(meta.region, 'en');
  assert.equal(careervietAdapter.id, 'careerviet');
  assert.equal(careervietAdapter.label, 'CareerViet');
  assert.ok(careervietAdapter.matches({ provider: 'careerviet' }));
  assert.ok(!careervietAdapter.matches({ careers_url: 'https://careerviet.vn/viec-lam/x' })); // never careers_url-detected
  assert.ok(!careervietAdapter.matches({}));

  // Bare board endpoint when nothing is configured.
  assert.equal(careervietAdapter.buildEndpoint({}), `${BASE_URL}/tat-ca-viec-lam-vi.html`);
  // off-host override ignored → derived endpoint
  assert.equal(
    careervietAdapter.buildEndpoint({ careerviet: 'https://evil.com/x' }),
    `${BASE_URL}/tat-ca-viec-lam-vi.html`,
  );
  assert.equal(careervietAdapter.buildEndpoint({ api: 'not a url' }), `${BASE_URL}/tat-ca-viec-lam-vi.html`);
  // on-host https override honoured
  assert.equal(
    careervietAdapter.buildEndpoint({ careerviet: 'https://careerviet.vn/viec-lam/mirror-vi.html' }),
    'https://careerviet.vn/viec-lam/mirror-vi.html',
  );
});

test('assertCareerVietUrl: https + host-pinned to careerviet.vn', () => {
  assert.equal(assertCareerVietUrl(`${BASE_URL}/tat-ca-viec-lam-vi.html`), `${BASE_URL}/tat-ca-viec-lam-vi.html`);
  assert.throws(() => assertCareerVietUrl('https://evil.com/x'), /untrusted hostname/);
  assert.throws(() => assertCareerVietUrl('http://careerviet.vn/x'), /HTTPS/);
  assert.throws(() => assertCareerVietUrl('nonsense'), /invalid URL/);
  assert.equal(TRUSTED_HOST, 'careerviet.vn');
});

test('buildListUrl(): the URL shapes the board\'s own search form generates', () => {
  assert.equal(buildListUrl({}, 1), 'https://careerviet.vn/viec-lam/tat-ca-viec-lam-vi.html');
  assert.equal(buildListUrl({}, 2), 'https://careerviet.vn/viec-lam/tat-ca-viec-lam-trang-2-vi.html');

  // A keyword narrows to "{keyword}-k"; spaces become hyphens, like the site.
  assert.equal(
    buildListUrl({ searchKeywords: 'back end' }, 1),
    'https://careerviet.vn/viec-lam/back-end-k-vi.html',
  );

  // A recognized city narrows a keyword search further; an unknown city is
  // IGNORED (falls back to the "-k" keyword-only slug) rather than guessed.
  assert.equal(
    buildListUrl({ searchKeywords: 'backend', searchLocation: 'Ho Chi Minh' }, 1),
    'https://careerviet.vn/viec-lam/backend-tai-ho-chi-minh-kl8-vi.html',
  );
  assert.equal(
    buildListUrl({ searchKeywords: 'backend', searchLocation: 'Berlin' }, 1),
    'https://careerviet.vn/viec-lam/backend-k-vi.html',
  );

  // A city with no keyword has no working URL on this board — dropped, same
  // as an unrecognized city, rather than guessed into a slug that redirects.
  assert.equal(
    buildListUrl({ searchLocation: 'Ho Chi Minh' }, 1),
    'https://careerviet.vn/viec-lam/tat-ca-viec-lam-vi.html',
  );

  // A slash inside the keyword must never create a second path segment.
  assert.equal(buildListUrl({ searchKeywords: 'node/js' }, 1), 'https://careerviet.vn/viec-lam/nodejs-k-vi.html');
});

test('buildPageUrl(): derives later pages from a page-1 endpoint string', () => {
  assert.equal(buildPageUrl(`${BASE_URL}/tat-ca-viec-lam-vi.html`, 1), `${BASE_URL}/tat-ca-viec-lam-vi.html`);
  assert.equal(
    buildPageUrl(`${BASE_URL}/tat-ca-viec-lam-vi.html`, 3),
    `${BASE_URL}/tat-ca-viec-lam-trang-3-vi.html`,
  );
  // Matches buildListUrl's own output for the same entry+page.
  const entry = { searchKeywords: 'backend', searchLocation: 'Ho Chi Minh' };
  assert.equal(buildPageUrl(buildListUrl(entry, 1), 2), buildListUrl(entry, 2));
});

test('citySegment(): Object.prototype member names are treated as unknown locations', () => {
  assert.equal(citySegment('constructor'), null);
  assert.equal(citySegment('toString'), null);
  assert.equal(citySegment('valueOf'), null);
  assert.equal(citySegment('Ho Chi Minh'), 'tai-ho-chi-minh-kl8');
  assert.equal(citySegment('hcm'), 'tai-ho-chi-minh-kl8');
  assert.equal(citySegment(''), null);
});

test('visibleText(): drops HTML comments, not just tags', () => {
  assert.equal(visibleText('Senior Dev <!-- ad --> <img src="x.gif">'), 'Senior Dev');
});

test('parsePostedAt(): the board\'s own DD-MM-YYYY format at Vietnam\'s UTC+7 offset', () => {
  assert.equal(parsePostedAt('01-02-2026'), Date.parse('2026-02-01T00:00:00+07:00'));
  assert.equal(parsePostedAt('not a date'), undefined);
});

test('parseListingPage(): full + minimal cards, entities decoded once, dedup by card id', () => {
  const jobs = parseListingPage(PAGE);
  assert.equal(jobs.length, 2);

  const full = jobs.find((j) => j.url.includes('35C82AFA'));
  assert.ok(full);
  assert.equal(full.title, 'Backend Developer & API'); // entities decoded once
  assert.equal(full.url, 'https://careerviet.vn/vi/tim-viec-lam/backend-developer.35C82AFA.html');
  assert.equal(full.company, 'CÔNG TY CỔ PHẦN CC1 - HOLDINGS');
  assert.equal(full.location, 'Hồ Chí Minh');
  // postedAt must come from "Cập nhật", never "Hạn nộp" — both share the .time block.
  assert.equal(typeof full.postedAt, 'number');
  assert.ok(Math.abs(full.postedAt - Date.parse('2026-08-16T00:00:00+07:00')) < 1000);

  const minimal = jobs.find((j) => j.url.includes('35C90001'));
  assert.ok(minimal);
  assert.equal(minimal.title, 'Middle Java Developer');
  assert.equal(minimal.company, '');
  assert.equal(minimal.location, '');
  assert.equal(minimal.postedAt, undefined);
});

test('parseListingPage(): a malformed href drops just that card, never throws', () => {
  const CARD_BAD_HREF = '<div id="job-item-35C90003"><a class="job_link" title="Bad Href Job" href="http://[invalid">Bad Href Job</a></div>';
  const parsed = parseListingPage(CARD_BAD_HREF);
  assert.deepEqual(parsed, []);
});

test('parseListingPage(): an off-host href is never emitted as a posting URL', () => {
  const CARD_OFF_HOST = '<div id="job-item-35C90004"><a class="job_link" title="Off Host Job" href="https://evil.example.com/phish">Off Host Job</a></div>';
  assert.deepEqual(parseListingPage(CARD_OFF_HOST), []);
});

test('parseListingPage(): an empty .location block never leaks a sibling deadline date', () => {
  const CARD_EMPTY_LOCATION = `
<div class="job-item  " id="job-item-35C90002"><div class="figcaption"><div class="title "><h2><a class="job_link" data-id="35C90002" title="Empty Location Job" href="/vi/tim-viec-lam/empty-location-job.35C90002.html">Empty Location Job</a></h2></div><div class="caption"><div class="location"><em class="mdi mdi-map-marker"></em></div><div class="time"><ul><li><em class="fa fa-clock-o"></em> <span>Hạn nộp<!-- -->: </span><time>10-09-2026</time></li></ul></div></div></div></div>`;
  const [job] = parseListingPage(CARD_EMPTY_LOCATION);
  assert.equal(job.location, '');
});

test('assertParsedSomething(): throws only when job cards are present but unparsed', () => {
  assert.throws(
    () => assertParsedSomething(PAGE.replace(/job_link/g, 'renamed'), `${BASE_URL}/tat-ca-viec-lam-vi.html`),
    /markup changed/,
  );
  assert.doesNotThrow(() => assertParsedSomething(NO_RESULTS_PAGE, `${BASE_URL}/tat-ca-viec-lam-vi.html`));
});

test('fetchCareerviet(): dedups a repeat and stops when a page adds nothing new', async () => {
  const byUrl = new Map([
    [`${BASE_URL}/tat-ca-viec-lam-vi.html`, PAGE],
    [`${BASE_URL}/tat-ca-viec-lam-trang-2-vi.html`, CARD_MINIMAL], // only a repeat
  ]);
  const jobs = await fetchCareerviet(`${BASE_URL}/tat-ca-viec-lam-vi.html`, {
    fetchImpl: textResponder(byUrl),
    company: {},
  });
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((j) => j.source === 'careerviet'));
  const full = jobs.find((j) => j.url.includes('35C82AFA'));
  assert.equal(full.date, new Date(Date.parse('2026-08-16T00:00:00+07:00')).toISOString());
  const minimal = jobs.find((j) => j.url.includes('35C90001'));
  assert.equal(minimal.date, '');
  assert.equal(minimal.company, '');
});

test('fetchCareerviet(): honours company.max_pages, clamps to the 50-page cap', async () => {
  const asked = [];
  const endlessFetch = (url) => {
    asked.push(url);
    const m = /trang-(\d+)/.exec(url);
    const page = m ? Number(m[1]) : 1;
    return Promise.resolve({
      ok: true,
      status: 200,
      text: async () => CARD_MINIMAL.replace(/35C90001/g, String(40000000 + page)),
    });
  };
  // An already-aborted signal short-circuits the polite inter-page delay (the
  // mock fetch ignores the signal), so the 50-page clamp doesn't wall-clock
  // the suite. delay() resolves immediately when signal.aborted is set.
  const signal = AbortSignal.abort();

  await fetchCareerviet(`${BASE_URL}/tat-ca-viec-lam-vi.html`, { fetchImpl: endlessFetch, signal, company: { max_pages: 3 } });
  assert.equal(asked.length, 3);

  asked.length = 0;
  await fetchCareerviet(`${BASE_URL}/tat-ca-viec-lam-vi.html`, { fetchImpl: endlessFetch, signal, company: { max_pages: 999 } });
  assert.equal(asked.length, 50);
});

test('fetchCareerviet(): every request is pinned against SSRF (redirect:error + browser UA)', async () => {
  const opts = [];
  const spy = (url, o) => {
    opts.push(o);
    return Promise.resolve({ ok: true, status: 200, text: async () => (url.includes('trang-') ? NO_RESULTS_PAGE : PAGE) });
  };
  await fetchCareerviet(`${BASE_URL}/tat-ca-viec-lam-vi.html`, { fetchImpl: spy, company: {} });
  assert.ok(opts.length > 0);
  assert.ok(opts.every((o) => o.redirect === 'error' && typeof o.headers['User-Agent'] === 'string' && o.headers['User-Agent'].length > 0));
});

test('fetchCareerviet(): a broken page 1 throws instead of returning an empty board', async () => {
  const brokenFetch = () => Promise.resolve({
    ok: true,
    status: 200,
    // The realistic markup change: postings still on the page (the job-item id
    // shape is intact) but the anchor class the parser keys on was renamed.
    text: async () => '<div id="job-item-35C99999"><a class="renamed" title="Senior Dev" href="/vi/tim-viec-lam/senior-dev.35C99999.html">Senior Dev</a></div>',
  });
  await assert.rejects(
    () => fetchCareerviet(`${BASE_URL}/tat-ca-viec-lam-vi.html`, { fetchImpl: brokenFetch, company: {} }),
    /markup changed/,
  );
});

test('fetchCareerviet(): rejects an off-host endpoint before any request is made', async () => {
  await assert.rejects(
    () => fetchCareerviet('https://evil.com/x', { fetchImpl: () => Promise.resolve({ ok: true, status: 200, text: async () => PAGE }) }),
    /untrusted hostname/,
  );
});
