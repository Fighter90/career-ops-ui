/**
 * Personio language-version fan-out (CAR-223 — port of parent career-ops
 * #5044 / c7e5ba59, the #4789 scan-side dedup stack's source half).
 *
 * The careers page (not /xml) is the primary source: its Next.js payload lists
 * every posting with `available_languages` and the `current_locale` the page
 * rendered it in. Each emitted row is ONE language version of a posting, with
 * the version's BCP-47-ish tag (e.g. 'en', 'de') on the row's `language`
 * field and `/job/<id>?language=<code>` on its URL — so the scanner can
 * dedup/pick per language. The `?language=en` hard-force on the HTML fallback
 * is gone: the request URL carries no language force.
 *
 * CI-isolated: fake fetchImpl, no network, fixtures built in-file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchPersonio,
  parsePersonioListing,
  parsePersonioXml,
  parsePersonioHtml,
  assertPersonioUrl,
} from '../server/lib/sources/personio.mjs';

const BASE = 'https://acme.jobs.personio.de/';
const HOST = 'acme.jobs.personio.de';
const XML_URL = 'https://acme.jobs.personio.de/xml';

// Runs `fn` with console.warn captured, so a test can assert on (and keep out
// of the run's output) the source's warnings.
const withWarnings = async (fn) => {
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => { warnings.push(args.join(' ')); };
  try {
    return { result: await fn(), warnings };
  } finally {
    console.warn = original;
  }
};

// Build a careers page the same way the real Next.js app streams it: the RSC
// payload is split mid-object across two `self.__next_f.push([1,"<chunk>"])`
// scripts, so only concatenated chunks parse.
const flightPage = (...objects) => {
  const payload = `7:["$","div",null,{"jobs":[${objects.map(o => JSON.stringify(o)).join(',')}]}]\n`;
  const mid = Math.floor(payload.length / 2);
  return '<html><body><script>self.__next_f.push([0])</script>'
    + [payload.slice(0, mid), payload.slice(mid)]
      .map(chunk => `<script>self.__next_f.push(${JSON.stringify([1, chunk])})</script>`).join('')
    + '</body></html>';
};

const posting = (id, name, available, current, extra = {}) => ({
  id: String(id),
  name,
  main_office: 'Berlin',
  additional_offices: ['Remote', 'Berlin'],
  available_languages: available,
  default_locale: available[0],
  current_locale: current,
  created_at: '2026-10-02T09:00:00Z',
  ...extra,
});

const xmlSample = `<workzag-jobs>
<position><id>1834171</id><office>Munich</office><name>Staff Engineer</name>
  <createdAt>2024-11-13T14:10:41+00:00</CreatedAt></position>
</workzag-jobs>`;

// Careers page served when a tenant disables /xml: job-box anchors, no payload.
const htmlSample = `<ul><li>
    <a class="page_job__haA3E job-box" href="/job/2378948"><div class="page_jobHeaderContent__c_2JP">
      <h3 class="page_jobTitle__K0ilk jb-title">ML-QA Engineer</h3>
      <div class="page_jobMeta__GhU10 jb-description">
        <div class="page_jobMetaItem__olmVi"><span class="page_jobMetaText__5yzux">Berlin AI Campus, Munich</span></div>
      </div>
    </div></a>
  </li><li>
    <a class="page_job__haA3E job-box" href="/job/2540715"><div class="page_jobHeaderContent__c_2JP">
      <h3 class="page_jobTitle__K0ilk jb-title">Senior Engineer (m/f/d) &amp; Lead</h3>
      <div class="page_jobMeta__GhU10 jb-description">
        <div class="page_jobMetaItem__olmVi"><span class="page_jobMetaText__5yzux">Remote</span></div>
      </div>
    </div></a>
  </li><li>
    <a class="nav-link" href="/privacy-policy">Datenschutzerklärung</a>
  </li></ul>`;

const httpError = (status, url = '') => {
  const err = new Error(`HTTP ${status} ${url}`.trim());
  err.status = status;
  return err;
};

/** A tenant mock: `pages` answers exact URLs, everything else 404s. */
const tenantFetch = (pages, { failStatus = new Map() } = {}) => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (failStatus.has(url)) throw httpError(failStatus.get(url), url);
    if (url in pages) return { ok: true, status: 200, text: async () => pages[url] };
    throw httpError(404, url);
  };
  return { fetchImpl, calls };
};

const brief = (jobs) => jobs.map(j => `${j.url.replace(BASE, '')}|${j.language ?? '-'}|${j.title}`);

// ── parsePersonioListing: the careers-page payload ──────────────────────────

test('personio: parsePersonioListing keeps postings only, in page order, once per id', () => {
  const listing = parsePersonioListing(flightPage(
    posting(101, 'QA Engineer (m/w/d)', ['de', 'en'], 'de'),
    { id: '5', title: 'not a posting' },                                   // junk sharing the id key
    { id: 'abc', name: 'Non-numeric', available_languages: ['en'] },       // non-numeric id
    posting(102, 'Lead {"id":"9"} "Quoted" Engineer', ['EN', 'not a code!'], 'EN'), // braces + bad codes
    posting(101, 'QA Engineer (m/w/d)', ['de', 'en'], 'de'),               // duplicate id
  ));
  assert.deepEqual(listing.map(p => p.id), ['101', '102']);
  assert.equal(listing[0].name, 'QA Engineer (m/w/d)');
  assert.equal(listing[0].mainOffice, 'Berlin');
  assert.deepEqual(listing[0].additionalOffices, ['Remote', 'Berlin']);
  assert.equal(listing[0].createdAt, '2026-10-02T09:00:00Z');
  assert.deepEqual(listing[0].availableLanguages, ['de', 'en']);
  assert.equal(listing[0].currentLocale, 'de');
  // Language codes lowercase; malformed ones dropped.
  assert.deepEqual(listing[1].availableLanguages, ['en']);
  assert.equal(listing[1].currentLocale, 'en');
  assert.equal(listing[1].name, 'Lead {"id":"9"} "Quoted" Engineer');
});

test('personio: parsePersonioListing yields nothing without a payload', () => {
  assert.equal(parsePersonioListing(htmlSample).length, 0);
  assert.equal(parsePersonioListing('').length, 0);
  assert.equal(parsePersonioListing(null).length, 0);
  assert.equal(parsePersonioListing(undefined).length, 0);
});

// ── fetch: the careers page is primary; one row per language version ────────

test('personio: one careers-page fetch, each posting in its own default language, no language force', async () => {
  const { fetchImpl, calls } = tenantFetch({
    [BASE]: flightPage(
      posting(1, 'A de', ['de', 'en'], 'de'),
      posting(2, 'B en', ['en'], 'en'),
      posting(3, 'C fr', ['de', 'fr'], 'fr')),
  });
  const jobs = await fetchPersonio(XML_URL, { fetchImpl, company: { name: 'Acme' } });
  // Exactly one request, the bare careers page — NO ?language= force anywhere.
  assert.deepEqual(calls, [BASE]);
  assert.ok(!calls.some(u => u.includes('language=')), `no language force expected, saw ${JSON.stringify(calls)}`);
  assert.deepEqual(brief(jobs), [
    'job/1?language=de|de|A de',
    'job/2?language=en|en|B en',
    'job/3?language=fr|fr|C fr',
  ]);
  // The web-ui row shape is intact, `language` added on listing rows.
  assert.equal(jobs[0].id, 'personio-1');
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].source, 'personio');
  assert.equal(jobs[0].location, 'Berlin, Remote'); // offices de-duplicated
  assert.equal(jobs[0].date, '2026-10-02T09:00:00.000Z');
  assert.equal(jobs[0].isRemote, true);
  assert.equal(jobs[0].workplaceType, 'Remote');
  assert.equal(jobs[0].salary, '');
  assert.equal(jobs[0].snippet, '');
  assert.equal(jobs[0].relocates, false);
});

test('personio: a single-language page stays one row per posting (no cross-language explosion)', async () => {
  const { fetchImpl, calls } = tenantFetch({
    [BASE]: flightPage(
      posting(11, 'Only German', ['de'], 'de'),
      posting(12, 'Only English', ['en'], 'en')),
  });
  const jobs = await fetchPersonio(XML_URL, { fetchImpl, company: { name: 'Acme' } });
  assert.deepEqual(calls, [BASE]);
  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs.map(j => j.language), ['de', 'en']);
  assert.ok(jobs.every(j => j.url.startsWith(`https://${HOST}/job/`)));
});

test('personio: a ?language= on careers_url asks for that language wherever a posting has it', async () => {
  const { fetchImpl, calls } = tenantFetch({
    [`${BASE}?language=en`]: flightPage(
      posting(1, 'A en', ['de', 'en'], 'en'),
      posting(2, 'B en', ['en'], 'en'),
      posting(3, 'C fr', ['de', 'fr'], 'fr')),
  });
  const jobs = await fetchPersonio(XML_URL, { fetchImpl, company: { name: 'Acme', careers_url: `${BASE}?language=en` } });
  assert.deepEqual(calls, [`${BASE}?language=en`]);
  assert.deepEqual(brief(jobs), [
    'job/1?language=en|en|A en',
    'job/2?language=en|en|B en',
    'job/3?language=fr|fr|C fr',
  ]);
});

test('personio: the careers_url language is lowercased; a branded careers_url (slug pin) contributes none', async () => {
  const { fetchImpl, calls } = tenantFetch({
    [`${BASE}?language=en`]: flightPage(posting(1, 'A en', ['de', 'en'], 'en')),
  });
  await fetchPersonio(XML_URL, { fetchImpl, company: { name: 'Acme', careers_url: `${BASE}?language=EN` } });
  assert.deepEqual(calls, [`${BASE}?language=en`]);

  const pinned = tenantFetch({ [BASE]: flightPage(posting(1, 'A de', ['de'], 'de')) });
  await fetchPersonio(XML_URL, {
    fetchImpl: pinned.fetchImpl,
    company: { name: 'Acme', personio: 'acme', careers_url: 'https://www.acme.example/careers/?language=en' },
  });
  assert.deepEqual(pinned.calls, [BASE]); // branded host → no preferred language
});

// ── the fan-out (dedupIncludeLanguage): every version, default first ────────

test('personio: dedupIncludeLanguage fetches every further language; each posting keeps its default version first', async () => {
  const { fetchImpl, calls } = tenantFetch({
    [BASE]: flightPage(
      posting(1, 'A de', ['de', 'en'], 'de'),
      posting(2, 'B en', ['en'], 'en'),
      posting(3, 'C fr', ['de', 'fr'], 'fr')),
    [`${BASE}?language=en`]: flightPage(
      posting(1, 'A en', ['de', 'en'], 'en'),
      posting(2, 'B en', ['en'], 'en'),
      posting(3, 'C fr', ['de', 'fr'], 'fr')),
    [`${BASE}?language=de`]: flightPage(
      posting(1, 'A de', ['de', 'en'], 'de'),
      posting(2, 'B en', ['en'], 'en'),
      posting(3, 'C de', ['de', 'fr'], 'de')),
  });
  const jobs = await fetchPersonio(XML_URL, {
    fetchImpl,
    company: { name: 'Acme', careers_url: `${BASE}?language=en` },
    dedupIncludeLanguage: true,
  });
  // Defaults page first, then the careers_url language, then code order.
  assert.deepEqual(calls, [BASE, `${BASE}?language=en`, `${BASE}?language=de`]);
  // ≥2 rows for posting 1 with distinct language values; default-language version first.
  const v1 = jobs.filter(j => j.url.includes('/job/1'));
  assert.ok(v1.length >= 2);
  assert.deepEqual([...new Set(v1.map(j => j.language))].sort(), ['de', 'en']);
  assert.equal(v1[0].language, 'de');
  assert.deepEqual(brief(jobs), [
    'job/1?language=de|de|A de',
    'job/1?language=en|en|A en',
    'job/2?language=en|en|B en',
    'job/3?language=fr|fr|C fr',
    'job/3?language=de|de|C de',
  ]);
});

test('personio: a failing language fetch drops only that language\'s versions', async () => {
  const { fetchImpl, calls } = tenantFetch({
    [BASE]: flightPage(
      posting(1, 'A de', ['de', 'en'], 'de'),
      posting(2, 'B en', ['en'], 'en'),
      posting(3, 'C fr', ['de', 'fr'], 'fr')),
    [`${BASE}?language=en`]: flightPage(
      posting(1, 'A en', ['de', 'en'], 'en'),
      posting(2, 'B en', ['en'], 'en'),
      posting(3, 'C fr', ['de', 'fr'], 'fr')),
    // ?language=de 404s (kept out of `pages`).
  });
  const jobs = await fetchPersonio(XML_URL, { fetchImpl, company: { name: 'Acme' }, dedupIncludeLanguage: true });
  assert.deepEqual(brief(jobs), [
    'job/1?language=de|de|A de',
    'job/1?language=en|en|A en',
    'job/2?language=en|en|B en',
    'job/3?language=fr|fr|C fr',
  ]);
  assert.ok(calls.includes(`${BASE}?language=de`));
});

test('personio: at most 5 further languages are fetched, and the cap names what it skipped', async () => {
  const extra = ['ar', 'cs', 'da', 'es', 'fi', 'fr', 'it'];
  const page = flightPage(posting(1, 'A de', ['de', ...extra], 'de'));
  const { fetchImpl, calls } = tenantFetch({ [BASE]: page });
  const { warnings } = await withWarnings(() =>
    fetchPersonio(XML_URL, { fetchImpl, company: { name: 'Acme' }, dedupIncludeLanguage: true }));
  const fetched = calls.slice(1).map(u => u.replace(`${BASE}?language=`, ''));
  assert.deepEqual(fetched, extra.slice(0, 5));
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Acme: 7 further languages exceed the cap of 5; skipped fr, it/);
});

test('personio: the careers_url language is fetched first, so the cap never drops it', async () => {
  const extra = ['ar', 'cs', 'da', 'es', 'fi', 'fr', 'it'];
  const page = flightPage(posting(1, 'A de', ['de', ...extra], 'de'));
  const { fetchImpl, calls } = tenantFetch({ [BASE]: page });
  const { warnings } = await withWarnings(() =>
    fetchPersonio(XML_URL, {
      fetchImpl,
      company: { name: 'Acme', careers_url: `${BASE}?language=it` },
      dedupIncludeLanguage: true,
    }));
  const fetched = calls.slice(1).map(u => u.replace(`${BASE}?language=`, ''));
  assert.deepEqual(fetched, ['it', 'ar', 'cs', 'da', 'es']);
  assert.match(warnings[0] ?? '', /skipped fi, fr/);
});

test('personio: preferredLanguageRank (preferred_languages) fetches the preferred versions when careers_url names none', async () => {
  const { fetchImpl, calls } = tenantFetch({
    [BASE]: flightPage(
      posting(1, 'A de', ['de', 'en', 'fr'], 'de'),
      posting(2, 'B en', ['en'], 'en')),
    [`${BASE}?language=fr`]: flightPage(
      posting(1, 'A fr', ['de', 'en', 'fr'], 'fr'),
      posting(2, 'B en', ['en'], 'en')),
  });
  const jobs = await fetchPersonio(XML_URL, {
    fetchImpl,
    company: { name: 'Acme' },
    // preferred_languages: [fr] — 'en' is advertised too but not preferred.
    preferredLanguageRank: (lang) => (lang === 'fr' ? 0 : -1),
  });
  // The rank picked fr (the only kept candidate): its page fetched after the defaults page.
  assert.deepEqual(calls, [BASE, `${BASE}?language=fr`]);
  // Posting 1 gained the fr version next to its default; B stays one row.
  assert.deepEqual(brief(jobs), [
    'job/1?language=de|de|A de',
    'job/1?language=fr|fr|A fr',
    'job/2?language=en|en|B en',
  ]);
});

test('personio: maxPages (a health probe) gets the one listing request and no fan-out', async () => {
  const { fetchImpl, calls } = tenantFetch({
    [BASE]: flightPage(
      posting(1, 'A de', ['de', 'en'], 'de'),
      posting(2, 'B en', ['en'], 'en'),
      posting(3, 'C fr', ['de', 'fr'], 'fr')),
  });
  const jobs = await fetchPersonio(XML_URL, {
    fetchImpl,
    company: { name: 'Acme' },
    dedupIncludeLanguage: true,
    maxPages: 1,
  });
  assert.deepEqual(calls, [BASE]);
  assert.equal(jobs.length, 3);
});

// ── fallbacks: the payload is undocumented, /xml answers when the page can't ─

test('personio: a failing careers page falls back to the XML feed (rows without language)', async () => {
  const { fetchImpl, calls } = tenantFetch({ [XML_URL]: xmlSample }, { failStatus: new Map([[BASE, 403]]) });
  const jobs = await fetchPersonio(XML_URL, { fetchImpl, company: { name: 'Acme' } });
  assert.deepEqual(calls, [BASE, XML_URL]);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, `https://${HOST}/job/1834171`);
  assert.equal(jobs[0].language, undefined);
  assert.equal(jobs[0].source, 'personio');
});

test('personio: a page that links jobs but yields no payload warns and falls back, keeping the asked-for language', async () => {
  const { fetchImpl, calls } = tenantFetch({
    [`${BASE}?language=en`]: htmlSample,
    [`${XML_URL}?language=en`]: xmlSample,
  });
  const { result: jobs, warnings } = await withWarnings(() =>
    fetchPersonio(XML_URL, { fetchImpl, company: { name: 'Acme', careers_url: `${BASE}?language=en` } }));
  assert.deepEqual(calls, [`${BASE}?language=en`, `${XML_URL}?language=en`]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Acme: careers page links jobs but its payload yielded none/);
  assert.equal(jobs[0].language, undefined); // XML rows carry no language
});

test('personio: careers page and feed both failing → the page is re-fetched for its job links', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (calls.length === 1) throw httpError(403, url); // careers page down on the first try
    if (url === XML_URL) throw httpError(404, url);    // feed disabled
    return { ok: true, status: 200, text: async () => htmlSample };
  };
  const jobs = await fetchPersonio(XML_URL, { fetchImpl, company: { name: 'Acme' } });
  assert.deepEqual(calls, [BASE, XML_URL, BASE]);
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].title, 'ML-QA Engineer');
  assert.equal(jobs[0].url, `https://${HOST}/job/2378948`);
  assert.equal(jobs[0].language, undefined); // the job-link fallback has no language
  assert.equal(jobs[0].date, '');            // nor a creation date
});

test('personio: a non-404 feed error is rethrown (no silent HTML fallback)', async () => {
  const { fetchImpl } = tenantFetch({}, { failStatus: new Map([[BASE, 403], [XML_URL, 500]]) });
  await assert.rejects(
    () => fetchPersonio(XML_URL, { fetchImpl, company: { name: 'Acme' } }),
    /HTTP 500/,
  );
});

// ── untouched contracts: the parsers and the SSRF guard ─────────────────────

test('personio: parsePersonioXml / parsePersonioHtml / assertPersonioUrl unchanged', () => {
  const xmlJobs = parsePersonioXml('<workzag-jobs><position><id>123</id><name>SWE</name><office>Remote</office></position></workzag-jobs>', 'Acme', HOST);
  assert.equal(xmlJobs.length, 1);
  assert.equal(xmlJobs[0].url, `https://${HOST}/job/123`);
  assert.equal(xmlJobs[0].language, undefined);

  const htmlJobs = parsePersonioHtml(htmlSample, 'Acme', HOST);
  assert.equal(htmlJobs.length, 2);
  assert.equal(htmlJobs[1].url, `https://${HOST}/job/2540715`); // query-less href kept bare
  assert.equal(htmlJobs[1].language, undefined);

  assert.throws(() => assertPersonioUrl('https://evil.com/xml'), /untrusted hostname/);
});
