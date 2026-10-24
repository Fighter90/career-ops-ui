/**
 * Magneto365 source (v1.253.0 parent parity) — CI-isolated suite.
 * Ported from the parent's magneto provider cases: the search-URL guard
 * (https, magneto365.com only, port/credentials dropped), the card parse
 * (result cards only — nav/search/preview links never read, entity decode,
 * "Confidencial"/board-name employers → '?', salary paragraph never a
 * location), the `?paginator[page]=N` walk (no-new-ids stop, max_pages /
 * max_jobs caps → magnetoTruncated), the page-1 vs later-page failure rules,
 * and the markup-change throw. No network — parseCards is pure; fetchMagneto
 * runs on a fake fetchImpl.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCards,
  resolveListUrl,
  buildPageUrl,
  resolveMaxPages,
  resolveMaxJobs,
  fetchMagneto,
  ALLOWED_HOSTS,
  DEFAULT_MAX_PAGES,
  MAX_PAGES_CAP,
  DEFAULT_MAX_JOBS,
  MAX_JOBS_CAP,
} from '../server/lib/sources/magneto.mjs';
import { magnetoAdapter } from '../server/lib/portals/adapters/magneto.mjs';
import { REDIRECT_REFUSAL_CAUSE_MESSAGE } from '../server/lib/http-json.mjs';

const BASE = 'https://www.magneto365.com/co/trabajos/buscar/tecnologia';

function card(id, { title = `Desarrollador Backend ${id}`, company = 'Acme S.A.S', location = 'Medellín' } = {}) {
  const href = `https://www.magneto365.com/co/empleos/desarrollador-backend-${id}`;
  return `<div class="mg_job_card_desktop_magneto-ui-card-jobs_container_13c81"><article class="mg_job_card_desktop_magneto-ui-card-jobs_13c81 "><div>`
    + `<h2 class="mg_job_card_desktop_magneto-ui-card-jobs_text_13c81"><a href="${href}" title="${title}" target="_blank" rel="noreferrer">${title}</a></h2>`
    + `<h3 class="mg_job_card_desktop_magneto-ui-card-jobs_text_13c81 ">${company} | Por obra o labor</h3>`
    + `<p class="mg_job_card_desktop_magneto-ui-card-jobs_text_13c81 ">$ 4.000.000, </p>`
    + `<p class="mg_job_card_desktop_magneto-ui-card-jobs_text_13c81 ">${location}</p>`
    + `</div></article></div>`;
}

// The listing page links its own category, search and pagination pages under
// /co/trabajos/..., and the detail-preview panel is an <article> too.
const NAV = `<nav><a href="https://www.magneto365.com/co/trabajos/empleos-por-ciudades">Empleos por ubicación</a>`
  + `<a href="https://www.magneto365.com/co/trabajos">/ trabajos</a>`
  + `<a href="https://www.magneto365.com/co/trabajos/buscar">/ buscar</a>`
  + `<a href="${BASE}?paginator[page]=2">2</a></nav>`;
const PREVIEW = `<article class="mg_job_details_magneto-ui-job-details"><a href="https://www.magneto365.com/co/empleos/desarrollador-backend-1">Expandir</a><p>Compartir en:</p></article>`;

const page = (...cards) => `<html><body>${NAV}<div class="results">${cards.join('')}</div>${PREVIEW}</body></html>`;

/** A fake fetchImpl answering `pages` by ?paginator[page]=N, recording every call. */
function makeFetch(pages, extra = {}) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, opts });
    const p = Number(new URL(url).searchParams.get('paginator[page]'));
    const body = pages[p];
    if (body instanceof Error) throw body;
    if (body && body.status) return { ok: false, status: body.status, text: async () => '' };
    return { ok: true, status: 200, text: async () => (body ?? '<html><body></body></html>') };
  };
  return { calls, fetchImpl, ...extra };
}

test('magneto: resolveListUrl — https on a magneto365.com host only, port and credentials dropped', () => {
  assert.equal(resolveListUrl(BASE).href, BASE);
  assert.equal(
    resolveListUrl('https://u:p@www.magneto365.com:8443/co/trabajos/buscar/tecnologia?q=1').href,
    'https://www.magneto365.com/co/trabajos/buscar/tecnologia?q=1');
  assert.deepEqual([...ALLOWED_HOSTS].sort(), ['magneto365.com', 'www.magneto365.com']);
  for (const bad of [
    'https://evil.example/?u=magneto365.com',
    'https://www.magneto365.com.evil.example/co/',
    'https://notmagneto365.com/co/',
    'http://www.magneto365.com/co/trabajos/buscar/tecnologia',
    'https://www.magneto365.com@evil.example/co/',
    '::',
  ]) {
    assert.throws(() => resolveListUrl(bad), undefined, bad);
  }
});

test('magneto: caps resolve — positive integers bounded, non-numeric values defaulted (strings coerce)', () => {
  assert.equal(resolveMaxPages({}), DEFAULT_MAX_PAGES);
  assert.equal(resolveMaxPages({ max_pages: 3 }), 3);
  assert.equal(resolveMaxPages({ max_pages: 9999 }), MAX_PAGES_CAP);
  assert.equal(resolveMaxPages({ max_pages: -1 }), DEFAULT_MAX_PAGES);
  assert.equal(resolveMaxPages({ max_pages: '7' }), 7,
    'a numeric string coerces (Number(value)) — pinned contract, and 7 proves it against the default 5');
  assert.equal(resolveMaxPages({ max_pages: 'abc' }), DEFAULT_MAX_PAGES, 'a non-numeric value falls back to the default');
  assert.equal(resolveMaxPages({ max_pages: null }), DEFAULT_MAX_PAGES);
  assert.equal(resolveMaxJobs({}), DEFAULT_MAX_JOBS);
  assert.equal(resolveMaxJobs({ max_jobs: 9999 }), MAX_JOBS_CAP);
});

test('magneto: buildPageUrl keeps other params and replaces an existing paginator', () => {
  assert.equal(buildPageUrl(resolveListUrl(BASE), 2), `${BASE}?paginator[page]=2`);
  assert.equal(buildPageUrl(resolveListUrl(`${BASE}?orden=fecha&paginator[page]=7`), 3), `${BASE}?orden=fecha&paginator[page]=3`);
});

test('magneto: parseCards reads postings only — never the nav, search or preview links', () => {
  const cards = parseCards(page(
    card(1110175, { company: 'Job&amp;Talent Colombia' }),
    card(1108924, { title: 'Ingenier&#237;a de datos', location: 'Bogotá, D.C.' }),
  ), 'https://www.magneto365.com');
  assert.deepEqual(cards, [
    {
      id: '1110175',
      title: 'Desarrollador Backend 1110175',
      url: 'https://www.magneto365.com/co/empleos/desarrollador-backend-1110175',
      company: 'Job&Talent Colombia',
      location: 'Medellín',
    },
    {
      id: '1108924',
      title: 'Ingeniería de datos',
      url: 'https://www.magneto365.com/co/empleos/desarrollador-backend-1108924',
      company: 'Acme S.A.S',
      location: 'Bogotá, D.C.',
    },
  ]);
});

test('magneto: parseCards — a salary-only paragraph never becomes the location; tiny titles drop', () => {
  const html = `<html><body>`
    + `<article class="x card-jobs y"><h2><a href="https://www.magneto365.com/co/empleos/analista-1">Analista</a></h2><p>$ 4.000.000</p></article>`
    + `<article class="x card-jobs y"><h2><a href="https://www.magneto365.com/co/empleos/ab-2">Ab</a></h2><p>Medellín</p></article>`
    + `</body></html>`;
  const cards = parseCards(html, 'https://www.magneto365.com');
  assert.equal(cards.length, 1, 'a 2-char title drops its card');
  assert.equal(cards[0].location, '', 'the salary paragraph is not a city');
});

test('magneto: "Confidencial" and the board\'s own name become ?, never the entry name', () => {
  const cards = parseCards(page(card(1, { company: 'Confidencial' }), card(2, { company: 'Magneto empleos' }), card(3)), 'https://www.magneto365.com');
  assert.deepEqual(cards.map((c) => c.company), ['?', '?', 'Acme S.A.S']);
});

test('magneto: parseCards — a malformed posting href drops that anchor, never the parser', () => {
  // `new URL(href, origin)` throws on the broken absolute URL; the anchor is
  // skipped and the next candidate link still resolves the card.
  const html = `<html><body>`
    + `<article class="x card-jobs y"><h2><a href="http://[::1">Broken</a></h2><p>Medellín</p></article>`
    + `<article class="x card-jobs y"><h2><a href="https://www.magneto365.com/co/empleos/ok-1">Analista</a></h2><p>Bogotá</p></article>`
    + `</body></html>`;
  const cards = parseCards(html, 'https://www.magneto365.com');
  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, '1', 'the next candidate link still resolves the card');
});

test('magneto: parseCards — an off-host or non-posting anchor never reads as the posting link', () => {
  const html = `<html><body>`
    + `<article class="x card-jobs y"><h2><a href="https://evil.example/co/empleos/x-1">Evil</a></h2><p>Bogotá</p></article>`
    + `<article class="x card-jobs y"><h2><a href="https://www.magneto365.com/co/trabajos/empleos-todo">Nav</a></h2><p>Cali</p></article>`
    + `<article class="x card-jobs y"><h2><a href="https://www.magneto365.com/co/empleos/ok-9">Analista</a></h2><p>Medellín</p></article>`
    + `</body></html>`;
  const cards = parseCards(html, 'https://www.magneto365.com');
  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, '9');
});

test('magneto: parseCards — a card without paragraphs reads as no location', () => {
  const html = `<html><body>`
    + `<article class="x card-jobs y"><h2><a href="https://www.magneto365.com/co/empleos/np-8">Sin Parrafos</a></h2></article>`
    + `</body></html>`;
  const cards = parseCards(html, 'https://www.magneto365.com');
  assert.equal(cards.length, 1);
  assert.equal(cards[0].location, '');
});

test('magneto: fetchMagneto — one normalized web-ui row per card, redirect error + UA on every request', async () => {
  const { calls, fetchImpl } = makeFetch({ 1: page(card(1110175, { title: 'Ingeniero Remoto de Datos' }), card(1108924)) });
  const jobs = await fetchMagneto(BASE, { fetchImpl, delayMs: 0, company: { name: 'Magneto365' } });
  assert.equal(calls.length, 2, 'a short page 1 is probed once more; the empty page 2 ends the sweep');
  assert.equal(calls[0].url, `${BASE}?paginator[page]=1`);
  assert.equal(calls[0].opts.redirect, 'error', 'SSRF: redirects are refused');
  assert.ok(calls[0].opts.headers['User-Agent'], 'a browser-like UA is sent');
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].id, 'magneto-1110175');
  assert.equal(jobs[0].title, 'Ingeniero Remoto de Datos');
  assert.equal(jobs[0].company, 'Acme S.A.S');
  assert.equal(jobs[0].location, 'Medellín');
  assert.equal(jobs[0].isRemote, true, 'isRemote reads Spanish "remoto"');
  assert.equal(jobs[1].isRemote, false);
  assert.equal(jobs[1].source, 'magneto');
  assert.equal(jobs[1].date, '');
});

test('magneto: fetchMagneto — empty search → [], markup change → throw', async () => {
  assert.deepEqual(
    await fetchMagneto(BASE, { fetchImpl: makeFetch({ 1: `<html><body>${NAV}</body></html>` }).fetchImpl, delayMs: 0 }),
    []);
  const changed = `<html><body><div class="new-card"><a href="https://www.magneto365.com/co/empleos/analista-55">Analista</a></div></body></html>`;
  await assert.rejects(
    () => fetchMagneto(BASE, { fetchImpl: makeFetch({ 1: changed }).fetchImpl, delayMs: 0 }),
    /markup change/);
});

test('magneto: fetchMagneto — a page-1 fetch failure throws (no board to report on)', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: false, status: 404, text: async () => '' }; };
  await assert.rejects(() => fetchMagneto(BASE, { fetchImpl, delayMs: 0 }), /HTTP 404/);
  assert.equal(calls, 1, 'a permanent 4xx is not retried');
});

test('magneto: fetchMagneto — a later page failing keeps the earlier pages (partials, not a flag)', async () => {
  const { calls, fetchImpl } = makeFetch({ 1: page(card(1)), 2: { status: 503 } });
  const jobs = await fetchMagneto(BASE, { fetchImpl, delayMs: 0, retries: 0 });
  assert.equal(calls.length, 2);
  assert.equal(jobs.length, 1, 'page-1 jobs kept');
  assert.equal(jobs.magnetoTruncated, undefined, 'an error stop is not a cap truncation');
});

test('magneto: fetchMagneto — a transient failure is retried and the page still parses', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    const p = Number(new URL(url).searchParams.get('paginator[page]'));
    calls.push(p);
    if (calls.length === 1) {
      const err = new Error('HTTP 503');
      err.status = 503;
      throw err;
    }
    return { ok: true, status: 200, text: async () => (p === 1 ? page(card(1)) : '<html><body></body></html>') };
  };
  const jobs = await fetchMagneto(BASE, { fetchImpl, delayMs: 0, retries: 1, retryDelayMs: 0 });
  assert.deepEqual(calls, [1, 1, 2], 'page 1 is retried after the transient 503, then probed once more');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'magneto-1');
});

test('magneto: fetchMagneto — a statusless network error retries; a refused redirect never does', async () => {
  let page1Attempts = 0;
  const flaky = async (url) => {
    const p = Number(new URL(url).searchParams.get('paginator[page]'));
    if (p !== 1) return { ok: true, status: 200, text: async () => '<html><body></body></html>' };
    page1Attempts += 1;
    if (page1Attempts === 1) throw new Error('ECONNRESET'); // no .status — a network error
    return { ok: true, status: 200, text: async () => page(card(1)) };
  };
  const jobs = await fetchMagneto(BASE, {
    fetchImpl: flaky, delayMs: 0, retries: 1, retryDelayMs: 0,
    signal: new AbortController().signal, // a live signal rides the retry delay
  });
  assert.equal(page1Attempts, 2, 'a statusless error is transient — page 1 is fetched twice');
  assert.equal(jobs.length, 1);

  let refused = 0;
  const redirectRefused = async () => {
    refused += 1;
    const err = new TypeError('fetch failed');
    err.cause = new Error(REDIRECT_REFUSAL_CAUSE_MESSAGE);
    throw err;
  };
  await assert.rejects(
    () => fetchMagneto(BASE, { fetchImpl: redirectRefused, delayMs: 0, retries: 2, retryDelayMs: 0 }),
    /fetch failed/);
  assert.equal(refused, 1, 'a redirect refusal is rethrown at once, never retried');
});

test('magneto: fetchMagneto — an abort between pages keeps the partials', async () => {
  const ac = new AbortController();
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const p = Number(new URL(url).searchParams.get('paginator[page]'));
    if (p === 1) {
      ac.abort(); // aborted while page 1 is being processed
      return { ok: true, status: 200, text: async () => page(card(1)) };
    }
    return { ok: true, status: 200, text: async () => '<html><body></body></html>' };
  };
  const jobs = await fetchMagneto(BASE, { fetchImpl, delayMs: 0, signal: ac.signal });
  assert.equal(jobs.length, 1, 'an aborted walk is not an empty board');
  assert.equal(calls.length, 1, 'page 2 is never fetched after the abort');
});

test('magneto: fetchMagneto — the inter-page delay is honoured when non-zero', async () => {
  const { fetchImpl } = makeFetch({ 1: page(card(1)), 2: page() });
  const jobs = await fetchMagneto(BASE, { fetchImpl, delayMs: 1 });
  assert.equal(jobs.length, 1);
});

test('magneto: fetchMagneto — an employer-less card keeps ? and a location-less card keeps "" (entry: null)', async () => {
  const html = `<html><body>`
    + `<article class="x card-jobs y"><h2><a href="https://www.magneto365.com/co/empleos/q1-1">Analista Confidencial</a></h2><h3>Confidencial | Obra</h3><p>$ 1.000, </p><p>Cali</p></article>`
    + `<article class="x card-jobs y"><h2><a href="https://www.magneto365.com/co/empleos/q2-2">Sin Ubicacion</a></h2><h3>Acme | Obra</h3><p>$ 2.000, </p></article>`
    + `</body></html>`;
  const jobs = await fetchMagneto(BASE, { fetchImpl: makeFetch({ 1: html }).fetchImpl, delayMs: 0, company: null });
  assert.equal(jobs[0].company, '?', 'a hidden employer is never replaced by an entry name');
  assert.equal(jobs[1].location, '', 'a card whose last paragraph is a salary reads as no city');
});

test('magneto: fetchMagneto — pagination stops on a page with no new ids and honours max_pages', async () => {
  const p1 = page(card(1), card(2));
  const repeat = makeFetch({ 1: p1, 2: p1 });
  assert.equal((await fetchMagneto(BASE, { fetchImpl: repeat.fetchImpl, delayMs: 0 })).length, 2);
  assert.equal(repeat.calls.length, 2);

  const walk = makeFetch({ 1: page(card(1)), 2: page(card(2)), 3: page(card(3)) });
  const jobs = await fetchMagneto(BASE, { fetchImpl: walk.fetchImpl, delayMs: 0, company: { max_pages: 2 } });
  assert.equal(walk.calls.length, 2);
  assert.equal(jobs.length, 2);
  assert.equal(jobs.magnetoTruncated, undefined, 'a 2-card last page is a natural end, not a cap');
});

test('magneto: fetchMagneto — max_jobs caps the sweep and tags magnetoTruncated', async () => {
  const many = page(...Array.from({ length: 20 }, (_, i) => card(i + 1)));
  const { calls, fetchImpl } = makeFetch({ 1: many, 2: many });
  const jobs = await fetchMagneto(BASE, { fetchImpl, delayMs: 0, company: { max_jobs: 3 } });
  assert.equal(jobs.length, 3);
  assert.equal(calls.length, 1, 'the cap stops the walk before the next page');
  assert.equal(jobs.magnetoTruncated, true);
});

test('magneto: a walk landing exactly on max_jobs with pages remaining is a cap stop (partial board)', async () => {
  // 15 + 5 across two pages with page 3 unexamined: the sweep ended ON the
  // cap, not at the end of the board — the flag has to say the board is
  // partial (a short page landing exactly on the cap is not a natural end).
  const p1 = page(...Array.from({ length: 15 }, (_, i) => card(i + 1)));
  const p2 = page(...Array.from({ length: 5 }, (_, i) => card(100 + i)));
  const { calls, fetchImpl } = makeFetch({ 1: p1, 2: p2, 3: p2 });
  const jobs = await fetchMagneto(BASE, { fetchImpl, delayMs: 0, company: { max_jobs: 20 } });
  assert.equal(jobs.length, 20);
  assert.equal(calls.length, 2, 'the cap stops the walk before page 3');
  assert.equal(jobs.magnetoTruncated, true, 'pages remain unexamined — the board is partial');
});

test('magneto: clean() decodes then strips — an entity-escaped tag never survives as markup', () => {
  const cards = parseCards(
    page(card(1, { title: 'Analista &lt;script&gt;alert(1)&lt;/script&gt; de Datos', company: 'Acme &lt;b&gt;Ltd' })),
    'https://www.magneto365.com',
  );
  assert.equal(cards.length, 1);
  assert.equal(cards[0].title, 'Analista de Datos', 'the decoded tag is stripped with its contents');
  assert.equal(cards[0].company, 'Acme Ltd', 'the decoded tag is stripped');
  assert.ok(!cards[0].title.includes('<') && !cards[0].company.includes('<'));
});

test('magneto: a pre-aborted signal throws on page 1, never returns []', async () => {
  const fetchImpl = async () => { throw new Error('must not be called'); };
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(
    () => fetchMagneto(BASE, { fetchImpl, delayMs: 0, signal: ac.signal }),
    (err) => err?.name === 'AbortError',
    'a pre-aborted scan must fail loud, not read as an empty board');
});

test('magneto: fetchMagneto — default limits: five full pages of 20 reach max_jobs 100 (partial board)', async () => {
  const full = (from) => page(...Array.from({ length: 20 }, (_, i) => card(from + i)));
  const pages = Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [n, full((n - 1) * 20 + 1)]));
  const { calls, fetchImpl } = makeFetch(pages);
  const jobs = await fetchMagneto(BASE, { fetchImpl, delayMs: 0 });
  assert.equal(jobs.length, DEFAULT_MAX_JOBS);
  assert.equal(calls.length, DEFAULT_MAX_PAGES, 'page 6 is never fetched');
  assert.equal(jobs.magnetoTruncated, true, 'a full last-allowed page may hide more results');
});

test('magneto: fetchMagneto asserts the endpoint before any request', async () => {
  const fetchImpl = async () => { throw new Error('must not be called'); };
  await assert.rejects(
    () => fetchMagneto('https://evil.example/co/trabajos', { fetchImpl, delayMs: 0 }),
    /not a magneto365\.com host/);
});

test('magneto adapter: provider- or host-selected, endpoint normalized, invalid → null', () => {
  assert.equal(magnetoAdapter.matches({ provider: 'magneto' }), true);
  assert.equal(magnetoAdapter.matches({ careers_url: BASE }), true);
  assert.equal(magnetoAdapter.matches({ api: 'https://magneto365.com/co/trabajos' }), true);
  assert.equal(magnetoAdapter.matches({ careers_url: 'http://www.magneto365.com/co/x' }), false, 'http is refused');
  assert.equal(magnetoAdapter.matches({ careers_url: 'https://www.magneto365.com.evil.example/co/' }), false);
  assert.equal(magnetoAdapter.matches({ provider: 'greenhouse' }), false);
  assert.equal(magnetoAdapter.matches({}), false);
  assert.equal(magnetoAdapter.matches(null), false);

  assert.equal(
    magnetoAdapter.buildEndpoint({ careers_url: 'https://u:p@www.magneto365.com:8443/co/trabajos/buscar/tecnologia' }),
    BASE,
    'port and credentials are dropped');
  assert.equal(magnetoAdapter.buildEndpoint({ provider: 'magneto', careers_url: 'https://evil.example/x' }), null);
  assert.equal(magnetoAdapter.buildEndpoint({ provider: 'magneto' }), null);
});
