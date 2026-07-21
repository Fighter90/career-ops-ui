/**
 * v1.16.0 — SmartRecruiters pagination.
 *
 * v1.14.0 hit only the first 100 postings. v1.16 follows
 * totalFound / offset across pages with a 30-page (3000-job) safety cap.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchSmartRecruiters, buildPublicUrl } from '../server/lib/sources/smartrecruiters.mjs';

function makeFetchStub(pages) {
  return async (url) => {
    const m = url.match(/offset=(\d+)/);
    const offset = m ? Number(m[1]) : 0;
    const page = pages.find((p) => p.offset === offset) || { content: [], totalFound: pages[0]?.totalFound || 0 };
    return {
      ok: true,
      status: 200,
      json: async () => page,
    };
  };
}

test('single page when totalFound ≤ 100', async () => {
  const pages = [{
    offset: 0,
    totalFound: 42,
    content: Array.from({ length: 42 }, (_, i) => ({
      id: `id-${i}`, name: `Engineer ${i}`, company: { name: 'Foo' }, ref: `https://r/${i}`,
    })),
  }];
  const jobs = await fetchSmartRecruiters('https://api.smartrecruiters.com/v1/companies/Foo/postings', {
    fetchImpl: makeFetchStub(pages),
  });
  assert.equal(jobs.length, 42);
  assert.equal(jobs[0].source, 'smartrecruiters');
});

test('walks 3 pages when totalFound = 250', async () => {
  const pages = [
    { offset: 0,   totalFound: 250, content: Array.from({ length: 100 }, (_, i) => ({ id: `0-${i}`, name: 'X', company: { name: 'Bar' }, ref: 'https://r' })) },
    { offset: 100, totalFound: 250, content: Array.from({ length: 100 }, (_, i) => ({ id: `1-${i}`, name: 'X', company: { name: 'Bar' }, ref: 'https://r' })) },
    { offset: 200, totalFound: 250, content: Array.from({ length:  50 }, (_, i) => ({ id: `2-${i}`, name: 'X', company: { name: 'Bar' }, ref: 'https://r' })) },
  ];
  const jobs = await fetchSmartRecruiters('https://api.smartrecruiters.com/v1/companies/Bar/postings', {
    fetchImpl: makeFetchStub(pages),
  });
  assert.equal(jobs.length, 250);
});

test('stops on empty page even if totalFound is wrong', async () => {
  // Some SmartRecruiters tenants report stale totalFound; we must
  // still stop when a page comes back empty.
  const pages = [
    { offset: 0,   totalFound: 500, content: Array.from({ length: 100 }, (_, i) => ({ id: `0-${i}`, name: 'X', company: { name: 'Baz' }, ref: 'https://r' })) },
    { offset: 100, totalFound: 500, content: Array.from({ length: 30  }, (_, i) => ({ id: `1-${i}`, name: 'X', company: { name: 'Baz' }, ref: 'https://r' })) },
    { offset: 200, totalFound: 500, content: [] },
  ];
  const jobs = await fetchSmartRecruiters('https://api.smartrecruiters.com/v1/companies/Baz/postings', {
    fetchImpl: makeFetchStub(pages),
  });
  assert.equal(jobs.length, 130);
});

test('respects 30-page hard safety cap (3000 jobs)', async () => {
  // Fixture: 31 pages of 100 jobs each. Cap should kick in at 30 × 100 = 3000.
  // But the test expects stops cleanly at the cap.
  let pageCount = 0;
  const stubFetch = async (url) => {
    pageCount += 1;
    if (pageCount > 35) throw new Error('too many fetches — cap not honored');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        offset: (pageCount - 1) * 100,
        totalFound: 5000,
        content: Array.from({ length: 100 }, (_, i) => ({ id: `${pageCount}-${i}`, name: 'X', company: { name: 'Big' }, ref: 'https://r' })),
      }),
    };
  };
  const jobs = await fetchSmartRecruiters('https://api.smartrecruiters.com/v1/companies/Big/postings', {
    fetchImpl: stubFetch,
  });
  assert.ok(jobs.length <= 3000, `expected ≤ 3000, got ${jobs.length}`);
  assert.ok(pageCount <= 31, `cap not honored: ${pageCount} pages fetched`);
});

test('strips caller-supplied limit/offset query so we own the cursor', async () => {
  const seen = [];
  const stubFetch = async (url) => {
    seen.push(url);
    return { ok: true, status: 200, json: async () => ({ content: [], totalFound: 0 }) };
  };
  await fetchSmartRecruiters(
    'https://api.smartrecruiters.com/v1/companies/Foo/postings?limit=50&offset=999&extra=x',
    { fetchImpl: stubFetch }
  );
  // First request must use our limit/offset, not the caller's.
  assert.match(seen[0], /[?&]limit=100/);
  assert.match(seen[0], /[?&]offset=0/);
  // Original 'extra' query param is preserved.
  assert.match(seen[0], /extra=x/);
});

test('throws when upstream returns non-200', async () => {
  const stubFetch = async () => ({
    ok: false,
    status: 503,
    json: async () => ({}),
  });
  await assert.rejects(
    fetchSmartRecruiters('https://api.smartrecruiters.com/v1/companies/Foo/postings', {
      fetchImpl: stubFetch,
    }),
    /HTTP 503/
  );
});

// ─────────────── Public URL construction (#2047) ───────────────
// The public jobs.smartrecruiters.com site has no `/postings/` segment; carrying
// it over from the api.smartrecruiters.com ref yields a 404 that the liveness
// checker flags as an expired posting. buildPublicUrl drops it.

test('rewrites the api ref to a public URL without /postings/ (#2047)', async () => {
  const pages = [{
    offset: 0,
    totalFound: 1,
    content: [{
      id: 'abc123',
      name: 'Senior ML Engineer',
      company: { name: 'FooCorp' },
      ref: 'https://api.smartrecruiters.com/v1/companies/FooCorp/postings/abc123',
    }],
  }];
  const jobs = await fetchSmartRecruiters('https://api.smartrecruiters.com/v1/companies/FooCorp/postings', {
    fetchImpl: makeFetchStub(pages),
  });
  assert.equal(jobs[0].url, 'https://jobs.smartrecruiters.com/FooCorp/abc123-senior-ml-engineer');
  assert.ok(!/\/postings\//.test(jobs[0].url), 'public URL must not carry the /postings/ segment');
});

test('buildPublicUrl: ref rewrite, id synthesis, and applyUrl fallback', () => {
  // 1. Valid api ref → public URL, /postings/ dropped, title slug appended.
  assert.equal(
    buildPublicUrl({
      id: 'p1', name: 'Data Scientist', company: { name: 'Bar' },
      ref: 'https://api.smartrecruiters.com/v1/companies/BarCorp/postings/p1',
    }),
    'https://jobs.smartrecruiters.com/BarCorp/p1-data-scientist',
  );
  // 2. Untrusted / non-api ref → synthesise from company slug + posting id.
  assert.equal(
    buildPublicUrl({ id: 'xyz', name: 'Backend Dev', company: { name: 'Baz Inc' }, ref: 'https://evil.example/x' }),
    'https://jobs.smartrecruiters.com/baz-inc/xyz-backend-dev',
  );
  // 3. No usable ref and no id/company → last-resort applyUrl.
  assert.equal(
    buildPublicUrl({ name: 'Ghost', applyUrl: 'https://apply.example/ghost' }),
    'https://apply.example/ghost',
  );
});
