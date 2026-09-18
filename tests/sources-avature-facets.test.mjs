/**
 * A tenant's pinned filter facets must survive pagination (parent parity,
 * career-ops @ 6a9c84c).
 *
 * Avature is a per-tenant ATS whose search UI generates opaque facet params —
 * `?42386=[812132]` for a country filter, and so on. An operator who pins a
 * narrowed board in `portals.yml` (`api: https://acme.avature.net/careers/SearchJobs?42386=…`)
 * expects the scan to walk that narrowed board. `resolveSearch` rebuilt the URL
 * as `${origin}${path}` and dropped the query string outright, so every request
 * — the first one included — walked the tenant's entire global board instead:
 * more pages, more requests, and postings the operator had deliberately
 * filtered out.
 *
 * Our own pagination key always wins, so a stray same-named facet can never
 * collide with (or silently overwrite) the offset we control.
 *
 * CI-isolated: fake fetchImpl, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAvature } from '../server/lib/sources/avature.mjs';

// Avature paginates in steps of 6; a page with fewer rows ends the walk.
const PAGE_SIZE = 6;

/** Captures every requested URL and answers with one parseable row, then empty. */
function transport(pages = 1) {
  const urls = [];
  // Same markup shape the main avature suite uses, so a row actually parses and
  // the pagination loop advances instead of stopping on page 0. Each page must
  // carry a FULL page of distinct rows: the loop also stops on a short page.
  const card = (n) => `
  <article class="article article--result">
    <a class="link" href="/careers/JobDetail/Engineer-${n}/${n}">Engineer ${n}</a>
    <span class="list-item-location">Austin, TX</span>
    <div class="subtitle">Posted 02-May-2026</div>
  </article>`;
  const page = (i) => `<!doctype html><html><body><div class="results">${
    Array.from({ length: PAGE_SIZE }, (_, k) => card(i * PAGE_SIZE + k)).join('\n')
  }</div></body></html>`;
  const impl = async (url) => {
    urls.push(url);
    const i = urls.length - 1;
    return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => (i < pages ? page(i) : '') };
  };
  return { impl, urls };
}

/** The query params of a captured URL, as a plain object. */
const params = (url) => Object.fromEntries(new URL(url).searchParams.entries());

test('a pinned facet is carried onto every paginated request', async () => {
  const { impl, urls } = transport(3);
  await fetchAvature('https://acme.avature.net/careers/SearchJobs?42386=%5B812132%5D&country=de', {
    fetchImpl: impl, company: { name: 'Acme' },
  });
  assert.ok(urls.length >= 3, `expected several pages, got ${urls.length}`);
  for (const u of urls) {
    const p = params(u);
    assert.equal(p['42386'], '[812132]', `facet lost on ${u}`);
    assert.equal(p.country, 'de', `facet lost on ${u}`);
    assert.ok('jobOffset' in p, `pagination key missing on ${u}`);
  }
  // The offset still advances in its own steps.
  assert.notEqual(params(urls[0]).jobOffset, params(urls[1]).jobOffset);
});

test('an entry with no facets is unchanged — just the offset', async () => {
  const { impl, urls } = transport(1);
  await fetchAvature('https://acme.avature.net/careers/SearchJobs', { fetchImpl: impl, company: { name: 'Acme' } });
  assert.deepEqual(Object.keys(params(urls[0])), ['jobOffset']);
});

test("our pagination key wins over a same-named facet the entry pinned", async () => {
  const { impl, urls } = transport(2);
  await fetchAvature('https://acme.avature.net/careers/SearchJobs?jobOffset=999&region=emea', {
    fetchImpl: impl, company: { name: 'Acme' },
  });
  for (const u of urls) {
    const p = params(u);
    assert.notEqual(p.jobOffset, '999', 'a stray facet must not hijack pagination');
    assert.equal(p.region, 'emea', 'the genuine facet still survives');
    // Exactly one offset key reaches the wire — two would be ambiguous.
    assert.equal(new URL(u).searchParams.getAll('jobOffset').length, 1);
  }
});

test('a branded locale path keeps both its path and its facets', async () => {
  const { impl, urls } = transport(1);
  await fetchAvature('https://acme.avature.net/en_US/searchjobs/SearchJobs?field=eng', {
    fetchImpl: impl, company: { name: 'Acme' },
  });
  const u = new URL(urls[0]);
  assert.equal(u.pathname, '/en_US/searchjobs/SearchJobs');
  assert.equal(u.searchParams.get('field'), 'eng');
});
