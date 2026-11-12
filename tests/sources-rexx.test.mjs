/**
 * rexx Systems source (CAR-270 — port of parent career-ops PR #6946,
 * providers/rexx.mjs) — the server-rendered "Jobportal" list page walked with
 * `?start=`, posting dates joined from the Atom feed the page advertises.
 *
 * Fixtures are fictional; their markup mirrors the two card skins observed on
 * live portals (newer `<article>` + `job_standort`, older `<div>` with
 * plain-text information columns).
 *
 * CI-isolated: injected fake fetchImpl, no network, no parent-layout
 * dependency, fixtures built in-file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  meta,
  resolveListUrl,
  isPublicNamedHost,
  resolveMaxPages,
  toEpochMs,
  parseListPage,
  assertListPage,
  findFeedUrl,
  parseFeedDates,
  assertRexxUrl,
  fetchRexx,
} from '../server/lib/sources/rexx.mjs';
import { rexxAdapter } from '../server/lib/portals/adapters/rexx.mjs';
import { boardTruncation } from '../server/lib/board-truncation.mjs';

const HOST = 'jobs.acme.example';
const LIST = `https://${HOST}/stellenangebote.html`;

// ── fixtures ────────────────────────────────────────────────────────────────

const newCard = (id, title, city, href) =>
  `<article class="joboffer_container" onclick="window.location.href='https://${HOST}/x-de-j${id}.html'">`
  + '<div class="joboffer_outer"><div class="joboffer_inner">'
  + `<div class="joboffer_title_text joboffer_box"><a target="_self" href="${href ?? `https://${HOST}/Job-${id}-de-j${id}.html`}">${title}</a>`
  + '<div class="job_details"><span class="job_details_second">mit Berufserfahrung</span></div><div class="job_teaser"></div></div>'
  + `<div class="joboffer_informations joboffer_box"><span class="job_standort">${city}</span><span class="distance"></span>`
  + '<div class="job_location">Präsenz</div><div class="jobcategory_details"></div></div>'
  + '</div></div></article>';

const oldCard = (id, title, boxes) =>
  '<div class="joboffer_container">'
  + `<div class="joboffer_title_text joboffer_box"><a target="_self" href="https://${HOST}/Job-${id}-de-j${id}.html">${title}</a><div id="job_teaser"></div></div>`
  + boxes.map((b) => `<div class="joboffer_informations joboffer_box">\n${b}\n</div>`).join('')
  + '</div>';

const feedLink = (href) => `<link rel="alternate" type="application/atom+xml" title="Jobs" href="${href}" />`;

const listPage = (cards, { head = '', allCount = null } = {}) =>
  `<html><head>${head}</head><body><div id="joboffer_table_container"${allCount !== null ? ` data-count="${allCount}" data-all-count="${allCount}"` : ''}>`
  + `<div id="joboffers">${cards.join('\n')}</div></div>`
  + '<p><a href="https://jobs.acme.example/initiativbewerbung-de-f12.html">Initiativbewerbung</a></p></body></html>';

const atom = (entries) =>
  '<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Jobs</title>'
  + '<updated>2026-11-12T09:00:00+01:00</updated>'
  + entries.map(([id, date]) => `<entry><title>Job ${id}</title><link href="https://${HOST}/Job-${id}-de-j${id}.html"></link>`
    + `<summary type="html">Teaser…</summary><updated>${date}</updated></entry>`).join('')
  + '</feed>';

const company = (extra = {}) => ({ name: 'Acme', careers_url: LIST, provider: 'rexx', ...extra });

/** A 200 text response the shared fetchText transport can read. */
const respond = (body) => ({
  ok: true,
  status: 200,
  text: async () => body,
  headers: { get: () => null },
});

/** A fetchImpl mock: `routes` answers exact URLs, everything else throws. */
const transport = (routes) => {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, opts });
    const r = routes[url];
    if (r === undefined) throw new Error(`unexpected request: ${url}`);
    if (r instanceof Error) throw r;
    return respond(typeof r === 'function' ? r() : r);
  };
  return { fetchImpl, calls };
};

const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { status });

// Runs `fn` with console.error captured, so a test can assert on (and keep out
// of the run's output) the source's truncation warnings.
const withErrors = async (fn) => {
  const errors = [];
  const original = console.error;
  console.error = (...args) => { errors.push(args.join(' ')); };
  try {
    return { result: await fn(), errors };
  } finally {
    console.error = original;
  }
};

// ── meta + adapter contract ─────────────────────────────────────────────────

test('rexx: meta exports the auto-discovery contract', () => {
  assert.deepEqual(meta, { value: 'rexx', label: 'Rexx Systems', region: 'en' });
});

test('rexx adapter: matches only an explicit provider: rexx pin (branded hosts are not auto-claimed)', () => {
  assert.equal(rexxAdapter.id, 'rexx');
  assert.equal(rexxAdapter.label, 'Rexx Systems');
  assert.equal(rexxAdapter.matches(company()), true);
  // No opt-in → never claimed, whatever the careers_url looks like.
  assert.equal(rexxAdapter.matches({ name: 'Acme', careers_url: LIST }), false);
  assert.equal(rexxAdapter.matches({ name: 'Acme', careers_url: `https://${HOST}/stellenangebote.html` }), false);
  assert.equal(rexxAdapter.matches({}), false);
  assert.equal(rexxAdapter.matches(null), false);
});

test('rexx adapter: buildEndpoint returns the resolved list URL string, null (never throws, never an object) otherwise', () => {
  assert.equal(rexxAdapter.buildEndpoint(company()), LIST);
  assert.equal(rexxAdapter.buildEndpoint(company({ careers_url: `https://${HOST}/` })), LIST);
  assert.equal(rexxAdapter.buildEndpoint(company({ api: `https://${HOST}/job-offers.html`, careers_url: 'https://www.acme.example/careers' })),
    `https://${HOST}/job-offers.html`);
  const junk = [null, {}, { careers_url: `http://${HOST}/stellenangebote.html` }, { careers_url: 'not a url' },
    { careers_url: 'https://169.254.169.254/latest/meta-data/' }, { careers_url: 'https://localhost/' },
    { careers_url: 'https://jobs.corp.internal/' }, { careers_url: 42 }, { provider: 'rexx' }];
  for (const entry of junk) {
    const endpoint = rexxAdapter.buildEndpoint(entry);
    assert.equal(endpoint, null, `buildEndpoint(${JSON.stringify(entry)})`);
    assert.ok(endpoint === null || typeof endpoint === 'string', 'string-or-null contract');
  }
});

// ── resolveListUrl ──────────────────────────────────────────────────────────

test('rexx: resolveListUrl keeps host + path, rebuilds the https origin, reads the default list page', () => {
  const cases = [
    [{ careers_url: `https://${HOST}` }, LIST, 'a bare host reads stellenangebote.html'],
    [{ careers_url: `https://${HOST}/?ac=jobad_rss` }, LIST, 'the query string is dropped and "/" gets the default list page'],
    [{ careers_url: 'https://karriere.exampleco.example/stellenmarkt/' },
      'https://karriere.exampleco.example/stellenmarkt/stellenangebote.html', 'a path prefix ending in "/" keeps the prefix'],
    [{ careers_url: 'https://karriere.exampleco.example/stellenmarkt/stellenangebote.html?start=20#top' },
      'https://karriere.exampleco.example/stellenmarkt/stellenangebote.html', 'an explicit list page is kept, query and fragment dropped'],
    [{ careers_url: `https://user:pw@${HOST}:8443/stellenangebote.html` }, LIST, 'credentials and port are discarded (origin rebuilt from the hostname)'],
    [{ api: `https://${HOST}/job-offers.html`, careers_url: 'https://www.acme.example/careers' },
      `https://${HOST}/job-offers.html`, 'api: wins over careers_url'],
  ];
  for (const [entry, want, label] of cases) {
    const got = resolveListUrl(entry);
    assert.deepEqual(got, { host: new URL(want).hostname, listUrl: want }, label);
  }
});

test('rexx: resolveListUrl returns null (no throw) for http, malformed, non-string, IP-literal, single-label and internal-suffix URLs', () => {
  const rejected = [{ careers_url: `http://${HOST}/stellenangebote.html` }, { careers_url: 'not a url' },
    { careers_url: 'https://169.254.169.254/latest/meta-data/' }, { careers_url: 'https://127.1/stellenangebote.html' },
    { careers_url: 'https://0x7f000001/' }, { careers_url: 'https://[::1]/' }, { careers_url: 'https://localhost/' },
    { careers_url: 'https://jobs.corp.internal/' }, { careers_url: 'https://intranet/' }, { careers_url: 'ftp://acme.example/x' },
    { careers_url: 42 }, { careers_url: null }, {}, null];
  for (const entry of rejected) {
    assert.equal(resolveListUrl(entry), null, `resolveListUrl(${JSON.stringify(entry)})`);
  }
});

test('rexx: isPublicNamedHost refuses single-label, IPv4/IPv6 literals and internal-style suffixes', () => {
  const ok = ['jobs.acme.example', 'karriere.example.co.uk', 'a.b.c.example'];
  const bad = ['', 'intranet', '169.254.169.254', '127.1', '0x7f000001', '[::1]', 'localhost',
    'jobs.corp.internal', 'box.local', 'x.localdomain', 'y.home.arpa', 'host.lan'];
  for (const host of ok) assert.equal(isPublicNamedHost(host), true, host);
  for (const host of bad) assert.equal(isPublicNamedHost(host), false, host);
});

// ── caps + dates ────────────────────────────────────────────────────────────

test('rexx: resolveMaxPages default 30, entry override, hard cap 200, junk falls back', () => {
  assert.equal(resolveMaxPages({}), 30);
  assert.equal(resolveMaxPages({ max_pages: 5 }), 5);
  assert.equal(resolveMaxPages({ max_pages: 99999 }), 200);
  assert.equal(resolveMaxPages({ max_pages: -1 }), 30);
  assert.equal(resolveMaxPages({ max_pages: '10' }), 30);
});

test('rexx: toEpochMs is NaN-safe (epoch 0 kept, junk → undefined)', () => {
  assert.equal(toEpochMs('1970-01-01T00:00:00Z'), 0);
  assert.equal(toEpochMs('2026-11-10T00:00:00+01:00'), Date.parse('2026-11-10T00:00:00+01:00'));
  assert.equal(toEpochMs('not a date'), undefined);
  assert.equal(toEpochMs(''), undefined);
  assert.equal(toEpochMs(undefined), undefined);
});

// ── parseListPage ───────────────────────────────────────────────────────────

test('rexx: parseListPage counts cards, drops off-host / non-posting / title-less cards, decodes entities', () => {
  const html = listPage([
    newCard(101, 'R&amp;D Engineer (m/w/d)', 'M&#252;nchen'),
    oldCard(102, 'IT-Consultant', ['Defence &amp; Space', 'Festangestellte', 'Berlin, Bonn']),
    newCard(103, 'Relative Link Job', 'Hamburg', '/stellenmarkt/Relative-Link-Job-de-j103.html?agid=7&amp;x=1'),
    newCard(104, 'Off-host Job', 'Essen', 'https://evil.example/Off-host-Job-de-j104.html'),
    newCard(105, 'Not a posting', 'Köln', `https://${HOST}/about.html`),
    newCard(106, '   ', 'Köln'),
  ]);
  const page = parseListPage(html, LIST, HOST);
  const byId = Object.fromEntries(page.rows.map((r) => [r.id, r]));

  assert.equal(page.rawCount, 6, 'rawCount = every card the source rendered');
  assert.deepEqual(page.rows.map((r) => r.id).sort(), ['101', '102', '103'], 'drops off-host, non-posting and title-less cards');
  assert.equal(byId['101'].title, 'R&D Engineer (m/w/d)');
  assert.equal(byId['101'].location, 'München');
  assert.equal(byId['101'].url, `https://${HOST}/Job-101-de-j101.html`, 'keeps the absolute posting URL');
  assert.equal(byId['103'].url, `https://${HOST}/stellenmarkt/Relative-Link-Job-de-j103.html?agid=7&x=1`,
    'resolves a relative href against the page and decodes &amp; in it');
  assert.equal(byId['102'].location, 'Berlin, Bonn', "reads an older skin's last plain-text information column as the location");
  assert.equal(page.hasContainer, true);
  assert.equal(page.hasDetailLinks, true);
  assert.equal(page.total, null);
});

test('rexx: parseListPage reads data-all-count as the stated total', () => {
  assert.equal(parseListPage(listPage([], { allCount: 278 }), LIST, HOST).total, 278);
  assert.equal(parseListPage(listPage([newCard(1, 'A', 'X')]), LIST, HOST).total, null);
  assert.equal(parseListPage('not html at all', LIST, HOST).rawCount, 0, 'non-string input never throws');
});

// ── empty vs broken ─────────────────────────────────────────────────────────

test('rexx: assertListPage accepts a #joboffers container with no cards (empty board)', () => {
  const emptyPage = parseListPage('<div id="joboffers"><div id="joboffers_message"><span>Keine Treffer</span></div></div>', LIST, HOST);
  assert.doesNotThrow(() => assertListPage(emptyPage, LIST));
});

test('rexx: assertListPage throws when posting links are present but no card parsed (markup change)', () => {
  const changed = parseListPage(`<div id="joboffers"><li class="job-row"><a href="https://${HOST}/Job-9-de-j9.html">Job</a></li></div>`, LIST, HOST);
  assert.throws(() => assertListPage(changed, LIST), /markup changed/);
});

test('rexx: assertListPage throws on a page with neither cards nor the #joboffers container', () => {
  const notRexx = parseListPage('<html><body><h1>Karriere</h1></body></html>', LIST, HOST);
  assert.throws(() => assertListPage(notRexx, LIST), /not a rexx job list/);
});

// ── feed discovery + dates ──────────────────────────────────────────────────

test('rexx: findFeedUrl takes the advertised same-host feed (entities decoded, relative hrefs resolved)', () => {
  const same = findFeedUrl(feedLink(`https://${HOST}/rss_generator-rss0.php?unit=acme&amp;lang=de`), LIST, HOST);
  assert.equal(same, `https://${HOST}/rss_generator-rss0.php?unit=acme&lang=de`);
  const rel = findFeedUrl(feedLink('rss_generator-rss0.php?unit=acme'),
    'https://karriere.exampleco.example/stellenmarkt/stellenangebote.html', 'karriere.exampleco.example');
  assert.equal(rel, 'https://karriere.exampleco.example/stellenmarkt/stellenmarkt/rss_generator-rss0.php?unit=acme'.replace('/stellenmarkt/stellenmarkt', '/stellenmarkt'),
    'relative href resolved against the list page');
});

test('rexx: findFeedUrl ignores off-host, other-port, non-https and non-feed <link> tags', () => {
  const ignored = [feedLink('https://169.254.169.254/latest/meta-data'), feedLink(`http://${HOST}/feed.xml`),
    feedLink('https://jobs.acme.example.evil.example/feed'), feedLink(`https://${HOST}:8443/feed.xml`),
    '<link rel="stylesheet" type="text/css" href="https://jobs.acme.example/a.css">'];
  for (const html of ignored) {
    assert.equal(findFeedUrl(html, LIST, HOST), null, `findFeedUrl must ignore: ${html.slice(0, 60)}`);
  }
});

test('rexx: parseFeedDates maps job id → date, NaN-safe (epoch 0 kept, junk and off-host skipped)', () => {
  const dates = parseFeedDates(atom([['101', '2026-11-10T00:00:00+01:00'], ['102', 'not a date'], ['103', '1970-01-01T00:00:00Z']])
    + '<entry><title>Off-host</title><link href="https://evil.example/X-de-j999.html"/><updated>2026-01-01</updated></entry>', LIST, HOST);
  assert.equal(dates.get('101'), Date.parse('2026-11-10T00:00:00+01:00'));
  assert.equal(dates.has('102'), false);
  assert.equal(dates.get('103'), 0);
  assert.equal(dates.has('999'), false);
});

test('rexx: parseFeedDates also reads an RSS 2.0 <item>', () => {
  const rss = parseFeedDates(`<rss><channel><item><title>A</title><link>https://${HOST}/A-de-j7.html</link>`
    + '<pubDate>Tue, 10 Nov 2026 08:00:00 GMT</pubDate></item></channel></rss>', LIST, HOST);
  assert.equal(rss.get('7'), Date.parse('Tue, 10 Nov 2026 08:00:00 GMT'));
});

test('rexx: parseFeedDates skips a rel="self" link and prefers <updated> over an earlier <published>', () => {
  const selfFirst = parseFeedDates(`<feed><entry><link rel="self" href="https://${HOST}/feed/entry-8"/><link rel="alternate" href="https://${HOST}/H-de-j8.html"/>`
    + '<published>2026-10-01T00:00:00Z</published><updated>2026-11-01T00:00:00Z</updated></entry></feed>', LIST, HOST);
  assert.equal(selfFirst.get('8'), Date.parse('2026-11-01T00:00:00Z'));
});

test('rexx: parseFeedDates keeps the first posting link when later links are not postings', () => {
  const postingFirst = parseFeedDates(`<feed><entry><link href="https://${HOST}/Q-de-j10.html"/><link rel="related" href="https://evil.example/x"/>`
    + '<updated>2026-11-02T00:00:00Z</updated></entry></feed>', LIST, HOST);
  assert.equal(postingFirst.get('10'), Date.parse('2026-11-02T00:00:00Z'));
});

test('rexx: parseFeedDates falls back to <published> when an entry has no <updated>, tolerates a non-feed body', () => {
  const pubOnly = parseFeedDates(`<feed><entry><link href="https://${HOST}/P-de-j9.html"/><published>2026-10-05T00:00:00Z</published></entry></feed>`, LIST, HOST);
  assert.equal(pubOnly.get('9'), Date.parse('2026-10-05T00:00:00Z'));
  assert.equal(parseFeedDates(undefined, LIST, HOST).size, 0);
  assert.equal(parseFeedDates('<html>404</html>', LIST, HOST).size, 0);
});

// ── assertRexxUrl (defence-in-depth on every request URL) ───────────────────

test('rexx: assertRexxUrl requires https on a public named host', () => {
  assert.equal(assertRexxUrl(LIST), LIST);
  for (const url of ['http://jobs.acme.example/stellenangebote.html', 'not a url', 'https://169.254.169.254/feed',
    'https://127.1/x', 'https://[::1]/x', 'https://localhost/x', 'https://jobs.corp.internal/x', 'https://intranet/x']) {
    assert.throws(() => assertRexxUrl(url), /rexx:/, url);
  }
});

// ── fetchRexx: one-page board + feed ────────────────────────────────────────

test('fetchRexx: reads the list, confirms the end with ?start=, reads the feed once, joins dates by job id', async () => {
  const FEED = `https://${HOST}/rss_generator-rss0.php?unit=acme&lang=de`;
  const { fetchImpl, calls } = transport({
    [LIST]: listPage([newCard(1, 'Security Analyst', 'Essen'), oldCard(2, 'SOC Engineer', ['Defence', 'Festangestellte', 'Berlin'])],
      { head: feedLink(FEED.replaceAll('&', '&amp;')) }),
    [`${LIST}?start=2`]: listPage([]),
    [FEED]: atom([['1', '2026-11-03T00:00:00+01:00']]),
  });
  const jobs = await fetchRexx(LIST, { fetchImpl, company: company({ careers_url: `https://${HOST}/` }) });

  assert.deepEqual(calls.map((c) => c.url), [LIST, `${LIST}?start=2`, FEED]);
  assert.ok(calls.every((c) => c.opts.redirect === 'error'), 'redirect: "error" on every request (list pages and feed)');

  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].title, 'Security Analyst');
  assert.equal(jobs[0].location, 'Essen');
  assert.equal(jobs[0].source, 'rexx');
  assert.equal(jobs[0].id, 'rexx-1');
  assert.equal(jobs[0].url, `https://${HOST}/Job-1-de-j1.html`);
  assert.equal(jobs[1].location, 'Berlin');

  // Feed dates joined by job id; an unmatched posting stays undated ('').
  assert.equal(jobs[0].date, new Date(Date.parse('2026-11-03T00:00:00+01:00')).toISOString());
  assert.equal(jobs[1].date, '');

  // A complete board carries no truncation marker and no internal fields.
  assert.equal(boardTruncation(jobs), null);
  for (const key of Object.keys(jobs[0])) {
    assert.match(key, /^(id|title|company|url|salary|location|isRemote|workplaceType|relocates|date|snippet|source)$/, key);
  }
});

// ── fetchRexx: pagination, dedup, short-page end ────────────────────────────

test('fetchRexx: walks ?start= by the page card count, dedups by job id, ends on a short page', async () => {
  const { fetchImpl, calls } = transport({
    [LIST]: listPage([newCard(1, 'A', 'X'), newCard(2, 'B', 'X')]),
    [`${LIST}?start=2`]: listPage([newCard(2, 'B again', 'X'), newCard(3, 'C', 'X')]),
    [`${LIST}?start=4`]: listPage([newCard(4, 'D', 'X')]),
  });
  const jobs = await fetchRexx(LIST, { fetchImpl, company: company() });
  assert.equal(jobs.length, 4);
  assert.equal(new Set(jobs.map((j) => j.url)).size, 4, 'deduped by job id');
  assert.deepEqual(calls.map((c) => c.url), [LIST, `${LIST}?start=2`, `${LIST}?start=4`]);
});

test('fetchRexx: advances ?start= by the cards the source rendered, not the rows that parsed', async () => {
  const { fetchImpl, calls } = transport({
    [LIST]: listPage([newCard(1, 'A', 'X'), newCard(2, 'Off-host', 'X', 'https://evil.example/B-de-j2.html')]),
    [`${LIST}?start=2`]: listPage([newCard(3, 'C', 'X'), newCard(4, 'D', 'X')]),
    [`${LIST}?start=4`]: listPage([]),
  });
  const jobs = await fetchRexx(LIST, { fetchImpl, company: company() });
  assert.equal(jobs.length, 3);
  assert.equal(calls[1].url, `${LIST}?start=2`);
});

// ── fetchRexx: a portal that ignores ?start= ────────────────────────────────

test('fetchRexx: stops when a page brings nothing new (portal ignored ?start=), unmarked without a stated total', async () => {
  const same = listPage([newCard(1, 'A', 'X'), newCard(2, 'B', 'X')]);
  const { fetchImpl, calls } = transport({ [LIST]: same, [`${LIST}?start=2`]: same });
  const { result: jobs } = await withErrors(() => fetchRexx(LIST, { fetchImpl, company: company() }));
  assert.equal(jobs.length, 2);
  assert.equal(calls.length, 2);
  assert.equal(boardTruncation(jobs), null);
});

test('fetchRexx: leaves a repeated page unmarked when data-all-count equals what was read', async () => {
  const sameEq = listPage([newCard(1, 'A', 'X'), newCard(2, 'B', 'X')], { allCount: 2 });
  const { fetchImpl } = transport({ [LIST]: sameEq, [`${LIST}?start=2`]: sameEq });
  const { result: jobs, errors } = await withErrors(() => fetchRexx(LIST, { fetchImpl, company: company() }));
  assert.equal(jobs.length, 2);
  assert.equal(boardTruncation(jobs), null);
  assert.equal(errors.length, 0);
});

test('fetchRexx: marks a repeated page as truncated (repeat-page) when data-all-count exceeds what was read', async () => {
  const sameTot = listPage([newCard(1, 'A', 'X'), newCard(2, 'B', 'X')], { allCount: 30 });
  const { fetchImpl, calls } = transport({ [LIST]: sameTot, [`${LIST}?start=2`]: sameTot });
  const { result: jobs, errors } = await withErrors(() => fetchRexx(LIST, { fetchImpl, company: company() }));
  assert.equal(jobs.length, 2);
  assert.equal(calls.length, 2);
  assert.equal(boardTruncation(jobs)?.reason, 'repeat-page');
  assert.equal(boardTruncation(jobs)?.total, 30);
  assert.ok(errors.some((e) => /repeated a page/.test(e)), errors.join(' | '));
});

// ── SSRF: the entry guard runs before any request ───────────────────────────

test('fetchRexx: rejects an unusable careers_url before any fetch (0 calls, no throw-leak into the transport)', async () => {
  for (const careers_url of [`http://${HOST}/stellenangebote.html`, 'https//broken', undefined,
    'https://169.254.169.254/latest/meta-data/', 'https://127.1/stellenangebote.html', 'https://0x7f000001/',
    'https://[::1]/', 'https://localhost/', 'https://jobs.corp.internal/', 'https://intranet/']) {
    const { fetchImpl, calls } = transport({});
    let threw = null;
    try {
      await fetchRexx(LIST, { fetchImpl, company: company({ careers_url }) });
    } catch (e) { threw = e; }
    assert.ok(threw, `expected a throw for careers_url ${JSON.stringify(careers_url)}`);
    assert.equal(calls.length, 0, `0 fetch calls for careers_url ${JSON.stringify(careers_url)}`);
  }
});

test('fetchRexx: never requests a feed URL off the portal host', async () => {
  const { fetchImpl, calls } = transport({
    [LIST]: listPage([newCard(1, 'A', 'X')], { head: feedLink('https://169.254.169.254/latest/meta-data') }),
    [`${LIST}?start=1`]: listPage([]),
  });
  const jobs = await fetchRexx(LIST, { fetchImpl, company: company() });
  assert.equal(jobs.length, 1);
  assert.ok(calls.every((c) => new URL(c.url).hostname === HOST), calls.map((c) => c.url).join(' | '));
});

// ── empty / broken boards through fetch ─────────────────────────────────────

test('fetchRexx: returns [] for an empty board with no further requests', async () => {
  const { fetchImpl, calls } = transport({ [LIST]: listPage([]) });
  const jobs = await fetchRexx(LIST, { fetchImpl, company: company() });
  assert.deepEqual(jobs, []);
  assert.equal(calls.length, 1);
});

test('fetchRexx: throws on a page that is not a rexx list', async () => {
  const { fetchImpl } = transport({ [LIST]: '<html><body>Wartungsarbeiten</body></html>' });
  await assert.rejects(
    () => fetchRexx(LIST, { fetchImpl, company: company() }),
    /not a rexx job list/,
  );
});

// ── health probe (opts.maxPages) ────────────────────────────────────────────

test('fetchRexx: probe mode issues exactly one list request, no feed, no truncation marker or warning', async () => {
  const FEED = `https://${HOST}/feed.xml`;
  const { fetchImpl, calls } = transport({
    [LIST]: listPage([newCard(1, 'A', 'X'), newCard(2, 'B', 'X')], { head: feedLink(FEED) }),
  });
  const { result: jobs, errors } = await withErrors(() => fetchRexx(LIST, { fetchImpl, company: company(), maxPages: 1 }));
  assert.equal(calls.length, 1);
  assert.equal(jobs.length, 2);
  assert.equal(boardTruncation(jobs), null);
  assert.equal(errors.length, 0);
});

test('fetchRexx: propagates a transport rejection unwrapped while probing (first page)', async () => {
  const budget = httpError(403);
  const { fetchImpl } = transport({ [LIST]: budget });
  await assert.rejects(
    () => fetchRexx(LIST, { fetchImpl, company: company(), maxPages: 1 }),
    (err) => err === budget || err.status === 403,
  );
});

test('fetchRexx: propagates a later-page rejection unwrapped while probing (2-page budget)', async () => {
  const later = httpError(403);
  const { fetchImpl } = transport({ [LIST]: listPage([newCard(1, 'A', 'X')]), [`${LIST}?start=1`]: later });
  await assert.rejects(
    () => fetchRexx(LIST, { fetchImpl, company: company(), maxPages: 2 }),
    (err) => err === later || err.status === 403,
  );
});

// ── page cap ────────────────────────────────────────────────────────────────

test('fetchRexx: stops at the entry max_pages, warns "raise max_pages" and marks the board page-cap', async () => {
  const { fetchImpl, calls } = transport({
    [LIST]: listPage([newCard(1, 'A', 'X'), newCard(2, 'B', 'X')]),
    [`${LIST}?start=2`]: listPage([newCard(3, 'C', 'X'), newCard(4, 'D', 'X')]),
    [`${LIST}?start=4`]: listPage([newCard(5, 'E', 'X'), newCard(6, 'F', 'X')]),
  });
  const { result: jobs, errors } = await withErrors(() =>
    fetchRexx(LIST, { fetchImpl, company: company({ max_pages: 2 }) }));
  assert.equal(jobs.length, 4);
  assert.equal(calls.length, 2);
  assert.equal(boardTruncation(jobs)?.reason, 'page-cap');
  assert.ok(errors.some((e) => /raise max_pages/.test(e)), errors.join(' | '));
});

test('fetchRexx: treats a short page at the cap boundary as complete (no warning, no marker)', async () => {
  const { fetchImpl } = transport({
    [LIST]: listPage([newCard(1, 'A', 'X'), newCard(2, 'B', 'X')]),
    [`${LIST}?start=2`]: listPage([newCard(3, 'C', 'X')]),
  });
  const { result: jobs, errors } = await withErrors(() =>
    fetchRexx(LIST, { fetchImpl, company: company({ max_pages: 2 }) }));
  assert.equal(jobs.length, 3);
  assert.equal(boardTruncation(jobs), null);
  assert.equal(errors.length, 0);
});

test('fetchRexx: keeps a full boundary page truncated (page-cap) even when data-all-count is reached', async () => {
  const { fetchImpl, calls } = transport({
    [LIST]: listPage([newCard(1, 'A', 'X'), newCard(2, 'B', 'X')], { allCount: 4 }),
    [`${LIST}?start=2`]: listPage([newCard(3, 'C', 'X'), newCard(4, 'D', 'X')], { allCount: 4 }),
    [`${LIST}?start=4`]: listPage([newCard(5, 'E', 'X'), newCard(6, 'F', 'X')], { allCount: 4 }),
  });
  const { result: jobs, errors } = await withErrors(() =>
    fetchRexx(LIST, { fetchImpl, company: company({ max_pages: 2 }) }));
  assert.equal(jobs.length, 4);
  assert.equal(calls.length, 2);
  assert.equal(boardTruncation(jobs)?.reason, 'page-cap');
  assert.ok(errors.some((e) => /raise max_pages/.test(e)), errors.join(' | '));
});

// ── later-page fetch error: keep partial, never blame max_pages ─────────────

test('fetchRexx: retries a failing page (transient 503), then keeps the pages already read with a fetch-error marker', async () => {
  let p2 = 0;
  const { fetchImpl } = transport({
    [LIST]: listPage([newCard(1, 'A', 'X'), newCard(2, 'B', 'X')]),
    [`${LIST}?start=2`]: () => { p2 += 1; throw httpError(503); },
  });
  const { result: jobs, errors } = await withErrors(() => fetchRexx(LIST, { fetchImpl, company: company() }));
  assert.equal(jobs.length, 2, 'partials kept');
  assert.equal(p2, 3, 'fetchTextWithRetry: 3 attempts for a transient failure');
  assert.ok(!errors.some((e) => /raise max_pages/.test(e)), 'never blames max_pages');
  assert.ok(errors.some((e) => /stopped at page 2/.test(e)), errors.join(' | '));
  assert.equal(boardTruncation(jobs)?.reason, 'fetch-error');
}, { timeout: 20000 });

test('fetchRexx: fails loud when the first list page cannot be read', async () => {
  const { fetchImpl } = transport({ [LIST]: httpError(404) });
  await assert.rejects(() => fetchRexx(LIST, { fetchImpl, company: company() }), /404/);
});

// ── feed failure is best-effort ─────────────────────────────────────────────

test('fetchRexx: keeps the postings undated when the feed cannot be read', async () => {
  const FEED = `https://${HOST}/feed.xml`;
  const { fetchImpl } = transport({
    [LIST]: listPage([newCard(1, 'A', 'X')], { head: feedLink(FEED) }),
    [`${LIST}?start=1`]: listPage([]),
    [FEED]: httpError(404),
  });
  const { result: jobs, errors } = await withErrors(() => fetchRexx(LIST, { fetchImpl, company: company() }));
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].date, '');
  assert.ok(errors.some((e) => /feed unreadable/.test(e)), errors.join(' | '));
  assert.equal(boardTruncation(jobs), null);
});
