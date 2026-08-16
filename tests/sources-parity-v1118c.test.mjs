/**
 * v1.118 parent-parity sources — hecklerkoch / rheinmetall / larajobs.
 * Fetch/parse with a stubbed transport (no network), host-pinning, meta shape
 * for the scan dropdown, and adapter matches()/buildEndpoint(). Fixtures are
 * adapted to the web-ui provider contract for hecklerkoch, rheinmetall, larajobs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  meta as hkMeta, resolveListUrl as hkResolveListUrl, parseListing,
  fetchHecklerkoch, DEFAULT_LIST_URL as HK_DEFAULT_LIST_URL,
} from '../server/lib/sources/hecklerkoch.mjs';
import { hecklerkochAdapter } from '../server/lib/portals/adapters/hecklerkoch.mjs';
import {
  meta as rhmMeta, resolveListUrl as rhmResolveListUrl, parseVacancies,
  fetchRheinmetall, DEFAULT_LIST_URL as RHM_DEFAULT_LIST_URL,
} from '../server/lib/sources/rheinmetall.mjs';
import { rheinmetallAdapter } from '../server/lib/portals/adapters/rheinmetall.mjs';
import { meta as ljMeta, parseLarajobsFeed, fetchLarajobs, FEED_URL as LJ_FEED_URL } from '../server/lib/sources/larajobs.mjs';
import { larajobsAdapter } from '../server/lib/portals/adapters/larajobs.mjs';

const textResponse = (s) => ({ ok: true, status: 200, text: async () => s, json: async () => JSON.parse(s) });

// ---------------------------------------------------------------- fixtures

// Heckler & Koch SSR card — jobposting/{hash} anchor wrapping the <h3> title.
const hkCard = (hash, title) =>
  `<a to="[object Object]" href="https://karriere.heckler-koch.com/jobposting/${hash}" target="_blank" rel="noreferrer" class="group flex">`
  + `<div class="text-secondary font-medium"><p> Produktion | Direkteinstieg </p><h3 class="text-lg md:text-2xl">${title}</h3></div>`
  + '<i class="pl-4 icon-chevron"></i></a>';
const hkHtml = '<html>'
  + hkCard('d1be4446a082dd289578456f38fb82473beedb350', 'Maschineneinrichter (m/w/d) - Fr&#228;sen')
  + hkCard('ba2bf2265bc08d4d5df5993b33a0f4d05e4bd7ed0', 'Werkstudent Arbeitssicherheit (m/w/d)')
  + '</html>';

// Rheinmetall SSR card — ONE card holds THREE anchors to the same job; a
// cross-card regex would pair card A's trailing anchor with card B's title.
const rhmCard = (id, title, org) =>
  '<div class="flex gap-0.5 group">'
  + `<a href="/en/job/slug_${id}/${id}" target="_blank">img</a>`
  + `<div><a href="/en/job/slug_${id}/${id}"><div class="text-sm font-bold md:text-xl mb-2">${title}</div></a>`
  + `<div class="flex flex-wrap mr-6"> ${org} </div></div>`
  + `<a href="/en/job/slug_${id}/${id}">arrow</a>`
  + '</div>';
const rhmPageHtml = '<html>'
  + rhmCard('111', 'Fertigungssteuerer (m/w/d)', 'Rheinmetall Landsysteme GmbH | Kassel')
  + rhmCard('222', 'Softwareentwickler &amp; Architekt', 'Rheinmetall Air Defence AG | Z&#252;rich')
  + '</html>';

// LaraJobs RSS — job: namespace + dc:creator fallback + a link-less ghost.
const ljXml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rss version="2.0" xmlns:job="https://larajobs.com/ns/job" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>',
  '<title>LaraJobs</title>',
  '<item>',
  '  <title>Laravel &amp; Vue Developer</title>',
  '  <link>https://larajobs.com/job/3899</link>',
  '  <pubDate>Thu, 02 Jul 2026 13:09:40 +0000</pubDate>',
  '  <dc:creator><![CDATA[Fallback Co]]></dc:creator>',
  '  <job:company><![CDATA[Acme PHP]]></job:company>',
  '  <job:location><![CDATA[Remote (US)]]></job:location>',
  '</item>',
  '<item>',
  '  <title>Backend Engineer</title>',
  '  <link>https://larajobs.com/job/3900</link>',
  '  <dc:creator><![CDATA[Only Creator Co]]></dc:creator>',
  '</item>',
  '<item>',
  '  <title>Ghost (no link)</title>',
  '</item>',
  '<item>',
  '  <title>Off-host</title>',
  '  <link>https://phish.example.com/job/1</link>',
  '</item>',
  '</channel></rss>',
].join('\n');

// ------------------------------------------------------------------- tests

test('all three sources export a valid meta (scan dropdown auto-discovery)', () => {
  for (const m of [hkMeta, rhmMeta, ljMeta]) {
    assert.equal(typeof m.value, 'string');
    assert.equal(typeof m.label, 'string');
    assert.equal(m.region, 'en');
  }
  assert.deepEqual([hkMeta.value, rhmMeta.value, ljMeta.value].sort(),
    ['hecklerkoch', 'larajobs', 'rheinmetall']);
  assert.equal(hkMeta.label, 'Heckler & Koch');
  assert.equal(rhmMeta.label, 'Rheinmetall');
  assert.equal(ljMeta.label, 'LaraJobs');
});

test('hecklerkoch: list URL is host-pinned; defaults to the Stellenangebote list', () => {
  assert.equal(hkResolveListUrl({ careers_url: 'https://www.heckler-koch.com/en/Career' }),
    'https://www.heckler-koch.com/de/Karriere/Stellenangebote');
  assert.equal(hkResolveListUrl({ api: 'https://www.heckler-koch.com/de/Karriere/Stellenangebote' }),
    'https://www.heckler-koch.com/de/Karriere/Stellenangebote');
  // spoofed / http hosts rejected
  assert.equal(hkResolveListUrl({ careers_url: 'https://evil.com/x.heckler-koch.com' }), null);
  assert.equal(hkResolveListUrl({ careers_url: 'https://heckler-koch.com.evil.com/x' }), null);
  assert.equal(hkResolveListUrl({ careers_url: 'http://www.heckler-koch.com/de/Karriere' }), null); // https only
});

test('hecklerkoch: parseListing anchors on jobposting/{hash} and decodes titles', () => {
  const rows = parseListing(hkHtml);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, 'Maschineneinrichter (m/w/d) - Fräsen'); // &#228; decoded
  assert.equal(rows[0].url, 'https://karriere.heckler-koch.com/jobposting/d1be4446a082dd289578456f38fb82473beedb350');
  assert.equal(parseListing('<html>no jobs</html>').length, 0);
  assert.equal(parseListing(undefined).length, 0);
  // A malformed numeric entity (lone surrogate half) degrades to literal text,
  // never throws RangeError and aborts the whole parse.
  const badRows = parseListing('<html>' + hkCard('badhash0000000000000000000000000000000000', 'Bad&#xD800;Entity') + '</html>');
  assert.equal(badRows.length, 1);
  assert.equal(badRows[0].title, 'Bad&#xD800;Entity');
});

test('hecklerkoch: fetch normalizes jobs from one request and rejects evil endpoints', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, redirect: init.redirect });
    return textResponse(hkHtml);
  };
  const jobs = await fetchHecklerkoch(HK_DEFAULT_LIST_URL, { fetchImpl, company: { name: 'Heckler & Koch' } });
  assert.equal(calls.length, 1); // single request — the whole board is one SSR page
  assert.equal(calls[0].redirect, 'error');
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].company, 'Heckler & Koch');
  assert.equal(jobs[0].location, ''); // single-site board, empty by design
  assert.equal(jobs[0].source, 'hecklerkoch');
  assert.equal(jobs[0].id, 'hecklerkoch-d1be4446a082dd289578456f38fb82473beedb350');
  await assert.rejects(() => fetchHecklerkoch('https://evil.example.com/jobs', { fetchImpl }), /untrusted hostname/);
  await assert.rejects(() => fetchHecklerkoch('http://www.heckler-koch.com/de/Karriere/Stellenangebote', { fetchImpl }), /HTTPS/);
});

test('rheinmetall: list URL keeps an explicit locale list, defaults to /en, rejects spoofs', () => {
  assert.equal(rhmResolveListUrl({ api: 'https://www.rheinmetall.com/de/career/vacancies' }),
    'https://www.rheinmetall.com/de/career/vacancies');
  assert.equal(rhmResolveListUrl({ careers_url: 'https://www.rheinmetall.com/en/career' }),
    'https://www.rheinmetall.com/en/career/vacancies');
  assert.equal(rhmResolveListUrl({ careers_url: 'https://evil.com/x.rheinmetall.com' }), null);
  assert.equal(rhmResolveListUrl({ careers_url: 'https://rheinmetall.com.evil.com/en/career/vacancies' }), null);
  assert.equal(rhmResolveListUrl({ careers_url: 'http://www.rheinmetall.com/en/career/vacancies' }), null); // https only
});

test('rheinmetall: parseVacancies pairs each id with ITS OWN title (no cross-card bleed)', () => {
  const rows = parseVacancies(rhmPageHtml, 'https://www.rheinmetall.com');
  assert.equal(rows.length, 2); // 3 anchors per card collapse to one row
  assert.equal(rows[0].title, 'Fertigungssteuerer (m/w/d)');
  assert.equal(rows[1].title, 'Softwareentwickler & Architekt'); // &amp; decoded
  assert.equal(rows[0].location, 'Kassel'); // city from "Company | City"
  assert.equal(rows[1].location, 'Zürich'); // &#252; decoded
  assert.equal(rows[0].url, 'https://www.rheinmetall.com/en/job/slug_111/111');
  assert.equal(parseVacancies('<html>no cards</html>', 'https://x').length, 0);
  assert.equal(parseVacancies(undefined, 'https://x').length, 0);
});

test('rheinmetall: fetch paginates ?page=N and stops on a clamped (no-fresh-ids) page', async () => {
  const pages = [
    rhmPageHtml,
    '<html>' + rhmCard('333', 'C', 'X GmbH | Kiel') + '</html>',
    '<html>' + rhmCard('333', 'C', 'X GmbH | Kiel') + '</html>', // server clamps past the end
  ];
  let calls = 0;
  const seenUrls = [];
  const fetchImpl = async (url) => { seenUrls.push(url); return textResponse(pages[calls++] ?? pages[2]); };
  const jobs = await fetchRheinmetall(RHM_DEFAULT_LIST_URL, { fetchImpl, company: { name: 'Rheinmetall' } });
  assert.equal(calls, 3); // page 3 brought no fresh ids → stop
  assert.equal(jobs.length, 3);
  assert.ok(seenUrls[0].endsWith('?page=1')); // 1-based pagination
  assert.ok(seenUrls[1].endsWith('?page=2'));
  assert.equal(jobs[0].company, 'Rheinmetall');
  assert.equal(jobs[0].source, 'rheinmetall');
  assert.equal(jobs[0].id, 'rheinmetall-111');
  assert.equal(jobs[0].date, ''); // the list carries no posting date
  await assert.rejects(() => fetchRheinmetall('https://evil.example.com/en/career/vacancies', { fetchImpl }), /untrusted hostname/);
});

test('rheinmetall: fetch honours a per-company max_pages walk cap', async () => {
  const uniquePage = (n) => '<html>' + rhmCard(String(1000 + n), `Job ${n}`, `X GmbH | City${n}`) + '</html>';
  let calls = 0;
  const fetchImpl = async () => textResponse(uniquePage(calls++));
  const jobs = await fetchRheinmetall(RHM_DEFAULT_LIST_URL, { fetchImpl, company: { name: 'Rheinmetall', max_pages: 2 } });
  assert.equal(calls, 2); // capped despite every page bringing fresh ids
  assert.equal(jobs.length, 2);
});

test('larajobs: parse reads the job: namespace, falls back to dc:creator, drops bad links', () => {
  const jobs = parseLarajobsFeed(ljXml, 'LaraJobs');
  assert.equal(jobs.length, 2); // ghost (no link) + off-host link dropped
  assert.equal(jobs[0].title, 'Laravel & Vue Developer'); // &amp; decoded
  assert.equal(jobs[0].url, 'https://larajobs.com/job/3899');
  assert.equal(jobs[0].company, 'Acme PHP'); // job:company wins over dc:creator
  assert.equal(jobs[0].location, 'Remote (US)');
  assert.equal(jobs[0].isRemote, true); // remote flagged from job:location
  assert.equal(jobs[0].date, '2026-07-02'); // pubDate → ISO date
  assert.equal(jobs[0].source, 'larajobs');
  assert.equal(jobs[1].company, 'Only Creator Co'); // dc:creator fallback
  assert.equal(jobs[1].location, '');
  assert.equal(jobs[1].isRemote, false);
  assert.equal(jobs[1].date, ''); // missing pubDate tolerated
  // robustness + company fallback to the entry name
  assert.equal(parseLarajobsFeed('', 'X').length, 0);
  assert.equal(parseLarajobsFeed(null, 'X').length, 0);
  const bare = parseLarajobsFeed('<item><title>Bare</title><link>https://larajobs.com/job/1</link></item>', 'FallbackName');
  assert.equal(bare[0].company, 'FallbackName');
});

test('larajobs: fetch pins the request to larajobs.com with redirect:error', async () => {
  const jobs = await fetchLarajobs(LJ_FEED_URL, {
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://larajobs.com/feed');
      assert.equal(init.redirect, 'error');
      return textResponse(ljXml);
    },
    company: { name: 'LaraJobs' },
  });
  assert.equal(jobs.length, 2);
  await assert.rejects(() => fetchLarajobs('https://evil.example.com/feed', { fetchImpl: async () => textResponse(ljXml) }), /untrusted hostname/);
  await assert.rejects(() => fetchLarajobs('http://larajobs.com/feed', { fetchImpl: async () => textResponse(ljXml) }), /HTTPS/);
});

test('adapters: matches() + buildEndpoint() contracts (endpoint is a string or null)', () => {
  // single-company: provider OR host (parent detect parity)
  assert.equal(hecklerkochAdapter.matches({ careers_url: 'https://www.heckler-koch.com/de/Karriere/Stellenangebote' }), true);
  assert.equal(hecklerkochAdapter.matches({ provider: 'hecklerkoch' }), true);
  assert.equal(hecklerkochAdapter.matches({ careers_url: 'https://evil.com/x.heckler-koch.com' }), false);
  assert.equal(hecklerkochAdapter.buildEndpoint({ careers_url: 'https://www.heckler-koch.com/en/Career' }),
    'https://www.heckler-koch.com/de/Karriere/Stellenangebote');
  assert.equal(hecklerkochAdapter.buildEndpoint({ provider: 'hecklerkoch' }), HK_DEFAULT_LIST_URL);
  assert.equal(hecklerkochAdapter.buildEndpoint({ careers_url: 'https://example.com/jobs' }), null);

  assert.equal(rheinmetallAdapter.matches({ careers_url: 'https://www.rheinmetall.com/en/career' }), true);
  assert.equal(rheinmetallAdapter.matches({ provider: 'rheinmetall' }), true);
  assert.equal(rheinmetallAdapter.matches({ careers_url: 'https://rheinmetall.com.evil.com/en/career/vacancies' }), false);
  assert.equal(rheinmetallAdapter.buildEndpoint({ api: 'https://www.rheinmetall.com/de/career/vacancies' }),
    'https://www.rheinmetall.com/de/career/vacancies');
  assert.equal(rheinmetallAdapter.buildEndpoint({ provider: 'rheinmetall' }), RHM_DEFAULT_LIST_URL);
  assert.equal(rheinmetallAdapter.buildEndpoint({ careers_url: 'https://example.com/jobs' }), null);

  // board-wide: explicit provider only, host-pinned override
  assert.equal(larajobsAdapter.matches({ careers_url: 'https://larajobs.com/x' }), false);
  assert.equal(larajobsAdapter.matches({ provider: 'larajobs' }), true);
  assert.equal(larajobsAdapter.buildEndpoint({ provider: 'larajobs' }), LJ_FEED_URL);
  assert.equal(larajobsAdapter.buildEndpoint({ provider: 'larajobs', api: 'https://larajobs.com/feed-mirror' }),
    'https://larajobs.com/feed-mirror');
  assert.equal(larajobsAdapter.buildEndpoint({ provider: 'larajobs', api: 'https://evil.example.com/feed' }), LJ_FEED_URL);

  // all three expose id/label/fetch, and every endpoint above is a plain string
  for (const a of [hecklerkochAdapter, rheinmetallAdapter, larajobsAdapter]) {
    assert.equal(typeof a.id, 'string');
    assert.equal(typeof a.label, 'string');
    assert.equal(typeof a.fetch, 'function');
    assert.equal(typeof a.buildEndpoint({ provider: a.id }), 'string');
  }
});
