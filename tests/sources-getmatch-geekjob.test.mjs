/**
 * v1.29.0 — GetMatch + GeekJob HTML scrapers.
 *
 * Both adapters parse a vacancy index page via best-effort regex (see
 * the adapter file headers). Tests run against hand-crafted fixture
 * HTML so the parser logic is verified independently of the live site
 * structure. If the real site rotates class names, these tests still
 * pass — that's the point of fixture-driven testing for scrapers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchGetMatch, parseGetMatchCards } from '../server/lib/sources/getmatch.mjs';
import { searchGeekJob, parseGeekJobCards } from '../server/lib/sources/geekjob.mjs';

function mkHtmlFetch(html, status = 200) {
  return async () =>
    new Response(html, { status, headers: { 'content-type': 'text/html' } });
}

// ─────────────── GetMatch ───────────────

const GETMATCH_FIXTURE = `
<html><body>
<main>
  <a href="/vacancies/all" class="nav">Все вакансии</a>
  <a href="/vacancies/senior-php-acme" class="vacancy-card">Senior PHP Engineer</a>
  <div class="company">Acme Corp</div>
  <div class="salary">200 000 — 350 000 ₽</div>
  <div class="chips">удалённо · релокация</div>

  <a href="/vacancies/golang-beta" class="vacancy-card">Golang Backend Engineer</a>
  <div class="company">Beta Inc</div>
  <div class="salary">300 000 — 450 000 ₽</div>
  <div class="chips">офис · Москва</div>
</main>
</body></html>
`;

test('parseGetMatchCards extracts vacancy entries from fixture HTML', () => {
  const out = parseGetMatchCards(GETMATCH_FIXTURE);
  assert.ok(out.length >= 2, `expected ≥ 2 cards, got ${out.length}`);
  const senior = out.find((j) => j.title.includes('Senior PHP'));
  assert.ok(senior, 'Senior PHP card found');
  assert.equal(senior.source, 'getmatch');
  assert.equal(senior.url, 'https://getmatch.ru/vacancies/senior-php-acme');
  assert.equal(senior.isRemote, true);
  assert.equal(senior.relocates, true);
  const golang = out.find((j) => j.title.includes('Golang'));
  assert.ok(golang, 'Golang card found');
  assert.equal(golang.isRemote, false);
});

test('parseGetMatchCards skips "all jobs" nav anchors', () => {
  const html = '<a href="/vacancies/all" class="nav">Все вакансии</a>';
  assert.deepEqual(parseGetMatchCards(html), []);
});

test('parseGetMatchCards returns [] for empty / null input', () => {
  assert.deepEqual(parseGetMatchCards(''), []);
  assert.deepEqual(parseGetMatchCards(null), []);
});

test('searchGetMatch returns [] on healthy 200 with no parseable cards', async () => {
  const fetchImpl = mkHtmlFetch('<html><body>no results</body></html>');
  const out = await searchGetMatch('q', { fetchImpl });
  assert.deepEqual(out, []);
});

test('searchGetMatch throws on 5xx', async () => {
  const fetchImpl = mkHtmlFetch('', 502);
  await assert.rejects(
    () => searchGetMatch('q', { fetchImpl }),
    /GetMatch: HTTP 502/,
  );
});

test('searchGetMatch onlyRemote drops non-remote entries', async () => {
  const fetchImpl = mkHtmlFetch(GETMATCH_FIXTURE);
  const out = await searchGetMatch('q', { fetchImpl, onlyRemote: true });
  // Senior PHP is remote, Golang is not — only Senior PHP survives.
  assert.ok(out.every((j) => j.isRemote));
  assert.ok(out.some((j) => j.title.includes('Senior PHP')));
});

// ─────────────── GeekJob ───────────────

const GEEKJOB_FIXTURE = `
<html><body>
<main>
  <a href="/vacancy/12345" class="card">Senior Backend Developer</a>
  <div class="company">Tech Co</div>
  <div class="info">200 000 — 300 000 ₽ · удалённо</div>

  <a href="/vacancy/67890" class="card">DevOps Engineer</a>
  <div class="employer">DevOps Corp</div>
  <div class="info">офис · Санкт-Петербург</div>
</main>
</body></html>
`;

test('parseGeekJobCards extracts vacancy entries from fixture HTML', () => {
  const out = parseGeekJobCards(GEEKJOB_FIXTURE);
  assert.ok(out.length >= 2);
  const senior = out.find((j) => j.title.includes('Senior'));
  assert.ok(senior);
  assert.equal(senior.source, 'geekjob');
  assert.equal(senior.url, 'https://geekjob.ru/vacancy/12345');
  assert.equal(senior.isRemote, true);
  const devops = out.find((j) => j.title.includes('DevOps'));
  assert.ok(devops);
  assert.equal(devops.isRemote, false);
});

test('parseGeekJobCards returns [] for empty / null input', () => {
  assert.deepEqual(parseGeekJobCards(''), []);
  assert.deepEqual(parseGeekJobCards(null), []);
});

test('searchGeekJob throws on 5xx', async () => {
  const fetchImpl = mkHtmlFetch('', 503);
  await assert.rejects(
    () => searchGeekJob('q', { fetchImpl }),
    /GeekJob: HTTP 503/,
  );
});

test('searchGeekJob onlyRemote drops non-remote entries', async () => {
  const fetchImpl = mkHtmlFetch(GEEKJOB_FIXTURE);
  const out = await searchGeekJob('q', { fetchImpl, onlyRemote: true });
  assert.ok(out.every((j) => j.isRemote));
});

// ── v1.242.0 Phase-2 correctness ─────────────────────────────────────────────
//
// The old single card regex capped the per-card block at {0,2000} chars with a
// lookahead for the next anchor, so a card followed by more markup than the
// cap — always true for the TAIL card of a long page — was dropped silently.
// The parser now slices each card's block by index to the next anchor.

const BIG_FILLER = '<div class="desc">' + 'x'.repeat(2500) + '</div>';

test('parseGetMatchCards: tail card + card followed by a >2000-char block are kept', () => {
  const html = `
    <a href="/vacancies/first" class="vacancy-card">First Role Here</a>
    <div class="company">First Co</div>
    ${BIG_FILLER}
    <a href="/vacancies/tail" class="vacancy-card">Tail Role Here</a>
    <div class="company">Tail Co</div>
    <div class="chips">удалённо</div>
    ${BIG_FILLER}
  `;
  const out = parseGetMatchCards(html);
  const first = out.find((j) => j.title.includes('First Role'));
  const tail = out.find((j) => j.title.includes('Tail Role'));
  assert.ok(first, 'a card whose next anchor sits beyond 2000 chars was dropped by the cap');
  assert.equal(first.company, 'First Co');
  assert.ok(tail, 'the tail card was dropped — its block runs past the cap to end-of-page');
  assert.equal(tail.company, 'Tail Co');
  assert.equal(tail.isRemote, true);
});

test('parseGetMatchCards decodes HTML entities in title and company', () => {
  const html = `
    <a href="/vacancies/qa-1">Ingeniero &amp; QA &#8212; Senior</a>
    <div class="company">S&Aacute;B Coding</div>
  `;
  const [j] = parseGetMatchCards(html);
  assert.equal(j.title, 'Ingeniero & QA — Senior');
  assert.equal(j.company, 'SÁB Coding');
});

test('parseGeekJobCards: tail card + card followed by a >2000-char block are kept', () => {
  const html = `
    <a href="/vacancy/111">First Role Here</a>
    <div class="company">First Co</div>
    ${BIG_FILLER}
    <a href="/vacancy/222">Tail Role Here</a>
    <div class="company">Tail Co</div>
    <div class="info">удалённо</div>
    ${BIG_FILLER}
  `;
  const out = parseGeekJobCards(html);
  const first = out.find((j) => j.title.includes('First Role'));
  const tail = out.find((j) => j.title.includes('Tail Role'));
  assert.ok(first, 'a card whose next anchor sits beyond 2000 chars was dropped by the cap');
  assert.equal(first.company, 'First Co');
  assert.ok(tail, 'the tail card was dropped — its block runs past the cap to end-of-page');
  assert.equal(tail.company, 'Tail Co');
  assert.equal(tail.isRemote, true);
});

test('parseGeekJobCards decodes HTML entities in title and company', () => {
  const html = `
    <a href="/vacancy/333">Инженер &amp; QA &#8212; Senior</a>
    <div class="employer">S&amp;P Coding</div>
  `;
  const [j] = parseGeekJobCards(html);
  assert.equal(j.title, 'Инженер & QA — Senior');
  assert.equal(j.company, 'S&P Coding');
});
