/**
 * Job Bank (Canada) source — CI-isolated tests.
 * Uses a fake fetchImpl (no network, no port binding, no parent-project
 * dependency). Parent career-ops parity (providers/jobbankca.mjs), adapted to
 * the web-ui source contract + rich job shape.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchJobBankCa,
  parseAtomFeed,
  parseJobBankConfig,
  profileTargetKeywords,
  buildFeedUrl,
  assertJobBankUrl,
  FEED_URL,
  meta,
} from '../server/lib/sources/jobbankca.mjs';
import { jobbankcaAdapter } from '../server/lib/portals/adapters/jobbankca.mjs';

const okText = (xml) => ({ ok: true, text: async () => xml });
const errStatus = (status) => ({ ok: false, status, headers: { get: () => null }, text: async () => '' });

/** Build one Atom <entry>. `href` defaults to a valid jobposting URL. */
function atomEntry({
  title = 'Software Engineer',
  href = 'https://www.jobbank.gc.ca/jobsearch/jobposting/44225588?source=searchresults',
  employer = 'Acme Inc',
  location = 'Vancouver (BC)',
  salary = '$100,000.00 annually',
  updated = '2026-07-19T02:30:37Z',
  rawLink, // when set, replaces the whole <link> element (for security tests)
} = {}) {
  const link = rawLink !== undefined
    ? rawLink
    : `<link rel="alternate" type="text/html" href="${href}"/>`;
  const summaryParts = [
    '<strong>Job number:</strong> 123<br />',
    location != null ? `<strong>Location:</strong> ${location}<br />` : '',
    employer != null ? `<strong>Employer:</strong> ${employer}<br />` : '',
    salary != null ? `<strong>Salary:</strong> ${salary}` : '',
  ].join('');
  return [
    '<entry>',
    `<title>${title}</title>`,
    link,
    `<summary type="html"><![CDATA[${summaryParts}]]></summary>`,
    `<updated>${updated}</updated>`,
    '</entry>',
  ].join('');
}

function atomFeed(entries) {
  return `<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n${entries.join('\n')}\n</feed>`;
}

/**
 * fetchImpl that maps a `searchstring` → array-of-pages of Atom XML (1-indexed
 * page param). Records every call. A page beyond the array answers empty feed.
 */
function fakeSearch(byKeyword) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, headers: opts?.headers, method: opts?.method });
    const u = new URL(url);
    const kw = u.searchParams.get('searchstring');
    const page = Number(u.searchParams.get('page'));
    const pages = byKeyword[kw] || [];
    return okText(pages[page - 1] ?? atomFeed([]));
  };
  impl.calls = calls;
  return impl;
}

// ---------------------------------------------------------------------------
// meta + adapter
// ---------------------------------------------------------------------------

test('meta is { value: "jobbankca", label: "Job Bank (Canada)", region: "en" }', () => {
  assert.deepEqual(meta, { value: 'jobbankca', label: 'Job Bank (Canada)', region: 'en' });
});

test('adapter matches provider:jobbankca or a jobbank.gc.ca host; host-pins the endpoint', () => {
  assert.equal(jobbankcaAdapter.matches({ provider: 'jobbankca' }), true);
  assert.equal(jobbankcaAdapter.matches({ careers_url: 'https://www.jobbank.gc.ca/jobsearch/jobsearch' }), true);
  assert.equal(jobbankcaAdapter.matches({ api: 'https://www.jobbank.gc.ca/x' }), true);
  assert.equal(jobbankcaAdapter.matches({ provider: 'other' }), false);
  assert.equal(jobbankcaAdapter.matches({ careers_url: 'https://jobbank.gc.ca.evil.com/x' }), false);
  assert.equal(jobbankcaAdapter.matches({ careers_url: 'http://www.jobbank.gc.ca/x' }), false);
  assert.equal(jobbankcaAdapter.buildEndpoint({}), FEED_URL);
  assert.equal(jobbankcaAdapter.buildEndpoint({ api: 'https://www.jobbank.gc.ca/x' }), 'https://www.jobbank.gc.ca/x');
});

// ---------------------------------------------------------------------------
// assertJobBankUrl (host guard)
// ---------------------------------------------------------------------------

test('assertJobBankUrl accepts www.jobbank.gc.ca HTTPS, rejects other hosts/schemes/spoofs', () => {
  assert.equal(assertJobBankUrl(FEED_URL), FEED_URL);
  assert.throws(() => assertJobBankUrl('http://www.jobbank.gc.ca/x'), /must use HTTPS/);
  assert.throws(() => assertJobBankUrl('https://evil.example.com/x'), /untrusted hostname/);
  assert.throws(() => assertJobBankUrl('https://www.jobbank.gc.ca.evil.com/x'), /untrusted hostname/);
  assert.throws(() => assertJobBankUrl('https://jobbank.gc.ca/x'), /untrusted hostname/); // apex ≠ www host-pin
  assert.throws(() => assertJobBankUrl('not a url'), /invalid URL/);
});

// ---------------------------------------------------------------------------
// buildFeedUrl
// ---------------------------------------------------------------------------

test('buildFeedUrl sets searchstring, empty locationstring, and page', () => {
  const url = buildFeedUrl('software engineer', 3);
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, FEED_URL);
  assert.equal(u.searchParams.get('searchstring'), 'software engineer');
  assert.equal(u.searchParams.get('locationstring'), '');
  assert.equal(u.searchParams.get('page'), '3');
  assert.doesNotThrow(() => assertJobBankUrl(url)); // host-pinned
});

// ---------------------------------------------------------------------------
// parseJobBankConfig + profileTargetKeywords (keyword resolution)
// ---------------------------------------------------------------------------

test('parseJobBankConfig returns [] when the block is absent', () => {
  assert.deepEqual(parseJobBankConfig({}), { keywords: [] });
  assert.deepEqual(parseJobBankConfig({ jobbankca: {} }), { keywords: [] });
});

test('parseJobBankConfig trims, drops non-strings, and dedups keywords', () => {
  const cfg = parseJobBankConfig({ jobbankca: { keywords: ['  python  ', '', 7, 'data engineer', 'python'] } });
  assert.deepEqual(cfg.keywords, ['python', 'data engineer']);
});

test('profileTargetKeywords extracts primary[] + archetypes[].name, trims/dedups', () => {
  const profile = {
    target_roles: {
      primary: ['  Backend Developer ', 'Backend Developer', ''],
      archetypes: [{ name: 'Platform Engineer' }, { name: '' }, { nope: 'x' }, null],
    },
  };
  assert.deepEqual(profileTargetKeywords(profile), ['Backend Developer', 'Platform Engineer']);
  assert.deepEqual(profileTargetKeywords({}), []);
  assert.deepEqual(profileTargetKeywords({ target_roles: null }), []);
});

// ---------------------------------------------------------------------------
// parseAtomFeed
// ---------------------------------------------------------------------------

test('parseAtomFeed maps title/company/url/location/salary/date to the rich shape', () => {
  const xml = atomFeed([atomEntry({
    title: 'Senior Software Engineer',
    employer: 'Acme Inc',
    location: 'Vancouver (BC)',
    salary: '$100,000.00 annually',
    updated: '2026-07-19T02:30:37Z',
  })]);
  const jobs = parseAtomFeed(xml);
  assert.equal(jobs.length, 1);
  const j = jobs[0];
  assert.equal(j.id, 'jobbankca-44225588'); // numeric posting id from URL path
  assert.equal(j.title, 'Senior Software Engineer');
  assert.equal(j.company, 'Acme Inc');
  assert.equal(j.location, 'Vancouver (BC)');
  assert.equal(j.salary, '$100,000.00 annually');
  assert.equal(j.url, 'https://www.jobbank.gc.ca/jobsearch/jobposting/44225588?source=searchresults');
  assert.equal(j.date, '2026-07-19');
  assert.equal(j.snippet, '');
  assert.equal(j.relocates, false);
  assert.equal(j.source, 'jobbankca');
});

test('parseAtomFeed decodes HTML entities in title and employer', () => {
  const xml = atomFeed([atomEntry({ title: 'D&eacute;veloppeur &amp; Architecte', employer: 'Acme &amp; Fils' })]);
  const [j] = parseAtomFeed(xml);
  assert.equal(j.title, 'Développeur & Architecte');
  assert.equal(j.company, 'Acme & Fils');
});

test('parseAtomFeed drops entries with no usable https jobbank URL or no title', () => {
  const noHost = atomEntry({ href: 'https://evil.example.com/jobposting/1' });
  const httpScheme = atomEntry({ href: 'http://www.jobbank.gc.ca/jobsearch/jobposting/2' });
  const noTitle = atomEntry({ title: '' });
  const good = atomEntry();
  const jobs = parseAtomFeed(atomFeed([noHost, httpScheme, noTitle, good]));
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'jobbankca-44225588');
});

test('parseAtomFeed falls back to djb2(url) when the URL has no numeric posting id', () => {
  const xml = atomFeed([atomEntry({ href: 'https://www.jobbank.gc.ca/jobsearch/somewhere/else' })]);
  const [j] = parseAtomFeed(xml);
  assert.match(j.id, /^jobbankca-[0-9a-z]+$/);
  assert.notEqual(j.id, 'jobbankca-'); // non-empty hash
});

test('parseAtomFeed prefers rel="alternate" and resists a same-host attribute-injection link', () => {
  // A "self" link comes first; the alternate is the human-facing posting page.
  const twoLinks = atomEntry({
    rawLink:
      '<link rel="self" type="application/atom+xml" href="https://www.jobbank.gc.ca/jobsearch/jobposting/999"/>'
      + '<link rel="alternate" type="text/html" href="https://www.jobbank.gc.ca/jobsearch/jobposting/44225588"/>',
  });
  assert.equal(parseAtomFeed(atomFeed([twoLinks]))[0].url, 'https://www.jobbank.gc.ca/jobsearch/jobposting/44225588');

  // Attack: a decoy rel='alternate' href='...WRONG' buried inside a data="…"
  // attribute value. Sequential attribute tokenization must not pick WRONG.
  const attack = atomEntry({
    rawLink:
      `<link data=" rel='alternate' href='https://www.jobbank.gc.ca/jobsearch/jobposting/1111WRONG'" rel="self" href="https://www.jobbank.gc.ca/jobsearch/jobposting/2222REAL"/>`,
  });
  const url = parseAtomFeed(atomFeed([attack]))[0].url;
  assert.ok(url.includes('2222REAL'), `expected the real self href, got ${url}`);
  assert.ok(!url.includes('1111WRONG'), `injected href leaked: ${url}`);
});

test('parseAtomFeed flags remote from the title (bilingual: télétravail)', () => {
  const enRemote = parseAtomFeed(atomFeed([atomEntry({ title: 'Remote Backend Developer', href: 'https://www.jobbank.gc.ca/jobsearch/jobposting/10' })]))[0];
  assert.equal(enRemote.isRemote, true);
  assert.equal(enRemote.workplaceType, 'Remote');
  const frRemote = parseAtomFeed(atomFeed([atomEntry({ title: 'Développeur (télétravail)', href: 'https://www.jobbank.gc.ca/jobsearch/jobposting/11' })]))[0];
  assert.equal(frRemote.isRemote, true);
  const onsite = parseAtomFeed(atomFeed([atomEntry({ title: 'Warehouse Associate', location: 'Toronto (ON)', href: 'https://www.jobbank.gc.ca/jobsearch/jobposting/12' })]))[0];
  assert.equal(onsite.isRemote, false);
  assert.equal(onsite.workplaceType, 'Onsite');
});

test('parseAtomFeed is empty/robust on junk input', () => {
  assert.deepEqual(parseAtomFeed(''), []);
  assert.deepEqual(parseAtomFeed(null), []);
  assert.deepEqual(parseAtomFeed('<feed></feed>'), []);
});

// ---------------------------------------------------------------------------
// fetchJobBankCa — keyword threading, dedup, headers, delay
// ---------------------------------------------------------------------------

test('fetchJobBankCa queries each keyword, dedups by url, sends the browser UA', async () => {
  const shared = atomFeed([atomEntry()]); // same posting url under both keywords
  const impl = fakeSearch({ python: [shared], data: [shared] });
  const jobs = await fetchJobBankCa(FEED_URL, {
    fetchImpl: impl,
    delayMs: 0,
    company: { name: 'Job Bank', jobbankca: { keywords: ['python', 'data'] } },
  });
  assert.equal(jobs.length, 1); // deduped across keywords by url
  assert.equal(jobs[0].source, 'jobbankca');
  const kws = impl.calls.map((c) => new URL(c.url).searchParams.get('searchstring'));
  assert.deepEqual([...new Set(kws)].sort(), ['data', 'python']);
  assert.match(impl.calls[0].headers['User-Agent'], /Mozilla\/5\.0/);
});

test('fetchJobBankCa falls back to injected profile keywords when config has none', async () => {
  const impl = fakeSearch({ 'Backend Developer': [atomFeed([atomEntry()])] });
  const jobs = await fetchJobBankCa(FEED_URL, {
    fetchImpl: impl,
    delayMs: 0,
    profileKeywords: ['Backend Developer'],
    company: { name: 'Job Bank', jobbankca: {} },
  });
  assert.equal(jobs.length, 1);
  assert.equal(new URL(impl.calls[0].url).searchParams.get('searchstring'), 'Backend Developer');
});

test('fetchJobBankCa throws when no config keywords and no profile fallback', async () => {
  let called = false;
  await assert.rejects(
    () => fetchJobBankCa(FEED_URL, {
      fetchImpl: async () => { called = true; return okText(atomFeed([])); },
      delayMs: 0,
      profileKeywords: [], // no profile roles → no fallback
      company: { name: 'Empty', jobbankca: {} },
    }),
    /no jobbankca\.keywords\[\] and no config\/profile\.yml target_roles/,
  );
  assert.equal(called, false);
});

test('fetchJobBankCa rejects an off-host endpoint override before any fetch', async () => {
  let called = false;
  await assert.rejects(
    () => fetchJobBankCa('https://evil.example.com/feed', {
      fetchImpl: async () => { called = true; return okText(atomFeed([])); },
      delayMs: 0,
      company: { jobbankca: { keywords: ['python'] } },
    }),
    /untrusted hostname/,
  );
  assert.equal(called, false);
});

// ---------------------------------------------------------------------------
// pagination + page caps
// ---------------------------------------------------------------------------

/** A full page of exactly PAGE_SIZE (100) distinct postings. */
function fullPage(offset) {
  const entries = [];
  for (let i = 0; i < 100; i++) {
    const id = offset + i;
    entries.push(atomEntry({ href: `https://www.jobbank.gc.ca/jobsearch/jobposting/${id}` }));
  }
  return atomFeed(entries);
}

test('fetchJobBankCa paginates while pages are full, stops on a short page', async () => {
  const impl = fakeSearch({ python: [fullPage(1000), atomFeed([atomEntry({ href: 'https://www.jobbank.gc.ca/jobsearch/jobposting/2000' })])] });
  const jobs = await fetchJobBankCa(FEED_URL, { fetchImpl: impl, delayMs: 0, company: { jobbankca: { keywords: ['python'] } } });
  assert.equal(jobs.length, 101); // 100 (full page 1) + 1 (short page 2)
  const pages = impl.calls.map((c) => new URL(c.url).searchParams.get('page'));
  assert.deepEqual(pages, ['1', '2']); // stopped after the short page 2
});

test('fetchJobBankCa stops after one request when page 1 is already short', async () => {
  const impl = fakeSearch({ python: [atomFeed([atomEntry()])] });
  await fetchJobBankCa(FEED_URL, { fetchImpl: impl, delayMs: 0, company: { jobbankca: { keywords: ['python'] } } });
  assert.equal(impl.calls.length, 1);
});

test('fetchJobBankCa honours opts.maxPages (bounded probe) even when every page is full', async () => {
  let requests = 0;
  const impl = async () => { requests++; return okText(fullPage(requests * 1000)); };
  await fetchJobBankCa(FEED_URL, { fetchImpl: impl, delayMs: 0, maxPages: 2, company: { jobbankca: { keywords: ['python'] } } });
  assert.equal(requests, 2);
});

test('fetchJobBankCa clamps company.max_pages to the MAX_PAGES_CAP (20)', async () => {
  let requests = 0;
  const impl = async () => { requests++; return okText(fullPage(requests * 1000)); };
  await fetchJobBankCa(FEED_URL, { fetchImpl: impl, delayMs: 0, company: { jobbankca: { keywords: ['python'] }, max_pages: 999 } });
  assert.equal(requests, 20);
});

// ---------------------------------------------------------------------------
// recall-first: partial success vs total outage
// ---------------------------------------------------------------------------

test('fetchJobBankCa does not throw when one keyword fails and another answers empty', async () => {
  const impl = async (url) => {
    const kw = new URL(url).searchParams.get('searchstring');
    if (kw === 'bad') return errStatus(503);
    return okText(atomFeed([]));
  };
  const jobs = await fetchJobBankCa(FEED_URL, { fetchImpl: impl, delayMs: 0, company: { jobbankca: { keywords: ['ok', 'bad'] } } });
  assert.deepEqual(jobs, []);
});

test('fetchJobBankCa throws when every keyword request fails (total outage)', async () => {
  await assert.rejects(
    () => fetchJobBankCa(FEED_URL, { fetchImpl: async () => errStatus(500), delayMs: 0, company: { jobbankca: { keywords: ['a', 'b'] } } }),
    /all 2 keyword request\(s\) failed/,
  );
});
