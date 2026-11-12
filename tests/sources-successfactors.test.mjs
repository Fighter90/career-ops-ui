/**
 * SAP SuccessFactors (RMK) source + adapter. Public, zero-auth HTML tile fragment,
 * host-pinned per tenant. CI-isolated: fetchImpl is faked, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSuccessfactors, cityFromSlug, fetchSuccessfactors,
  assertSuccessfactorsUrl, meta, SF_HOST_RE,
  resolveTenantBase,
} from '../server/lib/sources/successfactors.mjs';
import { successfactorsAdapter } from '../server/lib/portals/adapters/successfactors.mjs';

const JOB_BASE = 'https://jobs.zf.com';
const ENDPOINT = 'https://jobs.zf.com/tile-search-results/';

// Small canned fragment: one full tile with a rendered city, one that recovers
// the city from the slug, one title-less (dropped), one url-less (dropped),
// and one with an off-host absolute data-url (dropped by the host pin).
const HTML = `
<ul>
  <li class="job-tile job-id-1001">
    <a class="jobTitle-link" href="#" data-url="/job/Friedrichshafen-Senior-AI-Engineer-BW-12345/1001/">Senior AI Engineer</a>
    <div id="job-1001-section-city-value">Friedrichshafen</div>
  </li>
  <li class="job-tile job-id-1002">
    <a class="jobTitle-link" data-url="/job/Munich-Data-Scientist-BY-67890/1002/">Data Scientist</a>
  </li>
  <li class="job-tile job-id-1003">
    <a class="jobTitle-link" data-url="/job/Berlin-Nobody-99999/1003/"></a>
  </li>
  <li class="job-tile job-id-1004">
    <a class="jobTitle-link" href="#">No URL Here</a>
  </li>
  <li class="job-tile job-id-1005">
    <a class="jobTitle-link" data-url="https://evil.com/job/Somewhere-Hacker-000/1005/">Off Host Role</a>
  </li>
</ul>`;

test('meta + adapter surface: provider-selected + SF-host-detected, host-pinned', () => {
  assert.equal(meta.value, 'successfactors');
  assert.equal(meta.region, 'en');
  assert.equal(meta.label, 'SAP SuccessFactors');

  assert.equal(successfactorsAdapter.id, 'successfactors');
  assert.equal(successfactorsAdapter.label, 'SAP SuccessFactors');
  assert.equal(successfactorsAdapter.fetch, fetchSuccessfactors);

  // matches: explicit provider
  assert.ok(successfactorsAdapter.matches({ provider: 'successfactors' }));
  // matches: literal successfactors / jobs2web host
  assert.ok(successfactorsAdapter.matches({ careers_url: 'https://career5.successfactors.eu/career' }));
  assert.ok(successfactorsAdapter.matches({ api: 'https://foo.jobs2web.com/x' }));
  // no match: branded RMK host without an explicit provider (must be wired)
  assert.ok(!successfactorsAdapter.matches({ careers_url: 'https://jobs.zf.com/' }));
  assert.ok(!successfactorsAdapter.matches({}));

  // buildEndpoint host-pins to the entry origin's tile-search fragment
  // #2099: a path in the configured URL is a brand/tenant prefix and is
  // PRESERVED (pre-#2099 it collapsed to the origin, silently returning the
  // parent brand's postings for multi-brand RMK holdings).
  assert.equal(
    successfactorsAdapter.buildEndpoint({ provider: 'successfactors', careers_url: 'https://jobs.zf.com/some/path' }),
    'https://jobs.zf.com/some/path/tile-search-results/',
  );
  assert.equal(successfactorsAdapter.buildEndpoint({ provider: 'successfactors' }), null);
  assert.equal(successfactorsAdapter.buildEndpoint({ careers_url: 'http://jobs.zf.com/' }), null); // non-https
});

test('SF_HOST_RE only claims literal successfactors/jobs2web hosts', () => {
  assert.ok(SF_HOST_RE.test('career5.successfactors.eu'));
  assert.ok(SF_HOST_RE.test('performancemanager.successfactors.com'));
  assert.ok(SF_HOST_RE.test('foo.jobs2web.com'));
  assert.ok(!SF_HOST_RE.test('jobs.zf.com'));
  assert.ok(!SF_HOST_RE.test('successfactors.evil.com'));
});

test('parseSuccessfactors: tiles → jobs, drops title-less/url-less/off-host', () => {
  const jobs = parseSuccessfactors(HTML, { jobBase: JOB_BASE, fallbackCompany: 'ZF' });
  assert.equal(jobs.length, 2); // 1001 + 1002; 1003 (no title), 1004 (no url), 1005 (off host) dropped

  const [a, b] = jobs;
  assert.equal(a.id, 'successfactors-1001');
  assert.equal(a.title, 'Senior AI Engineer');
  assert.equal(a.company, 'ZF');
  assert.equal(a.url, 'https://jobs.zf.com/job/Friedrichshafen-Senior-AI-Engineer-BW-12345/1001/');
  assert.equal(a.location, 'Friedrichshafen'); // rendered city div
  assert.equal(a.source, 'successfactors');
  assert.equal(a.date, '');
  assert.equal(a.salary, '');
  assert.equal(a.isRemote, false);
  assert.equal(a.workplaceType, '');
  assert.equal(a.relocates, false);
  assert.equal(a.snippet, '');

  assert.equal(b.id, 'successfactors-1002');
  assert.equal(b.title, 'Data Scientist');
  assert.equal(b.location, 'Munich'); // recovered from the slug (no city div)
  assert.equal(b.url, 'https://jobs.zf.com/job/Munich-Data-Scientist-BY-67890/1002/');
});

// The jobs API can render the city value with a trailing comma
// ("Bend, OR, USA," — upstream #6139, CSB lineage). clean() is shared with
// titles, which may legitimately end in a comma, so the artifact comma comes
// off the location cell only. Interior commas and a postal code stay.
test('parseSuccessfactors: a trailing comma on the rendered city comes off; a title comma stays', () => {
  const html = `
<ul>
  <li class="job-tile job-id-2001">
    <a class="jobTitle-link" href="#" data-url="/job/Bend-Ops-Lead-OR-24601/2001/">Ops Lead,</a>
    <div id="job-2001-section-city-value">Bend, OR, USA,</div>
  </li>
  <li class="job-tile job-id-2002">
    <a class="jobTitle-link" href="#" data-url="/job/Oslo-Platform-Engineer-NO-2002/2002/">Platform Engineer</a>
    <div id="job-2002-section-city-value">Oslo, NOR, 0150</div>
  </li>
</ul>`;
  const jobs = parseSuccessfactors(html, { jobBase: JOB_BASE, fallbackCompany: 'Acme' });
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].location, 'Bend, OR, USA', 'the artifact comma is stripped');
  assert.equal(jobs[0].title, 'Ops Lead,', 'a title may legitimately end in a comma — untouched');
  assert.equal(jobs[1].location, 'Oslo, NOR, 0150', 'interior commas and a postal code stay');
});

test('parseSuccessfactors: bad inputs → []', () => {
  assert.deepEqual(parseSuccessfactors('', { jobBase: JOB_BASE }), []);
  assert.deepEqual(parseSuccessfactors(HTML, {}), []); // no jobBase
  assert.deepEqual(parseSuccessfactors(HTML, { jobBase: 'not a url' }), []);
  assert.deepEqual(parseSuccessfactors(null, { jobBase: JOB_BASE }), []);
});

test('cityFromSlug: recovers leading city segment, empty when unresolvable', () => {
  assert.equal(cityFromSlug('/job/Munich-Data-Scientist-BY-67890/1002/', 'Data Scientist'), 'Munich');
  assert.equal(cityFromSlug('/job/San-Jose-Senior-Engineer-000/9/', 'Senior Engineer'), 'San Jose');
  assert.equal(cityFromSlug('/no/job/path/here', 'X'), '');
  assert.equal(cityFromSlug('/job/Senior-Engineer-000/9/', 'Senior Engineer'), ''); // title starts the slug → no city
});

test('assertSuccessfactorsUrl: https + real host, throws off-scheme/hostless', () => {
  assert.equal(assertSuccessfactorsUrl(ENDPOINT), ENDPOINT);
  assert.throws(() => assertSuccessfactorsUrl('http://jobs.zf.com/tile-search-results/'), /HTTPS/);
  assert.throws(() => assertSuccessfactorsUrl('ftp://jobs.zf.com/x'), /HTTPS/);
  assert.throws(() => assertSuccessfactorsUrl('nonsense'), /invalid URL/);
});

const htmlFetch = (byStartrow) => async (url, opts) => {
  assert.equal(opts.redirect, 'error');
  const startrow = Number((url.match(/[?&]startrow=(\d+)/) || [])[1] || 0);
  return { ok: true, status: 200, text: async () => (byStartrow[startrow] ?? '') };
};

test('fetchSuccessfactors: paginates by startrow until an empty page, CI-isolated', async () => {
  // page 0 → the canned fixture (2 usable tiles), page 2 → empty → stop.
  let calls = 0;
  const fetchImpl = (url, opts) => { calls += 1; return htmlFetch({ 0: HTML, 2: '' })(url, opts); };
  const jobs = await fetchSuccessfactors(ENDPOINT, { fetchImpl, company: { name: 'ZF' } });
  assert.equal(calls, 2); // startrow=0 (2 tiles) → startrow=2 (empty) → stop
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((j) => j.source === 'successfactors'));
  assert.ok(jobs.every((j) => j.company === 'ZF'));
});

test('fetchSuccessfactors: THROWS on a total outage (page-0 fetch fails, dead board ≠ empty board)', async () => {
  // A page-0 failure (nothing ever fetched, `succeededOnce` false) propagates:
  // an unreachable board must reject so scan/portal-health record a failure,
  // NOT resolve to [] which reads as "live but empty" (meituan/tencent
  // contract). This web-ui port is RMK-only — there is no post-RMK CSB probe.
  await assert.rejects(
    () => fetchSuccessfactors(ENDPOINT, { fetchImpl: async () => { throw new Error('tenant down'); }, company: { name: 'ZF' } }),
    /tenant down/,
  );
});

test('fetchSuccessfactors: a mid-scan failure keeps partials (does NOT discard page-1 tiles or re-throw)', async () => {
  // v1.134.1 regression guard (sibling of radancy/phenom): once ≥1 page has
  // succeeded, a LATER page failure must return what was already scraped — not
  // throw. Throwing would discard the tiles and, if the failure is a 404 on an
  // out-of-range startrow, get a live tenant quarantined as permanently dead.
  let calls = 0;
  const fetchImpl = (url, opts) => {
    calls += 1;
    if (calls === 1) return Promise.resolve({ ok: true, status: 200, text: async () => HTML }); // startrow=0 → 2 tiles
    return Promise.reject(Object.assign(new Error('page-2 blip'), { status: 404 })); // startrow=2 → transport failure
  };
  const jobs = await fetchSuccessfactors(ENDPOINT, { fetchImpl, company: { name: 'ZF' } });
  assert.equal(calls, 2);
  assert.equal(jobs.length, 2, 'page-1 partials preserved despite the page-2 failure');
  assert.ok(jobs.every((j) => j.source === 'successfactors'));
});

test('fetchSuccessfactors: host guard rejects an off-host endpoint before fetch', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, status: 200, text: async () => '' }; };
  await assert.rejects(() => fetchSuccessfactors('http://jobs.zf.com/tile-search-results/', { fetchImpl }), /HTTPS/);
  assert.equal(called, false); // guard fires before any fetch
});

test('resolveTenantBase: multi-brand RMK path preserved; endpoint segments never doubled (#2099)', () => {
  // Single-domain tenant unaffected: base === origin.
  assert.equal(resolveTenantBase({ careers_url: 'https://jobs.zf.com' }), 'https://jobs.zf.com');
  // Brand path survives; trailing /search/ stripped.
  assert.equal(
    resolveTenantBase({ api: 'https://careers.nemetschek.com/Bluebeam/search/' }),
    'https://careers.nemetschek.com/Bluebeam',
  );
  // Brand path without /search/ resolves the same.
  assert.equal(
    resolveTenantBase({ careers_url: 'https://careers.nemetschek.com/Bluebeam/' }),
    'https://careers.nemetschek.com/Bluebeam',
  );
  // An api: pointing straight at the tile endpoint must not double the segment.
  assert.equal(
    successfactorsAdapter.buildEndpoint({ api: 'https://careers.nemetschek.com/Bluebeam/tile-search-results/' }),
    'https://careers.nemetschek.com/Bluebeam/tile-search-results/',
  );
  // Adapter endpoint carries the brand path end-to-end.
  assert.equal(
    successfactorsAdapter.buildEndpoint({ careers_url: 'https://careers.nemetschek.com/Bluebeam/' }),
    'https://careers.nemetschek.com/Bluebeam/tile-search-results/',
  );
  // Unparseable / non-https / empty → null.
  assert.equal(resolveTenantBase({ careers_url: 'not a url' }), null);
  assert.equal(resolveTenantBase({ careers_url: 'http://careers.nemetschek.com/Bluebeam/' }), null);
  assert.equal(resolveTenantBase({}), null);
});

// ── Phase 2 (v1.242.0): exact-host pin + challenge-page shape guard ──

test('assertSuccessfactorsUrl: with an expected tenant host, the endpoint host must match EXACTLY', () => {
  assert.equal(assertSuccessfactorsUrl(ENDPOINT, 'jobs.zf.com'), ENDPOINT);
  assert.throws(
    () => assertSuccessfactorsUrl('https://evil.test/tile-search-results/', 'jobs.zf.com'),
    /tenant host/,
  );
  assert.throws(
    () => assertSuccessfactorsUrl('https://jobs.zf.com.evil.test/tile-search-results/', 'jobs.zf.com'),
    /tenant host/,
  );
});

test('fetchSuccessfactors: endpoint host is pinned to the tenant host from the entry', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, status: 200, text: async () => (calls === 1 ? HTML : '') };
  };
  // Same host as the entry → passes the guard and parses.
  const ok = await fetchSuccessfactors(ENDPOINT, {
    fetchImpl,
    company: { name: 'ZF', careers_url: 'https://jobs.zf.com/careers' },
  });
  assert.equal(ok.length, 2);
  // A same-scheme endpoint on ANOTHER host must be refused before any I/O.
  await assert.rejects(
    () => fetchSuccessfactors('https://jobs.schaeffler.com/tile-search-results/', {
      fetchImpl,
      company: { name: 'ZF', careers_url: 'https://jobs.zf.com/careers' },
    }),
    /tenant host/,
  );
  assert.ok(calls <= 2, 'the mismatched call must never reach the network');
});

test('fetchSuccessfactors: a challenge-page 200 (no job tiles) THROWS instead of reading as an empty board', async () => {
  const fetchImpl = async () => ({
    ok: true, status: 200,
    text: async () => '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>cf-challenge</body></html>',
  });
  await assert.rejects(
    () => fetchSuccessfactors(ENDPOINT, { fetchImpl, company: { name: 'ZF' } }),
    /job tiles/,
  );
});

test('fetchSuccessfactors: a later empty page (no tiles after ≥1 good page) still ends pagination quietly', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, status: 200, text: async () => (calls === 1 ? HTML : '') };
  };
  const jobs = await fetchSuccessfactors(ENDPOINT, { fetchImpl, company: { name: 'ZF' } });
  assert.equal(calls, 2);
  assert.equal(jobs.length, 2);
});

test('resolveTenantBase: a /go/<Category>/<id>/ saved-search page resolves to the tenant root', () => {
  const root = 'https://jobs.canadalife.com';
  for (const url of [
    `${root}/go/All-Jobs/9170201/`,
    `${root}/go/All-Jobs/9170201/?locale=en_US`,
    `${root}/go/All-Jobs/9170201/25/`,
    `${root}/go/All-Jobs/9170201`,
  ]) {
    assert.equal(resolveTenantBase({ careers_url: url }), root, url);
  }
  // A brand segment in FRONT of /go/ survives.
  assert.equal(resolveTenantBase({ careers_url: 'https://careers.nemetschek.com/Bluebeam/go/Sales/123/' }),
    'https://careers.nemetschek.com/Bluebeam');
  // Not a category page (no numeric id): left alone.
  assert.equal(resolveTenantBase({ careers_url: 'https://careers.example.com/go/' }), 'https://careers.example.com/go');
  assert.equal(resolveTenantBase({ careers_url: 'https://careers.example.com/Brand/go/jobs/' }), 'https://careers.example.com/Brand/go/jobs');
});

// ── Parent #6697: public-https host guard + opt-in caps + truncation warnings ──

test('host guard: supported branded hosts pass; unsafe hosts are rejected before any request', async () => {
  const { isAllowedHost } = await import('../server/lib/sources/successfactors.mjs');
  const ok = ['https://jobs.sap.com', 'https://jobs.zf.com/search/', 'https://jobs.schaeffler.com', 'https://jobs.hensoldt.net', 'https://careers.te.com/search/', 'https://career5.successfactors.eu/careers', 'https://careers.nemetschek.com/Bluebeam/'];
  const bad = ['http://jobs.zf.com', 'https://localhost', 'https://127.0.0.1', 'https://10.0.0.5', 'https://169.254.169.254/latest', 'https://2130706433', 'https://[::1]', 'https://intranet', 'https://jobs.corp.internal', 'https://user:pw@jobs.zf.com', 'https://jobs.zf.com:8443'];
  const okFail = ok.filter((u) => !resolveTenantBase({ name: 'T', careers_url: u }));
  const badFail = bad.filter((u) => resolveTenantBase({ name: 'T', careers_url: u }));
  assert.deepEqual(okFail, [], 'every supported branded host resolves');
  assert.deepEqual(badFail, [], 'no unsafe host resolves');
  assert.ok(ok.every((u) => isAllowedHost(new URL(u))));
  let requests = 0;
  let threw = 0;
  for (const u of bad) {
    try {
      await fetchSuccessfactors(`${u.replace(/\/+$/, '')}/tile-search-results/`, {
        fetchImpl: async () => { requests += 1; return { ok: true, status: 200, text: async () => '' }; },
        company: { name: 'T', careers_url: u },
      });
    } catch { threw += 1; }
  }
  assert.equal(requests, 0, 'unsafe hosts are refused before any request');
  assert.equal(threw, bad.length, 'every unsafe host throws');
});

test('resolveLimits: ceilings, default ignores a lowering max_pages, defaults are not "raised"', async () => {
  const { resolveLimits } = await import('../server/lib/sources/successfactors.mjs');
  assert.deepEqual(resolveLimits({ max_pages: 99999, max_jobs: 99999 }),
    { maxPages: 400, maxJobs: 10000, raised: true }, 'clamped to the ceilings');
  assert.deepEqual(resolveLimits({}), { maxPages: 40, maxJobs: 1000, raised: false }, 'defaults');
  assert.equal(resolveLimits({ max_pages: 5 }).maxPages, 40, 'RMK ignores a lowering max_pages');
  assert.equal(resolveLimits({ max_pages: 60 }).maxPages, 60, 'a raise is honored');
  assert.equal(resolveLimits({ max_jobs: 1500 }).maxJobs, 1500);
  assert.equal(resolveLimits({ max_jobs: 99999 }).maxJobs, 10000);
  assert.equal(resolveLimits({ max_pages: 5 }).raised, false);
});

const tilePage = (startrow) => Array.from({ length: 25 }, (_, i) =>
  `<li class="job-tile job-id-${startrow + i}"><a data-url="/job/x/${startrow + i}/" class="jobTitle-link" href="#">Role ${startrow + i}</a></li>`).join('');

/** A transport over a tenant's own tile endpoint; counts requests. */
const rmkEndpoint = (tenant) => `https://${tenant}/tile-search-results/`;
const rmkCtx = (c) => ({
  fetchImpl: async (u) => {
    c.n += 1;
    return { ok: true, status: 200, text: async () => tilePage(Number(new URL(u).searchParams.get('startrow'))) };
  },
});

test('RMK default cap warns when still receiving new postings', async () => {
  const warns = [];
  const origErr = console.error;
  console.error = (...a) => warns.push(a.join(' '));
  const calls = { n: 0 };
  try {
    const jobs = await fetchSuccessfactors(rmkEndpoint('jobs.rmkco.example'), { ...rmkCtx(calls), company: { name: 'RmkCo', careers_url: 'https://jobs.rmkco.example' } });
    assert.equal(jobs.length, 1000);
    assert.equal(calls.n, 40);
    assert.equal(warns.length, 1);
    assert.match(warns[0], /RmkCo truncated at max_pages=40, max_jobs=1000/);
    assert.match(warns[0], /raise max_pages and\/or max_jobs/);
    // The parent tags only the stderr warning for RMK (the fragment carries
    // no total) — no canonical truncated tag on the returned array.
    assert.equal(jobs.truncated, undefined);
  } finally {
    console.error = origErr;
  }
});

test('RMK opt-in max_pages/max_jobs raises the cap (and still warns when the new cap is hit)', async () => {
  const warns = [];
  const origErr = console.error;
  console.error = (...a) => warns.push(a.join(' '));
  const calls = { n: 0 };
  try {
    const jobs = await fetchSuccessfactors(rmkEndpoint('jobs.rmkco.example'), {
      ...rmkCtx(calls),
      company: { name: 'RmkCo', careers_url: 'https://jobs.rmkco.example', max_pages: 60, max_jobs: 1500 },
    });
    assert.equal(jobs.length, 1500);
    assert.equal(calls.n, 60);
    assert.equal(warns.length, 1);
    assert.match(warns[0], /truncated at max_pages=60, max_jobs=1500/);
  } finally {
    console.error = origErr;
  }
});

test('RMK does not warn when the last page before the cap is short', async () => {
  const warns = [];
  const origErr = console.error;
  console.error = (...a) => warns.push(a.join(' '));
  try {
    const shortLast = (u) => {
      const r = Number(new URL(u).searchParams.get('startrow'));
      return r < 975 ? tilePage(r) : tilePage(r).split('</li>').slice(0, 10).join('</li>') + '</li>';
    };
    const jobs = await fetchSuccessfactors(rmkEndpoint('jobs.shortlast.example'), {
      fetchImpl: async (u) => ({ ok: true, status: 200, text: async () => shortLast(u) }),
      company: { name: 'ShortLast', careers_url: 'https://jobs.shortlast.example' },
    });
    assert.equal(jobs.length, 985);
    assert.equal(warns.length, 0);
    assert.equal(jobs.truncated, undefined);
  } finally {
    console.error = origErr;
  }
});

test('RMK board that ends naturally before the cap does not warn', async () => {
  const warns = [];
  const origErr = console.error;
  console.error = (...a) => warns.push(a.join(' '));
  try {
    const jobs = await fetchSuccessfactors(rmkEndpoint('jobs.smallco.example'), {
      fetchImpl: async (u) => ({ ok: true, status: 200, text: async () => (new URL(u).searchParams.get('startrow') === '0' ? tilePage(0) : '') }),
      company: { name: 'SmallCo', careers_url: 'https://jobs.smallco.example' },
    });
    assert.equal(jobs.length, 25);
    assert.equal(warns.length, 0);
  } finally {
    console.error = origErr;
  }
});

test('RMK counts source rows, not parsed tiles, when judging a full last page', async () => {
  const warns = [];
  const origErr = console.error;
  console.error = (...a) => warns.push(a.join(' '));
  try {
    // The last page before the cap carries 24 titled tiles + 1 title-less one:
    // full by SOURCE rows (25), so the cap warning still fires.
    const badTile = '<li class="job-tile job-id-999999"><a data-url="/job/x/999999/" href="#"></a></li>';
    const jobs = await fetchSuccessfactors(rmkEndpoint('jobs.badtile.example'), {
      fetchImpl: async (u) => {
        const r = Number(new URL(u).searchParams.get('startrow'));
        return { ok: true, status: 200, text: async () => (r === 975 ? tilePage(r).split('</li>').slice(0, 24).join('</li>') + '</li>' + badTile : tilePage(r)) };
      },
      company: { name: 'BadTile', careers_url: 'https://jobs.badtile.example' },
    });
    assert.equal(warns.length, 1);
    assert.match(warns[0], /BadTile truncated/);
    assert.ok(jobs.length >= 975);
  } finally {
    console.error = origErr;
  }
});

test('RMK advances by source rows and walks past a page of malformed tiles', async () => {
  const asked = [];
  const bad = (id) => `<li class="job-tile job-id-${id}"><a data-url="/job/x/${id}/" href="#"></a></li>`;
  const jobs = await fetchSuccessfactors(rmkEndpoint('jobs.malformed.example'), {
    fetchImpl: async (u) => {
      const r = Number(new URL(u).searchParams.get('startrow'));
      asked.push(r);
      if (r === 0) return { ok: true, status: 200, text: async () => bad(9001) + bad(9002) };
      if (r === 2) return { ok: true, status: 200, text: async () => tilePage(100).split('</li>').slice(0, 5).join('</li>') + '</li>' };
      return { ok: true, status: 200, text: async () => '' };
    },
    company: { name: 'Malformed', careers_url: 'https://jobs.malformed.example' },
  });
  // startrow 0 → 2 (two raw rows) → 7 (2 + 5): a title-less page neither ends
  // the walk nor leaves the next offset overlapping.
  assert.equal(asked.join(), '0,2,7');
  assert.equal(jobs.length, 5);
});
