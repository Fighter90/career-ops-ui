import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { searchHH, parseHhCards } from '../server/lib/sources/hh.mjs';
import { searchHabr, parseHabrCards } from '../server/lib/sources/habr.mjs';

// ───────────────────────── FIX-H3 — defaults must work for PHP scans ─────────────────────────

let loadRuConfig;

before(async () => {
  // Build a project root with portals.yml that has NO title_filter override,
  // so loadConfig() falls through to DEFAULT_NEGATIVE / DEFAULT_QUERIES. The
  // user's actual portals.yml is allowed to disagree (it's their choice),
  // but the shipped defaults must produce non-empty PHP scans out of the box.
  const dir = mkdtempSync(resolve(tmpdir(), 'ru-defaults-'));
  writeFileSync(resolve(dir, 'portals.yml'), '# defaults only, no overrides\n');
  process.env.CAREER_OPS_ROOT = dir;
  ({ loadConfig: loadRuConfig } = await import('../server/lib/ru-scanner.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
});

test('RU defaults: no query word collides with the default negative list', () => {
  // If a default query contains "php" / "go" / "senior" and that same
  // word lives in DEFAULT_NEGATIVE, every result gets filtered out before
  // the user sees anything. This regression killed Senior PHP scans in
  // the past — we keep the invariant locked.
  const cfg = loadRuConfig();
  const negativeWords = new Set(cfg.negative);
  for (const q of cfg.queries) {
    for (const w of q.toLowerCase().split(/\s+/)) {
      assert.ok(
        !negativeWords.has(w),
        `query "${q}" word "${w}" appears in negative list — every match would be filtered out`
      );
    }
  }
});

test('RU defaults: default negative list has no PHP-killer entries', () => {
  const cfg = loadRuConfig();
  for (const n of cfg.negative) {
    assert.ok(
      !/^(php|symfony|laravel|composer|wordpress)$/i.test(n),
      `default negative list contains PHP-killer "${n}"`
    );
  }
});

// ───────────────────────── HH (website HTML scrape, v1.65.0) ─────────────────────────
// hh.ru's JSON API (api.hh.ru) now 403s every programmatic client regardless of
// IP/UA, so the adapter scrapes the public search website (hh.ru/search/vacancy),
// same as Habr Career. These cover the HTML parser and the fetch URL contract.

const HH_FIXTURE = `
<div data-qa="vacancy-serp__vacancy">
  <a data-qa="serp-item__title" href="https://hh.ru/vacancy/12345?from=serp">Senior PHP Developer</a>
  <a data-qa="vacancy-serp__vacancy-employer-text" href="/employer/1">Acme Corp</a>
  <span data-qa="vacancy-serp__vacancy-address">Москва</span>
  <span data-qa="vacancy-serp__vacancy-compensation-x">от 200 000 ₽</span>
</div>
<a data-qa="serp-item__title" href="https://adsrv.hh.ru/click?x=1">РЕКЛАМА</a>
<div data-qa="vacancy-serp__vacancy">
  <a data-qa="serp-item__title" href="https://hh.ru/vacancy/67890">Go разработчик</a>
  <a data-qa="vacancy-serp__vacancy-employer-text">ООО Тест</a>
  <span data-qa="vacancy-serp__vacancy-address">Можно удалённо</span>
</div>`;

test('parseHhCards: extracts title, company, url, id, location from website HTML', () => {
  const items = parseHhCards(HH_FIXTURE);
  assert.equal(items.length, 2);
  const j = items[0];
  assert.equal(j.id, 'hh-12345');
  assert.equal(j.title, 'Senior PHP Developer');
  assert.equal(j.company, 'Acme Corp');
  assert.equal(j.url, 'https://hh.ru/vacancy/12345');
  assert.equal(j.location, 'Москва');
  assert.match(j.salary, /200/);
  assert.equal(j.source, 'hh.ru');
});

test('parseHhCards: flags remote and skips adsrv ad blocks', () => {
  const items = parseHhCards(HH_FIXTURE);
  // Only real hh.ru/vacancy/<id> links survive — the adsrv ad is dropped.
  assert.ok(items.every((j) => /^hh-\d+$/.test(j.id)));
  assert.ok(!items.some((j) => /adsrv/.test(j.url)));
  const go = items.find((j) => j.id === 'hh-67890');
  assert.equal(go.isRemote, true);
  assert.equal(go.workplaceType, 'Remote');
});

test('parseHhCards: empty / null safe', () => {
  assert.deepEqual(parseHhCards(''), []);
  assert.deepEqual(parseHhCards(null), []);
});

test('parseHhCards: output carries no angle brackets (no HTML injection)', () => {
  const evil = `<div data-qa="vacancy-serp__vacancy"><a data-qa="serp-item__title" href="https://hh.ru/vacancy/999">Dev &lt;script&gt;x&lt;/script&gt; <b>Y</b></a><a data-qa="vacancy-serp__vacancy-employer-text">A&amp;B</a></div>`;
  const j = parseHhCards(evil)[0];
  // tags stripped, &lt;/&gt; NOT decoded back into live markup, no stray < >
  assert.doesNotMatch(j.title, /[<>]/);
  assert.doesNotMatch(j.company, /[<>]/);
  assert.equal(j.company, 'A&B'); // &amp; decoded exactly once (no double-unescape)
});

test('searchHH: builds the website search URL with params (not the API)', async () => {
  let capturedUrl = '';
  const fakeFetch = async (url) => { capturedUrl = url; return new Response(HH_FIXTURE, { status: 200 }); };
  const items = await searchHH('Senior Go', { area: 1001, perPage: 25, onlyRemote: true, fetchImpl: fakeFetch });
  assert.match(capturedUrl, /\/search\/vacancy\?/);
  assert.doesNotMatch(capturedUrl, /api\.hh\.ru/);
  assert.match(capturedUrl, /text=Senior\+Go/);
  assert.match(capturedUrl, /area=1001/);
  assert.match(capturedUrl, /items_on_page=25/);
  assert.match(capturedUrl, /schedule=remote/);
  assert.equal(items.length, 2);
});

test('searchHH: throws with geoBlocked flag if the website returns 403', async () => {
  const fakeFetch = async () => new Response('blocked', { status: 403 });
  await assert.rejects(
    () => searchHH('PHP', { fetchImpl: fakeFetch }),
    (err) => err.geoBlocked === true && err.status === 403 && /403/.test(err.message)
  );
});

const hhPage = (...ids) =>
  ids.map((id) => `<div data-qa="vacancy-serp__vacancy"><a data-qa="serp-item__title" href="https://hh.ru/vacancy/${id}">Job ${id}</a></div>`).join('');

test('searchHH: walks all pages, dedups across them, stops when a page adds nothing', async () => {
  const byPage = { '0': hhPage(1, 2, 3), '1': hhPage(4, 5), '2': hhPage(4, 5) }; // page 2 repeats page 1 → no new → stop
  const fakeFetch = async (url) => new Response(byPage[new URL(url).searchParams.get('page')] ?? '', { status: 200 });
  const items = await searchHH('x', { perPage: 50, fetchImpl: fakeFetch });
  assert.deepEqual(items.map((j) => j.id).sort(), ['hh-1', 'hh-2', 'hh-3', 'hh-4', 'hh-5'].sort());
});

test('searchHH: stops at maxPages even if every page has new results', async () => {
  let calls = 0;
  const fakeFetch = async (url) => {
    calls += 1;
    const p = Number(new URL(url).searchParams.get('page'));
    return new Response(hhPage(1000 + p), { status: 200 }); // always a fresh id
  };
  const items = await searchHH('x', { perPage: 50, maxPages: 3, fetchImpl: fakeFetch });
  assert.equal(calls, 3, 'must not exceed the page cap');
  assert.equal(items.length, 3);
});

test('searchHabr: paginates from page 1 and dedups across pages', async () => {
  const card = (id, name) => `<div class="vacancy-card"><a class="vacancy-card__backdrop-link" href="/vacancies/${id}"></a><div class="vacancy-card__inner"><div class="vacancy-card__company"><a class="link-comp" href="/c/x">C</a></div><div class="vacancy-card__title"><a class="vacancy-card__title-link" href="/vacancies/${id}">${name}</a></div></div></div>`;
  const byPage = { '1': `<section class="vacancies-list">${card(91, 'A')}${card(92, 'B')}</section>`, '2': `<section class="vacancies-list">${card(93, 'C')}</section>`, '3': '<section class="vacancies-list"></section>' };
  const fakeFetch = async (url) => new Response(byPage[new URL(url).searchParams.get('page')] ?? '<section class="vacancies-list"></section>', { status: 200 });
  const items = await searchHabr('x', { fetchImpl: fakeFetch });
  assert.equal(items.length, 3, 'page1 (2) + page2 (1), page3 empty → stop');
});

// ───────────────────────── HABR ─────────────────────────

test('parseHabrCards: extracts vacancy fields', () => {
  const html = `
<section class="vacancies-list">
<div class="vacancy-card"><a aria-label="X" class="vacancy-card__backdrop-link" href="/vacancies/1000164921"></a><div class="vacancy-card__inner"><div class="vacancy-card__date"><time class="basic-date" datetime="2026-04-20T19:26:44+03:00">20 апреля</time></div><a class="vacancy-card__icon-link" href="/vacancies/1000164921"></a><div class="vacancy-card__info"><div class="vacancy-card__company"><a class="link-comp" href="/c/x">Остров Сокровищ</a></div><div class="vacancy-card__title"><a class="vacancy-card__title-link" href="/vacancies/1000164921">PHP-разработчик </a></div><div class="vacancy-card__salary"><div class="basic-salary">от 100 000 до 250 000 ₽</div></div><div class="vacancy-card__meta"><div class="chip-with-icon__text">Middle</div><div class="chip-with-icon__text">Можно удалённо</div></div></div></div></div>
</section>`;
  const cards = parseHabrCards(html);
  assert.equal(cards.length, 1);
  const c = cards[0];
  assert.equal(c.id, 'habr-1000164921');
  assert.equal(c.title, 'PHP-разработчик');
  assert.equal(c.company, 'Остров Сокровищ');
  assert.equal(c.url, 'https://career.habr.com/vacancies/1000164921');
  assert.match(c.salary, /100 000.*250 000/);
  assert.equal(c.location, 'Remote');
  assert.equal(c.isRemote, true);
  assert.equal(c.workplaceType, 'Remote');
  assert.match(c.snippet, /Middle/);
  assert.equal(c.source, 'habr-career');
});

test('parseHabrCards: empty input → []', () => {
  assert.deepEqual(parseHabrCards(''), []);
  assert.deepEqual(parseHabrCards('<html>no cards</html>'), []);
});

test('searchHabr: throws on non-2xx', async () => {
  const fakeFetch = async () => new Response('forbidden', { status: 403 });
  await assert.rejects(
    () => searchHabr('PHP', { fetchImpl: fakeFetch }),
    (err) => err.status === 403 && /403/.test(err.message)
  );
});

test('searchHabr: builds URL with params', async () => {
  let captured = '';
  const fakeFetch = async (url) => {
    captured = url;
    return new Response('<section class="vacancies-list"></section>', {
      status: 200, headers: { 'content-type': 'text/html' },
    });
  };
  await searchHabr('Go', { onlyRemote: true, fetchImpl: fakeFetch });
  assert.match(captured, /q=Go/);
  assert.match(captured, /remote=1/);
  assert.match(captured, /sort=date/);
});

// ───────────────────────── orchestrator ─────────────────────────

test('runRuScan: end-to-end with mocked sources, dry-run', async () => {
  const { runRuScan } = await import('../server/lib/ru-scanner.mjs');

  // v1.29.0 — fake fetch now routes all FIVE RU sources (the default
  // `russian_portals.sources` expanded from 2 to 5). hh + habr still
  // return live-looking data; the 3 new sources return empty payloads
  // so we exercise the dispatcher path without polluting the assertion
  // on result counts. Per-adapter parser logic is tested separately in
  // tests/trudvsem-adapter.test.mjs etc.
  const fakeFetch = async (url) => {
    if (url.startsWith('https://hh.ru/search/vacancy')) {
      return new Response(
        `<div data-qa="vacancy-serp__vacancy"><a data-qa="serp-item__title" href="https://hh.ru/vacancy/5001">Senior PHP Engineer</a><a data-qa="vacancy-serp__vacancy-employer-text">X Corp</a><span data-qa="vacancy-serp__vacancy-address">Москва</span></div>`,
        { status: 200, headers: { 'content-type': 'text/html' } });
    }
    if (url.startsWith('https://career.habr.com/')) {
      return new Response(`<section class="vacancies-list">
<div class="vacancy-card"><a class="vacancy-card__backdrop-link" href="/vacancies/9001"></a><div class="vacancy-card__inner"><div class="vacancy-card__company"><a class="link-comp" href="/c/y">Y Corp</a></div><div class="vacancy-card__title"><a class="vacancy-card__title-link" href="/vacancies/9001">Junior PHP</a></div></div></div>
<div class="vacancy-card"><a class="vacancy-card__backdrop-link" href="/vacancies/9002"></a><div class="vacancy-card__inner"><div class="vacancy-card__company"><a class="link-comp" href="/c/z">Z Corp</a></div><div class="vacancy-card__title"><a class="vacancy-card__title-link" href="/vacancies/9002">Senior Go Developer</a></div></div></div>
</section>`, { status: 200, headers: { 'content-type': 'text/html' } });
    }
    if (url.startsWith('https://opendata.trudvsem.ru/')) {
      return new Response(JSON.stringify({ status: 200, results: { vacancies: [] } }),
        { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.startsWith('https://getmatch.ru/') || url.startsWith('https://geekjob.ru/')) {
      return new Response('<html><body>no results</body></html>',
        { status: 200, headers: { 'content-type': 'text/html' } });
    }
    throw new Error('unexpected URL: ' + url);
  };

  const logs = [];
  const result = await runRuScan({
    writeFiles: false,
    fetchImpl: fakeFetch,
    onLog: (s, l) => logs.push([s, l]),
  });

  // hh: 1 hit per query × N queries = N items, dedup → 1 unique
  // habr: 2 hits per query, one is "Junior" → filtered by negative
  assert.ok(result.counts.raw >= 2, 'should have raw items');
  assert.ok(result.counts.removedNeg >= 1, 'Junior must be filtered');
  assert.equal(result.errors.length, 0, 'no errors expected');
  assert.ok(logs.some(([s, l]) => l.includes('RU Portal Scan')), 'banner logged');
  assert.ok(logs.some(([s, l]) => l.includes('NEW') || l.includes('New offers added')), 'summary logged');
});

test('runRuScan: surfaces hh.ru 403 as error, continues with habr', async () => {
  const { runRuScan } = await import('../server/lib/ru-scanner.mjs');
  const fakeFetch = async (url) => {
    if (url.startsWith('https://hh.ru/search/vacancy')) {
      return new Response('forbidden', { status: 403 });
    }
    return new Response('<section class="vacancies-list"></section>', {
      status: 200, headers: { 'content-type': 'text/html' },
    });
  };
  const result = await runRuScan({ writeFiles: false, fetchImpl: fakeFetch, onLog: () => {} });
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors.some((e) => /geo-blocked|403/.test(e)));
});
