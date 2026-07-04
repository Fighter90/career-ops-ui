/**
 * Dassault Systèmes source + adapter (parent career-ops providers/dassault.mjs
 * parity, #1498). Public Exalead card-search XML, single-company /
 * provider-selected, host-pinned to www.3ds.com. CI-isolated (fake fetchImpl).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHits, fetchDassault, assertDassaultUrl, buildUrl, FEED_BASE, ORIGIN, meta,
} from '../server/lib/sources/dassault.mjs';
import { dassaultAdapter } from '../server/lib/portals/adapters/dassault.mjs';

// One <Hit> block in the Exalead shape the parser consumes.
const hit = (over = {}) => {
  const f = {
    content_title: 'Senior R&amp;D Engineer',
    content_cta_1_url: 'https://www.3ds.com/careers/jobs/senior-rd-engineer-12345',
    content_categories: 'Category/Engineering Country/France City/V&#233;lizy-Villacoublay',
    content_start_datetime: '2026/07/03 18:22:13',
    card_id: 'card-12345',
    ...over,
  };
  const metas = Object.entries(f)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `<Meta name="${k}"><MetaString name="value">${v}</MetaString></Meta>`)
    .join('');
  return `<Hit>${metas}</Hit>`;
};
const page = (hits) => `<Root>${hits.join('')}</Root>`;

// Fake fetch keyed on the `start` query param → page offset.
const xmlFetch = (byStart) => async (url) => {
  const start = Number((String(url).match(/[?&]start=(\d+)/) || [])[1] || 0);
  const hits = byStart[start] || [];
  return { ok: true, status: 200, text: async () => page(hits) };
};

test('meta + adapter surface: provider- and host-selected, host-pinned', () => {
  assert.equal(meta.value, 'dassault');
  assert.equal(meta.region, 'en');
  assert.equal(dassaultAdapter.id, 'dassault');

  assert.ok(dassaultAdapter.matches({ provider: 'dassault' }));
  assert.ok(dassaultAdapter.matches({ careers_url: 'https://www.3ds.com/careers/jobs' }));
  assert.ok(dassaultAdapter.matches({ api: 'https://3ds.com/apisearch/card_search_api' }));
  assert.ok(!dassaultAdapter.matches({ careers_url: 'https://3ds.com.evil.com/x' }));
  assert.ok(!dassaultAdapter.matches({ careers_url: 'https://boards.greenhouse.io/x' }));
  assert.equal(dassaultAdapter.buildEndpoint(), FEED_BASE);
});

test('buildUrl carries both refinements + the career/lang facets', () => {
  const u = new URL(buildUrl(20));
  assert.equal(u.origin + u.pathname, FEED_BASE);
  assert.equal(u.searchParams.get('lang'), 'en');
  assert.equal(u.searchParams.get('start'), '20');
  const refines = u.searchParams.getAll('r');
  assert.ok(refines.includes('f/card_content_type/career'));
  assert.ok(refines.some((r) => r.includes('cards language/en')));
});

test('assertDassaultUrl rejects non-3ds hosts + non-https (SSRF guard)', () => {
  assert.equal(assertDassaultUrl(FEED_BASE), FEED_BASE);
  assert.throws(() => assertDassaultUrl('https://evil.com/apisearch/card_search_api'), /untrusted hostname/);
  assert.throws(() => assertDassaultUrl('http://www.3ds.com/apisearch/card_search_api'), /HTTPS/);
  assert.throws(() => assertDassaultUrl('not a url'), /invalid URL/);
});

test('parseHits: decodes entities, extracts city/country + ISO date, keeps only 3ds hosts', () => {
  const jobs = parseHits(page([hit()]));
  assert.equal(jobs.length, 1);
  const j = jobs[0];
  assert.equal(j.title, 'Senior R&D Engineer');
  assert.equal(j.company, 'Dassault Systèmes');
  assert.equal(j.location, 'Vélizy-Villacoublay'); // City wins over Country
  assert.equal(j.date, '2026-07-03');
  assert.equal(j.source, 'dassault');
  assert.equal(j.isRemote, false);
  assert.ok(j.id.startsWith('dassault-'));
});

test('parseHits drops postings whose public URL is not on *.3ds.com', () => {
  const foreign = hit({ content_cta_1_url: 'https://dejobs.org/x/12', card_id: 'card-foreign' });
  const jobs = parseHits(page([hit(), foreign]));
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, `dassault-https://www.3ds.com/careers/jobs/senior-rd-engineer-12345`);
});

test('parseHits skips hits without a title or url', () => {
  assert.equal(parseHits(page([hit({ content_title: '' })])).length, 0);
  assert.equal(parseHits(page([hit({ content_cta_1_url: '' })])).length, 0);
  assert.equal(parseHits('not xml at all').length, 0);
  assert.equal(parseHits(null).length, 0);
});

test('fetchDassault paginates via start, dedups by card_id across pages, stops on empty page', async () => {
  const a = hit({ content_cta_1_url: 'https://www.3ds.com/careers/jobs/a', card_id: 'A' });
  const b = hit({ content_cta_1_url: 'https://www.3ds.com/careers/jobs/b', card_id: 'B' });
  const dupA = hit({ content_cta_1_url: 'https://www.3ds.com/careers/jobs/a', card_id: 'A' });
  const fetchImpl = xmlFetch({ 0: [a, b], 10: [dupA], 20: [] });
  const jobs = await fetchDassault(FEED_BASE, { fetchImpl });
  // page 0 yields A,B; page 10 is all-dup (fresh===0) → loop stops. B and A unique.
  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs.map((j) => j.id).sort(), ['dassault-https://www.3ds.com/careers/jobs/a', 'dassault-https://www.3ds.com/careers/jobs/b']);
  // internal dedup key is stripped from the returned objects
  assert.ok(!('_id' in jobs[0]));
});

test('fetchDassault honours a company name override for the company field', async () => {
  const fetchImpl = xmlFetch({ 0: [hit()], 10: [] });
  const jobs = await fetchDassault(FEED_BASE, { fetchImpl, company: { name: '3DS France' } });
  assert.equal(jobs[0].company, '3DS France');
});

test('fetchDassault refuses a repointed host before any fetch', async () => {
  await assert.rejects(
    () => fetchDassault('https://evil.com/apisearch/card_search_api', { fetchImpl: xmlFetch({}) }),
    /untrusted hostname/,
  );
});

test('ORIGIN is the pinned 3ds host', () => {
  assert.equal(ORIGIN, 'https://www.3ds.com');
});
