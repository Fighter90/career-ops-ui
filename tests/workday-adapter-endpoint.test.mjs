/**
 * Workday portal adapter — careers_url → CXS endpoint parsing (#255).
 *
 * The old two-segment regex mis-parsed single-segment site URLs (`/Search`,
 * `/Careers`): the optional first path group swallowed the site, `site` came
 * back undefined, and buildEndpoint defaulted to `External` — producing
 * `/wday/cxs/<t>/External/jobs` instead of `/wday/cxs/<t>/<site>/jobs`. The fix
 * parses the path structurally and takes the LAST non-empty, non-locale segment.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workdayAdapter } from '../server/lib/portals/adapters/workday.mjs';

const ep = (careers_url) => workdayAdapter.buildEndpoint({ careers_url });

test('single-segment site URLs use that segment as the site (#255)', () => {
  assert.equal(ep('https://parsons.wd5.myworkdayjobs.com/Search'),
    'https://parsons.wd5.myworkdayjobs.com/wday/cxs/parsons/Search/jobs');
  assert.equal(ep('https://kbr.wd5.myworkdayjobs.com/KBR_Careers'),
    'https://kbr.wd5.myworkdayjobs.com/wday/cxs/kbr/KBR_Careers/jobs');
  assert.equal(ep('https://slihrms.wd3.myworkdayjobs.com/Careers'),
    'https://slihrms.wd3.myworkdayjobs.com/wday/cxs/slihrms/Careers/jobs');
});

test('the documented two-segment <locale>/<site> case still works', () => {
  assert.equal(ep('https://acme.wd5.myworkdayjobs.com/en-US/External'),
    'https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/jobs');
  // a query string / fragment is ignored
  assert.equal(ep('https://acme.wd5.myworkdayjobs.com/en-US/External?foo=1#x'),
    'https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/jobs');
});

test('a deep posting link resolves to the SITE, not the job slug (first non-locale segment)', () => {
  // Regression guard: the site is the first segment after the optional locale,
  // never the last — a job path must not become the site.
  assert.equal(ep('https://acme.wd5.myworkdayjobs.com/en-US/External/job/San-Francisco/Software-Engineer_R-12345'),
    'https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/jobs');
  assert.equal(ep('https://acme.wd5.myworkdayjobs.com/External/job/x'),
    'https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/jobs');
});

test('an uppercase host lowercases the tenant/cell (CXS path is case-sensitive)', () => {
  assert.equal(ep('https://Parsons.WD5.MyWorkdayJobs.com/Search'),
    'https://parsons.wd5.myworkdayjobs.com/wday/cxs/parsons/Search/jobs');
});

test('no site segment (or a locale-only path) defaults to External', () => {
  assert.equal(ep('https://acme.wd1.myworkdayjobs.com/'),
    'https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/External/jobs');
  assert.equal(ep('https://acme.wd1.myworkdayjobs.com'),
    'https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/External/jobs');
  assert.equal(ep('https://acme.wd1.myworkdayjobs.com/en-US'),
    'https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/External/jobs');
});

test('an explicit api endpoint is passed through unchanged', () => {
  const api = 'https://x.wd5.myworkdayjobs.com/wday/cxs/x/Careers/jobs';
  assert.equal(workdayAdapter.buildEndpoint({ api, careers_url: 'https://ignored.wd5.myworkdayjobs.com/Search' }), api);
});

test('an api URL is validated by HOSTNAME, not substring (#443)', () => {
  // A real Workday api host is accepted and passed through…
  const real = 'https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/jobs';
  assert.equal(workdayAdapter.matches({ api: real }), true);
  assert.equal(workdayAdapter.buildEndpoint({ api: real, careers_url: '' }), real);
  // …but a URL that merely CONTAINS the string is rejected — no SSRF via a
  // crafted portals.yml `api`. matches → false, buildEndpoint → null.
  for (const evil of [
    'https://evil.com/?x=myworkdayjobs.com',
    'https://myworkdayjobs.com.evil.com/wday/cxs/x/y/jobs',
    'https://notmyworkdayjobs.com/wday/cxs/x/y/jobs',
    'not a url at all myworkdayjobs.com',
    'ftp://acme.wd5.myworkdayjobs.com/x',                                  // non-http scheme
    'https://user:pass@acme.wd5.myworkdayjobs.com/wday/cxs/x/y/jobs',      // embedded credentials
  ]) {
    assert.equal(workdayAdapter.matches({ api: evil }), false, `must reject api: ${evil}`);
    assert.equal(workdayAdapter.buildEndpoint({ api: evil, careers_url: '' }), null, `must not build from api: ${evil}`);
  }
  // The bare apex domain is a valid Workday host.
  assert.equal(workdayAdapter.matches({ api: 'https://myworkdayjobs.com/x' }), true);
});

test('matches() recognises Workday careers hosts (single- and two-segment)', () => {
  assert.equal(workdayAdapter.matches({ careers_url: 'https://parsons.wd5.myworkdayjobs.com/Search' }), true);
  assert.equal(workdayAdapter.matches({ careers_url: 'https://acme.wd5.myworkdayjobs.com/en-US/External' }), true);
  assert.equal(workdayAdapter.matches({ careers_url: 'https://acme.greenhouse.io/board' }), false);
  assert.equal(workdayAdapter.matches({ api: 'https://x.wd5.myworkdayjobs.com/wday/cxs/x/External/jobs' }), true);
});
