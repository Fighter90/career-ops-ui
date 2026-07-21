/**
 * Gem source (parent career-ops `providers/gem.mjs` parity). Per-tenant board
 * on the shared public jobs.gem.com GraphQL *batch* endpoint. CI-isolated —
 * every network call goes through a fake fetchImpl, nothing hits the wire.
 *
 * Covers the parent's meaningful cases: board-id resolution + host-spoof
 * rejection, the JobBoardList → (single batched) ExternalJobPostingQuery
 * two-call shape, extId-based URL construction, location folding (name +
 * Remote), firstPublishedTsSec (unix SECONDS) → date, HTML→text description
 * into snippet, graceful degradation when the detail batch fails or returns a
 * non-array, extId (not position) matching, and the SSRF host guard.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  fetchGem,
  parseGemPostings,
  buildJobDescriptionText,
  resolveBoardId,
  assertGemUrl,
  GEM_API_URL,
} from '../server/lib/sources/gem.mjs';
import { gemAdapter } from '../server/lib/portals/adapters/gem.mjs';

// A Response-like fake for http-json's fetchJson (needs { ok, status, json }).
const ok = (body) => ({ ok: true, status: 200, json: async () => body });

const LIST_RESPONSE = [{
  data: {
    oatsExternalJobPostings: {
      jobPostings: [
        {
          id: 'T2F0c0pvYlBvc3Q6MQ==',
          extId: '1001',
          title: 'AI Engineer',
          locations: [
            { name: 'San Francisco', isRemote: false },
            { isRemote: true },
          ],
          job: { department: { name: 'Engineering' }, locationType: 'HYBRID', employmentType: 'FULL_TIME' },
        },
        {
          // no extId → dropped by the extId+title guard
          id: 'T2F0c0pvYlBvc3Q6Mg==',
          extId: '',
          title: 'Should be dropped (no extId)',
        },
      ],
    },
  },
}];

const DETAIL_RESPONSE = [{
  data: {
    oatsExternalJobPosting: {
      extId: '1001',
      firstPublishedTsSec: 1700000000,
      descriptionHtml: '<p>Build &amp; ship <strong>AI</strong> tools.</p><ul><li>Own the roadmap</li></ul>',
    },
  },
}];

// A fetchImpl that answers JobBoardList vs ExternalJobPostingQuery by inspecting
// the posted body, and records each call for shape assertions.
function makeFetchImpl(calls, { detail = DETAIL_RESPONSE } = {}) {
  return async (url, opts) => {
    calls.push({ url, opts });
    const op = JSON.parse(opts.body)[0].operationName;
    return ok(op === 'JobBoardList' ? LIST_RESPONSE : detail);
  };
}

test('meta: gem / Gem / en', () => {
  assert.deepEqual(meta, { value: 'gem', label: 'Gem', region: 'en' });
});

test('resolveBoardId: parses jobs.gem.com/<boardId>, rejects spoofed hosts + non-strings', () => {
  assert.equal(resolveBoardId('https://jobs.gem.com/retool'), 'retool');
  assert.equal(resolveBoardId('https://jobs.gem.com/retool/1001'), 'retool');
  // path/query/suffix spoofs — a raw substring match would wrongly claim these
  assert.equal(resolveBoardId('https://evil.example/jobs.gem.com/retool'), null);
  assert.equal(resolveBoardId('https://evil.example/careers?x=jobs.gem.com/retool'), null);
  assert.equal(resolveBoardId('https://jobs.gem.com.evil.example/retool'), null);
  // non-gem / missing / non-string
  assert.equal(resolveBoardId('https://example.com/careers'), null);
  assert.equal(resolveBoardId(''), null);
  assert.equal(resolveBoardId(null), null);
  assert.equal(resolveBoardId(42), null);
});

test('assertGemUrl: pins host to jobs.gem.com + HTTPS', () => {
  assert.equal(assertGemUrl(`${GEM_API_URL}?board=retool`), `${GEM_API_URL}?board=retool`);
  assert.throws(() => assertGemUrl('https://evil.com/api/public/graphql/batch'), /untrusted hostname/);
  assert.throws(() => assertGemUrl('http://jobs.gem.com/api/public/graphql/batch'), /must use HTTPS/);
  assert.throws(() => assertGemUrl('not-a-url'), /invalid URL/);
});

test('adapter: matches jobs.gem.com host (+ provider flag), rejects spoofs; buildEndpoint → ?board=', () => {
  assert.ok(gemAdapter.matches({ careers_url: 'https://jobs.gem.com/retool' }));
  assert.ok(gemAdapter.matches({ provider: 'gem', careers_url: 'https://jobs.gem.com/retool' }));
  assert.equal(gemAdapter.matches({ careers_url: 'https://example.com/careers' }), false);
  assert.equal(gemAdapter.matches({ careers_url: 'https://jobs.gem.com.evil.example/retool' }), false);
  assert.equal(gemAdapter.matches({ provider: 'gem' }), false); // provider set but no resolvable board

  assert.equal(
    gemAdapter.buildEndpoint({ careers_url: 'https://jobs.gem.com/retool' }),
    'https://jobs.gem.com/api/public/graphql/batch?board=retool',
  );
  assert.equal(gemAdapter.buildEndpoint({ careers_url: 'https://example.com/careers' }), null);
});

test('buildJobDescriptionText: intro+body+outro then labeled compensation; absent fields dropped', () => {
  const posting = {
    jobPostSectionHtml: { introHtml: '<p>Intro.</p>', outroHtml: '<p>Outro.</p>' },
    descriptionHtml: '<p>Body &amp; more.</p>',
    compensationHtml: '<p>$100k</p>',
  };
  assert.equal(buildJobDescriptionText(posting), 'Intro.\n\nBody & more.\n\nOutro.\n\nCompensation: $100k');
  // description-only posting renders as plain text, no gaps
  assert.equal(buildJobDescriptionText({ descriptionHtml: '<p>Just body</p>' }), 'Just body');
  assert.equal(buildJobDescriptionText({}), '');
});

test('fetchGem: 2 POSTs to the batch endpoint, redirect:error, single JobBoardList then one detail op per extId', async () => {
  const calls = [];
  const jobs = await fetchGem(`${GEM_API_URL}?board=retool`, {
    fetchImpl: makeFetchImpl(calls),
    company: { name: 'Retool' },
  });

  assert.equal(calls.length, 2, 'exactly 2 calls');
  assert.ok(calls.every((c) => c.url === GEM_API_URL), 'both POST to the batch endpoint');
  assert.ok(calls.every((c) => c.opts.method === 'POST'), 'both POST');
  assert.ok(calls.every((c) => c.opts.redirect === 'error'), 'redirect:error SSRF guard on both');

  const listBody = JSON.parse(calls[0].opts.body);
  assert.equal(listBody.length, 1);
  assert.equal(listBody[0].operationName, 'JobBoardList');
  assert.equal(listBody[0].variables.boardId, 'retool');

  const detailBody = JSON.parse(calls[1].opts.body);
  assert.equal(detailBody.length, 1, 'one op for the one valid extId');
  assert.equal(detailBody[0].operationName, 'ExternalJobPostingQuery');
  assert.equal(detailBody[0].variables.boardId, 'retool');
  assert.equal(detailBody[0].variables.extId, '1001');
  assert.ok(calls[1].opts.body.includes('descriptionHtml'), 'detail query asks for descriptionHtml');

  // Normalization — no-extId posting dropped, valid one mapped.
  assert.equal(jobs.length, 1);
  const j = jobs[0];
  assert.equal(j.id, 'gem-1001');
  assert.equal(j.title, 'AI Engineer');
  assert.equal(j.company, 'Retool');
  assert.equal(j.url, 'https://jobs.gem.com/retool/1001');
  assert.equal(j.location, 'San Francisco · Remote'); // name + isRemote folded, deduped
  assert.equal(j.isRemote, true); // a remote location present
  assert.equal(j.workplaceType, 'Hybrid'); // from job.locationType
  assert.equal(j.relocates, false);
  assert.equal(j.salary, '');
  assert.equal(j.source, 'gem');
  // firstPublishedTsSec (unix seconds) → ISO date
  assert.equal(j.date, '2023-11-14');
  // descriptionHtml → tags stripped, entities decoded, into snippet
  assert.equal(j.snippet, 'Build & ship AI tools. Own the roadmap');
});

test('fetchGem: malformed list responses → [] with no detail call attempted', async () => {
  const emptyCases = [null, {}, [], [{}], [{ data: null }], [{ data: { oatsExternalJobPostings: null } }]];
  for (const body of emptyCases) {
    let requests = 0;
    const out = await fetchGem(`${GEM_API_URL}?board=retool`, {
      fetchImpl: async () => { requests += 1; return ok(body); },
      company: { name: 'Retool' },
    });
    assert.deepEqual(out, [], `body=${JSON.stringify(body)} → []`);
    assert.equal(requests, 1, 'no detail call when the list yields no valid postings');
  }
});

test('fetchGem: GraphQL errors on the list result throw', async () => {
  await assert.rejects(
    () => fetchGem(`${GEM_API_URL}?board=retool`, {
      fetchImpl: async () => ok([{ errors: [{ message: 'board not found' }] }]),
      company: { name: 'Retool' },
    }),
    /JobBoardList failed: board not found/,
  );
});

test('fetchGem: detail batch throwing degrades gracefully — postings kept, date/snippet empty', async () => {
  let detailAttempted = false;
  const jobs = await fetchGem(`${GEM_API_URL}?board=retool`, {
    fetchImpl: async (url, opts) => {
      if (JSON.parse(opts.body)[0].operationName === 'JobBoardList') return ok(LIST_RESPONSE);
      detailAttempted = true;
      throw new Error('HTTP 500');
    },
    company: { name: 'Retool' },
  });
  assert.ok(detailAttempted);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].date, '');
  assert.equal(jobs[0].snippet, '');
  assert.equal(jobs[0].url, 'https://jobs.gem.com/retool/1001');
});

test('fetchGem: non-array detail response tolerated — date stays empty, no crash', async () => {
  const jobs = await fetchGem(`${GEM_API_URL}?board=retool`, {
    fetchImpl: makeFetchImpl([], { detail: 'not an array' }),
    company: { name: 'Retool' },
  });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].date, '');
});

test('fetchGem: detail results matched back to postings by extId, not response position', async () => {
  const multiList = [{
    data: {
      oatsExternalJobPostings: {
        jobPostings: [
          { extId: 'a', title: 'Role A', locations: [] },
          { extId: 'b', title: 'Role B', locations: [] },
        ],
      },
    },
  }];
  // deliberately out of order vs. the request
  const multiDetail = [
    { data: { oatsExternalJobPosting: { extId: 'b', firstPublishedTsSec: 2000000000 } } },
    { data: { oatsExternalJobPosting: { extId: 'a', firstPublishedTsSec: 1000000000 } } },
  ];
  const jobs = await fetchGem(`${GEM_API_URL}?board=retool`, {
    fetchImpl: async (url, opts) =>
      ok(JSON.parse(opts.body)[0].operationName === 'JobBoardList' ? multiList : multiDetail),
    company: { name: 'Retool' },
  });
  const rowA = jobs.find((r) => r.url.endsWith('/a'));
  const rowB = jobs.find((r) => r.url.endsWith('/b'));
  assert.equal(rowA.date, '2001-09-09'); // 1000000000s
  assert.equal(rowB.date, '2033-05-18'); // 2000000000s
});

test('fetchGem: throws "cannot derive board id" before fetching when the endpoint has no board', async () => {
  let fetchCalled = false;
  await assert.rejects(
    () => fetchGem(GEM_API_URL, {
      fetchImpl: async () => { fetchCalled = true; return ok([]); },
      company: { name: 'NoBoard' },
    }),
    /cannot derive board id for NoBoard/,
  );
  assert.equal(fetchCalled, false, 'no request made for an endpoint with no board id');
});

test('fetchGem: off-host endpoint rejected by the SSRF guard before any fetch', async () => {
  let fetchCalled = false;
  await assert.rejects(
    () => fetchGem('https://evil.example/api/public/graphql/batch?board=retool', {
      fetchImpl: async () => { fetchCalled = true; return ok([]); },
    }),
    /untrusted hostname/,
  );
  assert.equal(fetchCalled, false);
});

test('parseGemPostings: pure normalization — remote inference from title, onsite default, empty maps', () => {
  const postings = [
    { extId: 'x', title: 'Remote Backend Engineer', locations: [{ name: 'Anywhere' }] },
    { extId: 'y', title: 'Onsite Designer', locations: [{ name: 'Berlin' }], job: { locationType: 'ONSITE' } },
    { extId: '', title: 'Dropped' },
  ];
  const jobs = parseGemPostings(postings, { boardId: 'acme', companyName: 'Acme' });
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].isRemote, true); // "Remote" in title
  assert.equal(jobs[0].workplaceType, 'Remote');
  assert.equal(jobs[0].date, ''); // no detail map → no date
  assert.equal(jobs[1].isRemote, false);
  assert.equal(jobs[1].workplaceType, 'Onsite');
  assert.equal(jobs[1].company, 'Acme');
  // non-array → []
  assert.deepEqual(parseGemPostings(null, { boardId: 'acme' }), []);
});
