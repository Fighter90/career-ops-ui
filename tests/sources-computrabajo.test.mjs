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

test('computrabajo: parseCards ignores non-posting links and non-card articles', () => {
  const html = `<article class="other"><a href="/ofertas-de-trabajo/oferta-de-trabajo-de-x-9">Nope</a></article>
    <a href="/trabajo-de-sistemas-en-bogota">Bogota</a>${card('K1')}`;
  const cards = parseCards(html, 'https://co.computrabajo.com');
  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, 'K1');
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
