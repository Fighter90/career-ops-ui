/**
 * Phenom source — Phase-2 shape contract + caps (v1.242.0 sources-6).
 *
 * CI-isolated: fake fetchImpl, no network, no port binding, nothing reads
 * CAREER_OPS_ROOT. Covers the defects from docs/sdd/BACKLOG.md sources-6:
 *   - a 200 with the wrong shape THROWS on page 1 (malformed first page used
 *     to read as [] because succeededOnce was set before the shape check);
 *   - a malformed LATER page keeps the partials and logs;
 *   - MAX_JOBS truncation is logged, never silent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  meta,
  assertPhenomUrl,
  parseRefineSearch,
  fetchPhenom,
} from '../server/lib/sources/phenom.mjs';

const CFG = { origin: 'https://careers.allianz.com', urlPrefix: 'global/en' };

const job = (id, title = `Role ${id}`) => ({ jobId: String(id), title, postedDate: '2026-05-07T18:25:30.000+0000' });

/** One refineSearch page with `n` postings and the given total. */
const page = (n, total, firstId = 1) => ({
  refineSearch: {
    status: 200,
    totalHits: total,
    data: { jobs: Array.from({ length: n }, (_, i) => job(firstId + i)) },
  },
});

const jsonResponse = (data) => ({ ok: true, status: 200, json: async () => data });

// ── meta / endpoint guard ───────────────────────────────────────────────────

test('meta: value/label/region', () => {
  assert.deepEqual(meta, { value: 'phenom', label: 'Phenom', region: 'en' });
});

test('assertPhenomUrl: https + real host', () => {
  assert.equal(assertPhenomUrl('https://careers.allianz.com/widgets'), 'https://careers.allianz.com/widgets');
  assert.throws(() => assertPhenomUrl('http://careers.allianz.com/widgets'), /must use HTTPS/);
  assert.throws(() => assertPhenomUrl('not-a-url'), /invalid URL/);
});

// ── parseRefineSearch: the shape is the documented envelope, or it throws ───

test('parseRefineSearch: maps the documented envelope to total + jobs', () => {
  const { total, jobs } = parseRefineSearch(page(2, 42), CFG, 'Allianz');
  assert.equal(total, 42);
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].id, 'phenom-1');
  assert.equal(jobs[0].company, 'Allianz');
  assert.equal(jobs[0].url, 'https://careers.allianz.com/global/en/job/1/Role-1');
  assert.equal(jobs[0].source, 'phenom');
});

test('parseRefineSearch: a 200 that stops speaking the envelope THROWS (Phase-2)', () => {
  for (const bad of [{}, { refineSearch: {} }, { refineSearch: { totalHits: 10 } }, null, 'nope', []]) {
    assert.throws(() => parseRefineSearch(bad, CFG, 'X'), (err) => {
      assert.ok(err instanceof TypeError);
      assert.match(err.message, /Phenom refineSearch/);
      return true;
    }, `expected a throw for ${JSON.stringify(bad)}`);
  }
});

// ── fetchPhenom: page-1 wrong shape throws; later-page failure keeps partials ─

test('fetchPhenom: a malformed FIRST page (200, wrong shape) THROWS — never []', async () => {
  // succeededOnce used to be set before the shape check, so a drifted envelope
  // read as a healthy-but-empty board. It must reject so scan/portal-health
  // record a failure instead of "live but empty" (meituan/tencent contract).
  await assert.rejects(
    () => fetchPhenom('https://careers.allianz.com/widgets', {
      fetchImpl: async () => jsonResponse({ unexpected: true }),
      company: { name: 'Allianz', phenom: { urlPrefix: 'global/en' } },
    }),
    /Phenom refineSearch/,
  );
});

test('fetchPhenom: a malformed LATER page keeps the partials and logs', async () => {
  let call = 0;
  const warnings = [];
  const real = console.warn;
  console.warn = (m) => warnings.push(String(m));
  let jobs;
  try {
    jobs = await fetchPhenom('https://careers.allianz.com/widgets', {
      fetchImpl: async () => (++call === 1 ? jsonResponse(page(3, 500)) : jsonResponse({})),
      company: { name: 'Allianz', phenom: { urlPrefix: 'global/en' } },
    });
  } finally {
    console.warn = real;
  }
  assert.equal(jobs.length, 3, 'page-1 partials survive a page-2 shape failure');
  assert.match(warnings.join(' '), /phenom/);
  assert.match(warnings.join(' '), /keeping partials|partial/i);
});

test('fetchPhenom: a first-page TRANSPORT failure still throws (unchanged contract)', async () => {
  await assert.rejects(
    () => fetchPhenom('https://careers.allianz.com/widgets', {
      fetchImpl: async () => { throw new Error('tenant down'); },
      company: { name: 'Allianz', phenom: { urlPrefix: 'global/en' } },
    }),
    /tenant down/,
  );
});

test('fetchPhenom: walks pages until the empty page', async () => {
  let call = 0;
  const jobs = await fetchPhenom('https://careers.allianz.com/widgets', {
    // totalHits 400 keeps the (page+1)*PAGE_SIZE >= totalHits stop from firing;
    // page 3 arrives empty (jobs: []) and ends the walk.
    fetchImpl: async () => jsonResponse([page(2, 400, 1), page(2, 400, 3), page(0, 400)][call++]),
    company: { name: 'Allianz', phenom: { urlPrefix: 'global/en' } },
  });
  assert.equal(jobs.length, 4);
});

// ── MAX_JOBS truncation is logged, never silent ─────────────────────────────

test('fetchPhenom: hitting MAX_JOBS logs the truncation', async () => {
  // 100/page (PAGE_SIZE) × 10 pages reaches MAX_JOBS=1000 while totalHits
  // claims far more — the cap, not the board, ended the walk. Each page gets
  // its own id range so no page is all-duplicates.
  let call = 0;
  const errors = [];
  const real = console.error;
  console.error = (m) => errors.push(String(m));
  let jobs;
  try {
    jobs = await fetchPhenom('https://careers.allianz.com/widgets', {
      fetchImpl: async () => jsonResponse(page(100, 9000, (call++) * 100 + 1)),
      company: { name: 'Allianz', phenom: { urlPrefix: 'global/en' } },
    });
  } finally {
    console.error = real;
  }
  assert.equal(jobs.length, 1000);
  assert.match(errors.join(' '), /truncated at 1000/);
  assert.match(errors.join(' '), /phenom/);
});

test('fetchPhenom: a board that fits under MAX_JOBS logs no truncation', async () => {
  let call = 0;
  const errors = [];
  const real = console.error;
  console.error = (m) => errors.push(String(m));
  try {
    await fetchPhenom('https://careers.allianz.com/widgets', {
      fetchImpl: async () => jsonResponse(page(2, 4, call++ * 2 + 1)),
      company: { name: 'Allianz', phenom: { urlPrefix: 'global/en' } },
    });
  } finally {
    console.error = real;
  }
  assert.deepEqual(errors.filter((e) => /truncated/.test(e)), []);
});
