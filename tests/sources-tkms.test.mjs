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
    JSON.parse(opts.body); // assert the request carries a JSON body
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

// ── branch hardening (CAR-269: the per-file branch baseline on tkms.mjs
// measured below the ratchet floor on CI's Node 20 — these lock the parse/
// config branches so every Node version clears the ratchet with margin) ──

import { resolveConfig, slugify, parseTkmsDate, tkmsLocation } from '../server/lib/sources/tkms.mjs';

test('resolveConfig: rejects non-URL, non-https and foreign hosts; reads the tkms block; defaults the subclient/locale', () => {
  assert.equal(resolveConfig(null), null);
  assert.equal(resolveConfig(undefined), null);
  assert.equal(resolveConfig({}), null);
  assert.equal(resolveConfig({ api: 'not a url' }), null);
  assert.equal(resolveConfig({ api: 'http://jobs.tkmsgroup.com' }), null, 'https only — plain HTTP is refused up front');
  assert.equal(resolveConfig({ api: 'https://jobs.example.com' }), null, 'host-pinned to jobs.tkmsgroup.com');
  const cfg = resolveConfig({ api: 'HTTPS://JOBS.TKMSGROUP.COM', tkms: { subclient: 'other', locale: 'de' } });
  assert.equal(cfg.origin, 'https://jobs.tkmsgroup.com', 'origin normalizes out of the case');
  assert.equal(cfg.subclient, 'other');
  assert.equal(cfg.locale, 'de');
  const def = resolveConfig({ careers_url: 'https://jobs.tkmsgroup.com/x' });
  assert.equal(def.queryApi, 'https://jobs.tkmsgroup.com/api/filter/query');
  assert.equal(def.subclient, 'tkms', 'a missing tkms block falls back to the platform defaults');
  assert.equal(def.locale, 'en');
});

test('slugify: non-alphanumeric runs collapse to hyphens; an empty slug falls back to "job"', () => {
  assert.equal(slugify('R&D — Systems Engineer (m/w/d)!'), 'R-D-Systems-Engineer-m-w-d');
  assert.equal(slugify('   '), 'job');
  assert.equal(slugify(''), 'job');
});

test('parseTkmsDate: prefers the epoch-seconds stamp, parses the naive ISO as UTC, refuses junk', () => {
  assert.equal(parseTkmsDate({ postingDate_timestamp: 1751493600 }), 1751493600000);
  assert.equal(parseTkmsDate({ postingDate: '2026-07-02T22:00:00' }), Date.parse('2026-07-02T22:00:00Z'),
    'the naive stamp is pinned to UTC for determinism');
  assert.equal(parseTkmsDate({ postingDate_timestamp: 'nope', postingDate: '2026-07-02T22:00:00' }),
    Date.parse('2026-07-02T22:00:00Z'), 'a non-numeric stamp falls through to the ISO field');
  assert.equal(parseTkmsDate({ postingDate: '   ' }), undefined, 'a whitespace stamp is absent');
  assert.equal(parseTkmsDate({ postingDate: 'nope' }), undefined, 'an unparseable stamp is absent');
  assert.equal(parseTkmsDate(null), undefined);
  assert.equal(parseTkmsDate({}), undefined);
});

test('tkmsLocation: cityState preferred over city, deduped; falls back to the flat city/country pair', () => {
  assert.equal(tkmsLocation({ locations: [{ cityState: 'Kiel' }, { city: 'Kiel' }, { cityState: 'Lübeck' }] }),
    'Kiel / Lübeck', 'the flat city repeating a cityState does not duplicate');
  assert.equal(tkmsLocation({ locations: [{}, null], city: 'Kiel', country: 'Germany' }), 'Kiel, Germany',
    'empty location entries contribute nothing; the flat fields serve the day');
  assert.equal(tkmsLocation({ locations: 'nope', city: 'Kiel', country: 'Germany' }), 'Kiel, Germany',
    'a non-array locations field falls back to the flat pair');
  assert.equal(tkmsLocation({ city: 'Kiel', country: 'Kiel' }), 'Kiel', 'the flat pair is deduped');
  assert.equal(tkmsLocation({}), '');
  assert.equal(tkmsLocation(null), '');
});

test('parseQuery: malformed rows are skipped; a non-numeric envelope reads as absent; the company name is trimmed or defaulted', () => {
  const parsed = parseQuery({
    jobs: [
      null,
      { data: null },
      { data: { id: null, title: 'X' } },
      { data: { id: 'ok' } },
      { data: { id: 'ok2', title: '   ' } },
      rawRow('7'),
    ],
    totalHits: 'many',
    nextPage: 'more',
  }, CFG);
  assert.equal(parsed.total, null, 'a non-numeric totalHits reads as absent');
  assert.equal(parsed.nextPage, null, 'a non-numeric nextPage reads as absent');
  assert.deepEqual(parsed.rows.map((r) => r.id), ['tkms-7'],
    'rows without data, id, or a usable title are dropped');
  const named = parseQuery({ jobs: [rawRow('8')] }, { ...CFG, company: '  ACME Marine  ' });
  assert.equal(named.rows[0].company, 'ACME Marine', 'a custom company name is trimmed in');
});

test('parseQuery: a lone surrogate in the id drops the row instead of throwing (URIError guard)', () => {
  const parsed = parseQuery({ jobs: [{ data: { id: 'a\u{D800}b', title: 'T' } }] }, CFG);
  assert.deepEqual(parsed.rows, []);
});

test('fetchTkms: an endpoint that is not the tkms host throws the labelled resolver error', async () => {
  await assert.rejects(
    () => fetchTkms('https://jobs.example.com', { fetchImpl: okJson({ jobs: [] }) }),
    /cannot resolve jobs host/,
  );
});

test('fetchTkms: hitting the posting cap (MAX_JOBS) while nextPage is set logs the posting-cap truncation', async () => {
  let page = 0;
  const fetchImpl = async () => {
    page++;
    const rows = Array.from({ length: 700 }, (_, i) => rawRow(`p${page}-${i}`));
    return { ok: true, json: async () => ({ jobs: rows, page: page - 1, nextPage: page, totalHits: 9999 }) };
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
  assert.equal(jobs.length, 1000, 'the total postings cap holds');
  assert.match(errs.join(' '), /posting cap/, 'the truncation names the posting cap, not the page cap');
});
