/**
 * Oracle Recruiting Cloud (ORC) — pagination stop conditions.
 *
 * A SHORT page is not the end of the board. ORC serves fewer rows than the
 * requested limit mid-list because some rows are filtered server-side:
 * American Express reports TotalJobsCount 454 and serves pages of 200, 199,
 * 54 — the 199 is not the end, and stopping there dropped the last 54
 * postings, 12% of the board. This matches the wider convention that an API
 * "may return fewer results than the number requested … even if not at the
 * end of the collection" (Google AIP-158).
 *
 * CI-isolated: fake fetchImpl, no network, no parent-project dependency.
 * Parent career-ops `tests/providers/oraclecloud.test.mjs` parity.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchOraclecloud,
  PAGE_SIZE,
  MAX_PAGES,
} from '../server/lib/sources/oraclecloud.mjs';

const CAREERS = 'https://egug.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs';

// Validate derived URLs by their parsed hostname, never by substring-matching
// the whole URL string (CodeQL js/incomplete-url-substring-sanitization).
const hostOf = (u) => { try { return new URL(u).hostname; } catch { return null; } };
const offsetOf = (u) => parseInt(new URL(u).searchParams.get('offset') || '0', 10);

/** Requisition rows whose Id is stable per offset — so dedup can be observed. */
function rows(offset, len) {
  return Array.from({ length: len }, (_, i) => ({
    Id: `${offset + i}`,
    Title: `Role ${offset + i}`,
    PrimaryLocation: 'New York, NY, United States',
    PostedDate: '2026-07-15',
    WorkplaceTypeCode: 'ORA_ON_SITE',
  }));
}

/** A page that reports a TotalJobsCount. */
function pageWithTotal(reqs, total, hasMore = false) {
  return { items: [{ TotalJobsCount: total, requisitionList: reqs }], hasMore };
}

/** A page from a tenant that reports NO total at all. */
function pageWithoutTotal(reqs, hasMore = false) {
  return { items: [{ requisitionList: reqs }], hasMore };
}

function fakeFetch(bodyForUrl) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, json: async () => bodyForUrl(url, calls.length) };
  };
  impl.calls = calls;
  return impl;
}

// ---------------------------------------------------------------------------
// A short page mid-list is not the end
// ---------------------------------------------------------------------------

test('fetchOraclecloud: walks past a short middle page while TotalJobsCount says more (Amex: 200/199/54 → 453)', async () => {
  // American Express (egug pod, CX_1): TotalJobsCount 454, served as 200, 199,
  // 54 — one row is filtered server-side. Taking the 199 as the end returned
  // 399 of 454 and lost 12% of the board.
  const amexPages = [200, 199, 54];
  const fetchImpl = fakeFetch((url, call) => {
    const offset = offsetOf(url);
    return pageWithTotal(rows(offset, amexPages[call - 1] ?? 0), 454, false);
  });

  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl, company: { name: 'Amex' } });

  assert.equal(jobs.length, 453);
  assert.equal(fetchImpl.calls.length, 3);
  assert.equal(hostOf(fetchImpl.calls[0].url), 'egug.fa.oraclecloud.com');
  assert.deepEqual(fetchImpl.calls.map((c) => offsetOf(c.url)), [0, 200, 400]);
});

test('fetchOraclecloud: stops once offset+PAGE_SIZE reaches the reported total (no speculative page)', async () => {
  const fetchImpl = fakeFetch((url) => pageWithTotal(rows(offsetOf(url), PAGE_SIZE), 400, false));

  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl });

  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(jobs.length, 400);
});

// ---------------------------------------------------------------------------
// The signals that DO end the walk
// ---------------------------------------------------------------------------

test('fetchOraclecloud: an empty page ends the walk even when the reported total is stale', async () => {
  // A tenant whose count is stale (9999) must not drive the loop to the cap.
  const fetchImpl = fakeFetch((url, call) => pageWithTotal(
    rows(offsetOf(url), call === 1 ? PAGE_SIZE : 0),
    9999,
    true, // hasMore is deliberately ignored — it never drives the stop
  ));

  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl });

  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(jobs.length, PAGE_SIZE);
});

test('fetchOraclecloud: still stops on a short page when the tenant reports no total', async () => {
  // With no total to check against, page length is the only signal left —
  // paging on would loop until the cap.
  const fetchImpl = fakeFetch((url, call) => pageWithoutTotal(
    rows(offsetOf(url), call === 1 ? PAGE_SIZE : 12),
  ));

  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl });

  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(jobs.length, PAGE_SIZE + 12);
});

test('fetchOraclecloud: a no-total tenant keeps paging while pages stay full', async () => {
  const fetchImpl = fakeFetch((url, call) => pageWithoutTotal(
    rows(offsetOf(url), call < 3 ? PAGE_SIZE : 7),
  ));

  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl });

  assert.equal(fetchImpl.calls.length, 3);
  assert.equal(jobs.length, PAGE_SIZE * 2 + 7);
});

// ---------------------------------------------------------------------------
// The page cap is the only backstop once short pages stop ending the walk
// ---------------------------------------------------------------------------

test('fetchOraclecloud: the page cap bounds a tenant whose total is absurdly large', async () => {
  // Every page is short AND non-empty while the total claims 999999. Nothing
  // in the stop conditions can end this — only MAX_PAGES may.
  const capped = fakeFetch((url) => pageWithTotal(rows(offsetOf(url), 199), 999999, true));
  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl: capped });
  assert.equal(capped.calls.length, MAX_PAGES);
  assert.equal(jobs.length, 199 * MAX_PAGES);

  // A smaller entry-level max_pages bounds it tighter still.
  const entryCapped = fakeFetch((url) => pageWithTotal(rows(offsetOf(url), 199), 999999, true));
  await fetchOraclecloud(CAREERS, { fetchImpl: entryCapped, company: { max_pages: 3 } });
  assert.equal(entryCapped.calls.length, 3);
});

// ---------------------------------------------------------------------------
// De-duplication survives the longer walk
// ---------------------------------------------------------------------------

test('fetchOraclecloud: de-duplicates a posting repeated across pages by URL', async () => {
  // Page 2 is short but re-serves 50 rows page 1 already returned, so the walk
  // that now continues past it must not double-count them.
  const fetchImpl = fakeFetch((url, call) => {
    if (call === 1) return pageWithTotal(rows(0, PAGE_SIZE), 403, false); // ids 0…199
    if (call === 2) return pageWithTotal(rows(150, 199), 403, false); // ids 150…348, 50 repeats
    return pageWithTotal(rows(349, 54), 403, false); // ids 349…402
  });

  const jobs = await fetchOraclecloud(CAREERS, { fetchImpl });

  assert.equal(fetchImpl.calls.length, 3);
  assert.equal(jobs.length, 403); // ids 0…402, each once — 50 repeats collapsed
  assert.equal(new Set(jobs.map((j) => j.url)).size, jobs.length);
});
