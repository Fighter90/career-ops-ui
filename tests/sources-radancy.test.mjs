/**
 * Radancy source — LEGACY TalentBrew markup + JSON results-fragment transport.
 *
 * Ports the parent career-ops `tests/providers/radancy.test.mjs` cases added for
 * the two-markup-generations fix, adapted to the web-ui source contract: the
 * parsers emit rich job objects (not raw {id,title,url,location} records) and
 * the fragment transport is reached via an injected `opts.fetchJson` capability
 * (an injected-capability gate) rather than a `ctx` object.
 *
 * Fixtures are trimmed from real responses. Both legacy fixtures keep the
 * sibling <button class="js-save-job-btn" data-job-id="…"> that repeats the job
 * id — exactly what a naive data-job-id scan would turn into a phantom row.
 *
 * The existing modern-markup + ?p=N-walk cases live in
 * tests/sources-parity-v1118a.test.mjs and are left untouched.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseResults,
  parseModernResults,
  parseLegacyResults,
  resolveListUrl,
  assertRadancyUrl,
  buildFragmentUrl,
  readFragmentTotals,
  fetchRadancy,
} from '../server/lib/sources/radancy.mjs';

// A fetch-like text Response (HTML transport). json() throws on non-JSON, which
// is what makes an HTML page fail the fragment probe and fall through.
const textResponse = (s) => ({ ok: true, status: 200, text: async () => s, json: async () => JSON.parse(s) });

// Modern `search-results-list__item` markup (the untouched path).
const modernCard = (id, title, loc) =>
  '<li class="search-results-list__item job-list-01-list__item">' +
  '<div class="search-results-list__content">' +
  `<h5 class="search-results-list__job-title"><a class="search-results-list__job-link" href="/en/job/city/${id}-slug/3193/${id}" data-job-id="${id}">${title}</a></h5>` +
  `<ul><li class="search-results-list__job-info job-list-01-list__job-info--location"><i></i> <span>${loc}</span></li></ul>` +
  '</li>';
const MODERN_HTML = '<html>'
  + modernCard('40548453568', 'Innendienst', 'Bingen am Rhein, Germany')
  + modernCard('40546200896', 'Category Manager', 'London, United Kingdom')
  + '</html>';

// careers.unitedhealthgroup.com — wrapping <div>, req-number span, branded anchor class.
const LEGACY_UHG = `
<section id="search-results" data-total-results="5889" data-total-pages="59" data-records-per-page="100">
<ul>
<li>
  <a href="/job/acton/patient-service-representative/34088/98479156752" data-job-id="98479156752"
     class="brand-facet brand-facet__optum">
    <div>
      <h2>Patient Service Representative</h2>
      <span class="job-id job-info">1062355</span>
      <span class="job-divider"> | </span>
      <span class="job-location 1">Acton, Massachusetts</span>
    </div>
  </a>
  <button type="button" class="js-save-job-btn" data-job-id="98479156752" data-org-id="34088"></button>
</li>
<li>
  <a href="/job/eden-prairie/principal-architect-interoperability/34088/98187357488" data-job-id="98187357488"
     class="brand-facet brand-facet__optum">
    <div>
      <h2>Principal Architect, Interoperability &amp; Integration</h2>
      <span class="job-id job-info">1062360</span>
      <span class="job-location 1">Eden Prairie, Minnesota</span>
    </div>
  </a>
  <button type="button" class="js-save-job-btn" data-job-id="98187357488"></button>
</li>
</ul></section>`;

// www.kaiserpermanentejobs.org — same family, no wrapping div / class / req span.
const LEGACY_KP = `
<section id="search-results" data-total-results="2714" data-total-pages="28">
<ul>
<li>
  <a href="/job/denver/sales-representative-ii-large-group/641/98493319104" data-job-id="98493319104">
    <h2>Sales Representative II - Large Group</h2>
    <span class="job-location">Denver, CO, Flexible, Full-time, Day</span>
  </a>
  <button type="button" class="js-save-job-btn" data-job-id="98493319104" data-org-id="641"></button>
</li>
</ul></section>`;

// Silence the deliberate "truncated at N of M" warning in fragment tests whose
// fixtures report a total larger than the rows they serve (incidental, asserted
// on only in the dedicated truncation test).
async function muteErrors(fn) {
  const real = console.error;
  console.error = () => {};
  try { return await fn(); } finally { console.error = real; }
}

test('radancy modern parser is untouched by the legacy addition', () => {
  const modern = parseModernResults(MODERN_HTML, 'https://careers.munichre.com', 'Munich Re');
  assert.equal(modern.length, 2);
  assert.equal(modern[0].id, 'radancy-40548453568');
  assert.equal(modern[0].source, 'radancy');
  // The modern parser must not claim the legacy markup.
  assert.equal(parseModernResults(LEGACY_KP, 'https://x').length, 0);
});

test('radancy parseLegacyResults: UHG rows (save-job button not double-counted)', () => {
  const rows = parseLegacyResults(LEGACY_UHG, 'https://careers.unitedhealthgroup.com', 'Optum');
  assert.equal(rows.length, 2); // the repeated data-job-id on <button> must not add phantom rows
  // Title comes from <h2>, excluding the req-number span.
  assert.equal(rows[0].title, 'Patient Service Representative');
  // .job-location, tolerating the trailing " 1" class token.
  assert.equal(rows[0].location, 'Acton, Massachusetts');
  // Relative href resolved against origin.
  assert.equal(rows[0].url, 'https://careers.unitedhealthgroup.com/job/acton/patient-service-representative/34088/98479156752');
  // Entities decoded in legacy titles.
  assert.equal(rows[1].title, 'Principal Architect, Interoperability & Integration');
  // Emitted job SHAPE is identical to the modern path.
  assert.deepEqual(Object.keys(rows[0]).sort(), ['company', 'date', 'id', 'isRemote', 'location', 'relocates', 'salary', 'snippet', 'source', 'title', 'url', 'workplaceType'].sort());
  assert.equal(rows[0].id, 'radancy-98479156752');
  assert.equal(rows[0].company, 'Optum');
  assert.equal(rows[0].date, '');
  assert.equal(rows[0].source, 'radancy');
});

test('radancy parseLegacyResults: Kaiser variant (no div / class / req span)', () => {
  const rows = parseLegacyResults(LEGACY_KP, 'https://www.kaiserpermanentejobs.org', 'Kaiser Permanente');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Sales Representative II - Large Group');
  assert.equal(rows[0].location, 'Denver, CO, Flexible, Full-time, Day');
});

// search.jobs.barclays — card layout: title in <strong> inside the anchor,
// location as a SIBLING <div class="job-location"> after it (not inside),
// plus a job-date block whose <span> must not be mistaken for the location.
const LEGACY_BARCLAYS = `
<section id="search-results" data-total-results="797" data-total-pages="8" data-records-per-page="100">
<div class="list-item list-item--card fs-column fs-top round-corners bg--pale-blue-light p-1 text--black">
  <a href="/job/noida/fcs-senior-analyst/13015/101304506192" class="headline-3 job-title--link text--black" data-job-id="101304506192"><strong>FCS Senior Analyst</strong></a>
  <div class="job-location"> Noida, India</div>
  <div class="bg--white round-corners--small job-date"><img src="https://tbcdn.talentbrew.com/company/13015/v1_0/img/icons/icon-date--active-blue.svg" alt="" class="job-date--icon" /> <span>28 Sep</span></div>
</div>
<div class="list-item list-item--card fs-column fs-top round-corners bg--pale-blue-light p-1 text--black">
  <a href="/job/hong-kong/vp-quant-analyst/13015/99719476320" class="headline-3 job-title--link text--black" data-job-id="99719476320"><strong>VP Global Markets Liquid Financing Quant Analyst</strong></a>
  <div class="job-location"> Hong Kong, Hong Kong</div>
  <div class="bg--white round-corners--small job-date"><span>27 Sep</span></div>
</div>
</section>`;

test('radancy parseLegacyResults: Barclays card layout (title in <strong>, sibling job-location div)', () => {
  const rows = parseLegacyResults(LEGACY_BARCLAYS, 'https://search.jobs.barclays', 'Barclays');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, 'radancy-101304506192');
  assert.equal(rows[0].title, 'FCS Senior Analyst');
  assert.equal(rows[0].url, 'https://search.jobs.barclays/job/noida/fcs-senior-analyst/13015/101304506192');
  assert.equal(rows[0].location, 'Noida, India');
  assert.equal(rows[1].title, 'VP Global Markets Liquid Financing Quant Analyst');
  assert.equal(rows[1].location, 'Hong Kong, Hong Kong');
  // The job-date <span>s between the anchors must never be mistaken for the location.
  assert.ok(rows.every((r) => !/Sep/.test(r.location)));
});

test('radancy modern parser does not claim the Barclays card layout (legacy branch still reached)', () => {
  assert.equal(parseModernResults(LEGACY_BARCLAYS, 'https://search.jobs.barclays', 'Barclays').length, 0);
  assert.equal(parseResults(LEGACY_BARCLAYS, 'https://search.jobs.barclays', 'Barclays').length, 2);
});

test('radancy parseLegacyResults: <p class="job-location"> is read; a location-less row stays empty', () => {
  // The sibling fallback reads the <p> variant and must not invent a location
  // for the unplaced row — nor borrow the next row's.
  const LEGACY_MIXED = `
<ul>
<li><a href="/job/london/analyst/13015/1" data-job-id="1"><strong>Analyst</strong></a><p class="job-location">London (United Kingdom)</p></li>
<li><a href="/job/nowhere/unplaced/13015/2" data-job-id="2"><strong>Unplaced</strong></a></li>
<li><a href="/job/pune/engineer/13015/3" data-job-id="3"><strong>Engineer</strong></a><div class="job-location">Pune (India)</div></li>
</ul>`;
  const rows = parseLegacyResults(LEGACY_MIXED, 'https://search.jobs.barclays');
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.location), ['London (United Kingdom)', '', 'Pune (India)']);
});

test('radancy parseResults falls back to the legacy parser only when modern finds nothing', () => {
  assert.equal(parseResults(LEGACY_KP, 'https://www.kaiserpermanentejobs.org', 'Kaiser').length, 1);
  // Modern markup still resolves through the modern branch (no legacy fallback).
  assert.equal(parseResults(MODERN_HTML, 'https://careers.munichre.com', 'Munich Re').length, 2);
});

test('radancy parseLegacyResults rejects malformed rows without throwing', () => {
  const cases = [
    () => parseLegacyResults(null, 'https://x.example'),
    () => parseLegacyResults('<a data-job-id="1">no href</a>', 'https://x.example'),
    () => parseLegacyResults('<a href="/job/a/b/1/2">no data-job-id</a>', 'https://x.example'),
    () => parseLegacyResults('<a href="/not-a-job/x" data-job-id="1"><h2>T</h2></a>', 'https://x.example'),
    () => parseLegacyResults('<a href="/job/a/b/1/2" data-job-id="1"><h2></h2></a>', 'https://x.example'),
  ];
  for (const f of cases) assert.equal(f().length, 0);
  // A repeated data-job-id dedupes across rows.
  assert.equal(parseLegacyResults(LEGACY_KP + LEGACY_KP, 'https://www.kaiserpermanentejobs.org').length, 1);
});

test('radancy buildFragmentUrl: the two params that decide whether the endpoint is usable', () => {
  const u = new URL(buildFragmentUrl('https://careers.unitedhealthgroup.com/en/search-jobs', 3));
  assert.equal(u.pathname, '/en/search-jobs/results');
  // SearchResultsModuleName MUST be sent (omitting it silently returns empty).
  assert.equal(u.searchParams.get('SearchResultsModuleName'), 'Search Results');
  // SearchFiltersModuleName MUST be absent (sending it re-attaches an ~8MB blob).
  assert.equal(u.searchParams.has('SearchFiltersModuleName'), false);
  assert.equal(u.searchParams.get('CurrentPage'), '3');
  assert.equal(u.searchParams.get('RecordsPerPage'), '100');
});

test('radancy readFragmentTotals reads data-total-results / data-total-pages', () => {
  const totals = readFragmentTotals(LEGACY_UHG);
  assert.equal(totals.totalResults, 5889);
  assert.equal(totals.totalPages, 59);
  // Missing / non-string input nulls out, never throws.
  assert.equal(readFragmentTotals('<div/>').totalPages, null);
  assert.equal(readFragmentTotals(null).totalResults, null);
});

test('radancy fetch prefers the JSON fragment transport and stamps company', async () => {
  const fragCalls = [];
  const jobs = await muteErrors(() => fetchRadancy('https://careers.unitedhealthgroup.com/en/search-jobs', {
    fetchImpl: async () => { throw new Error('the HTML page must not be touched when the fragment works'); },
    fetchJson: async (url) => {
      fragCalls.push(url);
      return Number(new URL(url).searchParams.get('CurrentPage')) === 1
        ? { results: LEGACY_UHG, hasJobs: true }
        : { results: '', hasJobs: true };
    },
    company: { name: 'Optum' },
  }));
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].company, 'Optum');
  assert.equal(jobs[0].title, 'Patient Service Representative');
  assert.ok(fragCalls.length > 0);
  assert.ok(fragCalls.every((u) => u.includes('/en/search-jobs/results')));
});

test('radancy fetch works with no fetchJson capability (HTML transport)', async () => {
  // The fragment transport is attempted by DEFAULT now; the mock refuses the
  // /results route (its HTML body fails res.json()) so the walk uses ?p=N.
  let calls = 0;
  const jobs = await fetchRadancy('https://careers.munichre.com/en/search-jobs', {
    fetchImpl: async (url) => (String(url).includes('/results')
      ? textResponse('<html>fragment probe — json() throws</html>')
      : textResponse(calls++ === 0 ? MODERN_HTML : '<html></html>')),
    company: { name: 'Munich Re' },
  });
  assert.equal(jobs.length, 2);
});

// ── Phase-2 (v1.242.0 sources-6): fragment transport by default, envelope ────

test('radancy: the JSON fragment transport runs by DEFAULT (no opts.fetchJson needed)', async () => {
  // In prod no caller passes fetchJson, so the preferred transport was dead
  // code. Without the capability the default must still try /results first.
  let page = 0;
  const htmlCalls = [];
  const jobs = await muteErrors(() => fetchRadancy('https://careers.unitedhealthgroup.com/en/search-jobs', {
    fetchImpl: async (url) => (String(url).includes('/results')
      ? { ok: true, status: 200, json: async () => (page++ === 0 ? { results: LEGACY_UHG, hasJobs: true } : { results: '', hasJobs: true }) }
      : (htmlCalls.push(String(url)), { ok: false, status: 403, text: async () => '', headers: { get: () => null } })),
    company: { name: 'Optum' },
  }));
  assert.ok(page >= 1, 'the /results fragment endpoint was requested');
  assert.equal(jobs.length, 2);
  assert.deepEqual(htmlCalls, [], 'a working fragment transport never touches ?p=N');
});

test('radancy: a page-1 HTML 200 with zero cards and no search-results container THROWS', async () => {
  // A Cloudflare challenge parses to zero rows on both markups; without the
  // documented envelope (the search-results section, present even on an empty
  // board) a page-1 200 must throw instead of reading as an empty board.
  const challenge = '<html><head><title>Attention Required</title></head><body>cf-error-details</body></html>';
  await assert.rejects(
    () => fetchRadancy('https://careers.munichre.com/en/search-jobs', {
      fetchImpl: async () => textResponse(challenge),
      company: { name: 'Munich Re' },
    }),
    /search-results container/,
  );
});

test('radancy: page-1 zero cards WITH the search-results container is a legitimately empty board', async () => {
  const empty = '<html><section id="search-results" data-total-results="0" data-total-pages="1"></section></html>';
  const jobs = await fetchRadancy('https://careers.munichre.com/en/search-jobs', {
    fetchImpl: async () => textResponse(empty),
    company: { name: 'Munich Re' },
  });
  assert.deepEqual(jobs, []);
});

test('radancy: a mid-scan HTML failure keeps the partials and logs', async () => {
  const warnings = [];
  const real = console.warn;
  console.warn = (m) => warnings.push(String(m));
  let htmlCalls = 0;
  let jobs;
  try {
    jobs = await fetchRadancy('https://careers.munichre.com/en/search-jobs', {
      fetchImpl: async (url) => {
        if (String(url).includes('/results')) return textResponse('<html>fragment probe — json() throws</html>');
        if (++htmlCalls === 1) return textResponse(MODERN_HTML);
        throw new Error('HTTP 503 (?p=2)');
      },
      company: { name: 'Munich Re' },
    });
  } finally {
    console.warn = real;
  }
  assert.equal(jobs.length, 2, 'page-2 failure keeps page-1 rows');
  assert.match(warnings.join(' '), /radancy/);
  assert.match(warnings.join(' '), /keeping partials|partial/i);
});

test('radancy: every resolveListUrl output passes assertRadancyUrl (no lang / en-us)', () => {
  // resolveListUrl keeps a lang-less search-jobs path as-is and derives one
  // only when absent — so the endpoint shape guard must accept BOTH, or every
  // scan of such a tenant fails at the guard.
  const entries = [
    'https://careers.munichre.com/search-jobs',        // no lang segment
    'https://careers.munichre.com/en/search-jobs',     // 2-letter lang
    'https://careers.munichre.com/en-us/search-jobs',  // regional lang
    'https://careers.munichre.com/de/some-page',       // → /de/search-jobs
    'https://careers.munichre.com/en-us/careers',      // → en-us preserved
  ];
  for (const entry of entries) {
    const endpoint = resolveListUrl({ api: entry });
    assert.ok(endpoint, `resolveListUrl(${entry})`);
    assert.doesNotThrow(() => assertRadancyUrl(endpoint), `assertRadancyUrl(${endpoint})`);
  }
  // The regional lang survives resolution instead of collapsing to /en/.
  assert.equal(resolveListUrl({ api: 'https://careers.munichre.com/en-us/careers' }), 'https://careers.munichre.com/en-us/search-jobs');
  // The guard still refuses anything that is not a search-jobs list URL.
  assert.throws(() => assertRadancyUrl('https://careers.munichre.com/en/other'), /search-jobs/);
  assert.throws(() => assertRadancyUrl('https://careers.munichre.com/en-us/jobs/listing'), /search-jobs/);
  assert.throws(() => assertRadancyUrl('not-a-url'), /invalid URL/);
});

test('radancy: job URLs are pinned to https on the tenant origin (both parsers)', () => {
  // href is page-controlled content: a javascript:/data:/scheme-relative/
  // plain-http href must never become the job URL, and an absolute one must
  // not leave the tenant origin the endpoint was pinned to.
  const wrap = (href) =>
    `<li class="search-results-list__item"><a class="search-results-list__job-link" href="${href}" data-job-id="1">T</a></li>`;
  const legacyWrap = (href) => `<li><a href="${href}" data-job-id="1"><h2>T</h2></a></li>`;
  const origin = 'https://careers.munichre.com';
  for (const parser of [parseModernResults, parseLegacyResults]) {
    for (const href of [
      'javascript:alert(1)//job/x',
      'data:text/html,<a>',
      '//evil.com/job/city/1-slug/3/1',
      'http://careers.munichre.com/job/city/1-slug/3/1',
      'https://evil.com/job/city/1-slug/3/1',
      'https://[', // unparseable even relative to the origin → dropped, never thrown
    ]) {
      const html = /Modern/.test(parser.name) ? wrap(href) : legacyWrap(href);
      assert.equal(parser(html, origin, 'X').length, 0, `${parser.name} dropped nothing for ${href}`);
    }
  }
  // A same-origin relative href still resolves.
  assert.equal(parseModernResults(wrap('/en/job/city/1-slug/3/1'), origin, 'X').length, 1);
  assert.equal(parseLegacyResults(legacyWrap('/en/job/city/1-slug/3/1'), origin, 'X').length, 1);
});

test('radancy fetch falls back to ?p=N when the fragment endpoint throws', async () => {
  let fbText = 0;
  const jobs = await fetchRadancy('https://careers.munichre.com/en/search-jobs', {
    fetchJson: async () => { throw new Error('no fragment endpoint on this tenant'); },
    fetchImpl: async () => textResponse(fbText++ === 0 ? MODERN_HTML : '<html></html>'),
    company: { name: 'Munich Re' },
  });
  assert.equal(jobs.length, 2);
  assert.ok(fbText > 0);
});

test('radancy fetch falls back when the fragment parses to zero rows', async () => {
  let emptyText = 0;
  const jobs = await fetchRadancy('https://careers.munichre.com/en/search-jobs', {
    fetchJson: async () => ({ results: '<div>no rows here</div>', hasJobs: true }),
    fetchImpl: async () => textResponse(emptyText++ === 0 ? MODERN_HTML : '<html></html>'),
    company: { name: 'Munich Re' },
  });
  assert.equal(jobs.length, 2);
  assert.ok(emptyText > 0);
});

test('radancy fetch THROWS on a total outage (page-1 HTML fails, nothing resolved)', async () => {
  // No fetchJson capability → straight to the HTML transport; page 1 fails and
  // NO request on either transport ever resolved, so the tenant is unreachable,
  // not empty. It must reject so scan/portal-health record a failure instead of
  // "live but empty" (meituan/tencent contract), NOT swallow to [].
  await assert.rejects(
    () => fetchRadancy('https://careers.munichre.com/en/search-jobs', {
      fetchImpl: async () => { throw new Error('tenant down'); },
      company: { name: 'Munich Re' },
    }),
    /tenant down/,
  );
});

test('radancy fetch does NOT throw when the fragment resolved (zero rows) then the HTML fallback fails', async () => {
  // A resolved fragment request is proof of life even at zero rows: when the
  // HTML fallback then fails (e.g. 403 on ?p=1), fetch() must NOT throw
  // "unreachable" for a tenant it just talked to — it returns what it has ([]).
  const jobs = await fetchRadancy('https://careers.munichre.com/en/search-jobs', {
    fetchJson: async () => ({ results: '', hasJobs: false }),
    fetchImpl: async () => { throw new Error('403 on the HTML page'); },
    company: { name: 'Munich Re' },
  });
  assert.deepEqual(jobs, []);
});

test('radancy fetch honors max_jobs on the fragment transport', async () => {
  const jobs = await muteErrors(() => fetchRadancy('https://careers.unitedhealthgroup.com/en/search-jobs', {
    fetchJson: async () => ({ results: LEGACY_UHG, hasJobs: true }),
    fetchImpl: async () => { throw new Error('unused'); },
    company: { name: 'Optum', max_jobs: 1 },
  }));
  assert.equal(jobs.length, 1);
});

test('radancy truncation warning reports the returned count, not the pre-slice buffer', async () => {
  // Legacy row generator; each fragment page serves 3 rows with server totals.
  const rowFor = (id) => `<li><a href="/job/c/s/1/${id}" data-job-id="${id}"><h2>T${id}</h2><span class="job-location">X</span></a></li>`;
  let page = 0;
  const warnings = [];
  const real = console.error;
  console.error = (m) => warnings.push(String(m));
  let jobs;
  try {
    // 3 rows/page with max_jobs 4 → page 2 pushes the buffer to 6, returns 4.
    jobs = await fetchRadancy('https://x.example/en/search-jobs', {
      fetchJson: async () => {
        page++;
        const ids = [page * 10 + 1, page * 10 + 2, page * 10 + 3];
        return { results: `<section data-total-results="99" data-total-pages="9">${ids.map(rowFor).join('')}</section>`, hasJobs: true };
      },
      fetchImpl: async () => { throw new Error('unused'); },
      company: { name: 'Overshoot', max_jobs: 4 },
    });
  } finally {
    console.error = real;
  }
  assert.equal(jobs.length, 4);
  const warned = (warnings.join(' ').match(/truncated at (\d+) of (\d+)/) || [])[1];
  assert.equal(warned, '4'); // the RETURNED count (4), not the pre-slice buffer (6)
});

test('radancy does not warn when the tenant simply serves fewer postings than its banner claims', async () => {
  // The whole point of parent career-ops #3839: `data-total-results` overstates
  // on a majority of tenants (4 of 9 measured live, by 10-56%). A walk that ends
  // naturally — the tenant ran out of rows — is COMPLETE, and warning "truncated
  // at 3 of 99" there tells the user to raise a cap that was never reached.
  const rowFor = (id) => `<li><a href="/job/c/s/1/${id}" data-job-id="${id}"><h2>T${id}</h2><span class="job-location">X</span></a></li>`;
  let page = 0;
  const warnings = [];
  const real = console.error;
  console.error = (m) => warnings.push(String(m));
  let jobs;
  try {
    jobs = await fetchRadancy('https://x.example/en/search-jobs', {
      fetchJson: async () => {
        page++;
        // Page 1 serves 3 rows; page 2 serves none — the board is exhausted —
        // while the banner keeps claiming 99 results across 9 pages.
        const ids = page === 1 ? [11, 12, 13] : [];
        return { results: `<section data-total-results="99" data-total-pages="9">${ids.map(rowFor).join('')}</section>`, hasJobs: true };
      },
      fetchImpl: async () => { throw new Error('unused'); },
      company: { name: 'Overstating', max_jobs: 500, max_pages: 20 },
    });
  } finally {
    console.error = real;
  }
  assert.equal(jobs.length, 3, 'every posting the tenant actually served is kept');
  assert.deepEqual(
    warnings.filter((w) => /truncated/.test(w)),
    [],
    'no truncation warning: our caps (500 jobs / 20 pages) were never reached',
  );
});

test('radancy cache-busts every JSON fragment request with a fresh value', () => {
  // A caching layer in front of the JSON route replays stale responses on some
  // tenants. A deterministic extra parameter would still give the cache a stable
  // key — and therefore the same stable, wrong mapping — so the buster must
  // differ per CALL, not per page.
  const a = new URL(buildFragmentUrl('https://x.example/en/search-jobs', 2));
  const b = new URL(buildFragmentUrl('https://x.example/en/search-jobs', 2));
  assert.ok(a.searchParams.get('_'), 'the cache-buster is present');
  assert.notEqual(
    a.searchParams.get('_'),
    b.searchParams.get('_'),
    'two calls for the SAME page must not produce the same URL',
  );
  // Everything else is unchanged — the buster must not disturb the real query.
  a.searchParams.delete('_');
  b.searchParams.delete('_');
  assert.equal(a.toString(), b.toString());
  assert.equal(a.searchParams.get('CurrentPage'), '2');
});
