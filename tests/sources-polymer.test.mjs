/**
 * Polymer source (upstream #6128 port) — CI-isolated suite.
 * A Polymer Hire tenant board is https://jobs.polymer.co/<slug> and its data
 * comes from the public no-auth JSON API
 * GET https://api.polymer.co/v1/hire/organizations/<slug>/jobs?page=N →
 * { items: [...], meta: { page, count, total, is_last, next_page } }.
 * The vendor demo tenant proved the metadata is not trustworthy (`total`
 * stays 1 on a multi-job board, page 2 is empty while is_last is false and
 * next_page is 3), so the walk stops on the RAW page length, a repeated
 * page, is_last on a page that has rows, or a covering count. Page 1 with a
 * wrong shape fails CLOSED; a later page failing keeps the partials.
 * No network — parsePolymerPage is pure; fetchPolymer runs on a fake
 * fetchImpl with an injectable sleep.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  SLUG_RE,
  extractSlug,
  resolveSlug,
  resolveMaxPages,
  assertPolymerUrl,
  jobLocation,
  postingUrl,
  parsePolymerPage,
  fetchPolymer,
} from '../server/lib/sources/polymer.mjs';
import { polymerAdapter } from '../server/lib/portals/adapters/polymer.mjs';

const instantSleep = async () => {}; // tests run without backoff waits

// ── fixtures ─────────────────────────────────────────────────────────────────

function row(over = {}) {
  return {
    id: '9a1',
    title: 'Senior Engineer',
    job_post_url: 'https://jobs.polymer.co/acme/9a1',
    display_location: 'Berlin, Germany',
    published_at: '2026-09-01T10:00:00.000Z',
    published_at_timestamp: 1788000000,
    ...over,
  };
}

function page(items, meta = { is_last: true }) {
  return { items, meta };
}

// ── registry + adapter contract ──────────────────────────────────────────────

test('polymer: meta — value, label, region en', () => {
  assert.deepEqual(meta, { value: 'polymer', label: 'Polymer', region: 'en' });
  assert.equal(polymerAdapter.id, 'polymer');
  assert.equal(polymerAdapter.label, 'Polymer');
});

test('polymer: adapter matches the board and API hosts; endpoint is the API walk-root string', () => {
  assert.equal(polymerAdapter.matches({ name: 'Acme', careers_url: 'https://jobs.polymer.co/acme' }), true);
  assert.equal(polymerAdapter.matches({ name: 'Acme', api: 'https://api.polymer.co/v1/hire/organizations/acme/jobs' }), true);
  assert.equal(polymerAdapter.matches({ name: 'Acme', careers_url: 'https://jobs.polymer.co/acme/9a1' }), true, 'a posting permalink reduces to the slug');
  assert.equal(polymerAdapter.matches({ name: 'X', careers_url: 'https://jobs.polymer.co.evil.example/acme' }), false, 'suffix-spoofed host');
  assert.equal(polymerAdapter.matches({ name: 'X', careers_url: 'https://evil-api.polymer.co/v1/x' }), false, 'prefix-spoofed host');
  assert.equal(polymerAdapter.matches({ name: 'X', careers_url: 'http://jobs.polymer.co/acme' }), false, 'non-https');
  assert.equal(polymerAdapter.matches(null), false);
  assert.equal(polymerAdapter.matches('polymer'), false);
  const endpoint = polymerAdapter.buildEndpoint({ name: 'Acme', careers_url: 'https://jobs.polymer.co/acme' });
  assert.equal(typeof endpoint, 'string');
  assert.equal(endpoint, 'https://api.polymer.co/v1/hire/organizations/acme/jobs');
  assert.equal(polymerAdapter.buildEndpoint({ name: 'X', careers_url: 'https://example.com/x' }), null, 'off-host entry → no endpoint (fail-soft)');
});

// ── slug extraction / host pin ───────────────────────────────────────────────

test('polymer: extractSlug claims jobs.polymer.co/<slug> and api.polymer.co org paths', () => {
  assert.equal(extractSlug('https://jobs.polymer.co/acme'), 'acme');
  assert.equal(extractSlug('https://jobs.polymer.co/acme/9a1?x=1'), 'acme', 'a deeper path reduces to the first segment');
  assert.equal(extractSlug('https://api.polymer.co/v1/hire/organizations/acme/jobs?page=2'), 'acme');
  assert.equal(extractSlug('  https://jobs.polymer.co/Acme-2  '), 'acme-2', 'whitespace trimmed, slug lowercased');
});

test('polymer: extractSlug rejects spoofed, non-HTTPS, slug-less and malformed URLs', () => {
  const rejects = [
    ['suffix-spoofed host', 'https://jobs.polymer.co.evil.example/acme'],
    ['prefix-spoofed host', 'https://evil-jobs.polymer.co/acme'],
    ['api host, wrong path', 'https://api.polymer.co/v1/other/acme'],
    ['bare board', 'https://jobs.polymer.co/'],
    ['unsafe slug', 'https://jobs.polymer.co/%2e%2e%2fadmin'],
    ['http', 'http://jobs.polymer.co/acme'],
    ['malformed', 'not a url'],
  ];
  for (const [name, u] of rejects) {
    assert.equal(extractSlug(u), null, `${name} must be rejected`);
  }
  assert.equal(extractSlug(null), null);
  assert.equal(extractSlug(7), null);
  assert.equal(extractSlug(''), null);
});

test('polymer: SLUG_RE is the upstream charset-checked slug shape', () => {
  assert.ok(SLUG_RE.test('acme'));
  assert.ok(SLUG_RE.test('acme-corp-2'));
  assert.ok(!SLUG_RE.test('-leading'));
  assert.ok(!SLUG_RE.test('trailing-'));
  assert.ok(!SLUG_RE.test('has space'));
  assert.ok(!SLUG_RE.test(''));
});

test('polymer: resolveSlug — api: wins; resolveMaxPages — per-entry override with a hard cap', () => {
  assert.equal(resolveSlug({ api: 'https://jobs.polymer.co/acme', careers_url: 'https://example.com' }), 'acme');
  assert.equal(resolveSlug({ careers_url: 'https://jobs.polymer.co/acme' }), 'acme');
  assert.equal(resolveSlug({}), null);
  assert.equal(resolveSlug(null), null);
  assert.equal(resolveMaxPages({}), 20, 'default 20');
  assert.equal(resolveMaxPages({ max_pages: 3 }), 3);
  assert.equal(resolveMaxPages({ max_pages: 500 }), 100, 'capped at 100');
  assert.equal(resolveMaxPages({ max_pages: 0 }), 20, 'a non-positive value falls back to the default');
  assert.equal(resolveMaxPages(null), 20);
});

test('polymer: assertPolymerUrl — https on exactly the API host, default port only', () => {
  assert.equal(assertPolymerUrl('https://api.polymer.co/v1/hire/organizations/acme/jobs'), 'https://api.polymer.co/v1/hire/organizations/acme/jobs');
  assert.throws(() => assertPolymerUrl('http://api.polymer.co/x'), /HTTPS/);
  assert.throws(() => assertPolymerUrl('https://evil.example/x'), /untrusted hostname/);
  assert.throws(() => assertPolymerUrl('https://api.polymer.co:8443/x'), /port/);
  assert.throws(() => assertPolymerUrl('not a url'), /invalid URL/);
});

// ── jobLocation / postingUrl ─────────────────────────────────────────────────

test('polymer: jobLocation — display_location wins; city/state/country join; real remoteness only', () => {
  assert.equal(jobLocation({ display_location: 'Berlin, Germany' }), 'Berlin, Germany');
  assert.equal(jobLocation({ city: 'Berlin', state_region: 'BE', country: 'Germany' }), 'Berlin, BE, Germany');
  assert.equal(jobLocation({ city: 'Berlin', remoteness_pretty: 'Fully remote' }), 'Remote (Berlin)');
  assert.equal(jobLocation({ remoteness_pretty: 'Remote' }), 'Remote');
  assert.equal(jobLocation({ city: 'Berlin', remoteness_pretty: 'No remote' }), 'Berlin', '"No remote" is not remote');
  assert.equal(jobLocation({ city: 'Berlin', remoteness_pretty: 'Remote within Germany' }), 'Remote (Berlin)');
  assert.equal(jobLocation({}), '');
});

test('polymer: postingUrl — an off-host or http job_post_url is rebuilt from the id', () => {
  assert.equal(postingUrl(row(), 'acme'), 'https://jobs.polymer.co/acme/9a1', 'an on-host url passes through');
  assert.equal(postingUrl(row({ job_post_url: 'https://evil.example/phish' }), 'acme'), 'https://jobs.polymer.co/acme/9a1', 'an off-host url cannot point the dedup key elsewhere');
  assert.equal(postingUrl(row({ job_post_url: 'http://jobs.polymer.co/acme/9a1' }), 'acme'), 'https://jobs.polymer.co/acme/9a1', 'an http downgrade is rebuilt');
  assert.equal(postingUrl(row({ job_post_url: undefined, id: 'weird id/2' }), 'acme'), `https://jobs.polymer.co/acme/${encodeURIComponent('weird id/2')}`, 'rebuilt from the id, encoded');
  assert.equal(postingUrl(row({ job_post_url: undefined, id: '\uD800bad' }), 'acme'), null, 'a lone-surrogate id drops the row (no url, no dedup key)');
  assert.equal(postingUrl({ title: 'x', job_post_url: undefined }, 'acme'), null, 'no id at all → no url');
});

// ── parsePolymerPage ─────────────────────────────────────────────────────────

test('polymer: parse maps rows — title/url/location/postedAt (ISO preferred over the seconds timestamp)', () => {
  const parsed = parsePolymerPage(page([
    row(),
    row({ id: '9b2', title: '  Support  Lead ', published_at: undefined }),
    row({ id: '9c3', title: '   ' }),   // blank title → dropped
    row({ id: undefined, title: 'No id', job_post_url: undefined }), // no id → dropped
    'junk',                             // junk row → dropped
  ], { is_last: true }), 'Acme', 'acme');
  assert.equal(parsed.jobs.length, 2);
  assert.deepEqual(
    { title: parsed.jobs[0].title, url: parsed.jobs[0].url, company: parsed.jobs[0].company, location: parsed.jobs[0].location, postedAt: parsed.jobs[0].postedAt },
    { title: 'Senior Engineer', url: 'https://jobs.polymer.co/acme/9a1', company: 'Acme', location: 'Berlin, Germany', postedAt: Date.parse('2026-09-01T10:00:00.000Z') },
  );
  assert.equal(parsed.jobs[1].title, 'Support Lead');
  assert.equal(parsed.jobs[1].postedAt, 1788000000 * 1000, 'published_at_timestamp seconds are the fallback');
  assert.equal(parsed.rawCount, 5, 'the raw page length is what stops the walk');
  assert.equal(parsed.isLast, true);
});

test('polymer: parse fails CLOSED on a page whose items container is the wrong shape', () => {
  assert.throws(() => parsePolymerPage({ items: null }, 'Acme', 'acme'), /polymer items/);
  assert.throws(() => parsePolymerPage({ unexpected: [] }, 'Acme', 'acme'), /expected an array/);
  assert.throws(() => parsePolymerPage(null, 'Acme', 'acme'), /expected an array/);
  const empty = parsePolymerPage(page([], { is_last: false }), 'Acme', 'acme');
  assert.deepEqual(empty.jobs, [], 'a present-and-empty items array is a real empty page');
});

// ── fetchPolymer — the web-ui fetch contract ─────────────────────────────────

test('polymer: fetch issues one request per page to the pinned API host with redirect:"error"; rows normalize', async () => {
  const seen = [];
  const jobs = await fetchPolymer('https://api.polymer.co/v1/hire/organizations/acme/jobs', {
    fetchImpl: async (url, opts) => { seen.push({ url, opts }); return { ok: true, status: 200, json: async () => page([row()]) }; },
    company: { name: 'Acme', careers_url: 'https://jobs.polymer.co/acme' },
    sleep: instantSleep,
  });
  assert.equal(seen.length, 1, 'is_last on a page with rows stops the walk');
  assert.equal(seen[0].url, 'https://api.polymer.co/v1/hire/organizations/acme/jobs?page=1');
  assert.equal(seen[0].opts.redirect, 'error');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'polymer-https://jobs.polymer.co/acme/9a1');
  assert.equal(jobs[0].source, 'polymer');
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].salary, '', 'salary_pretty is free text — left off');
  assert.equal(jobs[0].date, new Date(Date.parse('2026-09-01T10:00:00.000Z')).toISOString());
});

test('polymer: pagination walks until an EMPTY page (the raw length), not the metadata totals', async () => {
  const seen = [];
  const fakeMeta = { is_last: false, next_page: 3, total: 1, count: 1 }; // the demo tenant's untrustworthy shape
  const jobs = await fetchPolymer('https://api.polymer.co/v1/hire/organizations/acme/jobs', {
    fetchImpl: async (url) => {
      seen.push(url);
      const pageN = Number(new URL(url).searchParams.get('page'));
      if (pageN === 1) return { ok: true, status: 200, json: async () => page([row(), row({ id: '9b2', title: 'B', job_post_url: `https://jobs.polymer.co/acme/9b2` })], fakeMeta) };
      return { ok: true, status: 200, json: async () => page([], fakeMeta) }; // page 2: empty, but is_last says false
    },
    company: { name: 'Acme', careers_url: 'https://jobs.polymer.co/acme' },
    sleep: instantSleep,
  });
  assert.equal(seen.length, 2, 'the walk stops on the empty page, never chasing next_page');
  assert.equal(jobs.length, 2);
});

test('polymer: a count that covers the rows seen ends the walk; a smaller demo count is ignored', async () => {
  const seen = [];
  const jobs = await fetchPolymer('https://api.polymer.co/v1/hire/organizations/acme/jobs', {
    fetchImpl: async (url) => {
      seen.push(url);
      const pageN = Number(new URL(url).searchParams.get('page'));
      if (pageN === 1) return { ok: true, status: 200, json: async () => page([row(), row({ id: '9b2', title: 'B', job_post_url: undefined })], { count: 2, is_last: false }) };
      return { ok: true, status: 200, json: async () => { throw new Error('unreachable'); } };
    },
    company: { name: 'Acme', careers_url: 'https://jobs.polymer.co/acme' },
    sleep: instantSleep,
  });
  assert.equal(seen.length, 1, 'count 2 >= raw 2 and fully covered → stop');
  assert.equal(jobs.length, 2);
});

test('polymer: a repeated page (same raw key) stops the walk', async () => {
  const seen = [];
  const again = [row()];
  await fetchPolymer('https://api.polymer.co/v1/hire/organizations/acme/jobs', {
    fetchImpl: async (url) => {
      seen.push(url);
      return { ok: true, status: 200, json: async () => page(again, { is_last: false }) };
    },
    company: { name: 'Acme', careers_url: 'https://jobs.polymer.co/acme' },
    sleep: instantSleep,
  });
  assert.equal(seen.length, 2, 'page 2 returning the same rows ends the walk');
});

test('polymer: a later-page failure keeps the partials and logs a truncation warning', async () => {
  const warns = [];
  const origError = console.error;
  console.error = (...a) => warns.push(a.join(' '));
  let jobs;
  try {
    jobs = await fetchPolymer('https://api.polymer.co/v1/hire/organizations/acme/jobs', {
      fetchImpl: async (url) => {
        const pageN = Number(new URL(url).searchParams.get('page'));
        if (pageN === 1) return { ok: true, status: 200, json: async () => page([row(), row({ id: '9b2', title: 'B', job_post_url: `https://jobs.polymer.co/acme/9b2` })], { is_last: false }) };
        return { ok: false, status: 500, headers: { get: () => null }, text: async () => '' };
      },
      company: { name: 'Acme', careers_url: 'https://jobs.polymer.co/acme' },
      sleep: instantSleep,
    });
  } finally {
    console.error = origError;
  }
  assert.equal(jobs.length, 2, 'page-1 jobs survive a page-2 failure');
  assert.match(warns.join('\n'), /truncated at page 2.*2 jobs/, 'the warning names the page and the count');
});

test('polymer: page 1 with a malformed 200 THROWS — never an empty board', async () => {
  await assert.rejects(
    () => fetchPolymer('https://api.polymer.co/v1/hire/organizations/acme/jobs', {
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ unexpected: {} }) }),
      company: { name: 'Acme', careers_url: 'https://jobs.polymer.co/acme' },
      sleep: instantSleep,
    }),
    /expected an array/,
  );
  await assert.rejects(
    () => fetchPolymer('https://api.polymer.co/v1/hire/organizations/acme/jobs', {
      fetchImpl: async () => ({ ok: false, status: 422, headers: { get: () => null }, text: async () => '' }),
      company: { name: 'Acme', careers_url: 'https://jobs.polymer.co/acme' },
      sleep: instantSleep,
    }),
    /HTTP 422/,
    'an unknown slug is a loud error, not an empty items array',
  );
});

test('polymer: fetch fails loud without a resolvable slug and when the signal is already aborted', async () => {
  await assert.rejects(
    () => fetchPolymer('https://api.polymer.co/v1/hire/organizations/acme/jobs', { fetchImpl: async () => { throw new Error('x'); }, company: { name: 'Acme' } }),
    /cannot derive the organization slug/,
  );
  const controller = new AbortController();
  controller.abort();
  let touched = 0;
  await assert.rejects(
    () => fetchPolymer('https://api.polymer.co/v1/hire/organizations/acme/jobs', {
      fetchImpl: async () => { touched += 1; return { ok: true, json: async () => page([]) }; },
      company: { name: 'Acme', careers_url: 'https://jobs.polymer.co/acme' },
      signal: controller.signal,
      sleep: instantSleep,
    }),
    /abort/i,
  );
  assert.equal(touched, 0);
});
