/**
 * liveness-api — additional public-API rungs (parent parity, career-ops @
 * 4bc53fce, #4444): greenhouse-embedded (gh_jid on a company page),
 * SmartRecruiters `active` flag, Arbeitsagentur, We Work Remotely feed.
 *
 * CI-isolated: no network — the SSRF-safe GET is injected through the
 * `deps.safeGet` seam. web-ui adaptation of the parent's fetch mock: safeGet
 * follows redirects itself and reports the landing as `finalUrl`, so the
 * embed redirect is expressed as a first response whose finalUrl is the
 * Greenhouse redirect target.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAtsApi, checkLivenessViaApi } from '../server/lib/liveness-api.mjs';

const greenhouse = 'https://careers.example.com/detail/7823005003/?gh_jid=7823005003';
const smartrecruiters = 'https://jobs.smartrecruiters.com/ServiceNow/744000131661949-senior-director';
const arbeitsagentur = 'https://www.arbeitsagentur.de/jobsuche/jobdetail/10001-1003597288-S';
const wwr = 'https://weworkremotely.com/remote-jobs/acme-staff-engineer';

const check = (url, impl) => checkLivenessViaApi(url, { safeGet: impl });

test('four new URL shapes route only to fixed API hosts', () => {
  assert.match(resolveAtsApi(greenhouse).apiUrl, /^https:\/\/boards\.greenhouse\.io\/embed\//);
  assert.equal(resolveAtsApi(smartrecruiters).apiUrl,
    'https://api.smartrecruiters.com/v1/companies/ServiceNow/postings/744000131661949');
  assert.match(resolveAtsApi(arbeitsagentur).apiUrl, /^https:\/\/rest\.arbeitsagentur\.de\//);
  assert.equal(resolveAtsApi(wwr).apiUrl, 'https://weworkremotely.com/remote-jobs.rss');
  assert.equal(resolveAtsApi('https://jobs.smartrecruiters.com.evil.test/ServiceNow/123-title'), null);
  assert.equal(resolveAtsApi('https://weworkremotely.com/remote-jobs/%2e%2e'), null);
  // A greenhouse.io URL keeps the plain greenhouse rung, never the embed one.
  assert.equal(resolveAtsApi('https://boards.greenhouse.io/acme/jobs/123?gh_jid=123').ats, 'greenhouse');
  // A non-numeric gh_jid is not a posting id.
  assert.equal(resolveAtsApi('https://careers.example.com/job?gh_jid=abc'), null);
});

test('Greenhouse company URL checks the per-job API after a validated embed redirect', async () => {
  const calls = [];
  const verdict = await check(greenhouse, async (url) => {
    calls.push(url);
    if (calls.length === 1) {
      return { status: 200, text: '<html>', finalUrl: 'https://job-boards.greenhouse.io/embed/job_app?for=celonis&token=7823005003' };
    }
    return { status: 404, text: '{}', finalUrl: url };
  });
  assert.equal(verdict.result, 'expired');
  assert.equal(verdict.provider, 'greenhouse-embedded');
  assert.deepEqual(calls, [
    'https://boards.greenhouse.io/embed/job_app?token=7823005003',
    'https://boards-api.greenhouse.io/v1/boards/celonis/jobs/7823005003',
  ]);

  const live = await check(greenhouse, async (url) => (url.includes('/embed/')
    ? { status: 200, text: '', finalUrl: 'https://job-boards.greenhouse.io/embed/job_app?for=celonis&token=7823005003' }
    : { status: 200, text: '{"id":7823005003}', finalUrl: url }));
  assert.equal(live.result, 'active');

  const unsafe = await check(greenhouse, async () => (
    { status: 200, text: '', finalUrl: 'https://evil.example/embed/job_app?for=celonis&token=7823005003' }));
  assert.equal(unsafe, null);

  const callsWithSlash = [];
  const slashBoard = await check(greenhouse, async (url) => {
    callsWithSlash.push(url);
    return { status: 200, text: '', finalUrl: 'https://job-boards.greenhouse.io/embed/job_app?for=acme%2Fprivate&token=7823005003' };
  });
  assert.equal(slashBoard, null);
  assert.equal(callsWithSlash.length, 1);

  // A token that does not echo the posting id, or no redirect at all → unknown.
  const wrongToken = await check(greenhouse, async () => (
    { status: 200, text: '', finalUrl: 'https://job-boards.greenhouse.io/embed/job_app?for=celonis&token=1' }));
  assert.equal(wrongToken, null);
  const noRedirect = await check(greenhouse, async (url) => ({ status: 200, text: '', finalUrl: url }));
  assert.equal(noRedirect, null);
});

test('SmartRecruiters uses active flag, never status 200 alone', async () => {
  const body = (o) => async (url) => ({ status: 200, text: JSON.stringify(o), finalUrl: url });
  assert.equal((await check(smartrecruiters, body({ id: '744000131661949', active: false }))).result, 'expired');
  assert.equal((await check(smartrecruiters, body({ id: '744000131661949', active: true }))).result, 'active');
  assert.equal(await check(smartrecruiters, body({ id: 'other', active: true })), null);
  assert.equal(await check(smartrecruiters, body({})), null, 'status 200 alone proves nothing');
  // 404 is no longer authoritative for SmartRecruiters.
  assert.equal(await check(smartrecruiters, async (url) => ({ status: 404, text: '', finalUrl: url })), null);
});

test('Arbeitsagentur confirms matching live detail but leaves 404 uncertain', async () => {
  let sentHeaders;
  const live = await check(arbeitsagentur, async (url, opts) => {
    sentHeaders = opts.headers;
    return { status: 200, text: JSON.stringify({ referenznummer: '10001-1003597288-S', stellenangebotsTitel: 'Engineer' }), finalUrl: url };
  });
  assert.equal(live.result, 'active');
  assert.equal(sentHeaders['X-API-Key'], 'jobboerse-jobsuche');
  const missing = await check(arbeitsagentur, async (url) => ({ status: 404, text: '', finalUrl: url }));
  assert.equal(missing, null);
});

test('We Work Remotely feed presence proves live, absence remains unknown', async () => {
  const rss = '<rss><channel><item><title>Acme: Engineer</title><link>https://weworkremotely.com/remote-jobs/acme-staff-engineer</link></item></channel></rss>';
  let sentAccept;
  const feed = async (url, opts) => { sentAccept = opts.headers.Accept; return { status: 200, text: rss, finalUrl: url }; };
  const live = await check(wwr, feed);
  assert.equal(live.result, 'active');
  assert.equal(sentAccept, 'application/rss+xml');
  const absent = await check('https://weworkremotely.com/remote-jobs/another-job', feed);
  assert.equal(absent, null);
});
