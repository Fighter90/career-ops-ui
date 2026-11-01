// tests/sources-apple.test.mjs — Apple source contract (parent #5496 + #6196).
// CI-isolated: no network — the page fetch is injected via fetchImpl; sleep via
// the opts.sleep seam.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchApple,
  parseSearchPage,
  parseHydration,
  assertAppleUrl,
  resolveMaxPages,
  meta,
} from '../server/lib/sources/apple.mjs';
import { appleAdapter } from '../server/lib/portals/adapters/apple.mjs';

// One page of Apple's SSR hydration blob, built the way the live page embeds
// it: a JSON string literal inside JSON.parse("...").
const hydration = (rows, totalRecords) => {
  const blob = JSON.stringify({ loaderData: { search: { searchResults: rows, totalRecords } } });
  return `<!doctype html><script>window.__staticRouterHydrationData = JSON.parse(${JSON.stringify(blob)});</script>`;
};
const row = (id, title) => ({
  id,
  postingTitle: title,
  transformedPostingTitle: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  locations: [{ name: 'Cupertino, California, United States' }],
  postDateInGMT: '2026-09-10T00:00:00Z',
  team: { teamCode: 'OPMFG-BPM' },
});

/** Recording fetchImpl: every request url+opts is kept for assertions. */
const recording = (respond) => {
  const calls = [];
  const impl = async (url, opts = {}) => {
    const call = { url, opts, n: calls.length };
    calls.push(call);
    return respond(call);
  };
  impl.calls = calls;
  return impl;
};
const ok = (html) => ({ ok: true, status: 200, text: async () => html });
const httpErr = (status) => ({ ok: false, status, text: async () => '' });
const ENTRY = { name: 'Apple', careers_url: 'https://jobs.apple.com/en-us/search', apple: { queries: ['corporate strategy'], teams: [] } };
const NO_SLEEP = async () => {};

test('meta + adapter: apple / Apple / en; detect is exact-host, hijacks rejected', () => {
  assert.deepEqual(meta, { value: 'apple', label: 'Apple', region: 'en' });
  assert.equal(appleAdapter.matches({ provider: 'apple' }), true);
  assert.equal(appleAdapter.matches({ careers_url: 'https://jobs.apple.com/en-us/search' }), true);
  assert.equal(appleAdapter.matches({ careers_url: 'https://evil.example.com/jobs.apple.com/careers' }), false);
  assert.equal(appleAdapter.matches({ careers_url: 'https://jobs.apple.com.evil.example.com/careers' }), false);
  assert.equal(appleAdapter.matches({ careers_url: 'https://example.com/careers' }), false);
  assert.equal(appleAdapter.matches({ careers_url: null }), false);
  assert.equal(appleAdapter.matches({ careers_url: 7 }), false);
  assert.equal(appleAdapter.buildEndpoint({ careers_url: 'https://jobs.apple.com/en-us/search' }), 'https://jobs.apple.com/en-us/search');
  assert.equal(appleAdapter.buildEndpoint({ careers_url: 'https://example.com/x' }), null);
  assert.equal(appleAdapter.buildEndpoint({}), null);
});

test('assertAppleUrl: pins https + the exact host', () => {
  assert.throws(() => assertAppleUrl('http://jobs.apple.com/en-us/search'), /HTTPS/);
  assert.throws(() => assertAppleUrl('https://jobs.apple.com.evil.example.com/'), /untrusted hostname/);
  assert.throws(() => assertAppleUrl('not a url'), /invalid/);
});

test('fetchApple: maps title/url/company/location/date from the hydration blob; redirect:error on every request', async () => {
  const impl = recording(() => ok(hydration([row('200613455', 'Business Process Re-Engineering Manager')], 1)));
  const jobs = await fetchApple(ENTRY.careers_url, { fetchImpl: impl, company: ENTRY, sleep: NO_SLEEP });
  assert.equal(jobs.length, 1);
  const j = jobs[0];
  assert.equal(j.id, 'apple-200613455');
  assert.equal(j.title, 'Business Process Re-Engineering Manager');
  assert.equal(j.url, 'https://jobs.apple.com/en-us/details/200613455/business-process-re-engineering-manager?team=OPMFG-BPM');
  assert.equal(j.company, 'Apple');
  assert.equal(j.location, 'Cupertino, California, United States');
  assert.equal(j.date, '2026-09-10'); // ISO date for the scanner shape
  assert.equal(j.source, 'apple');
  for (const c of impl.calls) assert.equal(c.opts.redirect, 'error');
});

test('fetchApple: encodes the title segment; a non-encodable posting drops, the board keeps', async () => {
  const slashed = { ...row('300000001', 'Strategy Lead'), transformedPostingTitle: 'strategy/lead?x#y' };
  const surrogate = { ...row('300000002', 'Ops Lead'), transformedPostingTitle: 'ops-\uD800-lead' };
  const plain = row('300000003', 'Finance Lead');
  const impl = recording(() => ok(hydration([slashed, surrogate, plain], 3)));
  const jobs = await fetchApple(ENTRY.careers_url, { fetchImpl: impl, company: ENTRY, sleep: NO_SLEEP });
  const byId = Object.fromEntries(jobs.map((j) => [j.id, j.url]));
  assert.equal(byId['apple-300000001'], 'https://jobs.apple.com/en-us/details/300000001/strategy%2Flead%3Fx%23y?team=OPMFG-BPM');
  assert.equal('apple-300000002' in byId, false);
  assert.equal(byId['apple-300000003'], 'https://jobs.apple.com/en-us/details/300000003/finance-lead?team=OPMFG-BPM');
  assert.equal(jobs.length, 2);
});

test('fetchApple: keeps other axes when one search fails during a scan (recall-first)', async () => {
  const impl = recording((call) => (
    call.url.includes('search=alpha') ? httpErr(500) : ok(hydration([row('9', 'Kept Role')], 1))
  ));
  const jobs = await fetchApple(ENTRY.careers_url, {
    fetchImpl: impl,
    company: { ...ENTRY, apple: { queries: ['alpha', 'beta'], teams: [] } },
    sleep: NO_SLEEP,
  });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Kept Role');
  assert.ok(impl.calls.length >= 2);
});

test('fetchApple: throws a descriptive error when the hydration blob is gone', async () => {
  const impl = recording(() => ok('<!doctype html><p>no blob here</p>'));
  await assert.rejects(
    () => fetchApple(ENTRY.careers_url, { fetchImpl: impl, company: ENTRY, sleep: NO_SLEEP }),
    /hydration blob/,
  );
});

test('fetchApple: honours entry.max_pages and clamps an oversized one to 50', async () => {
  const endless = () => ok(hydration(Array.from({ length: 20 }, (_, i) => row(String(i), `R${i}`)), 100000));
  const a = recording(endless);
  await fetchApple(ENTRY.careers_url, { fetchImpl: a, company: { ...ENTRY, max_pages: 3 }, sleep: NO_SLEEP });
  assert.equal(a.calls.length, 3);

  const b = recording(endless);
  await fetchApple(ENTRY.careers_url, { fetchImpl: b, company: { ...ENTRY, max_pages: 9999 }, sleep: NO_SLEEP });
  assert.equal(b.calls.length, 50);
  assert.equal(resolveMaxPages({ max_pages: 9999 }), 50);
  assert.equal(resolveMaxPages({}), 2);
});

test('fetchApple: paces pages after the first (2 sleeps across 3 pages)', async () => {
  let slept = 0;
  const impl = recording(() => ok(hydration(Array.from({ length: 20 }, (_, i) => row(String(i), `R${i}`)), 100000)));
  await fetchApple(ENTRY.careers_url, { fetchImpl: impl, company: { ...ENTRY, max_pages: 3 }, sleep: async () => { slept += 1; } });
  assert.equal(slept, 2);
});

test('parseSearchPage: present-and-empty searchResults is "no matches"; wrong shapes throw naming the page', () => {
  const page = (search) => `<script>window.__staticRouterHydrationData = JSON.parse(${JSON.stringify(JSON.stringify({ loaderData: { search } }))});</script>`;
  const U = 'https://jobs.apple.com/en-us/search?page=1';
  const empty = parseSearchPage(page({ searchResults: [], totalRecords: 0 }), U, 'Apple');
  assert.equal(empty.jobs.length, 0);
  assert.equal(empty.rowCount, 0);
  assert.deepEqual(parseHydration(hydration([], 0)), { searchResults: [], totalRecords: 0 });
  for (const [label, search] of [
    ['missing', { totalRecords: 0 }],
    ['null', { searchResults: null, totalRecords: 0 }],
    ['an object', { searchResults: {}, totalRecords: 0 }],
    ['a string', { searchResults: 'x', totalRecords: 0 }],
  ]) {
    let msg = '';
    try { parseSearchPage(page(search), U, 'Apple'); } catch (e) { msg = e.message; }
    assert.match(msg, /searchResults .* not an array/, label);
    assert.ok(msg.includes(U), label);
  }
});

test('fetchApple: rejects a no-config entry with a clear message and no request', async () => {
  for (const apple of [undefined, {}, { queries: [], teams: [] }, { queries: ['  '] }]) {
    const impl = recording(() => ok(hydration([], 0)));
    const company = { name: 'Apple', careers_url: 'https://jobs.apple.com/en-us/search', ...(apple ? { apple } : {}) };
    await assert.rejects(
      () => fetchApple(company.careers_url, { fetchImpl: impl, company, sleep: NO_SLEEP }),
      /needs a non-empty apple\.queries or apple\.teams/,
    );
    assert.equal(impl.calls.length, 0, JSON.stringify(apple ?? null));
  }
});

test('fetchApple: a teams-only entry runs no text search; a PIPE row carries the hint in the snippet', async () => {
  const a = recording(() => ok(hydration([row('7', 'Team Role')], 1)));
  const jobs = await fetchApple(ENTRY.careers_url, {
    fetchImpl: a,
    company: { ...ENTRY, apple: { teams: ['business-process-management-OPMFG-BPM'] } },
    sleep: NO_SLEEP,
  });
  assert.equal(jobs.length, 1);
  assert.ok(a.calls[0].url.includes('team=business-process-management-OPMFG-BPM'));
  assert.equal(a.calls[0].url.includes('search='), false);

  const NOTE = 'Apple labels this posting PIPE: it may be a talent pipeline, not a specific opening';
  const b = recording(() => ok(hydration([
    { ...row('200682978-2114', 'International Commercial Lead'), type: 'PIPE' },
    { ...row('200613455', 'Business Process Re-Engineering Manager'), type: 'REQ' },
    row('200600001', 'Untyped Role'),
  ], 3)));
  const rows = await fetchApple(ENTRY.careers_url, { fetchImpl: b, company: ENTRY, sleep: NO_SLEEP });
  const pipe = rows.find((j) => j.id === 'apple-200682978-2114');
  const req = rows.find((j) => j.id === 'apple-200613455');
  const untyped = rows.find((j) => j.id === 'apple-200600001');
  assert.equal(rows.length, 3);
  assert.equal(pipe.snippet, NOTE); // web-ui shape: the note rides in the snippet
  assert.equal(req.snippet, '');
  assert.equal(untyped.snippet, '');
});
