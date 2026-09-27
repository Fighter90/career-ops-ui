/**
 * Tests for the per-tenant ATS sources:
 * BambooHR, Breezy HR, Comeet, Personio, plus the long-standing
 * Recruitee and SolidJobs sources (added to web-ui in v1.76.0).
 *
 * CI-isolated: HTTP is never hit; a fake fetchImpl is injected and `opts.company`
 * is passed explicitly the same way en-scanner does. Each block covers parse +
 * fetch + adapter detection + the SSRF host guard.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fetchBambooHR, parseBambooHRResponse, assertBambooHRUrl } from '../server/lib/sources/bamboohr.mjs';
import { fetchBreezy, parseBreezyResponse, assertBreezyUrl } from '../server/lib/sources/breezy.mjs';
import { fetchComeet, parseComeetResponse, assertComeetUrl, isComeetApiUrl, redactToken } from '../server/lib/sources/comeet.mjs';
import { fetchPersonio, parsePersonioXml, parsePersonioHtml, assertPersonioUrl } from '../server/lib/sources/personio.mjs';
import { fetchRecruitee, parseRecruiteeResponse, assertRecruiteeUrl } from '../server/lib/sources/recruitee.mjs';
import { fetchSolidJobs, parseSolidJobsResponse, assertSolidJobsUrl, isSolidJobsUrl } from '../server/lib/sources/solidjobs.mjs';

import { bamboohrAdapter } from '../server/lib/portals/adapters/bamboohr.mjs';
import { breezyAdapter } from '../server/lib/portals/adapters/breezy.mjs';
import { comeetAdapter } from '../server/lib/portals/adapters/comeet.mjs';
import { personioAdapter } from '../server/lib/portals/adapters/personio.mjs';
import { recruiteeAdapter } from '../server/lib/portals/adapters/recruitee.mjs';
import { solidjobsAdapter } from '../server/lib/portals/adapters/solidjobs.mjs';

const okJson = (data) => async () => ({ ok: true, json: async () => data });
const okText = (text) => async () => ({ ok: true, text: async () => text });

// ─────────────────────────────── BambooHR ───────────────────────────────
test('bamboohr: parse drops rows without an id and builds the careers url', () => {
  const jobs = parseBambooHRResponse({
    result: [
      { id: 42, jobOpeningName: 'ML Engineer', location: { city: 'Berlin', state: 'BE' }, isRemote: 1 },
      { id: '', jobOpeningName: 'No id' },          // dropped
      { id: 7, jobOpeningName: '' },                 // dropped (no title)
    ],
  }, 'Acme', 'https://acme.bamboohr.com');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://acme.bamboohr.com/careers/42');
  assert.equal(jobs[0].isRemote, true);
  assert.equal(jobs[0].source, 'bamboohr');
  assert.match(jobs[0].location, /Berlin/);
});

test('bamboohr: fetch normalizes + adapter detects host', async () => {
  let seenOpts;
  const jobs = await fetchBambooHR('https://acme.bamboohr.com/careers/list', {
    fetchImpl: async (url, opts) => { seenOpts = opts; return { ok: true, text: async () => JSON.stringify({ result: [{ id: 1, jobOpeningName: 'SWE' }] }) }; },
    company: { name: 'Acme' },
  });
  assert.equal(jobs[0].company, 'Acme');
  // Never auto-follows: 'manual' surfaces the 3xx for classification (parent #4365).
  assert.equal(seenOpts.redirect, 'manual');
  assert.ok(bamboohrAdapter.matches({ careers_url: 'https://acme.bamboohr.com/x' }));
  assert.equal(bamboohrAdapter.buildEndpoint({ careers_url: 'https://acme.bamboohr.com' }), 'https://acme.bamboohr.com/careers/list');
  assert.equal(bamboohrAdapter.matches({ careers_url: 'https://acme.example.com' }), false);
});

test('bamboohr: SSRF guard rejects an off-domain host', () => {
  assert.throws(() => assertBambooHRUrl('https://evil.com/careers/list'), /untrusted hostname/);
});

// Parent #4365 parity — redirect classification on /careers/list.
const redirectRes = (location, status = 302) => ({
  ok: false, status, headers: new Headers({ location }), text: async () => '',
});
const embed2 = (body) => ({ ok: true, json: async () => body });

test('bamboohr: an untrusted endpoint throws before any fetch', async () => {
  let calls = 0;
  await assert.rejects(
    fetchBambooHR('https://evil.example/acme.bamboohr.com/careers/list', { fetchImpl: async () => { calls++; return embed2({}); } }),
    /untrusted hostname/,
  );
  assert.equal(calls, 0);
});

test('bamboohr: a non-marketing redirect + empty embed-widget feed is a live, empty board → []', async () => {
  let probeOpts;
  const jobs = await fetchBambooHR('https://empty.bamboohr.com/careers/list', {
    fetchImpl: async (url, opts) => {
      if (url.includes('/careers/list')) return redirectRes('/settings/account/temporarily_suspended');
      assert.equal(url, 'https://empty.bamboohr.com/jobs/embed2.php?version=1.0.0&format=json');
      probeOpts = opts;
      return embed2({ success: true, departments: [] });
    },
  });
  assert.deepEqual(jobs, []);
  assert.equal(probeOpts.redirect, 'error');
});

test('bamboohr: a redirect + populated embed-widget feed (suspended-account signature) → status 404', async () => {
  await assert.rejects(
    fetchBambooHR('https://dead.bamboohr.com/careers/list', {
      fetchImpl: async (url) => (url.includes('/careers/list')
        ? redirectRes('/settings/account/temporarily_suspended')
        : embed2({ success: true, departments: [{ id: 1, label: 'Ops', positions: [{ id: 7 }] }] })),
    }),
    (err) => err.status === 404,
  );
});

test('bamboohr: a redirect whose embed-widget probe also fails → status 404', async () => {
  await assert.rejects(
    fetchBambooHR('https://dead.bamboohr.com/careers/list', {
      fetchImpl: async () => redirectRes('/login.php'),
    }),
    (err) => err.status === 404,
  );
});

for (const [label, location] of [['bare host', 'https://www.bamboohr.com/'], ['no www', 'https://bamboohr.com']]) {
  test(`bamboohr: a marketing-site bounce (${label}) is a 404 without the embed-widget probe`, async () => {
    let probeCalled = false;
    await assert.rejects(
      fetchBambooHR('https://dead.bamboohr.com/careers/list', {
        fetchImpl: async (url) => {
          if (url.includes('/careers/list')) return redirectRes(location, 301);
          probeCalled = true;
          return embed2({ success: true, departments: [] });
        },
      }),
      (err) => err.status === 404,
    );
    assert.equal(probeCalled, false);
  });
}

test('bamboohr: a non-redirect failure passes through unmapped', async () => {
  const transientErr = new Error('This operation was aborted');
  await assert.rejects(
    fetchBambooHR('https://slow.bamboohr.com/careers/list', { fetchImpl: async () => { throw transientErr; } }),
    (err) => err === transientErr && err.status !== 404,
  );
  await assert.rejects(
    fetchBambooHR('https://slow.bamboohr.com/careers/list', {
      fetchImpl: async () => ({ ok: false, status: 503, headers: new Headers(), text: async () => '' }),
    }),
    (err) => err.status === 503,
  );
});

// ──────────────────────────────── Breezy ────────────────────────────────
test('breezy: parse keeps https rows, drops malformed urls, parses date', () => {
  const jobs = parseBreezyResponse([
    { name: 'Backend Dev', url: 'https://foo.breezy.hr/p/abc', location: { name: 'Remote' }, published_date: '2026-06-01T00:00:00Z' },
    { name: 'Bad', url: 'ftp://nope' },   // dropped (non-https)
    { name: 'NoUrl' },                    // dropped
  ], 'Foo');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].isRemote, true);
  assert.match(jobs[0].date, /2026-06-01/);
  assert.equal(jobs[0].source, 'breezy');
});

test('breezy: fetch + adapter detection + SSRF guard', async () => {
  const jobs = await fetchBreezy('https://foo.breezy.hr/json', {
    fetchImpl: okJson([{ name: 'X', url: 'https://foo.breezy.hr/p/1' }]),
    company: { name: 'Foo' },
  });
  assert.equal(jobs[0].company, 'Foo');
  assert.equal(breezyAdapter.buildEndpoint({ careers_url: 'https://foo.breezy.hr' }), 'https://foo.breezy.hr/json');
  assert.throws(() => assertBreezyUrl('https://evil.com/json'), /untrusted hostname/);
});

// ──────────────────────────────── Comeet ────────────────────────────────
test('comeet: isComeetApiUrl + token redaction', () => {
  assert.ok(isComeetApiUrl('https://www.comeet.co/careers-api/2.0/company/AB/positions?token=secret'));
  assert.equal(isComeetApiUrl('https://www.comeet.co/jobs/AB'), false);
  assert.match(redactToken('https://www.comeet.co/careers-api/x?token=secret'), /token=REDACTED/);
});

test('comeet: parse prefers url_active_page, drops rows without url', () => {
  const jobs = parseComeetResponse([
    { name: 'Data Eng', location: { name: 'Tel Aviv', is_remote: true }, url_active_page: 'https://acme.com/jobs/1', time_updated: '2026-05-01' },
    { name: 'NoUrl', location: { name: 'X' } }, // dropped
  ], 'Acme');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://acme.com/jobs/1');
  assert.equal(jobs[0].isRemote, true);
  assert.match(jobs[0].date, /2026-05-01/);
});

test('comeet: fetch + adapter detection + SSRF guard rejects wrong host/path', async () => {
  const url = 'https://www.comeet.co/careers-api/2.0/company/AB/positions?token=t';
  const jobs = await fetchComeet(url, { fetchImpl: okJson([{ name: 'Y', url_active_page: 'https://acme.com/1' }]), company: { name: 'Acme' } });
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(comeetAdapter.buildEndpoint({ api: url }), url);
  assert.throws(() => assertComeetUrl('https://www.comeet.co/jobs/AB'), /untrusted or malformed/);
});

// ─────────────────────────────── Personio ───────────────────────────────
test('personio: parse XML feed, build url from numeric id, join offices', () => {
  const xml = `<workzag-jobs>
    <position><id>123</id><name>ML Engineer</name><office>Berlin</office>
      <additionalOffices><office>Munich</office></additionalOffices><createdAt>2026-04-02T00:00:00Z</createdAt></position>
    <position><id>x9</id><name>BadId</name><office>NoUrl</office></position>
  </workzag-jobs>`;
  const jobs = parsePersonioXml(xml, 'Acme', 'acme.jobs.personio.de');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://acme.jobs.personio.de/job/123');
  assert.match(jobs[0].location, /Berlin, Munich/);
  assert.match(jobs[0].date, /2026-04-02/);
});

test('personio: fetch (text) + adapter detection + SSRF guard', async () => {
  const xml = '<workzag-jobs><position><id>1</id><name>SWE</name><office>Remote</office></position></workzag-jobs>';
  const jobs = await fetchPersonio('https://acme.jobs.personio.de/xml', { fetchImpl: okText(xml), company: { name: 'Acme' } });
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].isRemote, true);
  assert.equal(personioAdapter.buildEndpoint({ careers_url: 'https://acme.jobs.personio.com' }), 'https://acme.jobs.personio.com/xml');
  assert.throws(() => assertPersonioUrl('https://evil.com/xml'), /untrusted hostname/);
});

// HTML fallback shape served when a tenant disables the /xml feed. Class names
// carry build-specific hashed suffixes; only the stable job-box / jobMetaText
// substrings are matched. Two job-box anchors + one unrelated nav link.
const PERSONIO_HTML = `<ul><li>
    <a class="page_job__haA3E job-box" href="/job/2378948"><div class="page_jobHeaderContent__c_2JP">
      <h3 class="page_jobTitle__K0ilk jb-title">ML-QA Engineer</h3>
      <div class="page_jobMeta__GhU10 jb-description">
        <div class="page_jobMetaItem__olmVi"><span class="page_jobMetaText__5yzux">Berlin AI Campus, Munich</span></div>
        <div class="page_jobMetaItem__olmVi"><span class="page_jobMetaText__5yzux">Vollzeit</span></div>
      </div>
    </div></a>
  </li><li>
    <a class="page_job__haA3E job-box" href="/job/2540715?language=en"><div class="page_jobHeaderContent__c_2JP">
      <h3 class="page_jobTitle__K0ilk jb-title">Senior Engineer (m/f/d) &amp; Lead</h3>
      <div class="page_jobMeta__GhU10 jb-description">
        <div class="page_jobMetaItem__olmVi"><span class="page_jobMetaText__5yzux">Remote</span></div>
      </div>
    </div></a>
  </li><li>
    <a class="nav-link" href="/privacy-policy">Datenschutzerklärung</a>
  </li></ul>`;

test('personio: parsePersonioHtml scrapes job-box anchors, ignores nav links, strips ?language= + decodes entities', () => {
  const jobs = parsePersonioHtml(PERSONIO_HTML, 'Acme', 'acme.jobs.personio.de');
  assert.equal(jobs.length, 2); // the /privacy-policy nav-link is ignored
  assert.equal(jobs[0].title, 'ML-QA Engineer');
  assert.equal(jobs[0].url, 'https://acme.jobs.personio.de/job/2378948');
  assert.equal(jobs[0].location, 'Berlin AI Campus, Munich'); // first jobMetaText span only
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].source, 'personio');
  assert.equal(jobs[0].date, ''); // no createdAt exposed on the listing page
  assert.equal(jobs[1].title, 'Senior Engineer (m/f/d) & Lead'); // &amp; decoded
  assert.equal(jobs[1].url, 'https://acme.jobs.personio.de/job/2540715'); // ?language=en stripped
  assert.equal(jobs[1].isRemote, true);
  // empty / non-string page → empty result (no crash)
  assert.equal(parsePersonioHtml('', 'X', 'acme.jobs.personio.de').length, 0);
  assert.equal(parsePersonioHtml(null, 'X', 'acme.jobs.personio.de').length, 0);
});

test('personio: fetch falls back to HTML scrape when the /xml feed is disabled (404)', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith('/xml')) return { ok: false, status: 404 }; // feed disabled
    return { ok: true, text: async () => PERSONIO_HTML };         // careers page
  };
  const jobs = await fetchPersonio('https://acme.jobs.personio.de/xml', { fetchImpl, company: { name: 'Acme' } });
  assert.equal(calls.length, 2);
  assert.equal(calls[1], 'https://acme.jobs.personio.de/?language=en');
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].title, 'ML-QA Engineer');
  assert.equal(jobs[0].url, 'https://acme.jobs.personio.de/job/2378948');
  assert.equal(jobs[0].source, 'personio'); // jobs come from the HTML fallback
});

test('personio: fetch re-throws a non-404 XML error without falling back to HTML', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return { ok: false, status: 500 };
  };
  await assert.rejects(
    fetchPersonio('https://acme.jobs.personio.de/xml', { fetchImpl, company: { name: 'Acme' } }),
    /HTTP 500/,
  );
  assert.equal(calls.length, 1); // only /xml was hit — no fallback on a 500
});

// ─────────────────────────────── Recruitee ──────────────────────────────
test('recruitee: parse offers, custom-domain url allowed, remote flag', () => {
  const jobs = parseRecruiteeResponse({
    offers: [
      { title: 'Frontend', careers_url: 'https://careers.acme.com/1', city: 'Lisbon', country: 'PT', remote: true },
      { title: 'Bad', url: 'http://nope' }, // dropped (non-https)
    ],
  }, 'Acme');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://careers.acme.com/1');
  assert.equal(jobs[0].isRemote, true);
});

test('recruitee: fetch + adapter detection + SSRF guard', async () => {
  const jobs = await fetchRecruitee('https://acme.recruitee.com/api/offers/', {
    fetchImpl: okJson({ offers: [{ title: 'X', url: 'https://acme.recruitee.com/o/1' }] }),
    company: { name: 'Acme' },
  });
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(recruiteeAdapter.buildEndpoint({ careers_url: 'https://acme.recruitee.com' }), 'https://acme.recruitee.com/api/offers/');
  assert.throws(() => assertRecruiteeUrl('https://evil.com/api/offers/'), /untrusted hostname/);
});

// ─────────────────────────────── SolidJobs ──────────────────────────────
test('solidjobs: isSolidJobsUrl + parse throws on bad shape', () => {
  assert.ok(isSolidJobsUrl('https://solid.jobs/public-api/offers/it'));
  assert.equal(isSolidJobsUrl('https://solid.jobs/other'), false);
  assert.throws(() => parseSolidJobsResponse({ nope: 1 }, 'X'), /unexpected API response/);
});

test('solidjobs: parse joins locations, fetch + adapter + SSRF guard', async () => {
  const parsed = parseSolidJobsResponse({ jobs: [{ title: 'Dev', url: 'https://solid.jobs/o/1', locations: ['Remote', 'EU'] }] }, 'Co');
  assert.equal(parsed[0].location, 'Remote, EU');
  assert.equal(parsed[0].isRemote, true);
  const jobs = await fetchSolidJobs('https://solid.jobs/public-api/offers/engineering', {
    fetchImpl: okJson({ jobs: [{ title: 'Y', url: 'https://solid.jobs/o/2', company: 'Acme' }] }),
    company: { name: 'Fallback' },
  });
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(solidjobsAdapter.buildEndpoint({ careers_url: 'https://solid.jobs/public-api/offers/it' }), 'https://solid.jobs/public-api/offers/it');
  assert.throws(() => assertSolidJobsUrl('https://evil.com/public-api/offers/it'), /untrusted or malformed/);
});
