/**
 * `api:` host pinning — parse the URL, exact-host allowlist, never substring.
 *
 * lever / workable / smartrecruiters matched `api.includes('lever.co')`-style
 * substrings: `https://clever.com/` CONTAINS `lever.co`, so an off-host URL
 * rode into the fetch slot (blind SSRF via 302). greenhouse / ashby claimed
 * any api merely CONTAINING 'greenhouse'/'ashbyhq', so a jobicy / himalayas
 * api with `greenhouse` in a query param was shadowed by greenhouse's 7th
 * place in ALL_ADAPTERS.
 *
 * Contract: an `api:` is honoured only when it parses to https + an exact
 * allowlisted hostname; a non-string api is no match and never throws.
 * careers_url is parsed too, so a vendor token inside the PATH of another
 * host (`https://evil.com/jobs.lever.co/x`) is not claimed; legacy
 * boards[.eu].greenhouse.io slugs are (parent LEGACY_BOARD_HOSTS #4195).
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT with cv.md, no network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let dir;
let resolveAdapter;
let lever, workable, smartRecruiters, greenhouse, ashby, jobicy, himalayas, workday;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'adapters-host-pin-'));
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# cv\n');
  process.env.CAREER_OPS_ROOT = dir;
  ({ resolveAdapter } = await import('../server/lib/portals/registry.mjs'));
  const A = '../server/lib/portals/adapters/';
  ({ leverAdapter: lever } = await import(A + 'lever.mjs'));
  ({ workableAdapter: workable } = await import(A + 'workable.mjs'));
  ({ smartRecruitersAdapter: smartRecruiters } = await import(A + 'smartrecruiters.mjs'));
  ({ greenhouseAdapter: greenhouse } = await import(A + 'greenhouse.mjs'));
  ({ ashbyAdapter: ashby } = await import(A + 'ashby.mjs'));
  ({ jobicyAdapter: jobicy } = await import(A + 'jobicy.mjs'));
  ({ himalayasAdapter: himalayas } = await import(A + 'himalayas.mjs'));
  ({ workdayAdapter: workday } = await import(A + 'workday.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  rmSync(dir, { recursive: true, force: true });
});

/** matches → false, buildEndpoint → null, never a throw. */
function refused(adapter, company, note) {
  assert.equal(adapter.matches(company), false, `${adapter.id}.matches must refuse ${note}`);
  assert.doesNotThrow(() => adapter.buildEndpoint(company), `${adapter.id} must not throw on ${note}`);
  assert.equal(adapter.buildEndpoint(company), null, `${adapter.id}.buildEndpoint must be null for ${note}`);
}

// ─── lever ────────────────────────────────────────────────────────────────

test('lever: an off-host api is refused (clever.com contains "lever.co")', () => {
  refused(lever, { api: 'https://clever.com/x' }, 'clever.com');
  refused(lever, { api: 'https://evil.com/?x=lever.co' }, 'query-param look-alike');
  refused(lever, { api: 'https://api.lever.co.evil.test/v0/postings/x' }, 'suffix spoof');
  refused(lever, { api: 'http://api.lever.co/v0/postings/x' }, 'http scheme');
  refused(lever, { api: {} }, 'non-string api');
});

test('lever: a real api host (US + EU) passes through; other fields ignored', () => {
  for (const api of [
    'https://api.lever.co/v0/postings/acme?mode=json',
    'https://api.eu.lever.co/v0/postings/acme',
  ]) {
    assert.equal(lever.matches({ api }), true, api);
    assert.equal(lever.buildEndpoint({ api }), api);
  }
});

test('lever: a real api pin wins even when careers_url is another host', () => {
  const c = { careers_url: 'https://jobs.lever.co/other', api: 'https://api.lever.co/v0/postings/acme' };
  assert.equal(lever.buildEndpoint(c), 'https://api.lever.co/v0/postings/acme');
});

test('lever: careers_url look-alikes (vendor token in another host) are not claimed', () => {
  refused(lever, { careers_url: 'https://evil.com/jobs.lever.co/jetbrains' }, 'token in path');
  refused(lever, { careers_url: 'https://jobs.lever.co.evil.test/jetbrains' }, 'host suffix spoof');
  refused(lever, { careers_url: 'https://jobs.lever.co/..' }, 'path-traversal slug');
});

test('lever: valid careers_urls still build the postings endpoint (incl. scheme-less + EU)', () => {
  assert.equal(lever.buildEndpoint({ careers_url: 'https://jobs.lever.co/jetbrains' }),
    'https://api.lever.co/v0/postings/jetbrains');
  assert.equal(lever.buildEndpoint({ careers_url: 'jobs.lever.co/jetbrains' }),
    'https://api.lever.co/v0/postings/jetbrains');
  assert.equal(lever.buildEndpoint({ careers_url: 'https://jobs.eu.lever.co/acme' }),
    'https://api.eu.lever.co/v0/postings/acme');
});

// ─── workable ─────────────────────────────────────────────────────────────

test('workable: an off-host api is refused', () => {
  refused(workable, { api: 'https://evil.com/?x=workable.com' }, 'query-param look-alike');
  refused(workable, { api: 'https://unworkable.com/api/v3/accounts/x/jobs' }, 'look-alike host');
  refused(workable, { api: 'https://apply.workable.com.evil.test/x' }, 'suffix spoof');
  refused(workable, { api: 42 }, 'non-string api');
});

test('workable: the real API host passes through', () => {
  const api = 'https://apply.workable.com/api/v3/accounts/foo/jobs?details=true';
  assert.equal(workable.matches({ api }), true);
  assert.equal(workable.buildEndpoint({ api }), api);
});

test('workable: www/jobs are Workable’s own site, not an account (legacy host)', () => {
  refused(workable, { careers_url: 'https://www.workable.com/careers' }, 'www.workable.com');
  refused(workable, { careers_url: 'https://jobs.workable.com/x' }, 'jobs.workable.com');
});

test('workable: careers_url look-alikes are not claimed', () => {
  refused(workable, { careers_url: 'https://evil.com/apply.workable.com/foo' }, 'token in path');
  refused(workable, { careers_url: 'https://apply.workable.com.evil.test/foo' }, 'suffix spoof');
});

test('workable: valid careers_urls still build the v3 endpoint', () => {
  assert.equal(workable.buildEndpoint({ careers_url: 'https://apply.workable.com/foo-corp/' }),
    'https://apply.workable.com/api/v3/accounts/foo-corp/jobs?details=true');
  assert.equal(workable.buildEndpoint({ careers_url: 'https://foocorp.workable.com/careers' }),
    'https://apply.workable.com/api/v3/accounts/foocorp/jobs?details=true');
});

// ─── smartrecruiters ──────────────────────────────────────────────────────

test('smartrecruiters: an off-host api is refused', () => {
  refused(smartRecruiters, { api: 'https://evil.com/?x=smartrecruiters.com' }, 'query-param look-alike');
  refused(smartRecruiters, { api: 'https://api.smartrecruiters.com.evil.test/x' }, 'suffix spoof');
  refused(smartRecruiters, { api: null }, 'null api');
});

test('smartrecruiters: a careers-page (HTML) api pin is not an endpoint', () => {
  refused(smartRecruiters, { api: 'https://careers.smartrecruiters.com/AcmeCorp' }, 'careers-page api');
  refused(smartRecruiters, { api: 'https://jobs.smartrecruiters.com/AcmeCorp' }, 'jobs-page api');
});

test('smartrecruiters: the real api host passes through', () => {
  const api = 'https://api.smartrecruiters.com/v1/companies/Acme/postings';
  assert.equal(smartRecruiters.matches({ api }), true);
  assert.equal(smartRecruiters.buildEndpoint({ api }), api);
});

test('smartrecruiters: an oneclick-ui careers_url yields the company slug, not "oneclick-ui"', () => {
  assert.equal(smartRecruiters.buildEndpoint({ careers_url: 'https://careers.smartrecruiters.com/oneclick-ui/company/AcmeCorp' }),
    'https://api.smartrecruiters.com/v1/companies/AcmeCorp/postings');
});

test('smartrecruiters: careers_url look-alikes are not claimed', () => {
  refused(smartRecruiters, { careers_url: 'https://evil.com/jobs.smartrecruiters.com/x' }, 'token in path');
  refused(smartRecruiters, { careers_url: 'https://jobs.smartrecruiters.com.evil.test/x' }, 'suffix spoof');
});

test('smartrecruiters: valid careers_urls still build the postings endpoint', () => {
  assert.equal(smartRecruiters.buildEndpoint({ careers_url: 'https://jobs.smartrecruiters.com/BarCorp' }),
    'https://api.smartrecruiters.com/v1/companies/BarCorp/postings');
  assert.equal(smartRecruiters.buildEndpoint({ careers_url: 'https://careers.smartrecruiters.com/BarCorp/jobs' }),
    'https://api.smartrecruiters.com/v1/companies/BarCorp/postings');
});

// ─── greenhouse ───────────────────────────────────────────────────────────

test('greenhouse: an api that merely CONTAINS "greenhouse" is refused', () => {
  refused(greenhouse, { api: 'https://evil.com/?x=greenhouse' }, 'query-param look-alike');
  refused(greenhouse, { api: 'https://greenhouse.evil.test/x' }, 'suffix spoof');
  refused(greenhouse, { api: 'http://boards-api.greenhouse.io/v1/boards/x/jobs' }, 'http scheme');
  refused(greenhouse, { api: { url: 'x' } }, 'non-string api');
});

test('greenhouse: a real boards-api api passes through on any allowed host', () => {
  for (const api of [
    'https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true',
    'https://boards.greenhouse.io/embed/job_board?for=stripe',
    'https://job-boards.eu.greenhouse.io/stripe',
  ]) {
    assert.equal(greenhouse.matches({ api }), true, api);
    assert.equal(greenhouse.buildEndpoint({ api }), api);
  }
});

test('greenhouse: legacy boards[.eu].greenhouse.io/<slug> careers_urls are claimed (#4195)', () => {
  assert.equal(greenhouse.matches({ careers_url: 'https://boards.greenhouse.io/acme' }), true);
  assert.equal(greenhouse.buildEndpoint({ careers_url: 'https://boards.greenhouse.io/acme' }),
    'https://boards-api.greenhouse.io/v1/boards/acme/jobs');
  assert.equal(greenhouse.buildEndpoint({ careers_url: 'https://boards.eu.greenhouse.io/acme' }),
    'https://boards-api.greenhouse.io/v1/boards/acme/jobs');
});

test('greenhouse: jobicy / himalayas api values containing "greenhouse" are NOT shadowed', () => {
  const jobicyEntry = { provider: 'jobicy', api: 'https://jobicy.com/api/v2/count?tag=greenhouse' };
  assert.equal(greenhouse.matches(jobicyEntry), false, 'greenhouse must not claim a jobicy api');
  const m = resolveAdapter(jobicyEntry);
  assert.ok(m, 'the entry still resolves');
  assert.equal(m.adapter.id, 'jobicy');
  assert.equal(m.endpoint, 'https://jobicy.com/api/v2/count?tag=greenhouse');

  const himalayasEntry = { provider: 'himalayas', api: 'https://himalayas.app/jobs?board=greenhouse' };
  assert.equal(greenhouse.matches(himalayasEntry), false);
  assert.equal(resolveAdapter(himalayasEntry).adapter.id, 'himalayas');
});

// ─── ashby ────────────────────────────────────────────────────────────────

test('ashby: an api that merely CONTAINS "ashbyhq" is refused', () => {
  refused(ashby, { api: 'https://evil.com/?x=ashbyhq' }, 'query-param look-alike');
  refused(ashby, { api: 'https://api.ashbyhq.com.evil.test/x' }, 'suffix spoof');
  refused(ashby, { api: 'http://api.ashbyhq.com/posting-api/job-board/x' }, 'http scheme');
  refused(ashby, { api: [] }, 'non-string api');
});

test('ashby: the real api host passes through', () => {
  const api = 'https://api.ashbyhq.com/posting-api/job-board/linear?includeCompensation=true';
  assert.equal(ashby.matches({ api }), true);
  assert.equal(ashby.buildEndpoint({ api }), api);
  assert.equal(ashby.buildEndpoint({ api, careers_url: 'https://jobs.ashbyhq.com/other' }), api);
});

// ─── workday (unanchored careers_url regex) ───────────────────────────────

test('workday: a workday URL inside another host’s query/path is not claimed', () => {
  refused(workday, { careers_url: 'https://evil.com/?to=https://acme.wd5.myworkdayjobs.com/en-US/External' }, 'URL in query');
  refused(workday, { careers_url: 'https://evil.com/x.wd5.myworkdayjobs.com/Search' }, 'URL in path');
  refused(workday, { careers_url: 'https://acme.wd5.myworkdayjobs.com.evil.test/Search' }, 'suffix spoof');
});

test('workday: valid myworkdayjobs careers_urls still build the CXS endpoint', () => {
  assert.equal(workday.buildEndpoint({ careers_url: 'https://parsons.wd5.myworkdayjobs.com/Search' }),
    'https://parsons.wd5.myworkdayjobs.com/wday/cxs/parsons/Search/jobs');
  assert.equal(workday.buildEndpoint({ careers_url: 'https://acme.wd5.myworkdayjobs.com/en-US/External?x=1#f' }),
    'https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/jobs');
});
