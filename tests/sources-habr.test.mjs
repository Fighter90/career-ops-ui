/**
 * Habr Career source — dedicated suite (BACKLOG [L]: habr was the only RU
 * source without one; both RU sources stayed ratchet exemptions).
 *
 * CI-isolated: the parser tests are pure fixture HTML; the search-path tests
 * inject a fetchImpl stub (never globalThis.fetch, so the transport's DNS
 * guard is skipped by contract and no network is touched — the same pattern
 * as tests/full-m2-transport.test.mjs).
 *
 * R-04 note: the "malformed 200 throws" shape contract (_shape.mjs) applies
 * to the JSON API sources. Habr is a server-rendered HTML scraper — a 200
 * whose body parses to zero cards is the documented end-of-results signal
 * (pagination stops on `added === 0`), so the shape assertions here pin that
 * contract instead of a throw. Transport-level failures (non-2xx, refused
 * off-host redirects) DO throw, and page-1 vs later-page fatality is pinned.
 *
 * FINDING (2026-10-30, reported not fixed — source edits out of scope):
 * parseHabrCards decodes entities but never strips resurrected tags from the
 * title/company, unlike hh.mjs's stripTags-after-decode. The skipped test
 * below pins the missing invariant. habr.mjs parseHabrCards, title/company
 * fields (title: decodeEntities(titleMatch[2].trim()) — no tag strip).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { meta, parseHabrCards, searchHabr } = await import('../server/lib/sources/habr.mjs');

// ─── meta contract (R-04 registry shape; drives the RU dispatch + dropdown) ───

test('meta: self-describing adapter metadata (region ru + configKey)', () => {
  assert.equal(meta.value, 'habr-career');
  assert.equal(meta.label, 'Habr Career');
  assert.equal(meta.region, 'ru');
  assert.equal(meta.configKey, 'habr');
});

// ─── card parser ───

/** One Habr vacancy card with a meta row (qualification · remote · CITY) and a skills block. */
const card = ({ href = '/vacancies/1000111', title = 'Backend Developer', company = 'Acme ООО',
  salary = 'от 100 000 ₽', date = '2026-01-15T10:00:00+0300', chips = [], skills = ['Docker', 'Kubernetes'] } = {}) => {
  const chipHtml = chips.map((c) => `<span class="chip-with-icon__text">${c}</span>`).join('');
  return `<div class="vacancy-card">`
    + `<a class="vacancy-card__title-link" href="${href}">${title}</a>`
    + `<div class="vacancy-card__company"><a href="/companies/1">${company}</a></div>`
    + `<div class="basic-salary">${salary}</div>`
    + `<time datetime="${date}"></time>`
    + `<div class="vacancy-card__meta">${chipHtml}</div>`
    + `<div class="vacancy-card__skills">${skills.map((s) => `<span class="chip-with-icon__text">${s}</span>`).join('')}</div>`
    + `</div>`;
};

/** Habr pages list cards inside a <section>; the parser's lookahead reads each card's end from it. */
const page = (...cards) => `<section class="vacancies">${cards.join('')}</section>`;

test('parseHabrCards: full card → normalized job row', () => {
  const jobs = parseHabrCards(page(card({
    chips: ['Senior', 'Можно удалённо', 'Москва'],
  })));
  assert.equal(jobs.length, 1);
  const j = jobs[0];
  assert.equal(j.id, 'habr-1000111');
  assert.equal(j.title, 'Backend Developer');
  assert.equal(j.company, 'Acme ООО');
  assert.equal(j.url, 'https://career.habr.com/vacancies/1000111');
  assert.equal(j.salary, 'от 100 000 ₽');
  assert.equal(j.date, '2026-01-15T10:00:00+0300');
  assert.equal(j.location, 'Москва');
  assert.equal(j.isRemote, true);
  assert.equal(j.relocates, false);
  assert.equal(j.workplaceType, 'Remote');
  assert.equal(j.source, 'habr-career');
  assert.equal(j.snippet, 'Senior · Можно удалённо · Москва · Docker · Kubernetes');
});

test('parseHabrCards: empty / falsy input → []', () => {
  assert.deepEqual(parseHabrCards(''), []);
  assert.deepEqual(parseHabrCards(null), []);
  assert.deepEqual(parseHabrCards(page('<div>no cards here</div>')), []);
});

test('parseHabrCards: card without a title link is skipped', () => {
  const html = page('<div class="vacancy-card"><div class="basic-salary">x</div></div>', card());
  const jobs = parseHabrCards(html);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'habr-1000111');
});

test('parseHabrCards: href without a numeric id falls back to the positional id', () => {
  const jobs = parseHabrCards(page(card({ href: '/vacancies/some-slug' })));
  assert.equal(jobs[0].id, 'habr-0');
  const two = parseHabrCards(page(card({ href: '/vacancies/a' }), card({ href: '/vacancies/b', title: 'X' })));
  assert.equal(two[0].id, 'habr-0');
  assert.equal(two[1].id, 'habr-1');
});

// v1.210.1 — SSR cards arrive escaped; an undecoded "&" failed a user's own
// "&" keyword and company names reached the tracker mangled.
test('parseHabrCards: HTML entities decoded in title AND company (v1.210.1)', () => {
  const jobs = parseHabrCards(page(card({
    title: 'Changellenge &gt;&gt; Lead &amp; QA',
    company: 'ООО &quot;М-ТЕХ&quot;',
  })));
  assert.equal(jobs[0].title, 'Changellenge >> Lead & QA');
  assert.equal(jobs[0].company, 'ООО "М-ТЕХ"');
});

test('parseHabrCards: double-encoded entity decodes exactly once', () => {
  const jobs = parseHabrCards(page(card({ title: 'T', company: 'A&amp;lt;B' })));
  assert.equal(jobs[0].company, 'A&lt;B', 'a double-encoded entity must survive as its single-decoded form');
});

// REAL FINDING (reported, not fixed — tests-only task): hh.mjs runs its title
// through stripTags() AFTER decodeEntities ("&lt;script&gt; cannot resurrect
// live markup" — server/lib/sources/hh.mjs stripTags comment), but habr.mjs
// applies decodeEntities with NO post-decode tag strip, so a card titled
// `Dev &lt;script&gt;x&lt;/script&gt;` yields the job title
// `Dev <script>x</script>` with live angle brackets. Same exposure class the
// hh suite pins against (tests/sources-hh.test.mjs 'no angle brackets out').
// Titles reach scan rows / pipeline.md / tracker TSV, so the invariant should
// hold here too. Fix would be one stripTags-style pass over title/company in
// parseHabrCards — left to the owner (source edits out of scope for this run).
test.skip('parseHabrCards: entity decoding cannot resurrect markup (BROKEN — see finding in file header)', () => {
  const jobs = parseHabrCards(page(card({ title: 'Dev &lt;script&gt;x&lt;/script&gt;', company: 'A&amp;lt;B' })));
  assert.doesNotMatch(jobs[0].title, /[<>]/);
});

test('parseHabrCards: CAR-142 — relocation / employment / experience chips never become the city', () => {
  const jobs = parseHabrCards(page(card({
    chips: ['Middle', 'Возможна релокация', 'Полный рабочий день', 'Опыт от 3 лет'],
    skills: [],
  })));
  assert.equal(jobs[0].location, 'Russia'); // no city chip → country fallback
  assert.equal(jobs[0].relocates, true);
  assert.equal(jobs[0].isRemote, false);
  assert.equal(jobs[0].workplaceType, 'Onsite');
});

test('parseHabrCards: no city chip + remote → Remote', () => {
  const jobs = parseHabrCards(page(card({ chips: ['Junior', 'Можно удалённо'] })));
  assert.equal(jobs[0].location, 'Remote');
});

test('parseHabrCards: CAR-142 — a structurally marked city chip wins over chip order', () => {
  // «Можно удалённо» comes first (passes isCity), but the LAST chip's lead
  // carries the ?city_id= link — it must win.
  const html = page('<div class="vacancy-card">'
    + '<a class="vacancy-card__title-link" href="/vacancies/5">Dev</a>'
    + '<div class="vacancy-card__meta">'
    + '<span class="chip-with-icon"><span class="chip-with-icon__text">Можно удалённо</span></span>'
    + '<a class="vacancy-card__meta-link" href="/vacancies?city_id=781"><span class="chip-with-icon__text">Санкт-Петербург</span></a>'
    + '</div>'
    + '</div>');
  const [j] = parseHabrCards(html);
  assert.equal(j.location, 'Санкт-Петербург');
});

test('parseHabrCards: missing skills block → whole block scanned for the city (metaEnd -1 branch)', () => {
  const html = page('<div class="vacancy-card">'
    + '<a class="vacancy-card__title-link" href="/vacancies/7">Dev</a>'
    + '<div class="vacancy-card__meta">'
    + '<span class="chip-with-icon__text">Middle</span>'
    + '<span class="chip-with-icon__text">Новосибирск</span>'
    + '</div>'
    + '</div>');
  const [j] = parseHabrCards(html);
  assert.equal(j.location, 'Новосибирск');
});

test('parseHabrCards: multiple cards parsed independently', () => {
  const jobs = parseHabrCards(page(
    card({ href: '/vacancies/1', title: 'A' }),
    card({ href: '/vacancies/2', title: 'B', company: 'Beta' }),
  ));
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].title, 'A');
  assert.equal(jobs[1].title, 'B');
  assert.equal(jobs[1].company, 'Beta');
});

// ─── searchHabr over an injected fetchImpl (no network) ───

const htmlRes = (text, { status = 200, location = null } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  url: 'https://career.habr.com/vacancies',
  headers: { get: (k) => (k.toLowerCase() === 'location' ? location : null) },
  text: async () => text,
  body: { cancel: async () => {} },
});

test('searchHabr: queries the search page with the right params + UA; one card out', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url: String(url), opts });
    return htmlRes(new URL(url).searchParams.get('page') === '1' ? page(card()) : '');
  };
  const jobs = await searchHabr('node.js', { fetchImpl });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'habr-1000111');
  assert.equal(calls.length, 2, 'page 2 is fetched once and is empty → walk ends');
  const u = new URL(calls[0].url);
  assert.equal(u.origin + u.pathname, 'https://career.habr.com/vacancies');
  assert.equal(u.searchParams.get('q'), 'node.js');
  assert.equal(u.searchParams.get('type'), 'all');
  assert.equal(u.searchParams.get('sort'), 'date');
  assert.equal(u.searchParams.get('page'), '1');
  assert.equal(u.searchParams.get('remote'), null, 'no remote param by default');
  assert.equal(u.searchParams.get('qid'), null);
  assert.match(calls[0].opts.headers['User-Agent'], /Mozilla\/5\.0/);
});

test('searchHabr: onlyRemote + experience + salary sort are forwarded', async () => {
  let u;
  await searchHabr('java', { fetchImpl: async (url) => { u = new URL(String(url)); return htmlRes(''); }, onlyRemote: true, experience: '3', sort: 'salary_desc' });
  assert.equal(u.searchParams.get('remote'), '1');
  assert.equal(u.searchParams.get('qid'), '3');
  assert.equal(u.searchParams.get('sort'), 'salary_desc');
});

test('searchHabr: pagination follows new cards and stops on a duplicate page', async () => {
  const pages = [
    page(card({ href: '/vacancies/1', title: 'A' })),
    page(card({ href: '/vacancies/2', title: 'B' })),
    page(card({ href: '/vacancies/2', title: 'B' })), // duplicate → end of results
    page(card({ href: '/vacancies/3', title: 'C' })), // never fetched
  ];
  let fetchedPage = 0;
  const fetchImpl = async (url) => {
    fetchedPage = Number(new URL(url).searchParams.get('page'));
    return htmlRes(pages[fetchedPage - 1] ?? '');
  };
  const jobs = await searchHabr('q', { fetchImpl });
  assert.equal(fetchedPage, 3, 'stopped on the duplicate page');
  assert.deepEqual(jobs.map((j) => j.id), ['habr-1', 'habr-2']);
});

test('searchHabr: an empty first page ends the walk after one fetch', async () => {
  let calls = 0;
  const jobs = await searchHabr('q', { fetchImpl: async () => { calls++; return htmlRes('<html></html>'); } });
  assert.equal(calls, 1);
  assert.deepEqual(jobs, []);
});

test('searchHabr: maxPages caps the walk even when every page is new', async () => {
  let calls = 0;
  const fetchImpl = async (url) => {
    calls++;
    const p = new URL(url).searchParams.get('page');
    return htmlRes(page(card({ href: `/vacancies/${p}`, title: `J${p}` })));
  };
  const jobs = await searchHabr('q', { fetchImpl, maxPages: 2 });
  assert.equal(calls, 2);
  assert.equal(jobs.length, 2);
});

test('searchHabr: page-1 HTTP error → throws with the status (source down surfaces)', async () => {
  await assert.rejects(
    searchHabr('q', { fetchImpl: async () => htmlRes('', { status: 503 }) }),
    (e) => e.status === 503 && /Habr Career: HTTP 503/.test(e.message),
  );
});

test('searchHabr: page-1 refused off-host redirect → throws with the 3xx status', async () => {
  await assert.rejects(
    searchHabr('q', { fetchImpl: async () => htmlRes('', { status: 302, location: 'https://evil.example.com/x' }) }),
    (e) => e.status === 302,
  );
});

test('searchHabr: page-1 network-level error is rethrown raw (no status)', async () => {
  const boom = new Error('socket hang up');
  await assert.rejects(
    searchHabr('q', { fetchImpl: async () => { throw boom; } }),
    (e) => e === boom,
  );
});

test('searchHabr: a later-page failure is non-fatal — partial results are kept', async () => {
  let calls = 0;
  const fetchImpl = async (url) => {
    calls++;
    if (calls === 1) return htmlRes(page(card({ href: '/vacancies/9', title: 'A' })));
    throw Object.assign(new Error('HTTP 500'), { status: 500 });
  };
  const jobs = await searchHabr('q', { fetchImpl });
  assert.equal(calls, 2);
  assert.deepEqual(jobs.map((j) => j.id), ['habr-9']);
});

// ─── R-04 shape behaviour for an HTML scraper ───

test('searchHabr: a 200 with unparseable markup yields [] (HTML sources end on zero cards, no throw)', async () => {
  const jobs = await searchHabr('q', { fetchImpl: async () => htmlRes('{"unexpected":"json-shape"}') });
  assert.deepEqual(jobs, []);
});
