/**
 * Radancy source — LEGACY TalentBrew markup + JSON results-fragment transport.
 *
 * Ports the parent career-ops `tests/providers/radancy.test.mjs` cases added for
 * the two-markup-generations fix, adapted to the web-ui source contract: the
 * parsers emit rich job objects (not raw {id,title,url,location} records) and
 * the fragment transport is reached via an injected `opts.fetchJson` capability
 * (mirroring the parent's `ctx.fetchJson` gate) rather than a `ctx` object.
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
  let calls = 0;
  const jobs = await fetchRadancy('https://careers.munichre.com/en/search-jobs', {
    fetchImpl: async () => textResponse(calls++ === 0 ? MODERN_HTML : '<html></html>'),
    company: { name: 'Munich Re' },
  });
  assert.equal(jobs.length, 2);
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
