/**
 * TKMS source — CI-isolated tests for the v1.242.0 Phase-2 items:
 *   - parseQuery requires the documented envelope ({ jobs: [...] }) — a
 *     malformed 200 throws instead of reading as an empty page;
 *   - fetchTkms: page-1 shape failure throws; a later-page failure keeps the
 *     collected postings and logs;
 *   - hitting the page cap while the server still reports nextPage logs the
 *     truncation (was: silent).
 *
 * Fake fetchImpl, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchTkms,
  parseQuery,
  TKMS_DEFAULT_ORIGIN,
} from '../server/lib/sources/tkms.mjs';

const CFG = { origin: TKMS_DEFAULT_ORIGIN, locale: 'en' };

/** One raw TKMS query row (the `data` payload lives inside each item). */
const rawRow = (id, title = `Engineer ${id}`) => ({
  data: {
    id,
    title,
    city: 'Kiel',
    country: 'Germany',
    postingDate: '2026-07-02T22:00:00',
    locations: [{ cityState: 'Kiel' }],
  },
});

function okJson(data, capture) {
  return async (url, opts = {}) => {
    if (capture) { capture.url = url; capture.opts = opts; capture.bodies = capture.bodies || []; capture.bodies.push(JSON.parse(opts.body)); }
    return { ok: true, json: async () => data };
  };
}

// ── parseQuery shape guard ──────────────────────────────────────────────────

test('parseQuery: throws a labelled error on a malformed payload', () => {
  // Null/primitives: the label names the source and the actual shape.
  for (const bad of [null, undefined]) {
    assert.throws(
      () => parseQuery(bad, CFG),
      (err) => {
        assert.match(err.message, /TKMS/);
        return true;
      },
      `expected a throw for ${JSON.stringify(bad)}`,
    );
  }
  // A body without a jobs array names the missing container path.
  for (const bad of [{}, { jobs: 'nope' }, { jobs: null }, { totalHits: 5 }]) {
    assert.throws(
      () => parseQuery(bad, CFG),
      (err) => {
        assert.match(err.message, /TKMS/);
        assert.match(err.message, /jobs/);
        return true;
      },
      `expected a throw for ${JSON.stringify(bad)}`,
    );
  }
});

test('parseQuery: a valid envelope with an empty jobs array parses (legit empty board)', () => {
  const parsed = parseQuery({ jobs: [], nextPage: null, totalHits: 0 }, CFG);
  assert.deepEqual(parsed.rows, []);
  assert.equal(parsed.nextPage, null);
});

// ── fetchTkms ───────────────────────────────────────────────────────────────

test('fetchTkms: POSTs the query API with page/subclient and normalizes rows', async () => {
  const capture = {};
  let call = 0;
  const fetchImpl = async (url, opts = {}) => {
    capture.url = url;
    capture.opts = opts;
    const body = JSON.parse(opts.body);
    call++;
    return {
      ok: true,
      json: async () => (call === 1
        ? { jobs: [rawRow('11', 'Systems <b>Engineer</b>')], page: 0, nextPage: null, totalHits: 1 }
        : { jobs: [], nextPage: null }),
    };
  };
  const jobs = await fetchTkms('https://jobs.tkmsgroup.com', { fetchImpl });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'tkms-11');
  assert.equal(jobs[0].title, 'Systems Engineer'); // HTML tags stripped
  assert.match(jobs[0].url, /\/en\/job\/Systems-Engineer\/11$/); // slug keeps title casing
  assert.equal(capture.opts.method, 'POST');
  assert.equal(capture.opts.redirect, 'error');
});

test('fetchTkms: a malformed page-1 payload throws (masked-board contract)', async () => {
  await assert.rejects(
    () => fetchTkms('https://jobs.tkmsgroup.com', { fetchImpl: okJson({ error: 'denied' }) }),
    (err) => {
      assert.match(err.message, /TKMS/);
      return true;
    },
  );
});

test('fetchTkms: a malformed later page keeps the collected postings and logs', async () => {
  let call = 0;
  const fetchImpl = async () => {
    call++;
    return call === 1
      ? { ok: true, json: async () => ({ jobs: [rawRow('1')], page: 0, nextPage: 1, totalHits: 9 }) }
      : { ok: true, json: async () => ({ broken: true }) };
  };
  const errs = [];
  const orig = console.error;
  console.error = (...a) => errs.push(a.join(' '));
  let jobs;
  try {
    jobs = await fetchTkms('https://jobs.tkmsgroup.com', { fetchImpl });
  } finally {
    console.error = orig;
  }
  assert.equal(jobs.length, 1);
  assert.match(errs.join(' '), /tkms/);
});

test('fetchTkms: hitting the page cap while nextPage is set logs the truncation', async () => {
  let call = 0;
  const fetchImpl = async () => {
    call++;
    return {
      ok: true,
      json: async () => ({ jobs: [rawRow(String(call))], page: call - 1, nextPage: call, totalHits: 999 }),
    };
  };
  const errs = [];
  const orig = console.error;
  console.error = (...a) => errs.push(a.join(' '));
  try {
    await fetchTkms('https://jobs.tkmsgroup.com', { fetchImpl, company: { max_pages: 2 } });
  } finally {
    console.error = orig;
  }
  assert.match(errs.join(' '), /truncat/i);
});

test('fetchTkms: a clean end (nextPage null or empty page) does not log a truncation', async () => {
  const errs = [];
  const orig = console.error;
  console.error = (...a) => errs.push(a.join(' '));
  try {
    await fetchTkms('https://jobs.tkmsgroup.com', {
      fetchImpl: okJson({ jobs: [rawRow('1')], page: 0, nextPage: null, totalHits: 1 }),
    });
  } finally {
    console.error = orig;
  }
  assert.equal(errs.join(' '), '');
});
