/**
 * GermanTechJobs source (upstream parent #6346 port) — CI-isolated suite.
 *
 * The board's whole inventory rides one public no-auth RSS feed
 * (https://germantechjobs.de/rss — 4.3 MB / ~626 items when the parent
 * sampled it), so there is no pagination and no per-posting fetch. The
 * parser must fail CLOSED on a broken envelope/truncated feed (a silent
 * zero would look like an empty board) while a present-and-empty channel
 * is []. Cases ported from the parent's provider-contract tests: the
 * "{Role} @ {Company} [{salary}]" title split (last " @ " wins, a €-salary
 * bracket stripped — its inner text kept as the row's salary DISPLAY string,
 * never annualized), an unattributable title DROPPED rather than filed
 * under the board or the entry name), utm_* stripped from the canonical
 * URL, entity decoding before the split, location '' on every PARSE row (the
 * feed carries none — the normalized row carries only the board-level
 * country default, never an invented city), the CDATA/comment masking traps
 * (structure words inside a description must not split the item or trip the
 * open/close tally), and the fetch contract (one host-pinned request,
 * redirect:'error', the feed_url override allowlisted BEFORE any request,
 * broken body → named throw). CAR-228: the filled salary/location fields are
 * asserted to actually feed the #/scan filter panel (the client facet
 * tokenizer + country detector run here on the emitted rows, loaded from
 * public/js/lib the same way tests/salary-filter.test.mjs does). No network —
 * the parser is pure; fetch runs on a fake fetchImpl.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  FEED_URL,
  assertGermantechjobsUrl,
  splitTitle,
  cleanUrl,
  parseGermantechjobsFeed,
  fetchGermantechjobs,
} from '../server/lib/sources/germantechjobs.mjs';
import { germantechjobsAdapter } from '../server/lib/portals/adapters/germantechjobs.mjs';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The #/scan facet helpers the emitted rows must feed (CAR-228): the salary
// tokenizer + range filter from public/js/lib/skills.js and the country
// detector from public/js/lib/countries.js, both browser IIFEs loaded under a
// synthetic window (the established tests/salary-filter.test.mjs pattern).
const __dirname = dirname(fileURLToPath(import.meta.url));
globalThis.window = {};
new Function(readFileSync(resolve(__dirname, '..', 'public', 'js', 'lib', 'skills.js'), 'utf8'))();
new Function(readFileSync(resolve(__dirname, '..', 'public', 'js', 'lib', 'countries.js'), 'utf8'))();
const Skills = globalThis.window.Skills;
const Countries = globalThis.window.Countries;

// ── fixtures: the feed the way the board ships it ────────────────────────────

/** Two postings in the board's real shape: "{Role} @ {Company} [{salary}]", a
 *  CDATA description, and the utm_* tail the feed appends to every <link>. */
const SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>GermanTechJobs - tech &amp; IT jobs with salary info in Germany</title>
    <link>https://germantechjobs.de/</link>
    <item>
      <title>Data Architect (all Genders) @ BORA Gruppe Deutschland [48.000 - 70.000 €]</title>
      <link>https://germantechjobs.de/jobs/Data-Architect-BORA?utm_source=our_rss_feed&amp;utm_medium=our_rss_feed</link>
      <guid>https://germantechjobs.de/jobs/Data-Architect-BORA?utm_source=our_rss_feed&amp;utm_medium=our_rss_feed</guid>
      <pubDate>Thu, 29 Oct 2026 09:30:00 GMT</pubDate>
      <description><![CDATA[<p><b>Salary: 48.000 - 70.000 € per year</b></p><p>Build pipelines.</p>]]></description>
    </item>
    <item>
      <title>Platform Engineer @ SEW-EURODRIVE GmbH &amp; Co KG</title>
      <link>https://germantechjobs.de/jobs/Platform-Engineer-SEW?utm_source=our_rss_feed</link>
      <guid>https://germantechjobs.de/jobs/Platform-Engineer-SEW?utm_source=our_rss_feed</guid>
      <pubDate>Wed, 28 Oct 2026 11:00:00 GMT</pubDate>
      <description><![CDATA[<p>Own the platform.</p>]]></description>
    </item>
  </channel>
</rss>`;

// ── meta + adapter contract ──────────────────────────────────────────────────

test('germantechjobs: meta — value, label, region en', () => {
  assert.deepEqual(meta, { value: 'germantechjobs', label: 'GermanTechJobs', region: 'en' });
  assert.equal(germantechjobsAdapter.id, 'germantechjobs');
  assert.equal(germantechjobsAdapter.label, 'GermanTechJobs');
});

test('germantechjobs: the adapter matches ONLY the explicit provider field (board-wide feed, no per-entry URL)', () => {
  assert.equal(germantechjobsAdapter.matches({ name: 'GermanTechJobs', provider: 'germantechjobs' }), true);
  for (const [label, entry] of [
    ['no provider field', { name: 'Something', careers_url: 'https://germantechjobs.de/rss' }],
    ['a different provider', { provider: 'startup-jobs' }],
    ['null', null],
    ['a non-object', 'germantechjobs'],
  ]) {
    assert.equal(germantechjobsAdapter.matches(entry), false, `${label} must not match`);
  }
});

test('germantechjobs: buildEndpoint resolves the fixed feed, an allowlisted feed_url/api override, never an off-host URL', () => {
  assert.equal(germantechjobsAdapter.buildEndpoint({ provider: 'germantechjobs' }), FEED_URL);
  assert.equal(germantechjobsAdapter.buildEndpoint(null), FEED_URL, 'no override → the canonical feed');
  assert.equal(
    germantechjobsAdapter.buildEndpoint({ provider: 'germantechjobs', feed_url: 'https://germantechjobs.de/rss?mirror=1' }),
    'https://germantechjobs.de/rss?mirror=1',
  );
  for (const [label, bad] of [
    ['an untrusted host', 'https://evil.example/rss'],
    ['a suffix-spoofed host', 'https://germantechjobs.de.evil.example/rss'],
    ['a non-HTTPS URL', 'http://germantechjobs.de/rss'],
  ]) {
    assert.equal(
      germantechjobsAdapter.buildEndpoint({ provider: 'germantechjobs', feed_url: bad }),
      FEED_URL,
      `${label} falls back to the canonical feed (fail-soft)`,
    );
  }
});

// ── host pin ─────────────────────────────────────────────────────────────────

test('germantechjobs: assertGermantechjobsUrl — https on the board host (subdomain form allowed)', () => {
  assert.equal(assertGermantechjobsUrl(FEED_URL), FEED_URL);
  assert.equal(assertGermantechjobsUrl('https://www.germantechjobs.de/rss'), 'https://www.germantechjobs.de/rss');
  assert.throws(() => assertGermantechjobsUrl('http://germantechjobs.de/rss'), /HTTPS/);
  assert.throws(() => assertGermantechjobsUrl('https://evil.example/rss'), /untrusted hostname/);
  assert.throws(() => assertGermantechjobsUrl('https://germantechjobs.de.evil.example/rss'), /untrusted hostname/, 'suffix-spoofed host');
  assert.throws(() => assertGermantechjobsUrl('https://eviltermantechjobs.de/rss'), /untrusted hostname/, 'prefix-spoofed look-alike');
  assert.throws(() => assertGermantechjobsUrl('not a url'), /invalid URL/);
});

// ── title split ──────────────────────────────────────────────────────────────

test('germantechjobs: splitTitle — employer after the last " @ ", €-salary bracket stripped from the role and kept as the salary display string', () => {
  assert.deepEqual(
    splitTitle('Data Architect (all Genders) @ BORA Gruppe Deutschland [48.000 - 70.000 €]'),
    { title: 'Data Architect (all Genders)', company: 'BORA Gruppe Deutschland', salary: '48.000 - 70.000 €' },
  );
  assert.deepEqual(
    splitTitle('CIAM Platform Engineer (w/m/d) @ SEW-EURODRIVE GmbH & Co KG [50.000 - 80.000 €]'),
    { title: 'CIAM Platform Engineer (w/m/d)', company: 'SEW-EURODRIVE GmbH & Co KG', salary: '50.000 - 80.000 €' },
  );
  assert.deepEqual(
    splitTitle('Platform Engineer @ A @ B'),
    { title: 'Platform Engineer @ A', company: 'B', salary: '' },
    'the LAST " @ " segment is the employer',
  );
  assert.deepEqual(
    splitTitle('Tech Lead @ Trivago [Düsseldorf]'),
    { title: 'Tech Lead', company: 'Trivago [Düsseldorf]', salary: '' },
    'a trailing bracket without € is not a salary bracket — it survives inside the employer segment',
  );
  assert.deepEqual(
    splitTitle('Tech Lead @ Trivago [55.000 €] [Düsseldorf]'),
    { title: 'Tech Lead', company: 'Trivago [55.000 €] [Düsseldorf]', salary: '' },
    'only the TRAILING bracket is examined; the parent strips nothing here (single-trailing-bracket rule)',
  );
  assert.deepEqual(
    splitTitle('DevOps Engineer @ Acme [65.000  -  85.000   €]'),
    { title: 'DevOps Engineer', company: 'Acme', salary: '65.000 - 85.000 €' },
    'whitespace runs inside the bracket collapse to single spaces',
  );
});

test('germantechjobs: splitTitle — a title with no identifiable employer yields company: ""', () => {
  assert.deepEqual(splitTitle('Werkstudent IT'), { title: 'Werkstudent IT', company: '', salary: '' });
  assert.deepEqual(splitTitle(' @ Bora'), { title: '@ Bora', company: '', salary: '' }, 'an empty role is equally unattributable');
  assert.deepEqual(splitTitle(''), { title: '', company: '', salary: '' });
});

// ── canonical URL ────────────────────────────────────────────────────────────

test('germantechjobs: cleanUrl strips the feed attribution and keeps the stable /jobs/<slug> path', () => {
  assert.equal(
    cleanUrl('https://germantechjobs.de/jobs/Data-Architect-BORA?utm_source=our_rss_feed&utm_medium=our_rss_feed'),
    'https://germantechjobs.de/jobs/Data-Architect-BORA',
  );
  assert.equal(cleanUrl('https://germantechjobs.de/jobs/x#section'), 'https://germantechjobs.de/jobs/x', 'fragment dropped');
  assert.equal(cleanUrl('  https://germantechjobs.de/jobs/x  '), 'https://germantechjobs.de/jobs/x', 'whitespace trimmed');
});

test('germantechjobs: cleanUrl — non-https, off-board and malformed links are unusable', () => {
  assert.equal(cleanUrl('http://germantechjobs.de/jobs/x'), '', 'non-https');
  assert.equal(cleanUrl('https://evil.example/jobs/x'), '', 'off-board host');
  assert.equal(cleanUrl('https://germantechjobs.de.evil.example/jobs/x'), '', 'suffix-spoofed host');
  assert.equal(cleanUrl('not a url'), '');
  assert.equal(cleanUrl(''), '');
  assert.equal(cleanUrl(null), '');
});

// ── parse ────────────────────────────────────────────────────────────────────

test('germantechjobs: parse maps the real feed — split title/company, utm-free url, postedAt, flattened description', () => {
  const jobs = parseGermantechjobsFeed(SAMPLE);
  assert.equal(jobs.length, 2);
  const [first, second] = jobs;
  assert.equal(first.title, 'Data Architect (all Genders)');
  assert.equal(first.company, 'BORA Gruppe Deutschland', 'employer comes from the last " @ ", bracket stripped');
  assert.equal(first.url, 'https://germantechjobs.de/jobs/Data-Architect-BORA', 'utm_* attribution stripped');
  assert.equal(first.postedAt, Date.parse('Thu, 29 Oct 2026 09:30:00 GMT'));
  assert.match(first.description, /Build pipelines/);
  assert.ok(!first.description.includes('<p>'), 'the CDATA description is flattened to plain text');
  assert.equal(second.company, 'SEW-EURODRIVE GmbH & Co KG', 'entities in the title are decoded before the split');
  assert.equal(second.url, 'https://germantechjobs.de/jobs/Platform-Engineer-SEW');
});

test("germantechjobs: parse keeps location '' on every row — the feed carries none (documented unknown)", () => {
  const jobs = parseGermantechjobsFeed(SAMPLE);
  assert.ok(jobs.length > 0);
  for (const j of jobs) assert.equal(j.location, '', 'a location must not be invented at the parse (feed-mapping) layer');
});

test('germantechjobs: an unattributable title is DROPPED, never filed under the board or an entry name', () => {
  const noAt = parseGermantechjobsFeed(
    '<rss><channel><item><title>Werkstudent IT</title><link>https://germantechjobs.de/jobs/x</link></item></channel></rss>',
  );
  assert.deepEqual(noAt, [], 'no " @ " → no identifiable employer → the row is dropped');
  const emptyRole = parseGermantechjobsFeed(
    '<rss><channel><item><title> @ Bora</title><link>https://germantechjobs.de/jobs/y</link></item></channel></rss>',
  );
  assert.deepEqual(emptyRole, [], 'an empty role is equally unattributable');
});

test('germantechjobs: a row with no usable URL is dropped, the rest of the board stands', () => {
  const mixed = parseGermantechjobsFeed(
    '<rss><channel><item><title>No Link @ Co</title></item>'
      + '<item><title>Has Link @ Co</title><link>https://germantechjobs.de/jobs/ok</link></item>'
      + '<item><title>Off Board @ Co</title><link>https://evil.example/jobs/x</link></item>'
      + '</channel></rss>',
  );
  assert.equal(mixed.length, 1);
  assert.equal(mixed[0].url, 'https://germantechjobs.de/jobs/ok');
});

test('germantechjobs: a malformed envelope throws a descriptive error naming what arrived', () => {
  for (const [label, body] of [
    ['a non-string body', null],
    ['an HTML error page', '<html><body>502 Bad Gateway</body></html>'],
    ['an empty body', ''],
  ]) {
    assert.throws(() => parseGermantechjobsFeed(body), /unexpected feed response/, `${label} must throw`);
  }
});

test('germantechjobs: a present-and-empty channel is a real empty board ([])', () => {
  const empty = parseGermantechjobsFeed('<rss><channel><title>x</title></channel></rss>');
  assert.deepEqual(empty, []);
});

test('germantechjobs: a feed truncated mid-item throws instead of reading as a short board', () => {
  assert.throws(
    () => parseGermantechjobsFeed(
      '<rss><channel><item><title>A @ B</title><link>https://germantechjobs.de/jobs/a</link></item>'
        + '<item><title>C @ D</title></channel></rss>',
    ),
    /2 <item> open tag\(s\) but 1 <\/item> close tag\(s\)/,
    'the open/close item tally names the mismatch',
  );
});

test('germantechjobs: CDATA structure text does not split the item nor trip the open/close tally', () => {
  const cdataTrapBody = 'We run </item></channel></rss> pipelines and parse <item> tags for a living. Salary: 55.000 €.';
  const trap = parseGermantechjobsFeed(
    '<rss><channel><item><title>Platform Engineer @ Trap Co</title>'
      + '<link>https://germantechjobs.de/jobs/trap</link>'
      + `<description><![CDATA[<p>${cdataTrapBody}</p>]]></description>`
      + '</item></channel></rss>',
  );
  assert.equal(trap.length, 1, 'structure words inside CDATA must not end the item block early');
  assert.equal(trap[0].company, 'Trap Co');
  assert.equal(trap[0].title, 'Platform Engineer');
  assert.match(trap[0].description, /pipelines and parse/);
  assert.match(trap[0].description, /tags for a living/, 'the CDATA text survives (markup stripped, words kept)');
});

test('germantechjobs: invalid pubDate leaves postedAt unset; a valid epoch-0 is kept as 0', () => {
  for (const bad of ['not a date', 'Thu, 32 Oct 2026 09:30:00 GMT', '', '   ']) {
    const parsed = parseGermantechjobsFeed(
      '<rss><channel><item><title>A @ B</title><link>https://germantechjobs.de/jobs/d</link>'
        + `<pubDate>${bad}</pubDate></item></channel></rss>`,
    );
    assert.equal(parsed.length, 1);
    assert.ok(!('postedAt' in parsed[0]), `pubDate ${JSON.stringify(bad)} must not become a wrong timestamp`);
  }
  const epochZero = parseGermantechjobsFeed(
    '<rss><channel><item><title>A @ B</title><link>https://germantechjobs.de/jobs/e</link>'
      + '<pubDate>Thu, 01 Jan 1970 00:00:00 GMT</pubDate></item></channel></rss>',
  );
  assert.equal(epochZero.length, 1);
  assert.equal(epochZero[0].postedAt, 0, 'epoch 0 is a real timestamp — a truthiness check would drop it');
});

// ── fetch — the web-ui fetch contract ────────────────────────────────────────

test('germantechjobs: fetch issues exactly one request to the pinned feed with redirect:"error" and returns normalized rows', async () => {
  const seen = [];
  const jobs = await fetchGermantechjobs(FEED_URL, {
    fetchImpl: async (url, opts) => {
      seen.push({ url, opts });
      return { ok: true, status: 200, text: async () => SAMPLE };
    },
    company: { name: 'GermanTechJobs', provider: 'germantechjobs' },
    retries: 0,
  });
  assert.equal(seen.length, 1, 'one request covers the whole board');
  assert.equal(seen[0].url, FEED_URL);
  assert.equal(seen[0].opts.redirect, 'error');
  assert.equal(jobs.length, 2);
  const [row] = jobs;
  assert.deepEqual(
    Object.keys(row).sort(),
    ['company', 'date', 'id', 'isRemote', 'location', 'relocates', 'salary', 'snippet', 'source', 'title', 'url', 'workplaceType'],
    'the scanner 12-field row shape',
  );
  assert.equal(row.id, `germantechjobs-${row.url}`);
  assert.equal(row.source, 'germantechjobs');
  assert.equal(row.salary, '48.000 - 70.000 €', 'the € bracket feeds the salary facet as a display string (never annualized here)');
  assert.equal(row.location, 'Germany', 'the board-level country default feeds the country facet');
  assert.equal(row.isRemote, false);
  assert.equal(row.workplaceType, '');
  assert.equal(row.relocates, false);
  assert.equal(row.date, '2026-10-29');
  assert.match(row.snippet, /Build pipelines/);
  assert.equal(row.company, 'BORA Gruppe Deutschland');
  assert.equal(row.url, 'https://germantechjobs.de/jobs/Data-Architect-BORA');
  // The board's second sample item carries no € bracket — no salary may be
  // invented for it (the feed is silent, the field stays '').
  assert.equal(jobs[1].salary, '');
  assert.equal(jobs[1].location, 'Germany');
});

// ── CAR-228 — the emitted fields feed the #/scan filter panel ────────────────

test('germantechjobs: the salary display string parses through the REAL #/scan salary facet (German grouping)', async () => {
  const jobs = await fetchGermantechjobs(FEED_URL, {
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => SAMPLE }),
    company: { name: 'GermanTechJobs', provider: 'germantechjobs' },
    retries: 0,
  });
  const [withPay, withoutPay] = jobs;
  // "48.000" is German-formatted thousands: the shared client tokenizer must
  // read 48000, not 48 — this is exactly why the row is a display string and
  // never annualized at the source.
  assert.deepEqual(Skills.parseSalaryRange(withPay.salary), { min: 48000, max: 70000 });
  assert.deepEqual(Skills.parseAmounts(withPay.salary), [48000, 70000]);
  // The range filter keeps a row whose range overlaps the window.
  assert.equal(Skills.salaryInRange(withPay, 60000, 90000), true);
  assert.equal(Skills.salaryInRange(withPay, 80000, 90000), false);
  // No bracket → no parseable salary → the row is HIDDEN by an active salary
  // window (v1.68.0 semantics) — correct: the user asked for salaried rows.
  assert.equal(Skills.parseSalaryRange(withoutPay.salary), null);
});

test('germantechjobs: the board location feeds the REAL #/scan country facet', async () => {
  const jobs = await fetchGermantechjobs(FEED_URL, {
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => SAMPLE }),
    company: { name: 'GermanTechJobs', provider: 'germantechjobs' },
    retries: 0,
  });
  for (const row of jobs) {
    assert.deepEqual(Countries.detectCountry(row.location), { code: 'de', name: 'Germany', flag: '🇩🇪' });
    assert.equal(Countries.rowInCountry(row, 'de'), true, 'the country filter keeps every row of the board');
    assert.equal(Countries.rowInCountry(row, 'us'), false);
  }
});

test('germantechjobs: date contract — a present pubDate parses for the age facet, an absent one stays a defined ""', async () => {
  const dated = await fetchGermantechjobs(FEED_URL, {
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => SAMPLE }),
    company: { name: 'GermanTechJobs', provider: 'germantechjobs' },
    retries: 0,
  });
  for (const row of dated) {
    assert.equal(typeof row.date, 'string');
    assert.notEqual(row.date, '', 'SAMPLE items all carry a pubDate');
    assert.ok(Number.isFinite(Date.parse(row.date)), 'the Posted-within facet parses the date');
  }
  const ageless = await fetchGermantechjobs(FEED_URL, {
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => '<rss><channel><item><title>A @ B</title><link>https://germantechjobs.de/jobs/nd</link></item></channel></rss>',
    }),
    company: { name: 'GermanTechJobs', provider: 'germantechjobs' },
    retries: 0,
  });
  assert.equal(ageless.length, 1);
  assert.equal(ageless[0].date, '', 'no pubDate → an empty (never undefined) date');
  assert.equal(ageless[0].salary, '');
  // The age facet guards on truthy r.date (public/js/lib/scan-results.js):
  // an empty date is conservative-passed, never dropped and never a crash —
  // this row shape is exactly what that guard exists for.
});

test('germantechjobs: fetch refuses an off-host feed_url override before any request', async () => {
  let entered = 0;
  for (const bad of ['https://evil.example/rss', 'http://germantechjobs.de/rss']) {
    entered = 0;
    await assert.rejects(
      () => fetchGermantechjobs(bad, {
        fetchImpl: async () => { entered += 1; return { ok: true, status: 200, text: async () => SAMPLE }; },
      }),
      /untrusted hostname|must use HTTPS/,
    );
    assert.equal(entered, 0, 'the endpoint is validated before the fetch');
  }
});

test('germantechjobs: fetch fails loud on a broken body — never an empty board', async () => {
  await assert.rejects(
    () => fetchGermantechjobs(FEED_URL, {
      fetchImpl: async () => ({ ok: true, status: 200, text: async () => '<html>maintenance</html>' }),
      retries: 0,
    }),
    /unexpected feed response/,
  );
  const controller = new AbortController();
  controller.abort();
  let entered = 0;
  await assert.rejects(
    () => fetchGermantechjobs(FEED_URL, {
      fetchImpl: async () => { entered += 1; return { ok: true, status: 200, text: async () => SAMPLE }; },
      signal: controller.signal,
    }),
    /abort/i,
    'an aborted scan fails loud, not as an empty board',
  );
  assert.equal(entered, 0);
});

test('germantechjobs: an unroutable title through fetch yields [] — the entry name never becomes the employer', async () => {
  const jobs = await fetchGermantechjobs(FEED_URL, {
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => '<rss><channel><item><title>Werkstudent IT</title><link>https://germantechjobs.de/jobs/x</link></item></channel></rss>',
    }),
    company: { name: 'Acme Board', provider: 'germantechjobs' },
    retries: 0,
  });
  assert.deepEqual(jobs, []);
});
