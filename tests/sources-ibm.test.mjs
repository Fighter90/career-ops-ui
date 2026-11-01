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
  resolveMaxPages,
  API_URL,
  PAGE_DELAY_MS,
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

// ── assertIbmApiUrl + fetchIbm ──────────────────────────────────────────────

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
    /untrusted hostname/,
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

// ── pagination rework: max_pages + pacing + retry (#6273) ───────────────────

const mkFullPage = (from) => Array.from(
  { length: 30 },
  (_, i) => mkHit({ _id: `${from + i}`, url: `https://www.ibm.com/careers/job/${from + i}` }),
);

test('resolveMaxPages: default 20, entry override, 300 ceiling, junk ignored (#6273)', () => {
  assert.equal(resolveMaxPages({}), 20);
  assert.equal(resolveMaxPages({ max_pages: 3 }), 3);
  assert.equal(resolveMaxPages({ max_pages: 5000 }), 300);
  assert.equal(resolveMaxPages({ max_pages: -1 }), 20);
  assert.equal(resolveMaxPages({ max_pages: '7' }), 20);
  assert.equal(resolveMaxPages(null), 20);
});

test('fetchIbm: paces between pages, never before the first (#6273)', async () => {
  const sleeps = [];
  const impl = async () => ({ ok: true, json: async () => ({ hits: { hits: mkFullPage(0) } }) });
  await fetchIbm(API_URL, { fetchImpl: impl, company: { max_pages: 2 }, sleep: async (ms) => sleeps.push(ms) });
  assert.deepEqual(sleeps, [PAGE_DELAY_MS]); // one pause for 2 pages — after page 1
});

test('fetchIbm: a full board stops at max_pages and warns to raise it (#6273)', async () => {
  const lines = [];
  const orig = console.error;
  console.error = (...a) => { lines.push(a.join(' ')); };
  try {
    const calls = { n: 0 };
    const impl = async () => { calls.n += 1; return { ok: true, json: async () => ({ hits: { hits: mkFullPage(calls.n * 30) } }) }; };
    const jobs = await fetchIbm(API_URL, { fetchImpl: impl, company: { name: 'IBM', max_pages: 3 } });
    assert.equal(calls.n, 3);
    assert.equal(jobs.length, 90);
    assert.ok(lines.some((l) => l.includes('raise max_pages')), lines.join('\n'));
  } finally { console.error = orig; }
});

test('fetchIbm: a short page at the cap is a complete board, not a truncation (#6273)', async () => {
  const lines = [];
  const orig = console.error;
  console.error = (...a) => { lines.push(a.join(' ')); };
  try {
    let call = 0;
    const impl = async () => {
      call += 1;
      const hits = call === 1 ? mkFullPage(0) : [mkHit({ _id: 'x', url: 'https://www.ibm.com/careers/job/x' })];
      return { ok: true, json: async () => ({ hits: { hits } }) };
    };
    const jobs = await fetchIbm(API_URL, { fetchImpl: impl, company: { max_pages: 2 }, sleep: async () => {} });
    assert.equal(call, 2);
    assert.equal(jobs.length, 31);
    assert.equal(lines.length, 0);
  } finally { console.error = orig; }
});

test('fetchIbm: a transient 503 is retried, not fatal (#6273)', async () => {
  let calls = 0;
  const impl = async () => {
    calls += 1;
    if (calls === 1) throw Object.assign(new Error('HTTP 503'), { status: 503 });
    return { ok: true, json: async () => ({ hits: { hits: mkFullPage(0) } }) };
  };
  const jobs = await fetchIbm(API_URL, { fetchImpl: impl, company: { max_pages: 1 } });
  assert.equal(calls, 2);
  assert.equal(jobs.length, 30);
});

test('fetchIbm: a failed later page keeps earlier pages and warns without blaming max_pages (#6273)', async () => {
  const lines = [];
  const orig = console.error;
  console.error = (...a) => { lines.push(a.join(' ')); };
  try {
    let calls = 0;
    const impl = async () => {
      calls += 1;
      if (calls === 2) throw Object.assign(new Error('HTTP 404'), { status: 404 });
      return { ok: true, json: async () => ({ hits: { hits: mkFullPage(0) } }) };
    };
    const jobs = await fetchIbm(API_URL, { fetchImpl: impl, company: { name: 'IBM', max_pages: 5 }, sleep: async () => {} });
    assert.equal(jobs.length, 30);
    assert.ok(lines.some((l) => l.includes('truncated at page 2')), lines.join('\n'));
    assert.ok(!lines.some((l) => l.includes('raise max_pages')));
  } finally { console.error = orig; }
});

test('fetchIbm: a failed first page throws instead of returning [] (#6273)', async () => {
  const impl = async () => { throw Object.assign(new Error('HTTP 404'), { status: 404 }); };
  await assert.rejects(() => fetchIbm(API_URL, { fetchImpl: impl }));
});
