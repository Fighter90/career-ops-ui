/**
 * BambooHR source — CI-isolated tests (fake fetchImpl, no network).
 *
 * Covers the v1.242.0 phase-2 rule for this source: a 200 with the wrong shape
 * THROWS instead of reading as an empty board (previously
 * `Array.isArray(json.result) ? json.result : []` turned any envelope change
 * into a healthy-looking 0 postings), plus the redirect/SSRF surface that was
 * previously only exercised implicitly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchBambooHR,
  parseBambooHRResponse,
  assertBambooHRUrl,
  BAMBOOHR_HOST_RE,
} from '../server/lib/sources/bamboohr.mjs';

const ORIGIN = 'https://acme.bamboohr.com';

test('parseBambooHRResponse: normalizes the documented {result:[...]} envelope', () => {
  const rows = [
    { id: 42, jobOpeningName: 'ML Engineer', location: { city: 'Lindon', state: 'UT' }, isRemote: false },
    { id: '43', jobOpeningName: 'Support Specialist', location: {}, isRemote: true },
    { id: '', jobOpeningName: 'blank id' }, // dropped: blank id collapses postings
    { id: 44 }, // dropped: no title
  ];
  const jobs = parseBambooHRResponse({ result: rows }, 'Acme', ORIGIN);
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].id, 'bamboohr-42');
  assert.equal(jobs[0].title, 'ML Engineer');
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].url, `${ORIGIN}/careers/42`);
  assert.equal(jobs[0].location, 'Lindon, UT');
  assert.equal(jobs[0].isRemote, false);
  assert.equal(jobs[0].workplaceType, 'Onsite');
  assert.equal(jobs[1].location, 'Remote');
  assert.equal(jobs[1].isRemote, true);
  assert.equal(jobs[1].workplaceType, 'Remote');
  assert.equal(jobs[0].source, 'bamboohr');
});

test('parseBambooHRResponse: a legit empty board ({result:[]}) still reads as []', () => {
  assert.deepEqual(parseBambooHRResponse({ result: [] }, 'Acme', ORIGIN), []);
});

test('parseBambooHRResponse: a wrong-shape 200 throws instead of reading as an empty board', () => {
  assert.throws(() => parseBambooHRResponse({ jobs: [] }, 'Acme', ORIGIN), /BambooHR/);
  assert.throws(() => parseBambooHRResponse({ result: null }, 'Acme', ORIGIN), /BambooHR/);
  assert.throws(() => parseBambooHRResponse(null, 'Acme', ORIGIN), /BambooHR/);
  assert.throws(() => parseBambooHRResponse('<html>challenge</html>', 'Acme', ORIGIN), /BambooHR/);
});

test('fetchBambooHR: propagates the shape throw on a 200 with the wrong envelope', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ openings: [] }) });
  await assert.rejects(
    () => fetchBambooHR(`${ORIGIN}/careers/list`, { fetchImpl, company: { name: 'Acme' } }),
    /BambooHR/,
  );
});

test('fetchBambooHR: happy path parses the list without a probe request', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ result: [{ id: 9, jobOpeningName: 'QA Engineer' }] }),
    };
  };
  const jobs = await fetchBambooHR(`${ORIGIN}/careers/list`, { fetchImpl, company: { name: 'Acme' } });
  assert.equal(calls, 1, 'a healthy board needs exactly one request (no embed2 probe)');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, `${ORIGIN}/careers/9`);
});

test('assertBambooHRUrl: https + anchored <tenant>.bamboohr.com only', () => {
  assert.equal(assertBambooHRUrl(`${ORIGIN}/careers/list`), `${ORIGIN}/careers/list`);
  assert.throws(() => assertBambooHRUrl('https://acme.bamboohr.com.evil.com/careers/list'), /untrusted hostname/);
  assert.throws(() => assertBambooHRUrl('https://bamboohr.com/careers/list'), /untrusted hostname/);
  assert.throws(() => assertBambooHRUrl('http://acme.bamboohr.com/careers/list'), /HTTPS/);
  assert.throws(() => assertBambooHRUrl('not a url'), /invalid URL/);
  // the anchored host regex itself never matches look-alikes
  assert.ok(BAMBOOHR_HOST_RE.test('acme.bamboohr.com'));
  assert.ok(!BAMBOOHR_HOST_RE.test('acme.bamboohr.com.evil.com'));
});
