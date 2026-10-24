/**
 * Computrabajo source (v1.253.0 parent parity, #2650 encoding-fixed version)
 * — CI-isolated suite. Ported from the parent's computrabajo provider cases:
 * the country-host guard (https, `^[a-z]{2}\.computrabajo\.com$` only), the
 * card parse (box_offer articles only, entity decode of the Latin-American
 * `&#xF3;`-style markup, featured cards, hidden employer → '?', fragment
 * dropped), the `?p=N` walk with the `by=publicationtime` sort rules (a user
 * sort wins; no sort under /ofertas-de-trabajo/ per robots.txt), the tight
 * 3-page / 15-posting caps (→ computrabajoTruncated), challenge detection
 * (page 1 throws, a later page keeps the earlier pages), the markup-change
 * throw, and the page-1 vs later-page failure rules. No network — parseCards
 * is pure; fetchComputrabajo runs on a fake fetchImpl.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCards,
  resolveListUrl,
  buildPageUrl,
  resolveMaxPages,
  resolveMaxJobs,
  fetchComputrabajo,
  MAX_PAGES,
  DEFAULT_MAX_JOBS,
} from '../server/lib/sources/computrabajo.mjs';
import { computrabajoAdapter } from '../server/lib/portals/adapters/computrabajo.mjs';
import { REDIRECT_REFUSAL_CAUSE_MESSAGE } from '../server/lib/http-json.mjs';

const BASE = 'https://co.computrabajo.com/trabajo-de-sistemas';

function card(id, { title = `Ingeniero de integraci&#xF3;n ${id} &amp; IA`, company = `Acme ${id} &amp; Co`, location = 'Bogot&#xE1;, D.C.', featured = false } = {}) {
  return `
  <article class="box_offer ${featured ? ' outstanding' : ''}" data-id='${id}' data-blind="false" id="${id}">
    ${featured ? '<div class="list_dot mb15"><span class="fc_dest">Empleo destacado</span></div>' : ''}
    <h2 class="fs18 fwB prB">
      <a class="js-o-link fc_base" href="/ofertas-de-trabajo/oferta-de-trabajo-de-ingeniero-${id}#lc=ListOffers-Score4-0">
        ${title}
      </a>
    </h2>
    <p class="dFlex vm_fx fs16 fc_base mt5">
      ${company === null ? 'Importante empresa del sector' : `<a class="fc_base t_ellipsis" href="https://co.computrabajo.com/empresas/acme" offer-grid-article-company-url>${company}</a>`}
    </p>
    <p class="fs16 fc_base mt5"><span class="mr10">${location}</span></p>
    <div class="opt_dots"><span data-href-access="https://candidato.co.computrabajo.com/acceso/">Aplicar</span></div>
  </article>`;
}

const page = (...cards) => `<html><head><title>Trabajo de sistemas | Portal de Empleo Computrabajo</title></head><body>${cards.join('\n')}</body></html>`;

/** A fake fetchImpl answering `pages` by ?p=N, recording every call. */
function makeFetch(pages, extra = {}) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, opts });
    const p = Number(new URL(url).searchParams.get('p'));
    const body = pages[p];
    if (body instanceof Error) throw body;
    if (body && body.status) return { ok: false, status: body.status, text: async () => '' };
    return { ok: true, status: 200, text: async () => (body ?? page()) };
  };
  return { calls, fetchImpl, ...extra };
}

test('computrabajo: resolveListUrl — https country hosts only, port and credentials dropped', () => {
  assert.equal(resolveListUrl(BASE).href, BASE);
  assert.equal(resolveListUrl('https://mx.computrabajo.com/trabajo-de-ingeniero').hostname, 'mx.computrabajo.com');
  assert.equal(
    resolveListUrl('https://u:p@co.computrabajo.com:8443/trabajo-de-sistemas?q=1').href,
    'https://co.computrabajo.com/trabajo-de-sistemas?q=1');
  // The host must BE a Computrabajo country host, not contain it.
  for (const bad of [
    'https://evil.example/?u=co.computrabajo.com',
    'https://co.computrabajo.com.evil.example/x',
    'https://evilcomputrabajo.com/x',
    'https://candidato.co.computrabajo.com/acceso/',
    'http://co.computrabajo.com/trabajo-de-sistemas',
    'not a url',
    '',
  ]) {
    assert.throws(() => resolveListUrl(bad), undefined, bad);
  }
});

test('computrabajo: caps resolve — max_pages/max_jobs are hard-capped at the defaults', () => {
  assert.equal(resolveMaxPages({}), MAX_PAGES);
  assert.equal(resolveMaxPages({ max_pages: 2 }), 2);
  assert.equal(resolveMaxPages({ max_pages: 999 }), MAX_PAGES);
  assert.equal(resolveMaxJobs({}), DEFAULT_MAX_JOBS);
  assert.equal(resolveMaxJobs({ max_jobs: 999 }), DEFAULT_MAX_JOBS);
});

test('computrabajo: buildPageUrl sorts newest-first, preserves the user sort, and never sorts /ofertas-de-trabajo/', () => {
  assert.equal(
    buildPageUrl(resolveListUrl(BASE), 2),
    `${BASE}?by=publicationtime&p=2`,
    'the board\'s own "Fecha" sort by default');
  assert.equal(
    buildPageUrl(resolveListUrl(`${BASE}?by=salary`), 1),
    `${BASE}?by=salary&p=1`,
    'a by= the user put in their URL wins');
  assert.equal(
    buildPageUrl(resolveListUrl('https://co.computrabajo.com/ofertas-de-trabajo/?q=python&by=salary'), 1),
    'https://co.computrabajo.com/ofertas-de-trabajo/?q=python&p=1',
    'robots.txt keeps /ofertas-de-trabajo/ free of by=');
});

test('computrabajo: parseCards keeps the real employer, decodes entities, drops the fragment', () => {
  const cards = parseCards(page(card('A1', { featured: true }), card('A2', { company: null })), 'https://co.computrabajo.com');
  assert.deepEqual(cards, [
    {
      id: 'A1',
      title: 'Ingeniero de integración A1 & IA',
      url: 'https://co.computrabajo.com/ofertas-de-trabajo/oferta-de-trabajo-de-ingeniero-A1',
      company: 'Acme A1 & Co',
      location: 'Bogotá, D.C.',
    },
    {
      id: 'A2',
      title: 'Ingeniero de integración A2 & IA',
      url: 'https://co.computrabajo.com/ofertas-de-trabajo/oferta-de-trabajo-de-ingeniero-A2',
      // "Importante empresa del sector": a hidden employer, never the board's name
      company: '?',
      location: 'Bogotá, D.C.',
    },
  ]);
});

test('computrabajo: clean() decodes then strips — an entity-escaped tag never survives as markup', () => {
  // Strip-then-decode would emit "&lt;script&gt;" as a live "<script>" in the
  // stored title; the shared helper strips the decoded tag instead.
  const cards = parseCards(
    page(card('X9', { title: 'Analista &lt;script&gt;alert(1)&lt;/script&gt; de Datos', company: 'Acme &lt;b&gt;Ltd' })),
    'https://co.computrabajo.com',
  );
  assert.equal(cards.length, 1);
  assert.equal(cards[0].title, 'Analista de Datos', 'the decoded tag is stripped with its contents');
  assert.equal(cards[0].company, 'Acme Ltd', 'the decoded tag is stripped');
  assert.ok(!cards[0].title.includes('<') && !cards[0].company.includes('<'));
});

test('computrabajo: parseCards ignores non-posting links and non-card articles', () => {
  const html = `<article class="other"><a href="/ofertas-de-trabajo/oferta-de-trabajo-de-x-9">Nope</a></article>
    <a href="/trabajo-de-sistemas-en-bogota">Bogota</a>${card('K1')}`;
  const cards = parseCards(html, 'https://co.computrabajo.com');
  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, 'K1');
});

test('computrabajo: parseCards — an unresolvable origin drops the card instead of throwing', () => {
  // `new URL(href, origin)` throws when the origin itself is not a URL; the
  // card is skipped, never a parser crash.
  assert.deepEqual(parseCards(page(card('V1')), 'not a valid origin'), []);
});

test('computrabajo: parseCards — a link resolved off the Computrabajo host is dropped', () => {
  // A relative href inherits the origin: a foreign origin means the URL can
  // never pass the country-host guard.
  assert.deepEqual(parseCards(page(card('F1')), 'https://evil.example'), []);
});

test('computrabajo: parseCards — a box_offer card without a posting link is skipped', () => {
  const html = `<article class="box_offer" data-id='NL1'><h2>No posting link here</h2><p><span class="mr10">Bogotá</span></p></article>${card('K2')}`;
  const cards = parseCards(html, 'https://co.computrabajo.com');
  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, 'K2');
});

test('computrabajo: parseCards — an empty anchor falls back to the heading; a 2-char title drops', () => {
  const html = `<article class="box_offer" data-id='H1'><h2 class="t"><a href="/ofertas-de-trabajo/x-h1"> </a> Analista T&iacute;tulo</h2></article>
    <article class="box_offer" data-id='T2'><h2><a href="/ofertas-de-trabajo/x-t2">Ab</a></h2></article>`;
  const cards = parseCards(html, 'https://co.computrabajo.com');
  assert.equal(cards.length, 1, 'the 2-char title drops its card');
  assert.equal(cards[0].id, 'H1');
  assert.equal(cards[0].title, 'Analista Título', 'the heading is the title fallback');
});

test('computrabajo: parseCards — an empty anchor with no heading drops the card', () => {
  const html = `<article class="box_offer" data-id='NH1'><h2 class="t"><a href="/ofertas-de-trabajo/x-nh1">   </a></h2></article>${card('K3')}`;
  const cards = parseCards(html, 'https://co.computrabajo.com');
  assert.equal(cards.length, 1, 'no anchor text and no heading is no title');
  assert.equal(cards[0].id, 'K3');
});

test('computrabajo: parseCards — a card without data-id falls back to the path; no location span reads as none', () => {
  const html = `<article class="box_offer"><h2><a href="/ofertas-de-trabajo/x-noid-77">Analista de Nube</a></h2></article>`;
  const cards = parseCards(html, 'https://co.computrabajo.com');
  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, '/ofertas-de-trabajo/x-noid-77', 'the path identifies the posting when data-id is gone');
  assert.equal(cards[0].location, '');
});

test('computrabajo: fetchComputrabajo — normalized rows, redirect error + UA, sort params applied', async () => {
  const { calls, fetchImpl } = makeFetch({ 1: page(card('A1', { featured: true }), card('A2', { title: 'Ingeniero Remoto A2' })) });
  const jobs = await fetchComputrabajo(BASE, { fetchImpl, delayMs: 0, company: { name: 'Computrabajo Colombia' } });
  assert.equal(new URL(calls[0].url).searchParams.get('by'), 'publicationtime');
  assert.equal(new URL(calls[0].url).searchParams.get('p'), '1');
  assert.ok(calls.every((c) => c.opts.redirect === 'error'), 'SSRF: redirects are refused');
  assert.ok(calls.every((c) => c.opts.headers['User-Agent']), 'a browser-like UA is sent');
  assert.ok(calls.every((c) => c.opts.headers['Accept-Language']?.startsWith('es-')), 'a Spanish Accept-Language is sent');
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].id, 'computrabajo-A1');
  assert.equal(jobs[0].title, 'Ingeniero de integración A1 & IA');
  assert.equal(jobs[0].company, 'Acme A1 & Co');
  assert.equal(jobs[0].location, 'Bogotá, D.C.');
  assert.equal(jobs[1].isRemote, true, 'isRemote reads Spanish "remoto"');
  assert.equal(jobs[1].source, 'computrabajo');
  assert.equal(jobs[1].date, '');
});

test('computrabajo: fetchComputrabajo keeps a user sort; drops it under /ofertas-de-trabajo/', async () => {
  const keep = makeFetch({ 1: page(card('S1')) });
  await fetchComputrabajo(`${BASE}?by=salary`, { fetchImpl: keep.fetchImpl, delayMs: 0 });
  assert.equal(new URL(keep.calls[0].url).searchParams.get('by'), 'salary');

  const drop = makeFetch({ 1: page(card('R2')) });
  await fetchComputrabajo('https://co.computrabajo.com/ofertas-de-trabajo/?q=python&by=salary', { fetchImpl: drop.fetchImpl, delayMs: 0 });
  assert.equal(new URL(drop.calls[0].url).searchParams.has('by'), false);
  assert.equal(new URL(drop.calls[0].url).searchParams.get('q'), 'python');
});

test('computrabajo: fetchComputrabajo enforces the 3-page / 15-posting crawl caps (partial board)', async () => {
  const { calls, fetchImpl } = makeFetch({
    1: page(card('X1'), card('X2')),
    2: page(card('X3')),
    3: page(card('X4')),
    4: page(card('X5')),
  });
  const jobs = await fetchComputrabajo(BASE, { fetchImpl, delayMs: 0, company: { name: 'X', max_pages: 999, max_jobs: 999 } });
  assert.equal(calls.length, 3, 'a typo cannot raise the crawl caps');
  assert.equal(jobs.length, 4);
  assert.equal(jobs.computrabajoTruncated, undefined, 'a 2-card last page is a natural end, not a cap');

  const many = (p) => page(...Array.from({ length: 20 }, (_, i) => card(`P${p}-${i}`)));
  const capped = makeFetch({ 1: many(1), 2: many(2) });
  const out = await fetchComputrabajo(BASE, { fetchImpl: capped.fetchImpl, delayMs: 0 });
  assert.equal(out.length, 15, 'the default max_jobs stops the sweep mid-page');
  assert.equal(capped.calls.length, 1);
  assert.equal(out.computrabajoTruncated, true, 'the cap stopped the sweep — the board is partial');
});

test('computrabajo: a walk landing exactly on max_jobs with pages remaining is a cap stop (partial board)', async () => {
  // 10 + 5 across two pages, page 3 never fetched: the sweep ended ON the cap,
  // not at the end of the board — the flag has to say the board is partial.
  const ten = page(...Array.from({ length: 10 }, (_, i) => card(`T1-${i}`)));
  const five = page(...Array.from({ length: 5 }, (_, i) => card(`T2-${i}`)));
  const { calls, fetchImpl } = makeFetch({ 1: ten, 2: five, 3: five });
  const jobs = await fetchComputrabajo(BASE, { fetchImpl, delayMs: 0, company: { max_jobs: 15 } });
  assert.equal(jobs.length, 15);
  assert.equal(calls.length, 2, 'the cap stops the walk before page 3');
  assert.equal(jobs.computrabajoTruncated, true, 'pages remain unexamined — the board is partial');
});

test('computrabajo: a pre-aborted signal throws on page 1, never returns []', async () => {
  const fetchImpl = async () => { throw new Error('must not be called'); };
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(
    () => fetchComputrabajo(BASE, { fetchImpl, delayMs: 0, signal: ac.signal }),
    (err) => err?.name === 'AbortError',
    'a pre-aborted scan must fail loud, not read as an empty board');
});

test('computrabajo: fetchComputrabajo stops when a page brings no new ids (ignored page parameter)', async () => {
  const same = page(card('S1'), card('S2'));
  const { calls, fetchImpl } = makeFetch({ 1: same, 2: same, 3: same });
  const jobs = await fetchComputrabajo(BASE, { fetchImpl, delayMs: 0 });
  assert.equal(jobs.length, 2);
  assert.equal(calls.length, 2);
  assert.equal(jobs.computrabajoTruncated, undefined);
});

test('computrabajo: fetchComputrabajo — empty search → [], markup change → throw, challenge → throw', async () => {
  assert.deepEqual(
    await fetchComputrabajo(BASE, { fetchImpl: makeFetch({ 1: page() }).fetchImpl, delayMs: 0 }),
    []);

  const changed = page('<div class="new_card"><a href="/ofertas-de-trabajo/oferta-de-trabajo-de-x-1">X</a></div>');
  await assert.rejects(
    () => fetchComputrabajo(BASE, { fetchImpl: makeFetch({ 1: changed }).fetchImpl, delayMs: 0 }),
    /markup change/);

  const challenge = '<html><head><title>Just a moment...</title></head><body><div id="cf-challenge-running"></div></body></html>';
  await assert.rejects(
    () => fetchComputrabajo(BASE, { fetchImpl: makeFetch({ 1: challenge }).fetchImpl, delayMs: 0 }),
    /anti-bot challenge/);
});

test('computrabajo: generic "cloudflare" / "captcha" words on a normal page do not abort it', async () => {
  const html = page(card('C1')).replace('<body>', '<body><script src="https://cdnjs.cloudflare.com/x.js"></script><div class="g-recaptcha"></div>');
  const jobs = await fetchComputrabajo(BASE, { fetchImpl: makeFetch({ 1: html }).fetchImpl, delayMs: 0 });
  assert.equal(jobs.length, 1);
});

test('computrabajo: a challenge on a later page keeps the earlier pages and stops the walk', async () => {
  const challenge = '<html><head><title>Attention Required! | Cloudflare</title></head></html>';
  const { calls, fetchImpl } = makeFetch({ 1: page(card('L1')), 2: challenge });
  const jobs = await fetchComputrabajo(BASE, { fetchImpl, delayMs: 0 });
  assert.equal(jobs.length, 1);
  assert.equal(calls.length, 2);
  assert.equal(jobs.computrabajoTruncated, undefined, 'a challenge stop is not a cap truncation');
});

test('computrabajo: fetchComputrabajo — a page-1 fetch failure throws; a later one keeps the earlier pages', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: false, status: 404, text: async () => '' }; };
  await assert.rejects(
    () => fetchComputrabajo(BASE, { fetchImpl, delayMs: 0 }),
    /HTTP 404/);
  assert.equal(calls, 1, 'a permanent 4xx is not retried');

  const later = makeFetch({ 1: page(card('E1')), 2: { status: 503 } });
  const jobs = await fetchComputrabajo(BASE, { fetchImpl: later.fetchImpl, delayMs: 0, retries: 0 });
  assert.equal(jobs.length, 1, 'page-1 jobs kept');
  assert.equal(jobs.computrabajoTruncated, undefined, 'an error stop is not a cap truncation');
});

test('computrabajo: fetchComputrabajo asserts the endpoint before any request', async () => {
  const fetchImpl = async () => { throw new Error('must not be called'); };
  await assert.rejects(
    () => fetchComputrabajo('https://evil.example/trabajo', { fetchImpl, delayMs: 0 }),
    /not a Computrabajo country host/);
  await assert.rejects(
    () => fetchComputrabajo('http://co.computrabajo.com/x', { fetchImpl, delayMs: 0 }),
    /must be https/);
});

test('computrabajo: fetchComputrabajo — a transient failure is retried and the page still parses', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    const p = Number(new URL(url).searchParams.get('p'));
    calls.push(p);
    if (calls.length === 1) {
      const err = new Error('HTTP 503');
      err.status = 503;
      throw err;
    }
    return { ok: true, status: 200, text: async () => (p === 1 ? page(card('RT1')) : page()) };
  };
  const jobs = await fetchComputrabajo(BASE, { fetchImpl, delayMs: 0, retries: 1, retryDelayMs: 0 });
  assert.deepEqual(calls, [1, 1, 2], 'page 1 is retried after the transient 503, then the walk probes page 2');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'computrabajo-RT1');
});

test('computrabajo: fetchComputrabajo — a statusless network error retries; a refused redirect never does', async () => {
  let page1Attempts = 0;
  const flaky = async (url) => {
    const p = Number(new URL(url).searchParams.get('p'));
    if (p !== 1) return { ok: true, status: 200, text: async () => page() };
    page1Attempts += 1;
    if (page1Attempts === 1) throw new Error('ECONNRESET'); // no .status — a network error
    return { ok: true, status: 200, text: async () => page(card('NE1')) };
  };
  const jobs = await fetchComputrabajo(BASE, {
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
    () => fetchComputrabajo(BASE, { fetchImpl: redirectRefused, delayMs: 0, retries: 2, retryDelayMs: 0 }),
    /fetch failed/);
  assert.equal(refused, 1, 'a redirect refusal is rethrown at once, never retried');
});

test('computrabajo: fetchComputrabajo — an abort between pages keeps the partials', async () => {
  const ac = new AbortController();
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const p = Number(new URL(url).searchParams.get('p'));
    if (p === 1) {
      ac.abort(); // aborted while page 1 is being processed
      return { ok: true, status: 200, text: async () => page(card('AB1')) };
    }
    return { ok: true, status: 200, text: async () => page() };
  };
  const jobs = await fetchComputrabajo(BASE, { fetchImpl, delayMs: 0, signal: ac.signal });
  assert.equal(jobs.length, 1, 'an aborted walk is not an empty board');
  assert.equal(calls.length, 1, 'page 2 is never fetched after the abort');
});

test('computrabajo: fetchComputrabajo — the inter-page delay is honoured when non-zero', async () => {
  const { fetchImpl } = makeFetch({ 1: page(card('D1')), 2: page() });
  const jobs = await fetchComputrabajo(BASE, { fetchImpl, delayMs: 1 });
  assert.equal(jobs.length, 1);
});

test('computrabajo: fetchComputrabajo — an employer-less card keeps ?, a location-less card keeps "" (entry: null)', async () => {
  const employerless = `<article class="box_offer" data-id='Q1'><h2><a href="/ofertas-de-trabajo/x-q1">Analista Sin Empresa</a></h2><p><span class="mr10">Cali</span></p></article>`;
  const nolocation = `<article class="box_offer" data-id='Q2'><h2><a href="/ofertas-de-trabajo/x-q2">Analista Sin Ciudad</a></h2><p><span class="mr10"></span></p></article>`;
  const jobs = await fetchComputrabajo(BASE, {
    fetchImpl: makeFetch({ 1: page(employerless, nolocation) }).fetchImpl,
    delayMs: 0, company: null,
  });
  assert.equal(jobs[0].company, '?', 'a hidden employer is never replaced by an entry name');
  assert.equal(jobs[1].location, '', 'an empty location span is no city');
});

test('computrabajo adapter: provider- or host-selected, endpoint normalized, invalid → null', () => {
  assert.equal(computrabajoAdapter.matches({ provider: 'computrabajo' }), true);
  assert.equal(computrabajoAdapter.matches({ careers_url: BASE }), true);
  assert.equal(computrabajoAdapter.matches({ api: 'https://mx.computrabajo.com/x' }), true);
  assert.equal(computrabajoAdapter.matches({ careers_url: 'https://candidato.co.computrabajo.com/acceso/' }), false, 'the applicant host is never claimed');
  assert.equal(computrabajoAdapter.matches({ careers_url: 'http://co.computrabajo.com/x' }), false);
  assert.equal(computrabajoAdapter.matches({ careers_url: 'https://co.computrabajo.com.evil.example/x' }), false);
  assert.equal(computrabajoAdapter.matches({ provider: 'gupy' }), false);
  assert.equal(computrabajoAdapter.matches({}), false);
  assert.equal(computrabajoAdapter.matches(null), false);

  assert.equal(
    computrabajoAdapter.buildEndpoint({ careers_url: 'https://u:p@co.computrabajo.com:8443/trabajo-de-sistemas?q=1' }),
    'https://co.computrabajo.com/trabajo-de-sistemas?q=1',
    'port and credentials are dropped');
  assert.equal(computrabajoAdapter.buildEndpoint({ provider: 'computrabajo', careers_url: 'https://evil.example/x' }), null);
  assert.equal(computrabajoAdapter.buildEndpoint({ provider: 'computrabajo' }), null);
});
