/**
 * Hacker News source (two-step Algolia fetch) — CI-isolated; fake fetchImpl only.
 * Tests: findHiringThreadId, extractPost, fetchHackerNews, assertHnUrl, adapter.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findHiringThreadId,
  extractPost,
  fetchHackerNews,
  assertHnUrl,
  SEARCH_URL,
  ITEMS_BASE,
  HN_ALGOLIA_HOST,
} from '../server/lib/sources/hackernews.mjs';
import { hackernewsAdapter } from '../server/lib/portals/adapters/hackernews.mjs';

// --- fixtures ---

const SEARCH_JSON = {
  hits: [
    {
      objectID: '42000001',
      title: 'Ask HN: Who is hiring? (June 2026)',
      created_at: '2026-06-01T12:00:00.000Z',
    },
    {
      objectID: '41000001',
      title: 'Ask HN: Who wants to be hired? (June 2026)',
      created_at: '2026-06-01T11:00:00.000Z',
    },
  ],
};

const ITEMS_JSON = {
  id: 42000001,
  children: [
    // Child with pipe-delimited header + https link → should produce a job.
    {
      text:
        'Acme Corp | Senior Go Engineer | Remote | https://acmecorp.io/jobs/go-senior<p>We are looking for a senior Go engineer…</p>',
    },
    // Child with plain first-line title + link elsewhere in the body.
    {
      text:
        'Backend Developer at Globex Corp<p>Apply here: https://globex.example.com/apply</p>',
    },
    // Child with no link → must be dropped.
    {
      text: 'Just a plain comment with no URL, should be dropped.',
    },
    // Deleted child → must be dropped.
    {
      deleted: true,
      text: 'https://evil.com/deleted',
    },
    // Dead child → must be dropped.
    {
      dead: true,
      text: 'https://evil.com/dead',
    },
    // Child with remote in title → isRemote should be true.
    {
      text: 'WidgetCo | Remote Software Engineer | https://widgetco.io/careers/swe',
    },
  ],
};

// Fake two-step fetchImpl:
// Call 1 → SEARCH_JSON, call 2 → ITEMS_JSON.
function makeFetchImpl(searchJson = SEARCH_JSON, itemsJson = ITEMS_JSON) {
  let callCount = 0;
  return async (_url, _opts) => {
    callCount++;
    const body = callCount === 1 ? searchJson : itemsJson;
    return {
      ok: true,
      json: async () => body,
    };
  };
}

// --- findHiringThreadId ---

test('findHiringThreadId: picks first hit matching /who is hiring/i', () => {
  const id = findHiringThreadId(SEARCH_JSON);
  assert.equal(id, '42000001');
});

test('findHiringThreadId: returns null for empty hits', () => {
  assert.equal(findHiringThreadId({ hits: [] }), null);
});

test('findHiringThreadId: returns null for no matching title', () => {
  assert.equal(
    findHiringThreadId({ hits: [{ objectID: '1', title: 'Who wants to be hired?' }] }),
    null,
  );
});

test('findHiringThreadId: returns null for invalid input', () => {
  assert.equal(findHiringThreadId(null), null);
  assert.equal(findHiringThreadId('string'), null);
  assert.equal(findHiringThreadId({}), null);
});

// --- extractPost ---

test('extractPost: parses title (first line, URL-stripped) and url (first link)', () => {
  const child = {
    text: 'Acme Corp | Senior Go Engineer | Remote | https://acmecorp.io/jobs/go<p>Details…</p>',
  };
  const result = extractPost(child);
  assert.ok(result !== null);
  assert.ok(result.title.length > 0);
  // Title should not contain the URL
  assert.ok(!result.title.includes('https://'));
  assert.equal(result.url, 'https://acmecorp.io/jobs/go');
});

test('extractPost: returns null for child with no URL', () => {
  const child = { text: 'Plain comment with no link at all.' };
  assert.equal(extractPost(child), null);
});

test('extractPost: returns null for deleted child', () => {
  assert.equal(extractPost({ deleted: true, text: 'https://example.com' }), null);
});

test('extractPost: returns null for dead child', () => {
  assert.equal(extractPost({ dead: true, text: 'https://example.com' }), null);
});

test('extractPost: returns null for empty text', () => {
  assert.equal(extractPost({ text: '' }), null);
  assert.equal(extractPost({ text: '   ' }), null);
  assert.equal(extractPost({}), null);
});

test('extractPost: decodes HTML entities in title', () => {
  const child = { text: 'Acme &amp; Corp | Role | https://example.com' };
  const result = extractPost(child);
  assert.ok(result !== null);
  assert.ok(result.title.includes('Acme & Corp'));
});

test('extractPost: extracts url from anchor href', () => {
  const child = {
    text: 'Title line<p>Apply: <a href="https://example.com/apply">here</a></p>',
  };
  const result = extractPost(child);
  assert.ok(result !== null);
  assert.equal(result.url, 'https://example.com/apply');
});

// --- fetchHackerNews ---

test('fetchHackerNews: two-step fetch returns normalized 12-field jobs', async () => {
  const jobs = await fetchHackerNews('https://hn.algolia.com', { fetchImpl: makeFetchImpl() });
  // 3 valid jobs: Acme, Globex, WidgetCo (no-link child + deleted + dead dropped)
  assert.equal(jobs.length, 3);
  for (const job of jobs) {
    // All 12 fields present
    assert.ok('id' in job, 'missing id');
    assert.ok('title' in job, 'missing title');
    assert.ok('company' in job, 'missing company');
    assert.ok('url' in job, 'missing url');
    assert.ok('salary' in job, 'missing salary');
    assert.ok('location' in job, 'missing location');
    assert.ok('isRemote' in job, 'missing isRemote');
    assert.ok('workplaceType' in job, 'missing workplaceType');
    assert.ok('relocates' in job, 'missing relocates');
    assert.ok('date' in job, 'missing date');
    assert.ok('snippet' in job, 'missing snippet');
    assert.ok('source' in job, 'missing source');
    assert.equal(job.source, 'hackernews');
    assert.ok(job.id.startsWith('hackernews-'), `id should start with hackernews-: ${job.id}`);
  }
});

test('fetchHackerNews: remote detection sets isRemote and workplaceType', async () => {
  const jobs = await fetchHackerNews('https://hn.algolia.com', { fetchImpl: makeFetchImpl() });
  // WidgetCo has "Remote" in title
  const widgetco = jobs.find((j) => j.url.includes('widgetco'));
  assert.ok(widgetco, 'WidgetCo job should be present');
  assert.equal(widgetco.isRemote, true);
  assert.equal(widgetco.workplaceType, 'Remote');
});

test('fetchHackerNews: returns [] when no hiring thread found', async () => {
  const emptySearch = { hits: [] };
  const fetchImpl = async () => ({ ok: true, json: async () => emptySearch });
  const jobs = await fetchHackerNews('https://hn.algolia.com', { fetchImpl });
  assert.deepEqual(jobs, []);
});

test('fetchHackerNews: throws on non-ok search response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 429 });
  await assert.rejects(
    () => fetchHackerNews('https://hn.algolia.com', { fetchImpl }),
    /429/,
  );
});

test('fetchHackerNews: handles children:null gracefully (returns [])', async () => {
  const fetchImpl = makeFetchImpl(SEARCH_JSON, { id: 42000001, children: null });
  const jobs = await fetchHackerNews('https://hn.algolia.com', { fetchImpl });
  assert.deepEqual(jobs, []);
});

// --- SEARCH_URL lookup strategy (parent #3aa5e15) ---

test('SEARCH_URL filters by the whoishiring account tag, not a free-text query', () => {
  // A free-text "Ask HN Who is hiring" query could rank an unrelated recent
  // story above the real monthly thread; the account tag returns only its own
  // threads so date-ordering surfaces the latest real one first.
  assert.match(SEARCH_URL, /tags=story,author_whoishiring/);
  assert.doesNotMatch(SEARCH_URL, /query=/);
});

// --- assertHnUrl ---

test('assertHnUrl: accepts valid hn.algolia.com HTTPS URLs', () => {
  assert.equal(assertHnUrl(SEARCH_URL), SEARCH_URL);
  assert.equal(assertHnUrl(`${ITEMS_BASE}42000001`), `${ITEMS_BASE}42000001`);
});

test('assertHnUrl: throws on untrusted host', () => {
  assert.throws(() => assertHnUrl('https://evil.com/api'), /untrusted hostname/);
});

test('assertHnUrl: throws on HTTP (non-HTTPS)', () => {
  assert.throws(
    () => assertHnUrl(`http://${HN_ALGOLIA_HOST}/api/v1/items/1`),
    /must use HTTPS/,
  );
});

test('assertHnUrl: throws on invalid URL string', () => {
  assert.throws(() => assertHnUrl('not-a-url'), /invalid URL/);
});

// --- adapter ---

test('adapter: matches only on provider=hackernews', () => {
  assert.ok(hackernewsAdapter.matches({ provider: 'hackernews' }));
  assert.equal(hackernewsAdapter.matches({ provider: 'remotive' }), false);
  assert.equal(hackernewsAdapter.matches({ careers_url: 'https://news.ycombinator.com' }), false);
  assert.equal(hackernewsAdapter.matches({}), false);
});

test('adapter: buildEndpoint returns a fixed hn.algolia.com string, ignoring overrides', () => {
  const ep = hackernewsAdapter.buildEndpoint({ provider: 'hackernews' });
  assert.equal(ep, 'https://hn.algolia.com');
  // A user-supplied override must NOT leak into the endpoint slot.
  assert.equal(hackernewsAdapter.buildEndpoint({ hackernews: 'https://evil.com' }), 'https://hn.algolia.com');
  assert.equal(hackernewsAdapter.buildEndpoint({ api: 'https://evil.com' }), 'https://hn.algolia.com');
});

test('adapter: id and label are correct', () => {
  assert.equal(hackernewsAdapter.id, 'hackernews');
  assert.equal(hackernewsAdapter.label, 'Hacker News (Who is hiring)');
});
