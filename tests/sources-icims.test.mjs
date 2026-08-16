/**
 * iCIMS source + adapter.
 * Targets the classic iCIMS hosted-portal search pages at
 * `careers-<tenant>.icims.com` (DISTINCT from the jibeapply source). Public,
 * zero-auth HTML search fragment, host-pinned per tenant. CI-isolated:
 * fetchImpl is faked, no network. The parent's enrichDate() detail-page hook is
 * intentionally omitted (the web-ui in-process scanner has no per-job enrich
 * hook), so every job is undated (date: '').
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIcimsSearchPage, fetchIcims, assertIcimsUrl,
  resolveTenantOrigin, icimsSearchUrl, meta, ICIMS_HOST_RE,
} from '../server/lib/sources/icims.mjs';
import { icimsAdapter } from '../server/lib/portals/adapters/icims.mjs';

const ORIGIN = 'https://careers-acmefreight.icims.com';
const ENDPOINT = icimsSearchUrl(ORIGIN); // https://careers-acmefreight.icims.com/jobs/search?ss=1&in_iframe=1

// Search-results fixture: a card with a rendered location and
// an entity-bearing title, a themed second card, and a foreign-host card that
// must be dropped by the origin pin.
const FIXTURE = `<div class="iCIMS_MainWrapper iCIMS_ListingsPage">
<ul class="container-fluid iCIMS_JobsTable">
<li class="iCIMS_JobCardItem">
<div class="row">
<div class="col-xs-6 header left">
<span class="sr-only field-label">Location</span>
<span >
US-NJ-Edison</span>
</div>
<div class="col-xs-12 title">
<a href="https://careers-acmefreight.icims.com/jobs/1234/director%2c-revenue-operations/job?in_iframe=1&amp;hashed=-33555" class="iCIMS_Anchor" title="1234 - Director, Revenue Operations">
<span class="sr-only field-label">Title</span>
<h3 >
Director, Revenue Operations &amp; Strategy</h3>
</a>
</div>
</div>
</li>
<li class="iCIMS_JobCardItem">
<div class="row">
<div class="col-xs-6 header left">
<span class="sr-only field-label">Location</span>
<span class="iCIMS_JobHeaderField" data-test="location">
US-CA-Fontana</span>
</div>
<div class="col-xs-12 title">
<a href="https://careers-acmefreight.icims.com/jobs/5678/forklift-operator/job?in_iframe=1" class="iCIMS_Anchor" title="5678 - Forklift Operator">
<h3 class="iCIMS_Header" id="jobtitle-5678">
Forklift Operator</h3>
</a>
</div>
</div>
</li>
<li class="iCIMS_JobCardItem">
<div class="row">
<div class="col-xs-12 title">
<a href="https://evil.example.com/jobs/9999/phish/job" class="iCIMS_Anchor" title="9999 - Phish">
<h3 >Foreign Host Card</h3>
</a>
</div>
</div>
</li>
</ul>
</div>`;

test('meta + adapter surface: provider-selected + *.icims.com-detected, host-pinned', () => {
  assert.equal(meta.value, 'icims');
  assert.equal(meta.label, 'iCIMS');
  assert.equal(meta.region, 'en');

  assert.equal(icimsAdapter.id, 'icims');
  assert.equal(icimsAdapter.label, 'iCIMS');
  assert.equal(icimsAdapter.fetch, fetchIcims);

  // matches: explicit provider
  assert.ok(icimsAdapter.matches({ provider: 'icims' }));
  // matches: any *.icims.com host (api or careers_url)
  assert.ok(icimsAdapter.matches({ careers_url: `${ORIGIN}/jobs/search?ss=1` }));
  assert.ok(icimsAdapter.matches({ api: 'https://careers-x.icims.com/jobs' }));
  // no match: non-icims host / empty
  assert.ok(!icimsAdapter.matches({ careers_url: 'https://example.com/jobs' }));
  assert.ok(!icimsAdapter.matches({}));

  // buildEndpoint host-pins to the tenant portal search URL
  assert.equal(
    icimsAdapter.buildEndpoint({ careers_url: `${ORIGIN}/jobs/search?ss=1&in_iframe=1` }),
    ENDPOINT,
  );
  assert.equal(icimsAdapter.buildEndpoint({ provider: 'icims' }), null); // no host to pin
  assert.equal(icimsAdapter.buildEndpoint({ careers_url: 'http://careers-a.icims.com/jobs' }), null); // non-https
});

test('ICIMS_HOST_RE only claims *.icims.com subdomains', () => {
  assert.ok(ICIMS_HOST_RE.test('careers-acmefreight.icims.com'));
  assert.ok(ICIMS_HOST_RE.test('careers-x.icims.com'));
  assert.ok(!ICIMS_HOST_RE.test('icims.com')); // bare apex, not a tenant
  assert.ok(!ICIMS_HOST_RE.test('evilicims.com')); // look-alike
  assert.ok(!ICIMS_HOST_RE.test('icims.com.evil.com')); // suffix trick
});

test('parseIcimsSearchPage: same-origin cards parsed, foreign-host card dropped', () => {
  const jobs = parseIcimsSearchPage(FIXTURE, ORIGIN, 'acmefreight');
  assert.equal(jobs.length, 2); // 1234 + 5678; the evil.example.com card dropped

  const [dir, fork] = jobs;
  assert.equal(dir.id, 'icims-1234');
  assert.equal(dir.title, 'Director, Revenue Operations & Strategy'); // entity decoded
  assert.equal(dir.url, `${ORIGIN}/jobs/1234/director%2c-revenue-operations/job`); // query stripped
  assert.equal(dir.location, 'US-NJ-Edison');
  assert.equal(dir.company, 'acmefreight');
  assert.equal(dir.source, 'icims');
  assert.equal(dir.date, ''); // no list-page date; enrichDate omitted by design
  assert.equal(dir.salary, '');
  assert.equal(dir.isRemote, false);
  assert.equal(dir.workplaceType, '');
  assert.equal(dir.relocates, false);
  assert.equal(dir.snippet, '');

  assert.equal(fork.id, 'icims-5678');
  assert.equal(fork.title, 'Forklift Operator'); // themed <h3 class=… id=…>
  assert.equal(fork.location, 'US-CA-Fontana');
  assert.equal(fork.url, `${ORIGIN}/jobs/5678/forklift-operator/job`);
});

test('parseIcimsSearchPage: relative href resolves against origin; off-host protocol-relative dropped', () => {
  const rel = `<li class="iCIMS_JobCardItem"><div class="col-xs-12 title">
    <a href="/jobs/7777/relative-role/job?in_iframe=1" class="iCIMS_Anchor"><h3 >Relative Role</h3></a></div></li>`;
  const jobs = parseIcimsSearchPage(`<ul>${rel}</ul>`, ORIGIN, 'acmefreight');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, `${ORIGIN}/jobs/7777/relative-role/job`);
  assert.equal(jobs[0].id, 'icims-7777');

  // A protocol-relative link to another host must not sneak past once resolved.
  const off = `<li class="iCIMS_JobCardItem"><div class="col-xs-12 title">
    <a href="//evil.example.com/jobs/8888/x/job" class="iCIMS_Anchor"><h3 >Off Host</h3></a></div></li>`;
  assert.equal(parseIcimsSearchPage(`<ul>${off}</ul>`, ORIGIN, 'acmefreight').length, 0);
});

test('parseIcimsSearchPage: location extracted regardless of field-label class ordering', () => {
  const locCard = (cls) => `<li class="iCIMS_JobCardItem"><div class="row">
    <div class="col-xs-6 header left"><span class="${cls}">Location</span><span >US-TX-Austin</span></div>
    <div class="col-xs-12 title"><a href="${ORIGIN}/jobs/4242/themed-role/job" class="iCIMS_Anchor"><h3 >Themed Role</h3></a></div>
  </div></li>`;
  for (const cls of ['field-label', 'sr-only field-label', 'field-label sr-only', 'a field-label b']) {
    const [j] = parseIcimsSearchPage(locCard(cls), ORIGIN, 'acmefreight');
    assert.equal(j && j.location, 'US-TX-Austin', `class="${cls}"`);
  }
});

test('parseIcimsSearchPage: empty / garbage / bad-origin → []', () => {
  assert.deepEqual(parseIcimsSearchPage('', ORIGIN, 'x'), []);
  assert.deepEqual(parseIcimsSearchPage('<html>no cards</html>', ORIGIN, 'x'), []);
  assert.deepEqual(parseIcimsSearchPage(null, ORIGIN, 'x'), []);
  assert.deepEqual(parseIcimsSearchPage(FIXTURE, 'not a url', 'x'), []);
});

test('assertIcimsUrl: https + *.icims.com, throws off-scheme / off-host / unparseable', () => {
  const u = `${ORIGIN}/jobs/search`;
  assert.equal(assertIcimsUrl(u), u);
  assert.throws(() => assertIcimsUrl('http://careers-a.icims.com/jobs'), /HTTPS/);
  assert.throws(() => assertIcimsUrl('https://example.com/jobs'), /host must be \*\.icims\.com/);
  assert.throws(() => assertIcimsUrl('nonsense'), /invalid URL/);
});

test('resolveTenantOrigin: api over careers_url; https + *.icims.com only', () => {
  assert.equal(resolveTenantOrigin({ careers_url: `${ORIGIN}/jobs/search?ss=1` }), ORIGIN);
  assert.equal(
    resolveTenantOrigin({ api: 'https://careers-x.icims.com/y', careers_url: `${ORIGIN}/z` }),
    'https://careers-x.icims.com',
  );
  assert.equal(resolveTenantOrigin({ careers_url: 'http://careers-a.icims.com/jobs' }), null); // non-https
  assert.equal(resolveTenantOrigin({ careers_url: 'https://example.com/jobs' }), null); // non-icims
  assert.equal(resolveTenantOrigin({}), null);
});

// ── fetchIcims: pagination (CI-isolated fake fetchImpl) ─────────────────────
const mkCard = (id, title) => `<li class="iCIMS_JobCardItem"><div class="row">
<div class="col-xs-6 header left"><span class="sr-only field-label">Location</span><span >US-TX-Austin</span></div>
<div class="col-xs-12 title"><a href="${ORIGIN}/jobs/${id}/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/job?in_iframe=1" class="iCIMS_Anchor"><h3 >${title}</h3></a></div>
</div></li>`;
const page = (...cards) => `<ul class="iCIMS_JobsTable">${cards.join('')}</ul>`;

// Serve HTML keyed by the `pr` query param; assert the SSRF-safe redirect flag.
const htmlFetch = (byPr) => async (url, opts) => {
  assert.equal(opts.redirect, 'error');
  const pr = Number((url.match(/[?&]pr=(\d+)/) || [])[1] || 0);
  return { ok: true, status: 200, text: async () => (byPr[pr] ?? '') };
};

test('fetchIcims: paginates by pr and stops on the first empty page, CI-isolated', async () => {
  let calls = 0;
  const fetchImpl = (url, opts) => {
    calls += 1;
    return htmlFetch({ 0: page(mkCard(1, 'Role A'), mkCard(2, 'Role B')), 1: page(mkCard(3, 'Role C')) })(url, opts);
  };
  const jobs = await fetchIcims(ENDPOINT, { fetchImpl, company: { name: 'acmefreight' } });
  assert.equal(jobs.length, 3);
  assert.equal(calls, 3); // pr=0 (2 jobs) → pr=1 (1 job) → pr=2 (empty) → stop
  assert.ok(jobs.every((j) => j.source === 'icims'));
  assert.ok(jobs.every((j) => j.company === 'acmefreight'));
  assert.ok(jobs.every((j) => j.date === ''));
});

test('fetchIcims: stops when a page repeats the previous first URL', async () => {
  let calls = 0;
  const repeating = page(mkCard(9, 'Sticky Role'));
  const fetchImpl = (url, opts) => {
    calls += 1;
    return htmlFetch({ 0: page(mkCard(1, 'First')), 1: repeating, 2: repeating, 3: repeating })(url, opts);
  };
  const jobs = await fetchIcims(ENDPOINT, { fetchImpl, company: { name: 'acmefreight' } });
  assert.equal(jobs.length, 2); // pr0 First, pr1 Sticky; pr2 repeats pr1's first url → stop
  assert.equal(calls, 3);
});

test('fetchIcims: host guard rejects a non-https / non-icims endpoint before any fetch', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, status: 200, text: async () => '' }; };
  await assert.rejects(() => fetchIcims('http://careers-a.icims.com/jobs/search', { fetchImpl }), /HTTPS/);
  await assert.rejects(() => fetchIcims('https://example.com/jobs/search', { fetchImpl }), /host must be \*\.icims\.com/);
  assert.equal(called, false); // guard fires before any fetch
});
