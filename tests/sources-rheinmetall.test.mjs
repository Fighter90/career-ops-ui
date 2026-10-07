/**
 * Rheinmetall source — Phase-2 pagination + envelope contract (v1.242.0
 * sources-6). CI-isolated: fake fetchImpl, no network.
 *
 * Covers the defects from docs/sdd/BACKLOG.md sources-6:
 *   - the page loop had no try/catch → one 503 lost every earlier page; now a
 *     page-1 failure throws and a later-page failure keeps the partials + logs;
 *   - a page-1 200 with zero cards only warned and returned [] — a Cloudflare
 *     challenge read as an empty board; now the documented list container is
 *     required on page 1 (present even when the board is empty) and a page
 *     without it throws.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  meta,
  assertRheinmetallUrl,
  resolveListUrl,
  parseVacancies,
  fetchRheinmetall,
} from '../server/lib/sources/rheinmetall.mjs';

const ENDPOINT = 'https://www.rheinmetall.com/en/career/vacancies';

// One card, trimmed from the live SSR markup (three <a> copies share the
// /en/job/{slug}/{id} link; the title + org divs follow).
const card = (id, title, org = 'Rheinmetall Waffe Munition GmbH') =>
  '<div class="flex gap-0.5 group">'
  + `<div class="w-full"><a href="/en/job/whatsoever-slug/${id}" class="absolute inset-0 z-10"></a></div>`
  + `<a href="/en/job/whatsoever-slug/${id}" class="absolute inset-0">x</a>`
  + `<div class="text-sm font-bold md:text-xl mb-2">${title}</div>`
  + `<div class="flex flex-wrap mr-6">${org} | Berlin</div>`
  + '</div>';

// The documented envelope: the cards render inside this container on every
// vacancy-list page — even an empty one. A challenge/interstitial has neither.
const ENVELOPE = '<div class="gap-4 md:gap-6 flex flex-col">';
const listPage = (...cards) => `<html><main>${ENVELOPE}${cards.join('')}</main></html>`;
const challengePage = '<html><head><title>Attention Required</title></head><body>cf-error-details Cloudflare</body></html>';

const textResponse = (s) => ({ ok: true, status: 200, text: async () => s });
const statusResponse = (status) => ({ ok: false, status, text: async () => '', headers: { get: () => null } });

// ── meta / URL guards ───────────────────────────────────────────────────────

test('meta: value/label/region', () => {
  assert.deepEqual(meta, { value: 'rheinmetall', label: 'Rheinmetall', region: 'en' });
});

test('assertRheinmetallUrl pins the host; resolveListUrl stays inside it', () => {
  assert.equal(assertRheinmetallUrl(ENDPOINT), ENDPOINT);
  assert.throws(() => assertRheinmetallUrl('https://evil.com/en/career/vacancies'), /untrusted hostname/);
  assert.throws(() => assertRheinmetallUrl('http://www.rheinmetall.com/en/career/vacancies'), /must use HTTPS/);
  assert.throws(() => assertRheinmetallUrl('not-a-url'), /invalid URL/);
  assert.equal(resolveListUrl({ careers_url: 'https://rheinmetall.com/de/karriere' }), 'https://www.rheinmetall.com/en/career/vacancies');
  assert.equal(resolveListUrl({ api: 'https://www.rheinmetall.com/de/career/vacancies' }), 'https://www.rheinmetall.com/de/career/vacancies');
});

test('parseVacancies reads id/title/location from one card only', () => {
  const rows = parseVacancies(listPage(card('9001', 'Teamleiter'), card('9002', 'Ingenieur')), 'https://www.rheinmetall.com');
  assert.deepEqual(rows.map((r) => [r.id, r.title, r.location]), [
    ['9001', 'Teamleiter', 'Berlin'],
    ['9002', 'Ingenieur', 'Berlin'],
  ]);
  assert.deepEqual(rows.map((r) => r.url), [
    'https://www.rheinmetall.com/en/job/whatsoever-slug/9001',
    'https://www.rheinmetall.com/en/job/whatsoever-slug/9002',
  ]);
});

// ── the page loop: page-1 throws, later-page failures keep partials ─────────

test('fetchRheinmetall: walks pages until an empty page', async () => {
  let call = 0;
  const jobs = await fetchRheinmetall(ENDPOINT, {
    fetchImpl: async () => textResponse(++call === 1 ? listPage(card('9001', 'A'), card('9002', 'B')) : listPage()),
    company: { name: 'Rheinmetall' },
  });
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].id, 'rheinmetall-9001');
  assert.equal(jobs[0].source, 'rheinmetall');
});

test('fetchRheinmetall: a page-1 failure THROWS (board unreachable, not empty)', async () => {
  await assert.rejects(
    () => fetchRheinmetall(ENDPOINT, { fetchImpl: async () => statusResponse(503) }),
    /HTTP 503/,
  );
});

test('fetchRheinmetall: a mid-walk failure keeps the earlier pages and logs', async () => {
  let call = 0;
  const warnings = [];
  const real = console.warn;
  console.warn = (m) => warnings.push(String(m));
  let jobs;
  try {
    jobs = await fetchRheinmetall(ENDPOINT, {
      fetchImpl: async () => (++call === 1
        ? textResponse(listPage(card('9001', 'A'), card('9002', 'B')))
        : statusResponse(503)),
      company: { name: 'Rheinmetall' },
    });
  } finally {
    console.warn = real;
  }
  assert.equal(jobs.length, 2, 'one 503 on page 2 must not lose page 1');
  assert.match(warnings.join(' '), /rheinmetall/);
  assert.match(warnings.join(' '), /keeping partials|partial/i);
});

// ── page-1 200 with zero cards: the envelope decides empty vs challenge ─────

test('fetchRheinmetall: a page-1 200 WITHOUT the list container THROWS (challenge)', async () => {
  // A Cloudflare challenge page parses to zero cards and used to warn + return
  // [] — a dead/defended board read as "live but empty". The documented
  // envelope (the vacancy-list container) is required on page 1.
  await assert.rejects(
    () => fetchRheinmetall(ENDPOINT, { fetchImpl: async () => textResponse(challengePage) }),
    /vacancy-list container/,
  );
});

test('fetchRheinmetall: a page-1 200 with the container but zero cards is a legitimately empty board', async () => {
  const warnings = [];
  const real = console.warn;
  console.warn = (m) => warnings.push(String(m));
  let jobs;
  try {
    jobs = await fetchRheinmetall(ENDPOINT, { fetchImpl: async () => textResponse(listPage()) });
  } finally {
    console.warn = real;
  }
  assert.deepEqual(jobs, []);
});
