/**
 * OCC Mundial source + adapter — board-wide HTML search for occ.com.mx
 * (https://www.occ.com.mx/empleos/de-{keyword}/…). Provider-selected,
 * host-pinned public HTML. CI-isolated (fake fetchImpl, no network, no
 * parent-project dependency, nothing reads CAREER_OPS_ROOT).
 *
 * Parity with parent career-ops `tests/providers/occ.test.mjs`, adapted to the
 * web-ui source contract (12-field job objects + a fake fetch that returns the
 * Response-like shape http-json.mjs's fetchText expects). The parent's
 * `ctx.maxPages` probe maps to `opts.maxPages`, its `ctx.sleep` to `opts.sleep`.
 *
 * URL assertions use strict equality, never `String.includes` or an unanchored
 * regex over a URL.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  assertOccUrl,
  slugify,
  buildSearchUrl,
  isEmptyResultPage,
  parseCards,
  readOccConfig,
  fetchOcc,
  BASE_URL,
  TRUSTED_HOST,
  MAX_PAGES_CAP,
  INTER_REQUEST_DELAY_MS,
} from '../server/lib/sources/occ.mjs';
import { occAdapter } from '../server/lib/portals/adapters/occ.mjs';
import { BROWSER_LIKE_USER_AGENT } from '../server/lib/http-json.mjs';

// Two real-shape cards, then two that must be dropped (no data-id; blank title).
const FIXTURE = `
  <div class="card-job-offer is-highlighted" data-id='21319670' id="jobcard-21319670">
    <h2 class="text-grey-900">INGENIERO DE AUTOMATIZACI&#xD3;N</h2>
    <span class="mr-2 text-grey-900 font-base font-light">$ 40,000 - $ 50,000 Mensual</span>
    <div class="h-[21px] flex items-center gap-1">
      <span class="text-grey-900 no-underline"> Tecnoap </span>
    </div>
    <div class="no-alter-loc-text mt-1">
      <span class="text-grey-900"></span><p class="text-grey-900">San Nicol&#xE1;s de los Garza, Nuevo Le&#xF3;n</p>
    </div>
  </div>
  <div class="card-job-offer" data-id='21321698' id="jobcard-21321698">
    <h2>T&#xE9;cnico de automatizaci&#xF3;n</h2>
    <div class="h-[21px] flex items-center gap-1">
      <span class="text-grey-900"> Empresa confidencial </span>
    </div>
    <div class="no-alter-loc-text mt-1"><span></span><p>Apodaca, Nuevo Le&#xF3;n</p></div>
  </div>
  <div class="card-job-offer" id="jobcard-broken"><h2>Sin data-id</h2></div>
  <div class="card-job-offer" data-id='999'><h2>   </h2></div>
`;

const EMPTY_PAGE = '<html><body><h1>No hay empleos que coincidan con tu b&#xFA;squeda</h1></body></html>';
const CHALLENGE_PAGE = '<html><head><title>Just a moment...</title></head><body><div id="cf-chl"></div></body></html>';

function res(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => body, headers: { get: () => null } };
}

/** Fake transport that routes by URL and records every call. */
function router(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init, calls.length);
  };
  return { impl, calls };
}

const noSleep = { sleep: async () => {}, retryDelayMs: 0 };
const occ = (cfg) => ({ name: 'OCC', provider: 'occ', occ: cfg });

// ---------------------------------------------------------------------------
// meta + adapter recognition
// ---------------------------------------------------------------------------

test('meta is the EN occ source', () => {
  assert.deepEqual(meta, { value: 'occ', label: 'OCC Mundial', region: 'en' });
});

test('adapter surface: provider-selected only, never careers_url-detected', () => {
  assert.equal(occAdapter.id, 'occ');
  assert.equal(occAdapter.label, 'OCC Mundial');
  assert.equal(occAdapter.fetch, fetchOcc);
  assert.ok(occAdapter.matches({ provider: 'occ' }));
  assert.ok(!occAdapter.matches({ careers_url: 'https://www.occ.com.mx/empleos/de-x/' }));
  assert.ok(!occAdapter.matches({ provider: 'OCC' }));
  assert.ok(!occAdapter.matches({}));
  assert.ok(!occAdapter.matches(null));
});

test('adapter buildEndpoint: fixed board root, or a host-pinned HTTPS override', () => {
  assert.equal(occAdapter.buildEndpoint({ provider: 'occ' }), BASE_URL);
  assert.equal(BASE_URL, 'https://www.occ.com.mx/empleos/');
  assert.equal(
    occAdapter.buildEndpoint({ provider: 'occ', api: 'https://www.occ.com.mx/empleos/' }),
    'https://www.occ.com.mx/empleos/',
  );
  assert.equal(
    occAdapter.buildEndpoint({ provider: 'occ', occ_url: 'https://WWW.OCC.COM.MX/empleos/' }),
    'https://www.occ.com.mx/empleos/',
  );
});

for (const override of [
  'http://www.occ.com.mx/empleos/',
  'https://occ.com.mx/empleos/',
  'https://www.occ.com.mx.evil.example/empleos/',
  'https://evilocc.com.mx/empleos/',
  'https://www.occ.com.mx@evil.example/empleos/',
  'https://user:pw@www.occ.com.mx/empleos/',
  'https://www.occ.com.mx:8443/empleos/',
  'https://169.254.169.254/',
  'not a url',
]) {
  test(`adapter buildEndpoint ignores unsafe override ${JSON.stringify(override)}`, () => {
    assert.equal(occAdapter.buildEndpoint({ provider: 'occ', api: override }), BASE_URL);
  });
}

test('assertOccUrl: HTTPS + exact host, no credentials or port', () => {
  assert.equal(assertOccUrl('https://www.occ.com.mx/empleos/de-x/'), 'https://www.occ.com.mx/empleos/de-x/');
  assert.equal(TRUSTED_HOST, 'www.occ.com.mx');
  assert.throws(() => assertOccUrl('http://www.occ.com.mx/empleos/'), /HTTPS/);
  assert.throws(() => assertOccUrl('https://www.occ.com.mx.attacker.com/'), /untrusted hostname/);
  assert.throws(() => assertOccUrl('https://notocc.com.mx/'), /untrusted hostname/);
  assert.throws(() => assertOccUrl('https://occ.com.mx/'), /untrusted hostname/);
  assert.throws(() => assertOccUrl('https://a:b@www.occ.com.mx/'), /credentials/);
  assert.throws(() => assertOccUrl('https://www.occ.com.mx:444/'), /custom port/);
  assert.throws(() => assertOccUrl('nope'), /invalid URL/);
});

// ---------------------------------------------------------------------------
// URL shape
// ---------------------------------------------------------------------------

test('buildSearchUrl(): page 1 carries no pagination suffix', () => {
  assert.equal(buildSearchUrl('automatizacion', null, 1), 'https://www.occ.com.mx/empleos/de-automatizacion/');
});

test('buildSearchUrl(): paginates via the -pagina-N slug, not a query param', () => {
  assert.equal(buildSearchUrl('automatizacion', null, 3), 'https://www.occ.com.mx/empleos/de-automatizacion-pagina-3/');
});

test('buildSearchUrl(): folds accents and appends the en-{state} segment', () => {
  assert.equal(
    buildSearchUrl('robótica', 'Nuevo León', 2),
    'https://www.occ.com.mx/empleos/de-robotica-pagina-2/en-nuevo-leon/',
  );
});

// Hostile input must be neutralized by slugify(), not merely sit behind the
// fixed origin prefix: `new URL(u)` would resolve away the `..` it should catch,
// so the raw built path is checked.
for (const [query, state] of [['../../evil', null], ['automatizacion', 'https://evil.example'], ['a/../b', '..']]) {
  test(`buildSearchUrl(): slugifies ${JSON.stringify(state ?? query)} into [a-z0-9-] path segments`, () => {
    const u = buildSearchUrl(query, state, 1);
    assert.ok(u.startsWith('https://www.occ.com.mx/'));
    const pathname = u.slice('https://www.occ.com.mx'.length);
    assert.ok(!pathname.includes('..'), pathname);
    assert.ok(!pathname.includes('//'), pathname);
    assert.match(pathname, /^\/empleos\/de-[a-z0-9-]+\/(en-[a-z0-9-]+\/)?$/);
  });
}

test('slugify(): lowercases, folds accents, collapses separators, trims dashes', () => {
  assert.equal(slugify('  Ingeniería de Datos!! '), 'ingenieria-de-datos');
  assert.equal(slugify(''), '');
});

// ---------------------------------------------------------------------------
// Card parsing
// ---------------------------------------------------------------------------

test('parseCards(): drops cards missing data-id or a non-empty title', () => {
  assert.equal(parseCards(FIXTURE).length, 2);
});

test('parseCards(): decodes entities, builds the URL from data-id, extracts company + location', () => {
  const [a] = parseCards(FIXTURE);
  assert.equal(a.id, '21319670');
  assert.equal(a.title, 'INGENIERO DE AUTOMATIZACIÓN');
  assert.equal(a.url, 'https://www.occ.com.mx/empleo/oferta/21319670/');
  assert.equal(a.company, 'Tecnoap');
  assert.equal(a.location, 'San Nicolás de los Garza, Nuevo León');
});

test('parseCards(): normalizes "Empresa confidencial" to the "?" marker', () => {
  const [, b] = parseCards(FIXTURE);
  assert.equal(b.company, '?');
  assert.equal(b.title, 'Técnico de automatización');
});

test('parseCards(): returns [] for empty and card-less HTML', () => {
  assert.deepEqual(parseCards(''), []);
  assert.deepEqual(parseCards('<html></html>'), []);
  assert.deepEqual(parseCards(undefined), []);
});

// ---------------------------------------------------------------------------
// Empty-result detection
// ---------------------------------------------------------------------------

test('isEmptyResultPage(): recognizes OCC empty-result copy and nothing else', () => {
  assert.ok(isEmptyResultPage(EMPTY_PAGE));
  assert.ok(!isEmptyResultPage(CHALLENGE_PAGE));
  assert.ok(!isEmptyResultPage(''));
});

test('isEmptyResultPage(): folds accents and decodes entities before matching', () => {
  assert.ok(isEmptyResultPage('No hay empleos que coincidan con tu busqueda'));
  assert.ok(isEmptyResultPage('<p>No&nbsp;hay empleos que coincidan con tu b&#xFA;squeda</p>'));
});

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

for (const bad of [{ name: 'OCC' }, occ({}), occ({ queries: [] }), occ({ queries: ['  '] }), occ({ queries: 'x' })]) {
  test(`readOccConfig(): rejects ${JSON.stringify(bad.occ?.queries ?? null)} queries with a clear message`, () => {
    assert.throws(() => readOccConfig(bad), /requires a non-empty queries/);
  });
}

test('readOccConfig(): nested occ block wins over the parent\'s flat keys; defaults + cap', () => {
  assert.deepEqual(readOccConfig({ queries: ['flat'] }), { queries: ['flat'], states: [null], maxPages: 3 });
  assert.deepEqual(
    readOccConfig({ queries: ['flat'], occ: { queries: [' nested '], states: ['jalisco'], max_pages: 5 } }),
    { queries: ['nested'], states: ['jalisco'], maxPages: 5 },
  );
  assert.equal(readOccConfig(occ({ queries: ['x'], max_pages: 999 })).maxPages, MAX_PAGES_CAP);
  assert.equal(readOccConfig(occ({ queries: ['x'], max_pages: 0 })).maxPages, 3);
  assert.equal(readOccConfig(occ({ queries: ['x'], max_pages: 2.5 })).maxPages, 3);
});

test('fetchOcc(): a missing query list throws before any request', async () => {
  const { impl, calls } = router(() => res(FIXTURE));
  await assert.rejects(fetchOcc(BASE_URL, { fetchImpl: impl, company: { name: 'OCC' }, ...noSleep }), /requires a non-empty queries/);
  assert.equal(calls.length, 0);
});

// ---------------------------------------------------------------------------
// fetchOcc end-to-end against a fake transport
// ---------------------------------------------------------------------------

test('fetchOcc(): redirect:error + browser UA on every request; 12-field job shape', async () => {
  // Mirror the live quirk: an out-of-range page re-serves page 1.
  const { impl, calls } = router(() => res(FIXTURE));
  const jobs = await fetchOcc(BASE_URL, {
    fetchImpl: impl, company: occ({ queries: ['automatizacion'], states: ['nuevo-leon'], max_pages: 3 }), ...noSleep,
  });
  assert.ok(calls.length > 0);
  for (const c of calls) {
    assert.equal(c.init.redirect, 'error');
    assert.equal(c.init.headers['User-Agent'], BROWSER_LIKE_USER_AGENT);
  }
  assert.equal(calls[0].url, 'https://www.occ.com.mx/empleos/de-automatizacion/en-nuevo-leon/');
  assert.deepEqual(jobs[0], {
    id: 'occ-21319670',
    title: 'INGENIERO DE AUTOMATIZACIÓN',
    company: 'Tecnoap',
    url: 'https://www.occ.com.mx/empleo/oferta/21319670/',
    salary: '',
    location: 'San Nicolás de los Garza, Nuevo León',
    isRemote: false,
    workplaceType: '',
    relocates: false,
    date: '',
    snippet: '',
    source: 'occ',
  });
  assert.equal(jobs[1].company, '?');
});

test('fetchOcc(): dedups by posting id when OCC re-serves page 1, then stops', async () => {
  const { impl, calls } = router(() => res(FIXTURE));
  const jobs = await fetchOcc(BASE_URL, {
    fetchImpl: impl, company: occ({ queries: ['automatizacion'], states: ['nuevo-leon'], max_pages: 3 }), ...noSleep,
  });
  assert.equal(jobs.length, 2);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, 'https://www.occ.com.mx/empleos/de-automatizacion-pagina-2/en-nuevo-leon/');
});

test('fetchOcc(): paces between requests with the injected sleep', async () => {
  const slept = [];
  const { impl, calls } = router(() => res(FIXTURE));
  await fetchOcc(BASE_URL, {
    fetchImpl: impl, company: occ({ queries: ['a', 'b'], max_pages: 1 }),
    sleep: async (ms) => { slept.push(ms); }, retryDelayMs: 0,
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(slept, [INTER_REQUEST_DELAY_MS]);
});

test('fetchOcc(): throws on a total outage instead of returning an empty board', async () => {
  const { impl } = router(() => res('blocked', 403));
  await assert.rejects(
    fetchOcc(BASE_URL, { fetchImpl: impl, company: occ({ queries: ['a', 'b'], max_pages: 2 }), ...noSleep }),
    /all 2 search request\(s\) failed/,
  );
});

test('fetchOcc(): tolerates one failed keyword when another answers', async () => {
  const { impl } = router((url) => (url === 'https://www.occ.com.mx/empleos/de-dead/' ? res('gone', 404) : res(FIXTURE)));
  const jobs = await fetchOcc(BASE_URL, { fetchImpl: impl, company: occ({ queries: ['dead', 'alive'], max_pages: 1 }), ...noSleep });
  assert.equal(jobs.length, 2);
});

test('fetchOcc(): returns [] for a genuinely empty search without throwing', async () => {
  const { impl, calls } = router(() => res(EMPTY_PAGE));
  const jobs = await fetchOcc(BASE_URL, { fetchImpl: impl, company: occ({ queries: ['nada'], max_pages: 3 }), ...noSleep });
  assert.deepEqual(jobs, []);
  assert.equal(calls.length, 1);
});

test('fetchOcc(): throws when every page 1 is a challenge served with HTTP 200', async () => {
  const { impl } = router(() => res(CHALLENGE_PAGE));
  await assert.rejects(
    fetchOcc(BASE_URL, { fetchImpl: impl, company: occ({ queries: ['a', 'b'], max_pages: 2 }), ...noSleep }),
    /all 2 search request\(s\) failed.*challenge or markup change/,
  );
});

test('fetchOcc(): tolerates one challenged keyword when another parses', async () => {
  const { impl } = router((url) => (url === 'https://www.occ.com.mx/empleos/de-roto/' ? res(CHALLENGE_PAGE) : res(FIXTURE)));
  const jobs = await fetchOcc(BASE_URL, { fetchImpl: impl, company: occ({ queries: ['roto', 'bueno'], max_pages: 1 }), ...noSleep });
  assert.equal(jobs.length, 2);
});

test('fetchOcc(): emits the "?" marker for an unparsed employer, not the board name', async () => {
  const NO_COMPANY = `
    <div class="card-job-offer" data-id='777'><h2>Sin empresa</h2>
      <div class="no-alter-loc-text"><span></span><p>Monterrey</p></div>
    </div>`;
  const { impl } = router(() => res(NO_COMPANY));
  const jobs = await fetchOcc(BASE_URL, {
    fetchImpl: impl, company: { name: 'OCC Mundial', provider: 'occ', occ: { queries: ['x'], max_pages: 1 } }, ...noSleep,
  });
  assert.equal(jobs[0].company, '?');
  assert.equal(jobs[0].location, 'Monterrey');
});

test('fetchOcc(): caps max_pages at exactly 10 regardless of config', async () => {
  // Every page yields a fresh id, so only the cap can stop the loop. Exactly
  // 10, not "<= 10": a source stopping at 1 or at the default 3 would also
  // satisfy <= 10 and leave the cap untested.
  const { impl, calls } = router((_u, _i, n) => res(FIXTURE.replace(/21319670/g, String(n))));
  await fetchOcc(BASE_URL, { fetchImpl: impl, company: occ({ queries: ['x'], max_pages: 999 }), ...noSleep });
  assert.equal(calls.length, 10);
  assert.equal(calls[9].url, 'https://www.occ.com.mx/empleos/de-x-pagina-10/');
});

// ---------------------------------------------------------------------------
// Retries + bounded probe (parent ctx.maxPages → opts.maxPages)
// ---------------------------------------------------------------------------

test('fetchOcc(): a transient 503 is retried, then succeeds', async () => {
  const { impl, calls } = router((_u, _i, n) => (n === 1 ? res('busy', 503) : res(EMPTY_PAGE)));
  const jobs = await fetchOcc(BASE_URL, { fetchImpl: impl, company: occ({ queries: ['x'], max_pages: 1 }), ...noSleep });
  assert.deepEqual(jobs, []);
  assert.equal(calls.length, 2);
});

test('fetchOcc(): a permanent 4xx and a refused redirect are not retried', async () => {
  const perm = router(() => res('nope', 404));
  await assert.rejects(fetchOcc(BASE_URL, { fetchImpl: perm.impl, company: occ({ queries: ['x'] }), ...noSleep }), /failed/);
  assert.equal(perm.calls.length, 1);

  const redir = router(() => { throw new TypeError('fetch failed', { cause: new Error('unexpected redirect') }); });
  await assert.rejects(fetchOcc(BASE_URL, { fetchImpl: redir.impl, company: occ({ queries: ['x'] }), ...noSleep }), /failed/);
  assert.equal(redir.calls.length, 1);
});

test('fetchOcc(): honours opts.maxPages=1 even when max_pages says 10', async () => {
  const { impl, calls } = router((_u, _i, n) => res(FIXTURE.replace(/2131967\d/g, String(1000 + n))));
  await fetchOcc(BASE_URL, { fetchImpl: impl, company: occ({ queries: ['x'], max_pages: 10 }), maxPages: 1, ...noSleep });
  assert.equal(calls.length, 1);
});

test('fetchOcc(): while probing, an error propagates unwrapped after one request', async () => {
  class FakeSentinel extends Error {}
  const { impl, calls } = router(() => { throw new FakeSentinel(); });
  await assert.rejects(
    fetchOcc(BASE_URL, { fetchImpl: impl, company: occ({ queries: ['a', 'b'], max_pages: 3 }), maxPages: 1, ...noSleep }),
    (err) => err instanceof FakeSentinel,
  );
  assert.equal(calls.length, 1);
});

// ---------------------------------------------------------------------------
// SSRF
// ---------------------------------------------------------------------------

test('fetchOcc(): rejects an unsafe endpoint before any request is made', async () => {
  const { impl, calls } = router(() => res(FIXTURE));
  for (const url of [
    'http://www.occ.com.mx/empleos/',
    'https://www.occ.com.mx.evil.example/empleos/',
    'https://evilocc.com.mx/empleos/',
    'https://169.254.169.254/',
  ]) {
    await assert.rejects(fetchOcc(url, { fetchImpl: impl, company: occ({ queries: ['x'] }), ...noSleep }), /occ:/);
  }
  assert.equal(calls.length, 0);
});
