/**
 * Workday myworkdaysite.com tenants (parent 3e028d9).
 *
 * Same Workday product as myworkdayjobs, but the tenant lives in the PATH:
 *   https://{instance}.myworkdaysite.com/recruiting/{tenant}/{site}
 *   → CXS  https://{instance}.myworkdaysite.com/wday/cxs/{tenant}/{site}/jobs
 *   → jobs https://{instance}.myworkdaysite.com/recruiting/{tenant}/{site}{externalPath}
 * Every host guard that admits `.myworkdayjobs.com` admits `.myworkdaysite.com`
 * with the same strictness (parsed hostname, exact suffix); look-alikes stay out.
 * CI-isolated: fake fetchImpl, no network, no parent checkout.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workdayAdapter } from '../server/lib/portals/adapters/workday.mjs';
import { careersPageFromApi, jobBaseFromApi, fetchWorkday } from '../server/lib/sources/workday.mjs';

const ep = (careers_url) => workdayAdapter.buildEndpoint({ name: 'X', careers_url });

test('adapter resolves a myworkdaysite.com board to its CXS endpoint', () => {
  const url = 'https://wd5.myworkdaysite.com/recruiting/guidewire/external';
  assert.equal(workdayAdapter.matches({ careers_url: url }), true);
  assert.equal(ep(url), 'https://wd5.myworkdaysite.com/wday/cxs/guidewire/external/jobs');
  // query / fragment / deep posting path still resolve to the site
  assert.equal(ep('https://wd1.myworkdaysite.com/recruiting/acme/Careers/job/Remote/SRE_R100?x=1#y'),
    'https://wd1.myworkdaysite.com/wday/cxs/acme/Careers/jobs');
});

test('adapter rejects myworkdaysite look-alikes and non-HTTPS', () => {
  for (const url of [
    'https://wd5.myworkdaysite.com.evil.com/recruiting/acme/external',
    'https://evil.com/recruiting/acme/external?x=wd5.myworkdaysite.com',
    'https://evil.com/?x=https://wd5.myworkdaysite.com/recruiting/acme/external',
    'http://wd5.myworkdaysite.com/recruiting/acme/external',
    'https://user:pw@wd5.myworkdaysite.com/recruiting/acme/external',
    'https://wd5.myworkdaysite.com/acme/external',
  ]) {
    assert.equal(workdayAdapter.matches({ careers_url: url }), false, url);
    assert.equal(ep(url), null, url);
  }
});

test('adapter accepts a myworkdaysite api: verbatim and rejects look-alike api hosts', () => {
  const api = 'https://wd5.myworkdaysite.com/wday/cxs/guidewire/external/jobs';
  assert.equal(workdayAdapter.matches({ api }), true);
  assert.equal(workdayAdapter.buildEndpoint({ api }), api);
  for (const bad of [
    'https://myworkdaysite.com.evil.com/wday/cxs/a/b/jobs',
    'https://evil.com/?x=myworkdaysite.com',
    'http://wd5.myworkdaysite.com/wday/cxs/a/b/jobs',
  ]) {
    assert.equal(workdayAdapter.matches({ api: bad }), false, bad);
    assert.equal(workdayAdapter.buildEndpoint({ api: bad }), null, bad);
  }
});

test('myworkdayjobs endpoints are unchanged', () => {
  assert.equal(ep('https://acme.wd5.myworkdayjobs.com/en-US/External'),
    'https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/jobs');
  assert.equal(careersPageFromApi('https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/jobs'),
    'https://acme.wd5.myworkdayjobs.com/External');
  assert.equal(jobBaseFromApi('https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/jobs'),
    'https://acme.wd5.myworkdayjobs.com');
});

test('careers page / job base for a myworkdaysite CXS endpoint live under /recruiting/{tenant}/{site}', () => {
  const api = 'https://wd1.myworkdaysite.com/wday/cxs/acme/careers/jobs';
  assert.equal(careersPageFromApi(api), 'https://wd1.myworkdaysite.com/recruiting/acme/careers');
  assert.equal(jobBaseFromApi(api), 'https://wd1.myworkdaysite.com/recruiting/acme/careers');
  assert.equal(careersPageFromApi('https://wd1.myworkdaysite.com.evil.com/wday/cxs/acme/careers/jobs'), null);
  assert.equal(careersPageFromApi('http://wd1.myworkdaysite.com/wday/cxs/acme/careers/jobs'), null);
});

test('fetchWorkday builds myworkdaysite job URLs and Referer from /recruiting/{tenant}/{site}', async () => {
  let seen;
  const fetchImpl = async (url, init = {}) => {
    seen = { url, init };
    return {
      ok: true, status: 200,
      json: async () => ({ jobPostings: [{ title: 'SRE', externalPath: '/job/Remote/SRE_R100', locationsText: 'Remote' }] }),
    };
  };
  const api = 'https://wd1.myworkdaysite.com/wday/cxs/acme/careers/jobs';
  const [job] = await fetchWorkday(api, { fetchImpl, strict: true, resolveMultiLocation: false });
  assert.equal(seen.url, api);
  assert.equal(seen.init.headers.Referer, 'https://wd1.myworkdaysite.com/recruiting/acme/careers/');
  assert.equal(job.url, 'https://wd1.myworkdaysite.com/recruiting/acme/careers/job/Remote/SRE_R100');
});
