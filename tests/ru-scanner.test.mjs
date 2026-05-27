import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { searchHH } from '../server/lib/sources/hh.mjs';
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

// ───────────────────────── HH ─────────────────────────

test('searchHH: normalizes API response', async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({
        items: [
          {
            id: '12345',
            name: 'Senior PHP Developer',
            employer: { name: 'Acme Corp' },
            alternate_url: 'https://hh.ru/vacancy/12345',
            area: { name: 'Москва' },
            published_at: '2026-05-02T10:00:00+0300',
            salary: { from: 200000, to: 350000, currency: 'RUR' },
            snippet: { requirement: 'PHP 8+', responsibility: 'Build APIs' },
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  const items = await searchHH('PHP', { fetchImpl: fakeFetch });
  assert.equal(items.length, 1);
  const j = items[0];
  assert.equal(j.id, 'hh-12345');
  assert.equal(j.title, 'Senior PHP Developer');
  assert.equal(j.company, 'Acme Corp');
  assert.equal(j.url, 'https://hh.ru/vacancy/12345');
  assert.equal(j.location, 'Москва');
  assert.match(j.salary, /200000.*350000.*RUR/);
  assert.equal(j.source, 'hh.ru');
});

test('searchHH: throws with geoBlocked flag on 403', async () => {
  const fakeFetch = async () =>
    new Response(JSON.stringify({ errors: [{ type: 'forbidden' }] }), { status: 403 });
  await assert.rejects(
    () => searchHH('PHP', { fetchImpl: fakeFetch }),
    (err) => err.geoBlocked === true && err.status === 403 && /403/.test(err.message)
  );
});

test('searchHH: builds correct URL with params', async () => {
  let capturedUrl = '';
  const fakeFetch = async (url) => {
    capturedUrl = url;
    return new Response('{"items": []}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  await searchHH('Senior Go', { area: 1001, perPage: 25, onlyRemote: true, fetchImpl: fakeFetch });
  assert.match(capturedUrl, /text=Senior\+Go/);
  assert.match(capturedUrl, /area=1001/);
  assert.match(capturedUrl, /per_page=25/);
  assert.match(capturedUrl, /schedule=remote/);
});

// ───────────────── HH_PROXY (geo-block bypass via Russian proxy) ─────────────────

const okJson = async () =>
  new Response('{"items": []}', { status: 200, headers: { 'content-type': 'application/json' } });

test('searchHH: no dispatcher option when HH_PROXY unset', async () => {
  delete process.env.HH_PROXY;
  let opts = null;
  const fakeFetch = async (_url, o) => { opts = o; return okJson(); };
  await searchHH('PHP', { fetchImpl: fakeFetch });
  assert.equal('dispatcher' in opts, false, 'direct connection must not carry a dispatcher');
});

test('searchHH: passes a proxy dispatcher when HH_PROXY is set', async () => {
  process.env.HH_PROXY = 'http://user:pass@127.0.0.1:8080';
  try {
    let opts = null;
    const fakeFetch = async (_url, o) => { opts = o; return okJson(); };
    await searchHH('PHP', { fetchImpl: fakeFetch });
    assert.ok(opts.dispatcher, 'dispatcher must be present when HH_PROXY is set');
    assert.equal(typeof opts.dispatcher.dispatch, 'function', 'dispatcher must be an undici Dispatcher');
  } finally {
    delete process.env.HH_PROXY;
  }
});

test('hhProxyDispatcher: reflects HH_PROXY and rebuilds on change', async () => {
  const { hhProxyDispatcher } = await import('../server/lib/sources/hh.mjs');
  delete process.env.HH_PROXY;
  assert.equal(hhProxyDispatcher(), undefined, 'undefined when unset');

  process.env.HH_PROXY = 'http://127.0.0.1:8080';
  const a = hhProxyDispatcher();
  assert.ok(a, 'agent built when set');
  assert.equal(hhProxyDispatcher(), a, 'cached for same URL');

  process.env.HH_PROXY = 'http://127.0.0.1:9090';
  assert.notEqual(hhProxyDispatcher(), a, 'rebuilt when URL changes');
  delete process.env.HH_PROXY;
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
    if (url.startsWith('https://api.hh.ru/')) {
      return new Response(JSON.stringify({
        items: [{
          id: 'h1', name: 'Senior PHP Engineer', employer: { name: 'X' },
          alternate_url: 'https://hh.ru/vacancy/h1', area: { name: 'Москва' },
          published_at: '2026-05-02', salary: null, snippet: {},
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
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
    if (url.startsWith('https://api.hh.ru/')) {
      return new Response('{"errors":[{"type":"forbidden"}]}', { status: 403 });
    }
    return new Response('<section class="vacancies-list"></section>', {
      status: 200, headers: { 'content-type': 'text/html' },
    });
  };
  const result = await runRuScan({ writeFiles: false, fetchImpl: fakeFetch, onLog: () => {} });
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors.some((e) => /geo-blocked|403/.test(e)));
});
