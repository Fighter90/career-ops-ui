/**
 * ApplicantPro / isolved Talent Acquisition source (upstream #6252 port) —
 * CI-isolated suite. Fictional tenant `acme-example` and fictional postings
 * only. The listing page is a client-side Vue component, so the source reads
 * the public JSON the component itself calls
 * (`/core/jobs/<domainId>?getParams={}`): the numeric site id is read off the
 * tenant's `/jobs/` page (or pinned with `applicantpro.domainId`), then one
 * request returns the whole open inventory. The parser must fail CLOSED on
 * an envelope without `data.jobs` while a present-and-empty `jobs: []` is a
 * real empty board; the id becomes a URL path segment so only digits pass;
 * validThrough / employmentType are never read; pay attaches only for a
 * positive ANNUAL range. Opt-in `applicantpro.fetchDetails` (detailLimit
 * default 25, clamped [1,100], 250 ms pace) enriches from the JSON-LD
 * `JobPosting`, where the JSON-LD title wins and a failed detail fetch keeps
 * the list row. No network — fetchApplicantpro runs on a fake fetchImpl.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  assertApplicantproUrl,
  extractDomainId,
  parseListResponse,
  parseDetail,
  fetchApplicantpro,
} from '../server/lib/sources/applicantpro.mjs';
import { applicantproAdapter } from '../server/lib/portals/adapters/applicantpro.mjs';

const ORIGIN = 'https://acme-example.applicantpro.com';

// ── fixtures (fictional tenant, same shapes as the live board) ──────────────

const listJson = () => ({
  success: true,
  message: 'This is where the full jobs list will show',
  data: {
    jobs: [
      {
        id: 9000001,
        title: 'Learning Coordinator',
        city: 'Springfield',
        subdomain: 'acme-example',
        iso3: 'USA',
        abbreviation: 'IL',
        siteId: 70123,
        startDateRef: 'Sep 02, 2026',
        endDateRef: 'Nov 02, 2026',
        untilFilled: 0,
        orgTitle: 'People',
        workplaceType: 'Onsite',
        employmentType: 'Full Time',
        payType: 'Salary',
        payTypeFrame: 'per year',
        minSalary: '48,000',
        maxSalary: '50,000',
        jobLocation: 'Springfield, IL, United States',
        streetAddress: '1 Example Way',
        jobUrl: `${ORIGIN}/jobs/9000001`,
      },
      {
        id: 9000002,
        title: 'Operations Manager',
        city: 'Shelbyville',
        subdomain: 'acme-example',
        abbreviation: 'IL',
        stateName: 'Illinois',
        startDateRef: 'Oct 15, 2026',
        payType: 'Salary',
        payTypeFrame: null,
        minSalary: '',
        maxSalary: '',
        jobLocation: '',
        jobUrl: `${ORIGIN}/jobs/9000002`,
      },
      {
        id: 9000003,
        title: '  Site   Technician ',
        city: 'Capital City',
        abbreviation: 'IL',
        startDateRef: 'not a date',
        payType: 'Hourly',
        payTypeFrame: 'per hour',
        minSalary: '25.00',
        maxSalary: '30.00',
        jobLocation: 'Capital City, IL, United States',
        jobUrl: `${ORIGIN}/jobs/9000003`,
      },
      {
        id: 9000004,
        title: 'Payroll Analyst',
        city: 'Ogdenville',
        abbreviation: 'IL',
        startDateRef: 'Oct 20, 2026',
        payType: 'Salary',
        payTypeFrame: 'per year',
        minSalary: '0',
        maxSalary: '0',
        jobLocation: 'Ogdenville, IL, United States',
        jobUrl: `${ORIGIN}/jobs/9000004`,
      },
      { id: 9000005, title: '', jobLocation: 'Nowhere' },
      { title: 'Row Without An Id', jobLocation: 'Nowhere' },
      { id: '9000006/../../admin', title: 'Hostile Id', jobLocation: 'Nowhere' },
      { id: 9000001, title: 'Learning Coordinator (duplicate row)', jobLocation: 'Springfield' },
      null,
    ],
    jobCount: 9,
    jobInfoOrder: { payInfo: 1, postingDate: 2 },
    searchResultText: 'Number of Jobs: 9',
    showPostingDate: false,
    showWorkplaceType: false,
  },
});

const JOBS_PAGE = `<!doctype html>
<html lang="en">
<head><title>Careers - Acme Example</title></head>
<body>
<div id="job_listings" class="bootstrap-area"><job-listings v-bind="componentData"></div>
<script type="text/javascript">
  $(function() {
    window.bootstrapVue(
      "#job_listings",
      [ 'JobListings' ],
      { componentData: { organizationId : 5501, domainId : 70123, getParams : {"cityUrl":"","isInternal":0,"showLocation":1,"showDate":0}, domainName : "applicantpro.com", subdomainName : "acme-example" }}
    );
  });
</script>
<div id="social_media_widget" class="bootstrap-area"><social-media-widget v-bind="componentData"></div>
<script type="text/javascript">
  $(function() {
    window.bootstrapVue(
      "#social_media_widget",
      [ 'SocialMediaWidget' ],
      { componentData: { job : {"id":0,"title":""}, organizationId : 5501, rootDomainId : 4, domainId : 70123, domainName : "applicantpro.com", subdomainName : "acme-example" }}
    );
  });
</script>
</body>
</html>`;

const DETAIL_FULL = `<!doctype html>
<html lang="en"><head><title>Learning Coordinator</title>
<script type="application/ld+json">{"@context":"http://schema.org/","@type":"JobPosting","title":"Learning Coordinator","url":"${ORIGIN}/jobs/9000001.html","description":"<p>Help build &amp; run training for the <strong>Acme</strong> team.</p><ul><li>Schedule sessions</li></ul>","identifier":{"@type":"PropertyValue","name":"Acme Example","sameAs":"9000001"},"datePosted":"2026-09-02 00:00:00","validThrough":"2099-11-02 00:00:00T23:59","employmentType":"FULL_TIME","baseSalary":{"@type":"MonetaryAmount","currency":"USD","value":{"@type":"QuantitativeValue","unitText":"YEAR","minValue":"48,000","maxValue":"50,000"}},"hiringOrganization":{"@type":"Organization","name":"Acme Example","sameAs":"${ORIGIN}"},"jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","streetAddress":"1 Example Way","addressLocality":"Springfield","addressRegion":"IL","postalCode":"00000","addressCountry":"US"}}}</script>
</head><body><h1>Learning Coordinator</h1></body></html>`;

const DETAIL_ODD = `<!doctype html>
<html lang="en"><head><title>Operations Manager</title>
<script type="application/ld+json">{"@context":"http://schema.org/","@type":"JobPosting","title":"Operations Manager - Midwest","url":"${ORIGIN}/jobs/9000002.html","description":"<p>Permanent management role. Lead the regional operations team.</p>","identifier":{"@type":"PropertyValue","name":"Acme Example","sameAs":"9000002"},"datePosted":"2026-10-15 00:00:00","validThrough":"2099-12-31 00:00:00T23:59","employmentType":"CONTRACTOR","baseSalary":{"@type":"MonetaryAmount","currency":"USD","value":{"@type":"QuantitativeValue","unitText":"YEAR","minValue":"0","maxValue":"0"}},"hiringOrganization":{"@type":"Organization","name":"Acme Example"},"jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Shelbyville","addressRegion":"IL","addressCountry":"US"}}}</script>
</head><body><h1>Operations Coordinator</h1><p>Body heading disagrees with the JSON-LD title.</p></body></html>`;

const ENTRY = { name: 'Acme Example', careers_url: `${ORIGIN}/` };

/** A fetch stub serving the fixtures; records every call. */
function makeImpl(over = {}) {
  const calls = [];
  const impl = async (url, opts = {}) => {
    calls.push({ url, opts });
    if (url === `${ORIGIN}/jobs/`) return { ok: true, status: 200, text: async () => JOBS_PAGE };
    if (/\/core\/jobs\/\d+/.test(url)) return { ok: true, status: 200, json: async () => listJson() };
    if (url === `${ORIGIN}/jobs/9000001`) return { ok: true, status: 200, text: async () => DETAIL_FULL };
    if (url === `${ORIGIN}/jobs/9000002`) return { ok: true, status: 200, text: async () => DETAIL_ODD };
    if (over.detailFallback) return { ok: true, status: 200, text: async () => '<html>no json-ld</html>' };
    throw new Error(`unexpected URL: ${url}`);
  };
  impl.calls = calls;
  return impl;
}

/** A sleep stub that records pacing delays instead of waiting. */
function paceRecorder() {
  const delays = [];
  const sleep = async (ms) => { delays.push(ms); };
  sleep.delays = delays;
  return sleep;
}

// ── registry meta + adapter contract ─────────────────────────────────────────

test('applicantpro: meta — value, label, region en; adapter id/label match', () => {
  assert.deepEqual(meta, { value: 'applicantpro', label: 'ApplicantPro', region: 'en' });
  assert.equal(applicantproAdapter.id, 'applicantpro');
  assert.equal(applicantproAdapter.label, 'ApplicantPro');
  assert.equal(typeof applicantproAdapter.matches, 'function');
  assert.equal(typeof applicantproAdapter.buildEndpoint, 'function');
  assert.equal(typeof applicantproAdapter.fetch, 'function');
});

test('applicantpro: adapter resolves a tenant URL in any spelling to https://<tenant>/jobs/', () => {
  for (const [label, url] of [
    ['tenant root', `${ORIGIN}`],
    ['tenant root with slash', `${ORIGIN}/`],
    ['/jobs/ listing', `${ORIGIN}/jobs/`],
    ['a posting page', `${ORIGIN}/jobs/9000001.html`],
    ['a non-default port (dropped)', `${ORIGIN}:8443/jobs/`],
    ['upper-case host', 'https://ACME-Example.ApplicantPro.com/'],
    ['sitemap-style www link', 'https://www.applicantpro.com/openings/acme-example/jobs/9000001'],
  ]) {
    assert.equal(applicantproAdapter.matches({ name: 'Acme', careers_url: url }), true, label);
    assert.equal(applicantproAdapter.buildEndpoint({ name: 'Acme', careers_url: url }), `${ORIGIN}/jobs/`, label);
  }
  assert.equal(applicantproAdapter.matches({ name: 'Acme', api: `${ORIGIN}/jobs/`, careers_url: 'https://other.example/' }), true, 'api: wins over a foreign careers_url');
  assert.equal(applicantproAdapter.matches({ name: 'Acme', provider: 'applicantpro', careers_url: 'https://other.example/' }), true, 'an explicit provider override claims the entry');
  assert.equal(applicantproAdapter.matches(null), false);
  assert.equal(applicantproAdapter.matches('acme.applicantpro.com'), false);
});

test('applicantpro: adapter rejects hijacks, platform hosts, non-https and junk', () => {
  const rejects = [
    ['http', 'http://acme-example.applicantpro.com/'],
    ['foreign host', 'https://evil.example/'],
    ['suffix-spoofed host', 'https://acme-example.applicantpro.com.evil.example/'],
    ['user:pass credential', 'https://user:pw@acme-example.applicantpro.com/'],
    ['tenant name in the path only', 'https://evil.example/acme-example.applicantpro.com/'],
    ['hyphen look-alike host', 'https://acmeexample-applicantpro.com/'],
    ['suffix look-alike host', 'https://evilapplicantpro.com/'],
    ['the bare platform host', 'https://applicantpro.com/'],
    ['the platform www host', 'https://www.applicantpro.com/'],
    ['www openings without a tenant', 'https://www.applicantpro.com/openings/'],
    ['a www "tenant" that is not a label', 'https://www.applicantpro.com/openings/evil.example/jobs/1'],
    ['the feeds platform host', 'https://feeds.applicantpro.com/site_map_index.xml'],
    ['malformed', 'not a url'],
    ['empty', ''],
    ['null', null],
    ['a number', 7],
  ];
  for (const [label, url] of rejects) {
    const entry = { name: 'X', careers_url: url };
    assert.equal(applicantproAdapter.matches(entry), false, `${label} must be rejected`);
    assert.equal(applicantproAdapter.buildEndpoint(entry), null, `${label} must yield no endpoint`);
  }
});

test('applicantpro: assertApplicantproUrl — https on exactly a tenant host, default port only', () => {
  assert.equal(assertApplicantproUrl(`${ORIGIN}/jobs/`), `${ORIGIN}/jobs/`);
  assert.throws(() => assertApplicantproUrl('http://acme-example.applicantpro.com/'), /HTTPS/);
  assert.throws(() => assertApplicantproUrl('https://evil.example/jobs/'), /untrusted hostname/);
  assert.throws(() => assertApplicantproUrl('https://www.applicantpro.com/jobs/'), /untrusted hostname/);
  assert.throws(() => assertApplicantproUrl(`${ORIGIN}:8443/jobs/`), /port/);
  assert.throws(() => assertApplicantproUrl('not a url'), /invalid URL/);
});

// ── extractDomainId ──────────────────────────────────────────────────────────

test('applicantpro: extractDomainId reads the listing component\'s site id, not the social widget\'s', () => {
  assert.equal(extractDomainId(JOBS_PAGE), 70123);
  assert.equal(extractDomainId('<script>{ rootDomainId : 4 }</script>'), null, 'rootDomainId must not match');
  assert.equal(extractDomainId('<a href="/core/jobs/4321?x=1">'), 4321, 'falls back to a literal /core/jobs/<id> path');
  assert.equal(extractDomainId('<html>nothing</html>'), null);
  assert.equal(extractDomainId(''), null);
  assert.equal(extractDomainId(null), null);
});

// ── parseListResponse ────────────────────────────────────────────────────────

test('applicantpro: parseListResponse keeps the four well-formed postings and drops junk rows', () => {
  const jobs = parseListResponse(listJson(), ORIGIN, 'Acme Example');
  assert.equal(jobs.length, 4);
  assert.equal(jobs.map((j) => j.externalId).join(','), '9000001,9000002,9000003,9000004',
    'empty title, missing id, hostile id, duplicate id and null rows are dropped');
});

test('applicantpro: parseListResponse normalizes title, absolute url, company, location and a UTC postedAt', () => {
  const [learning] = parseListResponse(listJson(), ORIGIN, 'Acme Example');
  assert.equal(learning.title, 'Learning Coordinator');
  assert.equal(learning.url, `${ORIGIN}/jobs/9000001`);
  assert.equal(learning.company, 'Acme Example');
  assert.equal(learning.location, 'Springfield, IL, United States');
  assert.equal(learning.postedAt, Date.UTC(2026, 8, 2), '"Sep 02, 2026" reads as UTC, not local');
});

test('applicantpro: pay attaches only for a positive annual range, with no currency guessed', () => {
  const [learning, ops, tech, payroll] = parseListResponse(listJson(), ORIGIN, 'Acme Example');
  assert.deepEqual(learning.salary, { min: 48000, max: 50000 });
  assert.ok(!('salary' in ops), 'no payTypeFrame → no salary');
  assert.ok(!('salary' in tech), 'an hourly range is left off');
  assert.ok(!('salary' in payroll), 'a 0/0 annual range is left off');
});

test('applicantpro: parseListResponse builds a location from city + region when jobLocation is empty', () => {
  const [, ops] = parseListResponse(listJson(), ORIGIN, 'Acme Example');
  assert.equal(ops.location, 'Shelbyville, IL');
});

test('applicantpro: parseListResponse collapses title whitespace; an unparseable date leaves postedAt off', () => {
  const [, , tech] = parseListResponse(listJson(), ORIGIN, 'Acme Example');
  assert.equal(tech.title, 'Site Technician');
  assert.ok(!('postedAt' in tech));
});

test('applicantpro: list rows carry no requisitionId, description or employment type', () => {
  for (const j of parseListResponse(listJson(), ORIGIN, 'Acme Example')) {
    assert.ok(!('requisitionId' in j) && !('description' in j) && !('employmentType' in j), j.title);
  }
});

test('applicantpro: a present-and-empty data.jobs is an empty board', () => {
  assert.deepEqual(parseListResponse({ success: true, data: { jobs: [], jobCount: 0 } }, ORIGIN, 'A'), []);
});

test('applicantpro: parseListResponse fails CLOSED on an envelope without data.jobs', () => {
  for (const [label, body] of [
    ['an empty object', {}],
    ['data.jobs null', { success: true, data: { jobs: null } }],
    ['data.jobs an object', { success: true, data: { jobs: {} } }],
    ['jobs under another key', { success: true, data: { results: [] } }],
    ['success false', { success: false, data: { jobs: [] } }],
    ['a bare string', 'Unable to process request properly.'],
    ['null', null],
  ]) {
    // assert.throws matches against String(err) ('Error: <message>'), so the
    // regex stays unanchored like every other web-ui suite.
    assert.throws(() => parseListResponse(body, ORIGIN, 'A'), /applicantpro: unexpected response/, `${label} must throw`);
  }
  assert.throws(
    () => parseListResponse({ data: { results: 1, total: 2 } }, ORIGIN, 'A'),
    /\[results, total\]/,
    'the error names the keys it got',
  );
});

// ── parseDetail (JSON-LD) ────────────────────────────────────────────────────

test('applicantpro: parseDetail reads title, decoded description, posted date and location', () => {
  const full = parseDetail(DETAIL_FULL);
  assert.equal(full.title, 'Learning Coordinator');
  assert.match(full.description, /^Help build & run training for the Acme team\./);
  assert.match(full.description, /Schedule sessions/);
  assert.equal(full.postedAt, Date.UTC(2026, 8, 2), '"2026-09-02 00:00:00" reads as UTC');
  assert.equal(full.location, 'Springfield, IL');
});

test('applicantpro: parseDetail takes the JSON-LD title and ignores validThrough, employmentType and baseSalary', () => {
  const odd = parseDetail(DETAIL_ODD);
  assert.equal(odd.title, 'Operations Manager - Midwest', 'the JSON-LD title wins over the page heading');
  assert.ok(!('employmentType' in odd));
  assert.ok(!('validThrough' in odd));
  assert.ok(!('salary' in odd));
});

test('applicantpro: parseDetail tolerates pages with no or broken JSON-LD', () => {
  assert.deepEqual(parseDetail('<html>no json-ld</html>'), {});
  assert.deepEqual(parseDetail('<script type="application/ld+json">{not json</script>'), {});
  assert.deepEqual(parseDetail(null), {});
});

// ── fetchApplicantpro — the web-ui fetch contract ────────────────────────────

test('applicantpro: the default scan is two requests — the site-id page, then one JSON list', async () => {
  const impl = makeImpl();
  const jobs = await fetchApplicantpro(`${ORIGIN}/jobs/`, { fetchImpl: impl, company: ENTRY });
  assert.equal(jobs.length, 4);
  assert.equal(impl.calls.length, 2);
  assert.equal(impl.calls[0].url, `${ORIGIN}/jobs/`);
  assert.equal(impl.calls[1].url, `${ORIGIN}/core/jobs/70123?getParams=%7B%7D`);
  assert.equal(impl.calls[0].opts.redirect, 'error');
  assert.equal(impl.calls[1].opts.redirect, 'error');
  assert.ok(impl.calls.every((c) => new URL(c.url).origin === ORIGIN), 'only the tenant origin is requested');
});

test('applicantpro: rows are normalized to the scanner shape', async () => {
  const impl = makeImpl();
  const [learning] = await fetchApplicantpro(`${ORIGIN}/jobs/`, { fetchImpl: impl, company: ENTRY });
  assert.equal(learning.id, `applicantpro-${ORIGIN}/jobs/9000001`);
  assert.equal(learning.source, 'applicantpro');
  assert.equal(learning.title, 'Learning Coordinator');
  assert.equal(learning.company, 'Acme Example');
  assert.equal(learning.url, `${ORIGIN}/jobs/9000001`);
  assert.equal(learning.salary, '48000–50000', 'an annual range renders as a display string, no currency guessed');
  assert.equal(learning.location, 'Springfield, IL, United States');
  assert.equal(learning.date, new Date(Date.UTC(2026, 8, 2)).toISOString());
  assert.equal(learning.snippet, '', 'no description without fetchDetails');
  assert.equal(learning.workplaceType, '');
  assert.equal(learning.relocates, false);
  assert.equal(learning.isRemote, false);
  const [, , tech] = await fetchApplicantpro(`${ORIGIN}/jobs/`, { fetchImpl: impl, company: ENTRY });
  assert.equal(tech.salary, '', 'hourly ranges stay off the display string');
});

test('applicantpro: a www /openings/<tenant>/ endpoint scans the tenant host', async () => {
  const impl = makeImpl();
  await fetchApplicantpro(`${ORIGIN}/jobs/`, { fetchImpl: impl, company: { name: 'Acme', careers_url: 'https://www.applicantpro.com/openings/acme-example/jobs/9000001' } });
  assert.ok(impl.calls.every((c) => new URL(c.url).origin === ORIGIN), 'never the www sitemap redirect host');
});

test('applicantpro: applicantpro.domainId pins the site id (one request)', async () => {
  const impl = makeImpl();
  await fetchApplicantpro(`${ORIGIN}/jobs/`, { fetchImpl: impl, company: { ...ENTRY, applicantpro: { domainId: 555 } } });
  assert.equal(impl.calls.length, 1);
  assert.equal(impl.calls[0].url, `${ORIGIN}/core/jobs/555?getParams=%7B%7D`);
});

test('applicantpro: a /jobs/ page with no site id throws (markup change is loud)', async () => {
  const impl = async (url) => {
    if (url === `${ORIGIN}/jobs/`) return { ok: true, status: 200, text: async () => '<html>no id</html>' };
    throw new Error('list must not be requested');
  };
  await assert.rejects(
    () => fetchApplicantpro(`${ORIGIN}/jobs/`, { fetchImpl: impl, company: ENTRY }),
    /could not find the site id/,
  );
});

test('applicantpro: fetch throws on an envelope without data.jobs', async () => {
  const impl = async (url) => {
    if (url === `${ORIGIN}/jobs/`) return { ok: true, status: 200, text: async () => JOBS_PAGE };
    return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
  };
  await assert.rejects(
    () => fetchApplicantpro(`${ORIGIN}/jobs/`, { fetchImpl: impl, company: ENTRY }),
    /unexpected response/,
  );
});

test('applicantpro: fetch returns [] for a tenant with no openings', async () => {
  const impl = async (url) => {
    if (url === `${ORIGIN}/jobs/`) return { ok: true, status: 200, text: async () => JOBS_PAGE };
    return { ok: true, status: 200, json: async () => ({ success: true, data: { jobs: [], jobCount: 0 } }) };
  };
  const jobs = await fetchApplicantpro(`${ORIGIN}/jobs/`, { fetchImpl: impl, company: ENTRY });
  assert.deepEqual(jobs, []);
});

test('applicantpro: fetch refuses an off-host endpoint before any network call', async () => {
  for (const bad of ['https://evil.example/jobs/', 'http://acme-example.applicantpro.com/', 'https://www.applicantpro.com/']) {
    let touched = 0;
    await assert.rejects(
      () => fetchApplicantpro(bad, { fetchImpl: async () => { touched += 1; return { ok: true, text: async () => '' }; }, company: ENTRY }),
      /untrusted hostname|HTTPS/,
      bad,
    );
    assert.equal(touched, 0, `${bad}: validated before the fetch`);
  }
});

test('applicantpro: warns when jobCount exceeds the rows returned', async () => {
  const realError = console.error;
  const warnings = [];
  console.error = (...a) => warnings.push(a.join(' '));
  try {
    // jobCount larger than the raw array length — the same "list may be
    // incomplete" shape the parent's test exercises (9 rows of 120).
    const short = () => {
      const body = listJson();
      body.data.jobCount = 120;
      return body;
    };
    const impl = async (url) => {
      if (url === `${ORIGIN}/jobs/`) return { ok: true, status: 200, text: async () => JOBS_PAGE };
      if (/\/core\/jobs\//.test(url)) return { ok: true, status: 200, json: async () => short() };
      throw new Error(`unexpected URL: ${url}`);
    };
    await fetchApplicantpro(`${ORIGIN}/jobs/`, { fetchImpl: impl, company: ENTRY });
  } finally {
    console.error = realError;
  }
  assert.ok(warnings.some((w) => /applicantpro: Acme Example returned 9 of 120/.test(w)), warnings.join(' | '));
});

test('applicantpro: fetchDetails fetches up to detailLimit posting pages, paced, and enriches from the JSON-LD', async () => {
  const impl = makeImpl({ detailFallback: true });
  const pace = paceRecorder();
  const jobs = await fetchApplicantpro(`${ORIGIN}/jobs/`, {
    fetchImpl: impl,
    sleep: pace,
    company: { ...ENTRY, applicantpro: { fetchDetails: true, detailLimit: 2 } },
  });
  const detailCalls = impl.calls.filter((c) => /\/jobs\/\d+$/.test(c.url));
  assert.equal(detailCalls.length, 2, 'detailLimit caps the per-posting requests');
  assert.deepEqual(detailCalls.map((c) => c.url), [`${ORIGIN}/jobs/9000001`, `${ORIGIN}/jobs/9000002`]);
  assert.ok(detailCalls.every((c) => c.opts.redirect === 'error'));
  assert.deepEqual(pace.delays, [250], 'detail requests are paced 250 ms apart (one pause between two pages)');
  const [e1, e2, e3] = jobs;
  assert.match(e1.snippet, /^Help build & run training/);
  assert.equal(e1.title, 'Learning Coordinator');
  assert.equal(e2.title, 'Operations Manager - Midwest', 'the JSON-LD title wins');
  assert.match(e2.snippet, /Permanent management role/);
  assert.equal(e2.location, 'Shelbyville, IL', 'a missing list location is filled from the JSON-LD address');
  assert.ok(!e3.snippet, 'postings past detailLimit stay list-only');
});

test('applicantpro: detailLimit caps however many postings exist and clamps to 100', async () => {
  const many = () => {
    const body = listJson();
    body.data.jobs = Array.from({ length: 40 }, (_, i) => ({ id: 9100000 + i, title: `Role ${i}`, jobLocation: 'X' }));
    body.data.jobCount = 40;
    return body;
  };
  const detailPage = { ok: true, status: 200, text: async () => '<html>no json-ld</html>' };
  const noopPace = async () => {};
  const capCalls = [];
  const capImpl = async (url) => {
    capCalls.push(url);
    if (url === `${ORIGIN}/jobs/`) return { ok: true, status: 200, text: async () => JOBS_PAGE };
    if (/\/core\/jobs\//.test(url)) return { ok: true, status: 200, json: async () => many() };
    if (/\/jobs\/91\d+$/.test(url)) return detailPage;
    throw new Error(`unexpected URL: ${url}`);
  };
  await fetchApplicantpro(`${ORIGIN}/jobs/`, { fetchImpl: capImpl, sleep: noopPace, company: { ...ENTRY, applicantpro: { fetchDetails: true, detailLimit: 10 } } });
  assert.equal(capCalls.filter((u) => /\/jobs\/91\d+$/.test(u)).length, 10, '40 postings at detailLimit 10 make exactly 10 detail calls');

  const defCalls = [];
  const defImpl = async (url) => {
    defCalls.push(url);
    if (url === `${ORIGIN}/jobs/`) return { ok: true, status: 200, text: async () => JOBS_PAGE };
    if (/\/core\/jobs\//.test(url)) return { ok: true, status: 200, json: async () => many() };
    if (/\/jobs\/91\d+$/.test(url)) return detailPage;
    throw new Error(`unexpected URL: ${url}`);
  };
  await fetchApplicantpro(`${ORIGIN}/jobs/`, { fetchImpl: defImpl, sleep: noopPace, company: { ...ENTRY, applicantpro: { fetchDetails: true } } });
  assert.equal(defCalls.filter((u) => /\/jobs\/91\d+$/.test(u)).length, 25, 'detailLimit defaults to 25');

  const hugeBody = () => ({
    success: true,
    data: { jobs: Array.from({ length: 150 }, (_, i) => ({ id: 9200000 + i, title: `R${i}`, jobLocation: 'X' })), jobCount: 150 },
  });
  const hugeCalls = [];
  const hugeImpl = async (url) => {
    hugeCalls.push(url);
    if (url === `${ORIGIN}/jobs/`) return { ok: true, status: 200, text: async () => JOBS_PAGE };
    if (/\/core\/jobs\//.test(url)) return { ok: true, status: 200, json: async () => hugeBody() };
    if (/\/jobs\/92\d+$/.test(url)) return detailPage;
    throw new Error(`unexpected URL: ${url}`);
  };
  await fetchApplicantpro(`${ORIGIN}/jobs/`, { fetchImpl: hugeImpl, sleep: noopPace, company: { ...ENTRY, applicantpro: { fetchDetails: true, detailLimit: 5000 } } });
  assert.equal(hugeCalls.filter((u) => /\/jobs\/92\d+$/.test(u)).length, 100, 'detailLimit is clamped to 100');
});

test('applicantpro: a failed detail fetch keeps the list row and does not fail the board', async () => {
  const impl = async (url) => {
    if (url === `${ORIGIN}/jobs/`) return { ok: true, status: 200, text: async () => JOBS_PAGE };
    if (/\/core\/jobs\//.test(url)) return { ok: true, status: 200, json: async () => listJson() };
    throw Object.assign(new Error('HTTP 500'), { status: 500 });
  };
  const jobs = await fetchApplicantpro(`${ORIGIN}/jobs/`, {
    fetchImpl: impl,
    sleep: async () => {},
    company: { ...ENTRY, applicantpro: { fetchDetails: true, detailLimit: 2 } },
  });
  assert.equal(jobs.length, 4);
  assert.equal(jobs[0].title, 'Learning Coordinator');
  assert.ok(!jobs[0].snippet, 'the list row survives without enrichment');
});

test('applicantpro: no detail requests without a strict fetchDetails opt-in', async () => {
  for (const cfg of [undefined, {}, { fetchDetails: 'yes' }, { detailLimit: 5 }]) {
    const impl = makeImpl({ detailFallback: true });
    await fetchApplicantpro(`${ORIGIN}/jobs/`, {
      fetchImpl: impl,
      company: { ...ENTRY, ...(cfg ? { applicantpro: cfg } : {}) },
    });
    assert.equal(impl.calls.length, 2, `config ${JSON.stringify(cfg)} must stay list-only`);
  }
});

test('applicantpro: fetchKeka-style abort — an already-aborted signal fails loud before any request', async () => {
  const controller = new AbortController();
  controller.abort();
  let touched = 0;
  await assert.rejects(
    () => fetchApplicantpro(`${ORIGIN}/jobs/`, { fetchImpl: async () => { touched += 1; return { ok: true, text: async () => '' }; }, signal: controller.signal, company: ENTRY }),
    /abort/i,
  );
  assert.equal(touched, 0);
});

test('applicantpro: a transport failure on the site-id page propagates unwrapped', async () => {
  class FakeSentinel extends Error {}
  await assert.rejects(
    () => fetchApplicantpro(`${ORIGIN}/jobs/`, { fetchImpl: async () => { throw new FakeSentinel('boom'); }, company: ENTRY }),
    FakeSentinel,
  );
});

test('parseListResponse: salary edge branches — one-sided ranges and junk amounts (CAR-228 coverage)', () => {
  // salaryText branches: min-only, max-only, both, neither; junk amounts drop out
  const jobs = [
    { id: 11, title: 'Min only', payTypeFrame: 'per year', minSalary: 48000, maxSalary: 'junk' },
    { id: 12, title: 'Max only', payTypeFrame: 'per year', minSalary: 'junk', maxSalary: 60000 },
    { id: 13, title: 'Zero amounts', payTypeFrame: 'per year', minSalary: 0, maxSalary: -5 },
    { id: 14, title: 'Both', payTypeFrame: 'per year', minSalary: 48000, maxSalary: 60000 },
    { id: 15, title: 'Hourly frame', payTypeFrame: 'per hour', minSalary: 30, maxSalary: 50 },
  ];
  const parsed = parseListResponse(
    { success: true, data: { jobs, jobCount: jobs.length } },
    'Acme',
  );
  const rows = Object.fromEntries(parsed.map((r) => [r.title, r.salary]));
  // parseListResponse keeps the STRUCTURED salary; the display string is
  // applied by normalize() in the fetch path — so assert the ranges here and
  // the salaryText branches through a normalize-level fetch test below.
  assert.deepEqual(rows['Min only'], { min: 48000 });
  assert.deepEqual(rows['Max only'], { max: 60000 });
  assert.equal(rows['Zero amounts'], undefined);
  assert.deepEqual(rows['Both'], { min: 48000, max: 60000 });
  assert.equal(rows['Hourly frame'], undefined); // non-annual frames are left off
});

test('applicantpro: normalize renders one-sided annual salaries as ≥ / ≤ through the fetch flow (#CAR-228)', async () => {
  const body = listJson();
  body.data.jobs = [
    { id: 9200001, title: 'Min-side role', jobLocation: 'X', payTypeFrame: 'per year', minSalary: 48000 },
    { id: 9200002, title: 'Max-side role', jobLocation: 'X', payTypeFrame: 'per year', maxSalary: 60000 },
    { id: 9200003, title: 'Both sides', jobLocation: 'X', payTypeFrame: 'annual', minSalary: 10, maxSalary: 20 },
  ];
  body.data.jobCount = 3;
  const impl = async (url) => {
    if (url === `${ORIGIN}/jobs/`) return { ok: true, status: 200, text: async () => JOBS_PAGE };
    if (/\/core\/jobs\//.test(url)) return { ok: true, status: 200, json: async () => body };
    throw new Error(`unexpected URL: ${url}`);
  };
  const jobs = await fetchApplicantpro(`${ORIGIN}/jobs/`, { fetchImpl: impl, sleep: async () => {} });
  const rows = Object.fromEntries(jobs.map((r) => [r.title, r.salary]));
  assert.equal(rows['Min-side role'], '≥ 48000');
  assert.equal(rows['Max-side role'], '≤ 60000');
  assert.equal(rows['Both sides'], '10–20');
});
