/**
 * A Workday posting open in several places must not be dropped by a location
 * filter (parent parity, career-ops @ 6a9c84c).
 *
 * Workday's LIST endpoint answers a multi-location posting with a COUNT where
 * every other posting carries a place: `"53 Locations"`. That is not a
 * location, and `buildLocationFilter` matches by case-insensitive substring —
 * so a role open in Austin AND 52 other cities matches no `allow: [austin]`
 * entry and is silently discarded, while the same role listed singly passes.
 * Measured upstream across three tenants: 53 of 291 postings were placeholders,
 * so this is the ordinary case, not an edge one.
 *
 * The fix pays one extra GET per placeholder posting against the CXS *detail*
 * document, which is the only place the real places exist, and is capped so a
 * large tenant cannot silently turn a scan into a thousand requests.
 *
 * CI-isolated: fake fetchImpl, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchWorkday, isMultiLocationPlaceholder, locationsFromDetail, dateFromDetail,
  MAX_DETAIL_REQUESTS,
} from '../server/lib/sources/workday.mjs';
import { buildLocationFilter } from '../server/lib/location-filter.mjs';

const API = 'https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/careers/jobs';

/** A list-endpoint row. */
const row = (title, locationsText, path) => ({
  title, locationsText, externalPath: path, bulletFields: ['x', title], postedOn: 'Posted 3 Days Ago',
});

/** fetchImpl that answers the POST list once and any GET with a detail doc. */
function transport({ jobs, details = {}, onDetail = () => {} }) {
  const detailUrls = [];
  const impl = async (url, init = {}) => {
    if ((init.method || 'GET').toUpperCase() === 'POST') {
      return { ok: true, status: 200, json: async () => ({ jobPostings: jobs }) };
    }
    detailUrls.push(url);
    onDetail(url);
    const path = new URL(url).pathname.replace(/^\/wday\/cxs\/[^/]+\/[^/]+/, '');
    const doc = details[path];
    if (!doc) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => doc };
  };
  return { impl, detailUrls };
}

// ── The placeholder predicate ────────────────────────────────────────────────

test('the count-placeholder is recognised, and a real place is never mistaken for one', () => {
  for (const yes of ['53 Locations', '2 locations', ' 7  Locations ', '1 Location']) {
    assert.equal(isMultiLocationPlaceholder(yes), true, `${JSON.stringify(yes)} is a placeholder`);
  }
  // Anchored and singular-tolerant: a real place containing a digit and the
  // word must not be swallowed.
  for (const no of ['100 Locations Plaza', 'Austin, TX', 'Locations', '53', '', 'Remote - 3 Locations Available']) {
    assert.equal(isMultiLocationPlaceholder(no), false, `${JSON.stringify(no)} is a real value`);
  }
  assert.equal(isMultiLocationPlaceholder(undefined), false);
  assert.equal(isMultiLocationPlaceholder(53), false, 'a non-string is never a placeholder');
});

// ── Reading the detail document ──────────────────────────────────────────────

test('locationsFromDetail joins primary + additional places, deduped', () => {
  assert.equal(
    locationsFromDetail({ jobPostingInfo: { location: 'Austin, TX', additionalLocations: ['Sunnyvale, CA', 'Remote'] } }),
    'Austin, TX · Sunnyvale, CA · Remote',
  );
  // A tenant that repeats the primary inside additionalLocations must not ship it twice.
  assert.equal(
    locationsFromDetail({ jobPostingInfo: { location: 'Austin, TX', additionalLocations: ['Austin, TX'] } }),
    'Austin, TX',
  );
  assert.equal(locationsFromDetail({ jobPostingInfo: { location: 'Austin, TX' } }), 'Austin, TX');
  for (const empty of [null, undefined, {}, { jobPostingInfo: {} }, { jobPostingInfo: { additionalLocations: [] } }]) {
    assert.equal(locationsFromDetail(empty), '', `${JSON.stringify(empty)} yields no places`);
  }
});

test('dateFromDetail accepts an ISO date and refuses to guess at anything else', () => {
  assert.equal(dateFromDetail({ jobPostingInfo: { startDate: '2026-09-01' } }), '2026-09-01');
  // Not ISO → left alone rather than run through Date.parse, whose fallback is
  // implementation-defined and could differ between Node builds.
  for (const bad of ['Sept 1, 2026', '09/01/2026', '', 'yesterday', undefined, 20260901]) {
    assert.equal(dateFromDetail({ jobPostingInfo: { startDate: bad } }), '', `${JSON.stringify(bad)} is not trusted`);
  }
  assert.equal(dateFromDetail(null), '');
});

// ── The behaviour that matters ───────────────────────────────────────────────

test('a multi-location posting survives a location filter that its placeholder failed', async () => {
  const { impl } = transport({
    jobs: [row('Staff Engineer', '53 Locations', '/job/Multi/Staff-Engineer_R1')],
    details: { '/job/Multi/Staff-Engineer_R1': { jobPostingInfo: { location: 'Austin, TX', additionalLocations: ['Sunnyvale, CA'] } } },
  });
  const [job] = await fetchWorkday(API, { fetchImpl: impl });
  assert.equal(job.location, 'Austin, TX · Sunnyvale, CA');

  const allowAustin = buildLocationFilter({ allow: ['austin'] });
  assert.equal(allowAustin('53 Locations'), false, 'precondition: the placeholder is what got dropped');
  assert.equal(allowAustin(job.location), true, 'the enriched posting now passes');
});

test('an ordinary single-location posting costs no extra request', async () => {
  const { impl, detailUrls } = transport({ jobs: [row('Analyst', 'Austin, TX', '/job/Austin/Analyst_R2')] });
  const [job] = await fetchWorkday(API, { fetchImpl: impl });
  assert.equal(job.location, 'Austin, TX');
  assert.deepEqual(detailUrls, [], 'the detail endpoint must not be touched for a real place');
});

test('the detail GET targets the CXS host and carries the posting path', async () => {
  const { impl, detailUrls } = transport({
    jobs: [row('Staff Engineer', '3 Locations', '/job/Multi/Staff-Engineer_R1')],
    details: { '/job/Multi/Staff-Engineer_R1': { jobPostingInfo: { location: 'Austin, TX' } } },
  });
  await fetchWorkday(API, { fetchImpl: impl });
  assert.deepEqual(detailUrls, ['https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/careers/job/Multi/Staff-Engineer_R1']);
});

test('a failed or empty detail leaves the posting exactly as the list returned it', async () => {
  const { impl } = transport({
    jobs: [
      row('A', '4 Locations', '/job/Multi/A_R1'),           // 404 → untouched
      row('B', '5 Locations', '/job/Multi/B_R2'),           // 200 but no places → untouched
    ],
    details: { '/job/Multi/B_R2': { jobPostingInfo: {} } },
  });
  const jobs = await fetchWorkday(API, { fetchImpl: impl });
  assert.equal(jobs[0].location, '4 Locations', 'a failed detail must not blank the location');
  assert.equal(jobs[1].location, '5 Locations');
});

test('the enriched posting is dated exactly when the detail says so', async () => {
  const { impl } = transport({
    jobs: [row('Staff Engineer', '3 Locations', '/job/Multi/S_R1')],
    details: { '/job/Multi/S_R1': { jobPostingInfo: { location: 'Austin, TX', startDate: '2026-09-01' } } },
  });
  const [job] = await fetchWorkday(API, { fetchImpl: impl });
  assert.equal(job.date, '2026-09-01', 'an absolute date replaces the list endpoint\'s relative prose');
});

test('detail requests are capped, and the postings past the cap keep their placeholder', async () => {
  const jobs = [], details = {};
  for (let i = 0; i < MAX_DETAIL_REQUESTS + 5; i++) {
    const p = `/job/Multi/J${i}`;
    jobs.push(row(`Job ${i}`, '9 Locations', p));
    details[p] = { jobPostingInfo: { location: `City ${i}` } };
  }
  const { impl, detailUrls } = transport({ jobs, details });
  const out = await fetchWorkday(API, { fetchImpl: impl });
  assert.equal(detailUrls.length, MAX_DETAIL_REQUESTS, 'the cap bounds what one entry may spend');
  assert.equal(out[0].location, 'City 0');
  assert.equal(out.at(-1).location, '9 Locations', 'past the cap the placeholder is left visible, not faked');
});

test('enrichment is skipped entirely when the caller opts out', async () => {
  const { impl, detailUrls } = transport({
    jobs: [row('Staff Engineer', '3 Locations', '/job/Multi/S_R1')],
    details: { '/job/Multi/S_R1': { jobPostingInfo: { location: 'Austin, TX' } } },
  });
  const [job] = await fetchWorkday(API, { fetchImpl: impl, resolveMultiLocation: false });
  assert.equal(job.location, '3 Locations');
  assert.deepEqual(detailUrls, []);
});
