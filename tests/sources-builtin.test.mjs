/**
 * Built In source — ported from parent career-ops v1.31.0.
 *
 * Two design decisions are pinned here because both are easy to undo by
 * accident:
 *   - there is NO default query. A shared source must never ship one user's
 *     search terms, so an entry with neither `queries:` nor `categories:`
 *     scans nothing and says so;
 *   - a market host that is not allowlisted is REFUSED, not quietly replaced
 *     by builtin.com — a typo must not silently scan the national board.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta, resolveHost, assertHost, parseSalary, composeLocation, parsePostedAt,
  parseCards, parseListPage, readConfig, fetchBuiltin,
} from '../server/lib/sources/builtin.mjs';
import { builtinAdapter } from '../server/lib/portals/adapters/builtin.mjs';

const CARD = `
<script type="application/ld+json">{"itemListElement":[{"@type":"ListItem","position":1,"name":"Senior Product Manager","url":"https://builtin.com/job/senior-product-manager/12345","description":"Own the roadmap"}]}</script>
<div data-id="job-card-title" data-builtin-track-job-id="12345">
  <i class="fa-house-building"></i><div><span>Remote</span></div>
  <i class="fa-location-dot"></i><div><span>Seattle, WA</span></div>
  <i class="fa-sack-dollar"></i><div><span>120K-180K Annually</span></div>
  <i class="fa-clock"></i><div><span>Today</span></div>
</div>`;

const htmlFetch = (html) => async () => ({ ok: true, status: 200, headers: new Map(), text: async () => html });

test('meta is registry-shaped', () => {
  assert.deepEqual(meta, { value: 'builtin', label: 'Built In', region: 'en' });
});

test('a bare market host resolves to its canonical www form', () => {
  // The bare hosts 301 to www and the fetch uses redirect:'error', so the
  // rewrite has to happen here or the request fails.
  assert.equal(resolveHost('builtinseattle.com'), 'www.builtinseattle.com');
  assert.equal(resolveHost('builtinchicago.org'), 'www.builtinchicago.org', '.org, not a typo');
  assert.equal(resolveHost(''), 'builtin.com', 'empty means the national board');
  assert.equal(resolveHost('https://www.builtinnyc.com/jobs'), 'www.builtinnyc.com', 'a pasted URL is tolerated');
});

test('an unknown market resolves to null so the entry can be refused', () => {
  assert.equal(resolveHost('builtinatlantis.com'), null);
  assert.equal(resolveHost('evil.test'), null);
  assert.equal(resolveHost(42), null);
});

test('every request URL is host-checked against the allowlist', () => {
  assert.throws(() => assertHost('https://builtin.com.evil.test/jobs'), /untrusted hostname/);
  assert.throws(() => assertHost('http://builtin.com/jobs'), /must use HTTPS/);
  // A bare host is not canonical, so it must not pass the guard either.
  assert.throws(() => assertHost('https://builtinseattle.com/jobs'), /untrusted hostname/);
  assert.equal(assertHost('https://builtin.com/jobs'), 'https://builtin.com/jobs');
});

test('salary parses into whole dollars, and a single figure is not a range', () => {
  assert.deepEqual(parseSalary('120K-180K Annually'), { min: 120000, max: 180000 });
  assert.deepEqual(parseSalary('95K Annually'), { min: 95000, max: 95000 });
  assert.equal(parseSalary('competitive'), undefined);
});

test('workplace mode and place compose one location string', () => {
  assert.equal(composeLocation('Remote', ['Seattle, WA']), 'Remote · Seattle, WA');
  assert.equal(composeLocation('', ['Austin, TX']), 'Austin, TX');
  // A bare mode with no place is not a location: it would read as a city in
  // the results table and pass a location_filter it was never meant to.
  assert.equal(composeLocation('Hybrid', []), '');
});

test('relative posting labels become timestamps; unknown ones stay undefined', () => {
  const now = Date.UTC(2026, 7, 30);
  assert.equal(parsePostedAt('Today', now), now);
  assert.equal(parsePostedAt('Reposted Today', now), now, 'a repost is still a date');
  assert.equal(parsePostedAt('sometime', now), undefined, 'no invented dates');
});

test('a card yields company-side fields keyed by the job id', () => {
  const cards = parseCards(CARD);
  const card = cards.get('12345');
  assert.ok(card, 'the card is keyed by data-builtin-track-job-id');
  assert.equal(card.location, 'Remote · Seattle, WA');
  assert.deepEqual(card.salary, { min: 120000, max: 180000 });
});

test('the JSON-LD list and the card join into one row', () => {
  const [job] = parseListPage(CARD);
  assert.equal(job.title, 'Senior Product Manager');
  assert.equal(job.url, 'https://builtin.com/job/senior-product-manager/12345');
  assert.equal(job.description, 'Own the roadmap');
  assert.equal(job.location, 'Remote · Seattle, WA');
});

test('there is no default query — an unconfigured entry scans nothing', () => {
  const cfg = readConfig({ name: 'Built In' });
  assert.deepEqual(cfg.queries, []);
  assert.deepEqual(cfg.categories, []);
});

test('an unconfigured entry returns no rows instead of scanning the whole board', async () => {
  let called = false;
  const rows = await fetchBuiltin('', { fetchImpl: async () => { called = true; }, company: { name: 'Built In' } });
  assert.deepEqual(rows, []);
  assert.equal(called, false, 'and it does not even fetch');
});

test('an unknown market is refused rather than silently falling back', async () => {
  let called = false;
  const rows = await fetchBuiltin('', {
    fetchImpl: async () => { called = true; },
    company: { name: 'Built In', builtin: { host: 'builtinatlantis.com', queries: ['pm'] } },
  });
  assert.deepEqual(rows, []);
  assert.equal(called, false, 'a typo must not quietly scan the national board');
});

test('a configured entry produces web-ui job objects with a display salary', async () => {
  const rows = await fetchBuiltin('', {
    fetchImpl: htmlFetch(CARD),
    company: { name: 'Built In', builtin: { queries: ['product manager'], max_pages: 1 } },
  });
  assert.equal(rows.length, 1);
  const [job] = rows;
  assert.equal(job.id, 'builtin-12345');
  assert.equal(job.salary, '$120K–$180K', 'the contract carries a string, not a {min,max} object');
  assert.equal(job.isRemote, true);
  assert.equal(job.source, 'builtin');
});

test('adapter is explicit-only — a careers_url must not pull the whole board', () => {
  assert.equal(builtinAdapter.matches({ provider: 'builtin' }), true);
  assert.equal(builtinAdapter.matches({ careers_url: 'https://builtin.com/company/acme' }), false);
});
