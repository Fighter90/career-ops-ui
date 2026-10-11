/**
 * PageUp source (v1.248.8 parent parity) — CI-isolated suite.
 * Ported from the parent's pageup provider cases: parsing invariants
 * (search-results table only, commented-out duplicates, cross-tenant links,
 * id-only URL rebuild, more-link), stop rules (no-fresh, short page, cap),
 * and config resolution (api precedence, off-origin rejected).
 * No network — parsePageupListing is pure; fetchPageup runs on a fake fetchImpl.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePageupListing,
  resolveConfig,
  resolveMaxPages,
  fetchPageup,
  assertPageupUrl,
  PAGE_SIZE,
} from '../server/lib/sources/pageup.mjs';

const CFG = { tenant: '932', site: 'cw', lang: 'en' };

const listing = (anchors, opts = {}, idOffset = 0) => {
  const rows = anchors.map((title, i) =>
    `<tr><td><a class="job-link" href="/932/cw/en/job/${100 + idOffset + i}/${title.toLowerCase().replace(/\s+/g, '-')}">${title}</a></td></tr>`);
  const more = opts.more ? '<a class="more-link" href="/932/cw/en/listing/?page=2">More Jobs</a>' : '';
  return `<html><body><table><tbody id="search-results-content">${rows.join('')}${opts.extra ?? ''}</tbody></table>${more}</body></html>`;
};

test('pageup: parse reads the search-results table and rebuilds id-only URLs', () => {
  const r = parsePageupListing(listing(['Senior Engineer', 'Data Analyst']), CFG, 'Acme');
  assert.equal(r.valid, true);
  assert.equal(r.jobs.length, 2);
  assert.equal(r.jobs[0].title, 'Senior Engineer');
  assert.equal(r.jobs[0].url, 'https://careers.pageuppeople.com/932/cw/en/job/100');
  assert.equal(r.jobs[0].company, 'Acme');
  assert.equal(r.jobs[0].location, '');
});

test('pageup: no search-results table → valid:false (login/error page, not an empty board)', () => {
  const r = parsePageupListing('<html><body>Please sign in</body></html>', CFG, 'Acme');
  assert.equal(r.valid, false);
  assert.equal(r.reason, 'no-table');
});

test('pageup: an empty well-formed table is a valid empty board', () => {
  const r = parsePageupListing(
    '<html><body><tbody id="search-results-content"><tr><td>No jobs found</td></tr></tbody></body></html>', CFG, 'Acme');
  assert.equal(r.valid, true);
  assert.equal(r.jobs.length, 0);
});

test('pageup: posting links but none parsed → no-jobs-parsed (markup moved)', () => {
  const html = '<html><body><tbody id="search-results-content">'
    + '<a class="job-link" href="/932/cw/en/job/42"></a>'
    + '</tbody></body></html>';
  const r = parsePageupListing(html, CFG, 'Acme');
  assert.equal(r.valid, false);
  assert.equal(r.reason, 'no-jobs-parsed');
});

test('pageup: commented-out duplicate rows are not read twice', () => {
  const extra = '<!--<tr><td><a class="job-link" href="/932/cw/en/job/42/senior-engineer">Senior Engineer</a></td></tr>-->';
  const r = parsePageupListing(listing(['Senior Engineer'], { extra }), CFG, 'Acme');
  assert.equal(r.valid, true);
  assert.equal(r.jobs.length, 1, 'the commented copy is invisible');
});

test('pageup: cross-host and cross-tenant posting links are dropped', () => {
  const extra = '<a class="job-link" href="https://evil.example/932/cw/en/job/7/x">X</a>'
    + '<a class="job-link" href="/999/cw/en/job/8/y">Y</a>';
  const r = parsePageupListing(listing(['Real'], { extra }), CFG, 'Acme');
  assert.equal(r.valid, true);
  assert.equal(r.jobs.length, 1);
  assert.equal(r.jobs[0].title, 'Real');
});

test('pageup: more-link sets hasMore', () => {
  const anchors = Array.from({ length: PAGE_SIZE }, (_, i) => `Role ${i}`);
  const r = parsePageupListing(listing(anchors, { more: true }), CFG, 'Acme');
  assert.equal(r.valid, true);
  assert.equal(r.hasMore, true);
});

test('pageup: config resolution — api wins over careers_url, off-origin rejected', () => {
  assert.deepEqual(
    resolveConfig({ api: 'https://careers.pageuppeople.com/1/cw/en/x', careers_url: 'https://careers.pageuppeople.com/2/cw/en/y' }),
    { tenant: '1', site: 'cw', lang: 'en' });
  assert.equal(resolveConfig({ careers_url: 'https://jobs.hku.hk/cw/en/x' }), null, 'a branded domain is not claimed');
  assert.equal(resolveConfig({}), null);
});

test('pageup: max_pages resolution — positive integer, capped', () => {
  assert.equal(resolveMaxPages({}), 20);
  assert.equal(resolveMaxPages({ max_pages: 5 }), 5);
  assert.equal(resolveMaxPages({ max_pages: 9999 }), 200);
  assert.equal(resolveMaxPages({ max_pages: -1 }), 20);
});

test('pageup: assertPageupUrl — HTTPS vendor host only', () => {
  assertPageupUrl('https://careers.pageuppeople.com/1/cw/en/listing/');
  assert.throws(() => assertPageupUrl('http://careers.pageuppeople.com/1/cw/en/listing/'));
  assert.throws(() => assertPageupUrl('https://jobs.hku.hk/cw/en/listing/'));
});

test('pageup: fetchPageup — stops when a page yields nothing fresh', async () => {
  const page = listing(['Senior Engineer'], { more: true });
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: true, status: 200, text: async () => page }; };
  const jobs = await fetchPageup('https://careers.pageuppeople.com/932/cw/en/listing/', { fetchImpl, delayMs: 0 });
  assert.equal(calls, 2, 'page 1 fresh, page 2 no-fresh → stop');
  assert.equal(jobs.length, 1);
  assert.equal(jobs.pageupTruncated, undefined);
});

test('pageup: fetchPageup — the page cap tags the result array (partial board)', async () => {
  const pages = [0, PAGE_SIZE].map((off) => listing(Array.from({ length: PAGE_SIZE }, (_, i) => `Role ${off + i}`), { more: true }, off));
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: true, status: 200, text: async () => pages[calls - 1] }; };
  const jobs = await fetchPageup('https://careers.pageuppeople.com/932/cw/en/listing/', {
    fetchImpl, delayMs: 0, company: { name: 'Acme', max_pages: 2 },
  });
  assert.equal(calls, 2);
  assert.equal(jobs.length, PAGE_SIZE * 2);
  assert.equal(jobs.pageupTruncated, true);
});

test('pageup: fetchPageup — the first page failing means there is no board', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404, text: async () => '' });
  await assert.rejects(
    () => fetchPageup('https://careers.pageuppeople.com/932/cw/en/listing/', { fetchImpl, delayMs: 0 }),
    /HTTP 404/);
});

test('pageup: fetchPageup — the first page unrecognised (challenge page) rejects with the reason', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => '<html><body>Challenge</body></html>' });
  await assert.rejects(
    () => fetchPageup('https://careers.pageuppeople.com/932/cw/en/listing/', { fetchImpl, delayMs: 0 }),
    /no search-results table/);
});

// v1.248.8 — coverage: the defensive branches (page cap reached via fetch
// errors, abort, invalid URL, the adapter's off-host override fallback).
import { pageupAdapter } from '../server/lib/portals/adapters/pageup.mjs';

test('pageup: assertPageupUrl rejects an unparsable URL', () => {
  assert.throws(() => assertPageupUrl('not a url'), /invalid URL/);
});

test('pageup: fetchPageup — a later page failing keeps the collected jobs, no truncation flag', async () => {
  const good = listing(['Senior Engineer'], { more: true });
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return { ok: true, status: 200, text: async () => good };
    return { ok: false, status: 503, text: async () => '' };
  };
  const jobs = await fetchPageup('https://careers.pageuppeople.com/932/cw/en/listing/', { fetchImpl, delayMs: 0 });
  assert.equal(calls, 2);
  assert.equal(jobs.length, 1, 'page-1 jobs kept');
  assert.equal(jobs.pageupTruncated, undefined, 'an error stop is not a cap truncation');
});

test('pageup: fetchPageup — an aborted signal stops the sweep', async () => {
  const controller = new AbortController();
  const good = listing(['Senior Engineer'], { more: true });
  let calls = 0;
  const fetchImpl = async (url, { signal } = {}) => {
    calls += 1;
    if (calls === 1) {
      // Abort between page 1 and page 2 — the loop's top-of-page check stops
      // the sweep with page-1 jobs intact.
      queueMicrotask(() => controller.abort());
      return { ok: true, status: 200, text: async () => good };
    }
    if (signal?.aborted) { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }
    return { ok: true, status: 200, text: async () => good };
  };
  const jobs = await fetchPageup('https://careers.pageuppeople.com/932/cw/en/listing/', {
    fetchImpl, signal: controller.signal, delayMs: 0,
  });
  assert.equal(calls, 1, 'the loop stopped at the top-of-page check — page 2 is never fetched');
  assert.equal(jobs.length, 1, 'page-1 jobs survive the abort');
});

test('pageup adapter: buildEndpoint honours an on-host override and falls back off-host', () => {
  assert.equal(
    pageupAdapter.buildEndpoint({ pageup: 'https://careers.pageuppeople.com/5/cw/en/all' }),
    'https://careers.pageuppeople.com/5/cw/en/all');
  assert.equal(
    pageupAdapter.buildEndpoint({ pageup: 'https://jobs.hku.hk/cw/en/all', careers_url: 'https://careers.pageuppeople.com/6/cw/en/all' }),
    'https://careers.pageuppeople.com/6/cw/en/all',
    'an off-host override falls back to the on-host careers_url');
  assert.equal(
    pageupAdapter.buildEndpoint({ pageup: 'https://jobs.hku.hk/cw/en/all' }),
    'https://careers.pageuppeople.com',
    'nothing valid → the ORIGIN (fetch rejects with the tenant-URL message)');
});

test('pageup: fetchPageup — an unrecognised later page keeps the collected jobs', async () => {
  const good = listing(['Senior Engineer'], { more: true });
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, status: 200, text: async () => (calls === 1 ? good : '<html><body>Challenge</body></html>') };
  };
  const jobs = await fetchPageup('https://careers.pageuppeople.com/932/cw/en/listing/', { fetchImpl, delayMs: 0 });
  assert.equal(calls, 2);
  assert.equal(jobs.length, 1, 'page-1 jobs kept');
});

test('pageup: fetchPageup — a later page throwing (socket) keeps the collected jobs', async () => {
  const good = listing(['Remote Senior Engineer'], { more: true });
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return { ok: true, status: 200, text: async () => good };
    const e = new Error('socket hang up');
    throw e;
  };
  const jobs = await fetchPageup('https://careers.pageuppeople.com/932/cw/en/listing/', { fetchImpl, delayMs: 0 });
  assert.equal(calls, 2);
  assert.equal(jobs.length, 1, 'page-1 jobs kept through a transport error');
});

test('pageup: isRemote follows the title', async () => {
  const jobs = await fetchPageup('https://careers.pageuppeople.com/932/cw/en/listing/', {
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => listing(['Remote Data Engineer'], { }) }),
    delayMs: 0,
  });
  assert.equal(jobs[0].isRemote, true);
  const off = await fetchPageup('https://careers.pageuppeople.com/932/cw/en/listing/', {
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => listing(['Data Engineer']) }),
    delayMs: 0,
  });
  assert.equal(off[0].isRemote, false);
});

// v1.248.8 — parse edge branches: unterminated comment/tbody/anchor pairing,
// and a tail without a more-link.
test('pageup: an unterminated comment swallows the rest (parent parity)', () => {
  // The parent's stripComments documents this: an unterminated comment
  // returns everything before it. The page then reads as an empty, valid
  // board rather than half-parsed rows.
  const html = '<html><body><tbody id="search-results-content">'
    + '<!--<tr><td>stale</td></tr>'
    + '<tr><td><a class="job-link" href="/932/cw/en/job/42/real">Real</a></td></tr>'
    + '</tbody></body></html>';
  const r = parsePageupListing(html, CFG, 'Acme');
  assert.equal(r.valid, true);
  assert.equal(r.jobs.length, 0);
});

test('pageup: an unterminated tbody reads to the end of the document', () => {
  const html = '<html><body><tbody id="search-results-content">'
    + '<tr><td><a class="job-link" href="/932/cw/en/job/42/real">Real</a></td></tr>';
  const r = parsePageupListing(html, CFG, 'Acme');
  assert.equal(r.valid, true);
  assert.equal(r.jobs.length, 1);
});

test('pageup: an anchor closing after the next opens is dropped (title pairing)', () => {
  const html = '<html><body><tbody id="search-results-content">'
    + '<a class="job-link" href="/932/cw/en/job/42/never-closed">Never'
    + '<a class="job-link" href="/932/cw/en/job/43/next">Next</a>'
    + '</tbody></body></html>';
  const r = parsePageupListing(html, CFG, 'Acme');
  assert.equal(r.valid, true);
  assert.equal(r.jobs.length, 1);
  assert.equal(r.jobs[0].title, 'Next');
});

test('pageup: no more-link in the tail → hasMore false', () => {
  const r = parsePageupListing(listing(['Senior Engineer']), CFG, 'Acme');
  assert.equal(r.valid, true);
  assert.equal(r.hasMore, false);
});

test('pageup: data-href is not read as href', () => {
  const html = '<html><body><tbody id="search-results-content">'
    + '<tr><td><a class="job-link" data-href="/932/cw/en/job/99/decoy" href="/932/cw/en/job/42/real">Real</a></td></tr>'
    + '</tbody></body></html>';
  const r = parsePageupListing(html, CFG, 'Acme');
  assert.equal(r.jobs[0].url, 'https://careers.pageuppeople.com/932/cw/en/job/42');
});
