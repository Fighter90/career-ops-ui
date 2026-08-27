/**
 * ITviec source — board-wide HTML listing for Vietnam's largest IT job board
 * (server/lib/sources/itviec.mjs). CI-isolated: a stubbed transport (no
 * network, no port binding). Ported from the parent career-ops
 * providers/itviec.mjs + tests/providers/itviec.test.mjs, adapted to the
 * web-ui source contract (rich job objects + a fake fetch that returns a
 * Response-like shape for http-json.mjs's fetchText).
 *
 * The fixtures reproduce shapes measured on the live board on 2026-08-23, and
 * each one exists because it decides the parser's design:
 *   - cards carry a per-card Stimulus attribute
 *     (`data-search--job-selection-job-slug-value`) that both delimits the card
 *     and names the posting slug — the anchor a redesign is least likely to drop;
 *   - the title lives inside an h3 tagged `jobTitle`; company, location and the
 *     relative "Posted … ago" label sit in SIBLING fragments, so a parser that
 *     windows tightly around the title loses them;
 *   - the location is only machine-readable as a title ATTRIBUTE next to the
 *     map-pin icon, not as link text;
 *   - titles carry HTML entities (`&amp;`) that must decode once.
 *
 * The important group: a listing page that parses to nothing must THROW.
 * Returning [] would render a broken parser as a board with no openings —
 * indistinguishable from a healthy quiet board.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  meta, LIST_URL, assertItviecUrl, buildListUrl, cityPath, visibleText,
  parsePostedAt, parseListingPage, assertParsedSomething, fetchItviec,
} from '../server/lib/sources/itviec.mjs';
import { itviecAdapter } from '../server/lib/portals/adapters/itviec.mjs';

const textResponse = (s) => ({ ok: true, status: 200, text: async () => s });

// ---------------------------------------------------------------- fixtures

// One full card, trimmed from the live page: slug attribute, title h3, company
// link, map-pin location div, relative posted label. Structure preserved,
// asset URLs shortened.
const CARD_FULL = `
<div class='job-card ipt-2 d-flex flex-column bg-white'
     data-action='click-&gt;search--job-selection#select'
     data-search--job-selection-job-slug-value='senior-backend-engineer-java-sring-fundiin-5621'
     data-search--job-selection-job-index-value='0'>
  <div class='ipx-4 ipx-xl-3'>
    <div class='ipy-2'>
      <div class='d-flex align-items-center justify-content-between position-relative'>
        <span class='small-text text-dark-grey'>
        Posted
        1 day ago
        </span>
      </div>
      <h3 class='imt-3 text-break' data-controller='utm-tracking' data-search--job-selection-target='jobTitle'>
        <a target="_blank" class="text-it-black text-hover-red"
           href="https://itviec.com/it-jobs/senior-backend-engineer-java-sring-fundiin-5621?lab_feature=preview_jd_page">Back &amp; Middle End Engineer (Java/Sring)</a>
      </h3>
      <div class='imy-3 d-flex align-items-center'>
        <a target="_blank" title="FUNDIIN - Financial Services Platform" class="bg-white logo-employer-card"
           href="/companies/fundiin?lab_feature=preview_jd_page"><picture></picture></a>
        <span class='ims-2 small-text text-hover-underline'>
          <a target="_blank" data-controller="utm-tracking" class="text-rich-grey"
             href="/companies/fundiin?lab_feature=preview_jd_page">Fundiin</a>
        </span>
      </div>
    </div>
    <div class='imt-1 d-flex align-items-center text-dark-grey igap-2 small-text'>
      <div class='text-rich-grey flex-shrink-0'>
      At office
      </div>
      <div class='dot-icon flex-shrink-0'></div>
      <svg class="feather-icon icon-sm"><use href="https://itviec.com/assets/feather-icons-sprite.svg#map-pin"></use></svg>
      <div class='text-rich-grey text-truncate text-nowrap stretched-link position-relative' title='Ho Chi Minh'>
      Ho Chi Minh
      </div>
    </div>
  </div>
</div>`;

// A minimal card: no company block, no map-pin row, no parseable date. Every
// optional field must come out empty rather than leak in from a NEIGHBOURING
// card — the reason the parser slices per-card windows instead of scanning the
// whole page once.
const CARD_MINIMAL = `
<div class='job-card ipt-2 d-flex flex-column bg-white'
     data-search--job-selection-job-slug-value='middle-java-developer-mb-bank-0508'>
  <div class='ipy-2'>
    <span class='small-text text-dark-grey'>
    Posted
    3 weeks ago
    </span>
    <h3 data-search--job-selection-target='jobTitle'>
      <a href="https://itviec.com/it-jobs/middle-java-developer-mb-bank-0508">Middle Java Developer</a>
    </h3>
  </div>
</div>`;

const PAGE = `<html><body><div class='card-jobs-list'>${CARD_FULL}${CARD_MINIMAL}</div></body></html>`;

// ------------------------------------------------------------------- tests

test('meta is valid for scan-dropdown auto-discovery', () => {
  assert.equal(meta.value, 'itviec');
  assert.equal(meta.label, 'ITviec');
  assert.equal(meta.region, 'en');
});

test('assertItviecUrl pins to itviec.com (exact host, HTTPS-only)', () => {
  assert.equal(assertItviecUrl(LIST_URL), LIST_URL);
  assert.throws(() => assertItviecUrl('https://evil.com/it-jobs'), /untrusted hostname/);
  assert.throws(() => assertItviecUrl('https://itviec.com.evil.com/it-jobs'), /untrusted hostname/);
  assert.throws(() => assertItviecUrl('http://itviec.com/it-jobs'), /HTTPS/);
  assert.throws(() => assertItviecUrl('not a url'), /invalid URL/);
});

test('buildListUrl: bare board, keyword + city path segments, unknown city dropped', () => {
  // Page 1 of the bare board is the plain path; later pages carry ?page=N.
  assert.equal(buildListUrl({}, 1), 'https://itviec.com/it-jobs');
  assert.equal(buildListUrl({}, 2), 'https://itviec.com/it-jobs?page=2');

  // A keyword narrows by path segment; spaces become hyphens, like the site.
  assert.equal(buildListUrl({ searchKeywords: 'back end' }, 1), 'https://itviec.com/it-jobs/back-end');

  // A recognized city appends its own segment; diacritics resolve to the
  // board's own slug.
  assert.equal(
    buildListUrl({ searchKeywords: 'java', searchLocation: 'Hà Nội' }, 1),
    'https://itviec.com/it-jobs/java/ha-noi',
  );

  // An unrecognized location is dropped, not encoded into the path.
  assert.equal(buildListUrl({ searchLocation: 'Berlin' }, 1), 'https://itviec.com/it-jobs');

  // Prototype-member names must resolve to null, not to an inherited
  // Object.prototype member interpolated into the URL.
  assert.equal(buildListUrl({ searchLocation: 'constructor' }, 1), 'https://itviec.com/it-jobs');
  assert.equal(buildListUrl({ searchLocation: 'toString' }, 1), 'https://itviec.com/it-jobs');
  assert.equal(buildListUrl({ searchLocation: 'valueOf' }, 1), 'https://itviec.com/it-jobs');

  // A slash inside the keyword must never create a second path segment.
  assert.equal(buildListUrl({ searchKeywords: 'node/js' }, 1), 'https://itviec.com/it-jobs/nodejs');
});

test('cityPath resolves known cities (incl. diacritics) and rejects prototype members', () => {
  assert.equal(cityPath('HCM'), 'ho-chi-minh-hcm');
  assert.equal(cityPath('Hanoi'), 'ha-noi');
  assert.equal(cityPath('đà nẵng'), 'da-nang');
  assert.equal(cityPath('Berlin'), null);
  assert.equal(cityPath(''), null);
  assert.equal(cityPath('constructor'), null);
});

test('visibleText drops HTML comments (not just tags) and decodes entities once', () => {
  assert.equal(visibleText('Senior Dev <!-- ad --> <img src="x.gif">'), 'Senior Dev');
  assert.equal(visibleText('Back &amp; Middle'), 'Back & Middle');
});

test('parseListingPage: one job per card slug, entities decoded, no cross-card leak', () => {
  const jobs = parseListingPage(PAGE);
  assert.equal(jobs.length, 2);

  const senior = jobs.find((j) => j.url.endsWith('-5621'));
  assert.ok(senior);
  assert.equal(senior.title, 'Back & Middle End Engineer (Java/Sring)'); // entities decoded once
  assert.equal(senior.company, 'Fundiin'); // first /companies/ link WITH text
  assert.equal(senior.location, 'Ho Chi Minh'); // map-pin div's title attribute
  assert.ok(typeof senior.postedAt === 'number' && Math.abs(senior.postedAt - (Date.now() - 86_400_000)) < 5000);

  const middle = jobs.find((j) => j.url.endsWith('-0508'));
  assert.ok(middle);
  assert.equal(middle.title, 'Middle Java Developer');
  // Fields the minimal card lacks must be EMPTY — never inherited from the
  // richer neighbour above it.
  assert.equal(middle.company, '');
  assert.equal(middle.location, '');
  // The posted label is picked up even though it precedes the title h3.
  assert.ok(typeof middle.postedAt === 'number' && Math.abs(middle.postedAt - (Date.now() - 21 * 86_400_000)) < 5000);

  // robustness
  assert.equal(parseListingPage('<html>no jobs</html>').length, 0);
  assert.equal(parseListingPage(undefined).length, 0);
});

test('parsePostedAt: English + Vietnamese relative labels, unparseable stays undefined', () => {
  const now = Date.now();
  const cases = [
    ['today', 0],
    ['1 hour ago', 3_600_000],
    ['1 day ago', 86_400_000],
    ['3 weeks ago', 21 * 86_400_000],
    ['2 months ago', 60 * 86_400_000],
  ];
  for (const [label, delta] of cases) {
    const got = parsePostedAt(`Posted ${label}`, now);
    assert.equal(typeof got, 'number');
    assert.ok(Math.abs(got - (now - delta)) < 1000, `label "${label}" => ${got}`);
  }

  assert.equal(parsePostedAt('Posted sometime', now), undefined);

  // The Vietnamese-locale variant: "Đăng … trước" instead of "Posted … ago".
  const vi = parsePostedAt('Đăng 3 ngày trước', now);
  assert.equal(typeof vi, 'number');
  assert.ok(Math.abs(vi - (now - 3 * 86_400_000)) < 1000);
});

test('a Vietnamese-locale card yields postedAt via the label regex', () => {
  const now = Date.now();
  const VI_CARD = CARD_MINIMAL
    .replace(/Posted\s*3 weeks ago/, 'Đăng 2 tuần trước')
    .replace(/mb-bank-0508/g, 'vi-card-0001');
  const [viJob] = parseListingPage(VI_CARD);
  assert.ok(viJob);
  assert.equal(typeof viJob.postedAt, 'number');
  assert.ok(Math.abs(viJob.postedAt - (now - 14 * 86_400_000)) < 5000);
});

test('assertParsedSomething: throws only when card markers are present but unparsed', () => {
  // Postings still present (URL shape intact) but the parser's anchor renamed.
  assert.throws(
    () => assertParsedSomething(PAGE.replace(/jobTitle/g, 'renamed'), LIST_URL),
    /markup changed/,
  );
  // A genuinely empty page must NOT throw — a quiet board is not a break.
  assert.doesNotThrow(() => assertParsedSomething('<html><body>No jobs match your search.</body></html>', LIST_URL));
  // The guard's posting-link shape must not hinge on an exact digit count.
  assert.throws(
    () => assertParsedSomething('<a href="/it-jobs/junior-dev-123456">Junior Dev</a>', LIST_URL),
    /markup changed/,
  );
  // Category links (no numeric suffix) are not evidence of postings.
  assert.doesNotThrow(
    () => assertParsedSomething('<a href="/it-jobs/java">Java</a> <a href="/it-jobs/php">PHP</a>', LIST_URL),
  );
});

test('fetchItviec: pins redirect:error + a browser UA, dedups repeats, stops on no-fresh page', async () => {
  const pages = new Map([
    [LIST_URL, PAGE],
    [`${LIST_URL}?page=2`, CARD_MINIMAL], // only a repeat of the middle-java-developer card
  ]);
  const requested = [];
  const seenInit = [];
  const fetchImpl = async (url, init) => {
    requested.push(url);
    seenInit.push(init);
    return textResponse(pages.get(url) ?? '<html><body>No jobs match your search.</body></html>');
  };

  // An already-aborted signal short-circuits the polite inter-page delay (the
  // mock fetch ignores the signal) so the 750ms pacing doesn't wall-clock the
  // suite. delay() resolves immediately once signal.aborted is set.
  const signal = AbortSignal.abort();
  const jobs = await fetchItviec(LIST_URL, { fetchImpl, signal });

  assert.equal(jobs.length, 2); // page 2's repeat is not duplicated
  assert.equal(requested.length, 2); // stops once page 2 contributes nothing new
  assert.equal(jobs[0].source, 'itviec');
  assert.equal(jobs[0].id, 'itviec-senior-backend-engineer-java-sring-fundiin-5621');
  assert.equal(jobs[0].company, 'Fundiin');
  assert.equal(jobs[0].location, 'Ho Chi Minh');
  assert.ok(typeof jobs[0].date === 'string' && jobs[0].date.length > 0);

  assert.ok(seenInit.length > 0);
  for (const init of seenInit) {
    assert.equal(init.redirect, 'error');
    assert.equal(typeof init.headers['User-Agent'], 'string');
    assert.ok(init.headers['User-Agent'].length > 0);
  }
});

test('fetchItviec: entry.max_pages configures the run; an over-large value clamps to 50', async () => {
  const signal = AbortSignal.abort();

  // A configured max_pages honoured when every page brings a fresh card.
  const mkCard = (slug) => CARD_MINIMAL.replace(/middle-java-developer-mb-bank-0508/g, slug);
  const wide = new Map([
    [LIST_URL, PAGE],
    [`${LIST_URL}?page=2`, mkCard('page-two-job-a-0001')],
    [`${LIST_URL}?page=3`, mkCard('page-three-job-b-0002')],
  ]);
  const asked = [];
  const fetchImpl = async (url) => {
    asked.push(url);
    return textResponse(wide.get(url) ?? '<html>No jobs.</html>');
  };
  await fetchItviec(LIST_URL, { fetchImpl, signal, company: { max_pages: 2 } });
  assert.equal(asked.length, 2);

  // Every page below yields a NEW posting, so nothing but the cap can stop the
  // run — this proves the 50-page ceiling, not the no-fresh-page stop.
  const askedUnbounded = [];
  const endlessFetch = async (url) => {
    askedUnbounded.push(url);
    const page = Number(new URL(url).searchParams.get('page') || '1');
    return textResponse(CARD_MINIMAL.replace(/mb-bank-0508/g, String(700000 + page)));
  };
  await fetchItviec(LIST_URL, { fetchImpl: endlessFetch, signal, company: { max_pages: 999 } });
  assert.equal(askedUnbounded.length, 50);
});

test('fetchItviec: searchKeywords/searchLocation shape every page request', async () => {
  const signal = AbortSignal.abort();
  const asked = [];
  const fetchImpl = async (url) => {
    asked.push(url);
    return textResponse(url.includes('backend/ha-noi') ? PAGE : '<html>No jobs.</html>');
  };
  await fetchItviec(LIST_URL, {
    fetchImpl,
    signal,
    company: { searchKeywords: 'Backend', searchLocation: 'Ha Noi' },
  });
  assert.equal(asked[0], 'https://itviec.com/it-jobs/backend/ha-noi');
});

test('fetchItviec: a broken page 1 (cards present, unparsable) throws instead of an empty board', async () => {
  const signal = AbortSignal.abort();
  const fetchImpl = async () => textResponse('<a href="/it-jobs/senior-dev-1234">Senior Dev</a>');
  await assert.rejects(() => fetchItviec(LIST_URL, { fetchImpl, signal }), /markup changed/);
});

test('fetchItviec: rejects a foreign host and a non-HTTPS endpoint (SSRF pin)', async () => {
  const fetchImpl = async () => textResponse(PAGE);
  await assert.rejects(() => fetchItviec('https://evil.example.com/jobs', { fetchImpl }), /untrusted hostname/);
  await assert.rejects(() => fetchItviec('http://itviec.com/it-jobs', { fetchImpl }), /HTTPS/);
});

test('itviecAdapter: matches() + buildEndpoint() contracts', () => {
  assert.equal(itviecAdapter.id, 'itviec');
  assert.equal(itviecAdapter.label, 'ITviec');
  assert.equal(typeof itviecAdapter.fetch, 'function');

  // provider-selected only — never careers_url-detected.
  assert.equal(itviecAdapter.matches({ provider: 'itviec' }), true);
  assert.equal(itviecAdapter.matches({ careers_url: 'https://itviec.com/it-jobs' }), false);
  assert.equal(itviecAdapter.matches({}), false);
  assert.equal(itviecAdapter.matches(null), false);

  // Bare provider → the plain board URL.
  assert.equal(itviecAdapter.buildEndpoint({ provider: 'itviec' }), LIST_URL);
  // searchKeywords/searchLocation flow into the built endpoint.
  assert.equal(
    itviecAdapter.buildEndpoint({ provider: 'itviec', searchKeywords: 'java', searchLocation: 'Da Nang' }),
    'https://itviec.com/it-jobs/java/da-nang',
  );

  // off-host override ignored → derived endpoint
  assert.equal(itviecAdapter.buildEndpoint({ provider: 'itviec', itviec: 'https://evil.com/x' }), LIST_URL);
  assert.equal(itviecAdapter.buildEndpoint({ provider: 'itviec', api: 'not a url' }), LIST_URL);
  // on-host https override honoured
  assert.equal(
    itviecAdapter.buildEndpoint({ provider: 'itviec', itviec: 'https://itviec.com/it-jobs/mirror' }),
    'https://itviec.com/it-jobs/mirror',
  );
});
