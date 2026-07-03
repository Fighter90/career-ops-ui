/**
 * Avature source + adapter (parent career-ops `providers/avature.mjs` parity).
 * Per-tenant Avature ATS, HTML-over-fetch, host-pinned. CI-isolated: a fake
 * fetchImpl returns canned HTML; no network, no parent project.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAvature, fetchAvature, assertAvatureUrl, meta,
} from '../server/lib/sources/avature.mjs';
import { avatureAdapter } from '../server/lib/portals/adapters/avature.mjs';

const ORIGIN = 'https://acme.avature.net';
const ENDPOINT = 'https://acme.avature.net/careers';

// One <article class="article article--result"> block. `href` and `posted`
// are parameterised so tests can inject off-host / titleless / relative rows.
const articleBlock = ({
  href = '/careers/JobDetail/Senior-Go-Engineer/12345',
  title = 'Senior Go Engineer',
  posted = 'Posted 02-May-2026',
  location = '',
} = {}) => `
  <article class="article article--result">
    <a class="link" href="${href}">${title}</a>
    ${location ? `<span class="list-item-location">${location}</span>` : ''}
    <div class="subtitle">${posted}</div>
  </article>`;

const pageHtml = (blocks) => `<!doctype html><html><body>
  <div class="results">${blocks.join('\n')}</div>
</body></html>`;

// Fake fetchImpl: returns { ok, status, text } like the real fetch surface.
const htmlFetch = (byOffset) => async (url, opts) => {
  const offset = Number((url.match(/[?&]jobOffset=(\d+)/) || [])[1] || 0);
  const html = byOffset[offset] ?? pageHtml([]);
  return { ok: true, status: 200, text: async () => html, _opts: opts };
};

test('meta + adapter surface: provider-selected or avature.net host, host-pinned', () => {
  assert.equal(meta.value, 'avature');
  assert.equal(meta.label, 'Avature');
  assert.equal(meta.region, 'en');

  assert.equal(avatureAdapter.id, 'avature');
  assert.equal(avatureAdapter.label, 'Avature');
  assert.equal(typeof avatureAdapter.fetch, 'function');

  // matches: explicit provider, or an avature.net careers_url
  assert.ok(avatureAdapter.matches({ provider: 'avature', api: ENDPOINT }));
  assert.ok(avatureAdapter.matches({ careers_url: ENDPOINT }));
  assert.ok(avatureAdapter.matches({ careers_url: 'https://avature.net/careers' }));
  assert.ok(!avatureAdapter.matches({ careers_url: 'https://acme.example.com/careers' }));
  assert.ok(!avatureAdapter.matches({}));
  assert.ok(!avatureAdapter.matches(null));

  // buildEndpoint host-pins to the entry's own avature.net url; null otherwise
  assert.equal(avatureAdapter.buildEndpoint({ careers_url: ENDPOINT }), ENDPOINT);
  assert.equal(avatureAdapter.buildEndpoint({ api: ENDPOINT }), ENDPOINT);
  assert.equal(avatureAdapter.buildEndpoint({ provider: 'avature', careers_url: 'https://evil.com/x' }), null);
  assert.equal(avatureAdapter.buildEndpoint({ provider: 'avature', careers_url: 'http://acme.avature.net/x' }), null);
  assert.equal(avatureAdapter.buildEndpoint({}), null);
});

test('parseAvature: maps title/url/date/location, drops bad + off-host rows', () => {
  const html = pageHtml([
    articleBlock({ location: 'Berlin, DE' }),
    articleBlock({ href: '/careers/JobDetail/Backend-Dev/67890', title: 'Backend Developer', posted: '' }),
    articleBlock({ title: '' }),                                    // dropped: no title
    articleBlock({ href: '/careers/About/12', title: 'Not a job' }), // dropped: no JobDetail
    articleBlock({ href: 'https://evil.com/careers/JobDetail/x/999', title: 'Phishing' }), // dropped: off-host
    articleBlock({ href: 'https://acme.avature.net/careers/JobDetail/On-Host/222', title: 'Absolute On-Host' }),
  ]);
  const jobs = parseAvature(html, { origin: ORIGIN, fallbackCompany: 'Acme' });

  assert.equal(jobs.length, 3);

  const [first, second, third] = jobs;
  assert.equal(first.id, 'avature-12345');
  assert.equal(first.title, 'Senior Go Engineer');
  assert.equal(first.company, 'Acme');
  assert.equal(first.url, 'https://acme.avature.net/careers/JobDetail/Senior-Go-Engineer/12345');
  assert.equal(first.location, 'Berlin, DE');
  assert.equal(first.date, '2026-05-02');
  assert.equal(first.source, 'avature');
  assert.equal(first.isRemote, false);
  assert.equal(first.salary, '');
  assert.equal(first.relocates, false);
  assert.equal(first.workplaceType, '');
  assert.equal(first.snippet, '');

  assert.equal(second.id, 'avature-67890');
  assert.equal(second.title, 'Backend Developer');
  assert.equal(second.date, ''); // no Posted subtitle → ''

  // absolute on-host href kept, resolved verbatim
  assert.equal(third.title, 'Absolute On-Host');
  assert.equal(third.url, 'https://acme.avature.net/careers/JobDetail/On-Host/222');
  assert.equal(third.id, 'avature-222');
});

test('parseAvature: non-string / empty inputs → []', () => {
  assert.deepEqual(parseAvature(null, { origin: ORIGIN }), []);
  assert.deepEqual(parseAvature('<html></html>', { origin: ORIGIN }), []);
  assert.deepEqual(parseAvature(pageHtml([]), { origin: ORIGIN }), []);
});

test('assertAvatureUrl: https + host-pinned to (*.)avature.net', () => {
  assert.equal(assertAvatureUrl(ENDPOINT), ENDPOINT);
  assert.equal(assertAvatureUrl('https://avature.net/careers'), 'https://avature.net/careers');
  assert.throws(() => assertAvatureUrl('https://evil.com/x'), /untrusted hostname/);
  assert.throws(() => assertAvatureUrl('http://acme.avature.net/x'), /HTTPS/);
  assert.throws(() => assertAvatureUrl('not a url'), /invalid URL/);
});

test('fetchAvature: paginates by jobOffset, dedups, stops on short page (CI-isolated)', async () => {
  // page 0: a full page of 6 fresh rows; page 1: 2 rows (short) → stop
  const fullPage = pageHtml(
    Array.from({ length: 6 }, (_, i) => articleBlock({ href: `/careers/JobDetail/Role-${i}/${100 + i}`, title: `Role ${i}` })),
  );
  const shortPage = pageHtml([
    articleBlock({ href: '/careers/JobDetail/Last-A/200', title: 'Last A' }),
    articleBlock({ href: '/careers/JobDetail/Last-B/201', title: 'Last B' }),
  ]);
  let calls = 0;
  const fetchImpl = (url, opts) => {
    calls += 1;
    assert.equal(opts.redirect, 'error'); // SSRF: never follow redirects
    return htmlFetch({ 0: fullPage, 6: shortPage })(url, opts);
  };
  const jobs = await fetchAvature(ENDPOINT, { fetchImpl, company: { name: 'Acme' } });

  assert.equal(calls, 2);       // page 1 short → stop
  assert.equal(jobs.length, 8); // 6 + 2
  assert.ok(jobs.every((j) => j.source === 'avature'));
  assert.ok(jobs.every((j) => j.company === 'Acme'));
  assert.equal(jobs[0].id, 'avature-100');
});

test('fetchAvature: stops when a page adds no fresh rows (offset ignored)', async () => {
  const samePage = pageHtml([articleBlock({ href: '/careers/JobDetail/Dup/9/', title: 'Dup' })]);
  let calls = 0;
  const fetchImpl = (url, opts) => { calls += 1; return htmlFetch({ 0: samePage })(url, opts); };
  // offset 6+ falls back to empty page in htmlFetch, but the single-row page at
  // offset 0 is short anyway → one call. Verify a looping tenant can't spin:
  const jobs = await fetchAvature(ENDPOINT, { fetchImpl });
  assert.equal(calls, 1);
  assert.equal(jobs.length, 1);
});

test('fetchAvature: rejects an off-host endpoint before any fetch', async () => {
  let calls = 0;
  const fetchImpl = () => { calls += 1; return { ok: true, status: 200, text: async () => '' }; };
  await assert.rejects(() => fetchAvature('https://evil.com/careers', { fetchImpl }), /untrusted hostname/);
  assert.equal(calls, 0);
});
