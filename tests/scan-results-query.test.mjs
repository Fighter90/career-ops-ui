/**
 * GET /api/scan-results — paged query mode (v1.227.6).
 *
 * The route returned the whole snapshot and nothing else. That is ~2 MB
 * (2837 regional + 278 EN rows on a real box), which no LLM agent can hold in
 * context — so the Telegram assistant, whose skill points it at this very
 * endpoint, answered "найди все Продуктовый менеджер" with **9** matches while
 * the snapshot held **403**. It told the user it was "working with a limited
 * local index", which was true: it could see the endpoint and could not
 * consume it.
 *
 * Two further traps this pins:
 *   - `fresh` vs `filtered`. `fresh` is only what was new on the last run
 *     (104 rows); `filtered` is everything that survived the scan's filters
 *     (2837). "Find all X" means the latter, so `filtered` is the default.
 *   - `total` must be the count BEFORE paging, so an agent can answer "how
 *     many are there?" from a single request while rendering only `limit`.
 *
 * Back-compat is non-negotiable: the SPA's #/scan table reads the bare route
 * and does its own client-side filtering, so no params must mean no change.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server, baseUrl;

const job = (title, company, location) => ({ title, company, location, url: `https://x/${encodeURIComponent(title)}` });

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'scanq-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: X\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'last-scan.json'), JSON.stringify({
    en: {
      kind: 'en', when: '2026-08-29T18:00:00Z', errors: [],
      fresh: [job('Product Manager', 'Acme', 'Berlin')],
      filtered: [job('Product Manager', 'Acme', 'Berlin'), job('Go Engineer', 'Beta', 'Remote')],
    },
    ru: {
      kind: 'ru', when: '2026-08-29T17:58:00Z', errors: [],
      fresh: [job('Продуктовый менеджер', 'Ромашка', 'Москва')],
      filtered: [
        job('Продуктовый менеджер', 'Ромашка', 'Москва'),
        job('Senior Product Manager', 'IBS', 'Москва'),
        // The two shapes a whole-phrase match silently loses: the words in the
        // other order, and the words with filler between them.
        job('Менеджер продукта', 'Вектор', 'Москва'),
        job('Менеджер по развитию продукта', 'Куб', 'Казань'),
        job('Go разработчик', 'Дельта', 'СПб'),
      ],
    },
  }));
  process.env.CAREER_OPS_ROOT = dir;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); });
  });
});

after(async () => {
  if (server) { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
  delete process.env.CAREER_OPS_ROOT;
});

const get = async (qs) => (await fetch(`${baseUrl}/api/scan-results${qs}`)).json();

test('no params returns the bare snapshot, exactly as before', async () => {
  const b = await get('');
  // The SPA depends on this shape; a `rows`/`total` envelope here would break it.
  assert.ok(b.en && b.ru, 'must still be keyed by region');
  assert.equal(b.en.filtered.length, 2);
  assert.equal(b.ru.filtered.length, 5);
  assert.equal(b.rows, undefined, 'must not gain a paged envelope');
  assert.ok('workdayFallback' in b);
});

test('?q= searches the FILTERED set across both regions by default', async () => {
  const b = await get('?q=product');
  // "Product Manager" (en) + "Senior Product Manager" (ru) — not the fresh subset.
  assert.equal(b.total, 2);
  assert.equal(b.set, 'filtered');
  assert.deepEqual(b.rows.map((r) => r.region).sort(), ['en', 'ru']);
});

test('search is case-insensitive and matches Cyrillic titles', async () => {
  assert.equal((await get('?q=ПРОДУКТОВЫЙ')).total, 1);
  assert.equal((await get('?q=продуктовый менеджер')).total, 1);
});

test('search also covers company and location, not just the title', async () => {
  assert.equal((await get('?q=ромашка')).total, 1, 'company');
  assert.equal((await get('?q=Москва')).total, 3, 'location');
});

test('a multi-word query matches all terms, not the literal phrase', async () => {
  // The original whole-phrase `.includes(q)` found only the exact adjacency.
  // On real data that turned "продакт менеджер" into 32 hits where 162 rows
  // carry both words — and an agent asked "find all X" quoted the 32.
  const r = await get('?q=' + encodeURIComponent('менеджер продукта') + '&limit=50');
  const titles = r.rows.map((x) => x.title).sort();
  assert.deepEqual(titles, ['Менеджер по развитию продукта', 'Менеджер продукта']);
  assert.equal(r.total, 2);
});

test('term order does not matter, and filler between the terms is allowed', async () => {
  const a = await get('?q=' + encodeURIComponent('продукта менеджер') + '&limit=50');
  const b = await get('?q=' + encodeURIComponent('менеджер продукта') + '&limit=50');
  assert.equal(a.total, b.total, 'reversing the words must not change the answer');
  // "Менеджер ПО РАЗВИТИЮ продукта" is only reachable when the terms are
  // matched independently.
  assert.ok(a.rows.some((x) => x.title === 'Менеджер по развитию продукта'));
});

test('every term must be present — it is AND, not OR', async () => {
  // 'Go разработчик' carries neither term; 'Продуктовый менеджер' carries only
  // one of them. Requiring both is what keeps the widened match honest.
  const r = await get('?q=' + encodeURIComponent('менеджер разработчик') + '&limit=50');
  assert.equal(r.total, 0, 'a row must carry every term, not just one');
});

test('repeated whitespace between terms is not a term', async () => {
  const r = await get('?q=' + encodeURIComponent('  менеджер   продукта  ') + '&limit=50');
  assert.equal(r.total, 2, 'padding and doubled spaces must not change the result');
});

test('?set=fresh narrows to the last run — the distinction that caused the bug', async () => {
  const all = await get('?q=product&set=filtered');
  const fresh = await get('?q=product&set=fresh');
  assert.equal(all.total, 2);
  assert.equal(fresh.total, 1, 'fresh is only what was new last run');
  assert.equal(fresh.set, 'fresh');
});

test('?region= restricts to one side', async () => {
  assert.deepEqual((await get('?region=ru')).rows.map((r) => r.region), ['ru', 'ru', 'ru', 'ru', 'ru']);
  assert.equal((await get('?region=en')).total, 2);
  assert.equal((await get('?region=nonsense')).total, 7, 'an unknown region falls back to both');
});

test('total counts BEFORE paging so an agent can answer "how many"', async () => {
  const b = await get('?limit=1');
  assert.equal(b.total, 7, 'all filtered rows across both regions');
  assert.equal(b.returned, 1);
  assert.equal(b.rows.length, 1);
});

test('offset walks the result set without repeating or dropping a row', async () => {
  const seen = [];
  for (let off = 0; off < 7; off += 2) {
    const b = await get(`?limit=2&offset=${off}`);
    seen.push(...b.rows.map((r) => r.url));
  }
  assert.equal(new Set(seen).size, 7, 'every row seen exactly once');
});

test('limit is clamped and junk paging params never throw', async () => {
  assert.equal((await get('?limit=99999')).limit, 200, 'clamped to a sane maximum');
  assert.equal((await get('?limit=0')).limit, 1);
  assert.equal((await get('?limit=abc')).limit, 50, 'falls back to the default');
  assert.equal((await get('?offset=-5')).offset, 0);
  const past = await get('?offset=9999');
  assert.deepEqual(past.rows, [], 'past the end is empty, not an error');
  assert.equal(past.total, 7, 'but total still reports the truth');
});

test('a query matching nothing reports zero rather than falling back to everything', async () => {
  const b = await get('?q=zzz-no-such-role');
  assert.equal(b.total, 0);
  assert.deepEqual(b.rows, []);
});
