/**
 * IBM careers source — CI-isolated tests (fake fetchImpl, no network).
 * v1.242.0: the api: override is host-pinned (https + *.ibm.com) and job URLs
 * must be https: (the API served http: links that the scanner then fetched).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchIbm,
  parseIbmResponse,
  buildPostFilter,
  API_URL,
  meta,
} from '../server/lib/sources/ibm.mjs';

/** One Elasticsearch hit. */
const mkHit = (overrides = {}) => ({
  _source: {
    _id: 'IBM_1',
    title: 'Software Engineer',
    url: 'https://www.ibm.com/careers/job/1',
    field_keyword_19: 'Berlin, Germany',
    field_keyword_17: 'Hybrid',
    ...overrides,
  },
});

const makeTransport = (hits, { full = false } = {}) => async () => ({
  ok: true,
  json: async () => ({ hits: { hits, total: hits.length } }),
});

// ---------------------------------------------------------------------------
// parseIbmResponse
// ---------------------------------------------------------------------------

test('parseIbmResponse: maps hits into the 12-field shape', () => {
  const jobs = parseIbmResponse({ hits: { hits: [mkHit()] } });
  assert.equal(jobs.length, 1);
  const j = jobs[0];
  assert.ok(j.id.startsWith('ibm-'));
  assert.equal(j.title, 'Software Engineer');
  assert.equal(j.company, 'IBM');
  assert.equal(j.url, 'https://www.ibm.com/careers/job/1');
  assert.equal(j.location, 'Berlin, Germany · Hybrid');
  assert.equal(j.workplaceType, 'Hybrid');
  assert.equal(j.isRemote, false);
  assert.equal(j.source, 'ibm');
});

test('parseIbmResponse: throws on a wrong-shape 200 (no silent empty board)', () => {
  assert.throws(() => parseIbmResponse({ hits: {} }), /expected hits\.hits\[\]/);
  assert.throws(() => parseIbmResponse({}), /expected hits\.hits\[\]/);
  assert.throws(() => parseIbmResponse(null), /expected hits\.hits\[\]/);
});

test('parseIbmResponse: only https: job URLs survive (http:/javascript: dropped)', () => {
  const jobs = parseIbmResponse({
    hits: { hits: [
      mkHit({ url: 'http://www.ibm.com/careers/job/http' }), // insecure — dropped
      mkHit({ url: 'javascript:alert(1)' }),                 // scheme abuse — dropped
      mkHit({ url: '  https://www.ibm.com/careers/job/ok ' }), // whitespace tolerated
    ] },
  });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://www.ibm.com/careers/job/ok');
});

test('parseIbmResponse: remote detection from the work-mode and location facets', () => {
  const jobs = parseIbmResponse({ hits: { hits: [
    mkHit({ field_keyword_17: 'Remote', field_keyword_19: '' }),
    mkHit({ field_keyword_17: 'Onsite', field_keyword_19: 'Home Office Calgary' }),
    mkHit({ field_keyword_17: 'Onsite', field_keyword_19: 'New York' }),
  ] } });
  assert.equal(jobs[0].isRemote, true);
  assert.equal(jobs[1].isRemote, true);
  assert.equal(jobs[2].isRemote, false);
});

// ---------------------------------------------------------------------------
// buildPostFilter
// ---------------------------------------------------------------------------

test('buildPostFilter: sanitized category/country terms', () => {
  const pf = buildPostFilter({ country: ' Germany ', categories: [' SWE ', '', 42, null] });
  assert.deepEqual(pf, { bool: { must: [
    { bool: { should: [{ term: { field_keyword_08: 'SWE' } }] } },
    { term: { field_keyword_05: 'Germany' } },
  ] } });
  assert.deepEqual(buildPostFilter({}), { bool: { must: [] } });
});

// ---------------------------------------------------------------------------
// assertIbmApiUrl + fetchIbm
// ---------------------------------------------------------------------------

test('api override must be https on an ibm.com host; the default passes', async () => {
  await assert.rejects(
    () => fetchIbm('http://www-api.ibm.com/search/api/v2', { fetchImpl: async () => { throw new Error('must not fetch'); } }),
    /HTTPS/,
  );
  await assert.rejects(
    () => fetchIbm('https://evil.com/search/api/v2', { fetchImpl: async () => { throw new Error('must not fetch'); } }),
    (err) => { assert.match(err.message, /^ibm: untrusted hostname/); return err.message.includes('evil.com'); },
  );
  await assert.rejects(
    () => fetchIbm('not a url', { fetchImpl: async () => { throw new Error('must not fetch'); } }),
    /invalid/,
  );
  // https + ibm.com subdomain accepted (reaches the fake transport)
  const impl = async () => ({ ok: true, json: async () => ({ hits: { hits: [mkHit()] } }) });
  const jobs = await fetchIbm('https://www-api.ibm.com/search/api/v2', { fetchImpl: impl });
  assert.equal(jobs.length, 1);
});

test('fetchIbm: stops after a short page, POSTs the documented body', async () => {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, opts });
    const body = JSON.parse(opts.body);
    const hits = body.from === 0
      ? Array.from({ length: 30 }, (_, i) => mkHit({ _id: String(i), url: `https://www.ibm.com/careers/job/${i}` }))
      : [mkHit({ _id: 'x', url: 'https://www.ibm.com/careers/job/x' })];
    return { ok: true, json: async () => ({ hits: { hits } }) };
  };
  const jobs = await fetchIbm(API_URL, { fetchImpl: impl, company: { ibm: { country: 'Germany' } } });
  assert.equal(calls.length, 2); // full page → short page → stop
  assert.equal(jobs.length, 31);
  const first = calls[0];
  assert.equal(first.opts.method, 'POST');
  const body = JSON.parse(first.opts.body);
  assert.equal(body.size, 30);
  assert.equal(body.from, 0);
  assert.equal(body.lang, 'zz');
  assert.deepEqual(body.post_filter, { bool: { must: [{ term: { field_keyword_05: 'Germany' } }] } });
});

test('fetchIbm: a non-ok response throws with .status', async () => {
  const impl = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => fetchIbm(API_URL, { fetchImpl: impl }), /503|HTTP/);
});

// ---------------------------------------------------------------------------
// meta
// ---------------------------------------------------------------------------

test('meta: value, label, region', () => {
  assert.deepEqual(meta, { value: 'ibm', label: 'IBM', region: 'en' });
});
