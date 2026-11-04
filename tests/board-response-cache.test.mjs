// CAR-226 / parent career-ops #6105 — a board fetched twice in one scan, or
// again minutes later, should not hit the network a second time. Within the
// freshness window (15 minutes) a saved response is reused as-is; a stale GET
// is rechecked with If-None-Match and a 304 keeps the saved body. A changed
// ETag refetches. The cache never crosses endpoints, API credentials or
// request bodies, and a failed fetch is never saved.
//
// web-ui deviation from the parent (noted in the port): the parent persists
// saved bodies under data/cache/http/ so a SEPARATE scan process reuses them;
// web-ui keeps the store IN MEMORY, scoped to one scan run by
// withBoardResponseCache() — no on-disk cache contract exists here.
//
// CI-isolated: every fetch goes through an injected fetchImpl — no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  cachedBoardText,
  withBoardResponseCache,
  resolveBoardCacheTtlMs,
  formatBoardCacheWindow,
} from '../server/lib/board-response-cache.mjs';
import { fetchJson, fetchText } from '../server/lib/http-json.mjs';

const DEFAULT_TTL_MS = 15 * 60 * 1000;

/** Case-insensitive single-header read off a plain-object header bag. */
function headerValue(headers, name) {
  for (const [k, v] of Object.entries(headers || {})) {
    if (k.toLowerCase() === name) return v;
  }
  return null;
}

/**
 * A counting fetchImpl. Every request is recorded (url, method, body, the
 * incoming If-None-Match) and `handler(url, opts)` produces the Response.
 */
function countingFetch(handler) {
  const hits = [];
  const impl = async (url, opts = {}) => {
    hits.push({
      url,
      method: String(opts.method || 'GET').toUpperCase(),
      body: opts.body ?? null,
      inm: headerValue(opts.headers, 'if-none-match'),
    });
    return handler(url, opts, hits.length);
  };
  impl.hits = hits;
  return impl;
}

function jsonResponse(payload, { etag = '"v1"', headers = {} } = {}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json', etag, ...headers },
  });
}

function notModifiedResponse(etag = '"v1"') {
  return new Response(null, { status: 304, headers: { etag } });
}

/** The canonical two-phase board stub: serves v1, then 304s a matching recheck. */
function v1ThenRevalidateFetch(payload = { title: 'Platform Engineer', n: 1 }) {
  return countingFetch((url, opts) => {
    if (headerValue(opts.headers, 'if-none-match') === '"v1"') return notModifiedResponse();
    return jsonResponse(payload);
  });
}

// ───────────────────────── fresh reuse ─────────────────────────

test('two overlapping reads of one board make one request, and each caller gets its own object', async () => {
  const fetchImpl = v1ThenRevalidateFetch();
  const url = 'https://boards.example.test/v1/boards/northwind/jobs';
  const [a, b] = await withBoardResponseCache({ ttlMs: DEFAULT_TTL_MS }, () => Promise.all([
    fetchJson(fetchImpl, url),
    fetchJson(fetchImpl, url),
  ]));
  assert.equal(fetchImpl.hits.length, 1, `overlapping reads made ${fetchImpl.hits.length} requests`);
  assert.deepEqual(a, { title: 'Platform Engineer', n: 1 });
  assert.deepEqual(b, a);
  // A cached JSON body must not be a shared instance: one caller mutating its
  // result must never leak into the next caller's copy.
  assert.notEqual(a, b);
});

test('a second read inside the fresh window makes no request', async () => {
  const fetchImpl = v1ThenRevalidateFetch();
  const url = 'https://boards.example.test/v1/boards/northwind/jobs';
  await withBoardResponseCache({ ttlMs: DEFAULT_TTL_MS }, async () => {
    await fetchJson(fetchImpl, url);
    const again = await fetchJson(fetchImpl, url);
    assert.deepEqual(again, { title: 'Platform Engineer', n: 1 });
  });
  assert.equal(fetchImpl.hits.length, 1, `fresh reread made ${fetchImpl.hits.length} requests`);
});

test('fetchText bodies are reused inside the window too', async () => {
  const fetchImpl = countingFetch(() => new Response('<feed><job>1</job></feed>', {
    status: 200,
    headers: { 'content-type': 'application/xml', etag: '"t1"' },
  }));
  const url = 'https://boards.example.test/feed/northwind.xml';
  const [a, b] = await withBoardResponseCache({ ttlMs: DEFAULT_TTL_MS }, () => Promise.all([
    fetchText(fetchImpl, url),
    fetchText(fetchImpl, url),
  ]));
  assert.equal(fetchImpl.hits.length, 1, `text reuse made ${fetchImpl.hits.length} requests`);
  assert.equal(a, '<feed><job>1</job></feed>');
  assert.equal(b, a);
});

// ───────────────────────── ETag recheck ─────────────────────────

test('a stale board is rechecked with If-None-Match and a 304 keeps the saved body', async () => {
  // One scope = one scan run (the store is in-memory per scope). The clock is
  // mutable inside it: a long-running scan re-reading a board past the window.
  let now = 10_000;
  const fetchImpl = v1ThenRevalidateFetch();
  const url = 'https://boards.example.test/v1/boards/northwind/jobs';

  await withBoardResponseCache({ ttlMs: 1_000, now: () => now }, async () => {
    await fetchJson(fetchImpl, url); // stores the entry at now=10_000
    assert.equal(fetchImpl.hits.length, 1);

    now += 5_000; // past the 1 s window → stale
    const again = await fetchJson(fetchImpl, url);
    const recheck = fetchImpl.hits[1];
    assert.equal(recheck.inm, '"v1"', 'the recheck must carry If-None-Match');
    assert.deepEqual(again, { title: 'Platform Engineer', n: 1 }, '304 keeps the saved body');
    assert.equal(fetchImpl.hits.length, 2);

    // The revalidation refreshed storedAt, so an immediate next read is fresh.
    await fetchJson(fetchImpl, url);
    assert.equal(fetchImpl.hits.length, 2, 'a refreshed entry is fresh again');

    // …and goes stale again, so it revalidates once more instead of sticking.
    now += 5_000;
    await fetchJson(fetchImpl, url);
    assert.equal(fetchImpl.hits.length, 3);
    assert.equal(fetchImpl.hits[2].inm, '"v1"');
  });
});

test('a changed board refetches and replaces the saved entry', async () => {
  let now = 10_000;
  const url = 'https://boards.example.test/v1/boards/northwind/jobs';
  const fetchImpl = countingFetch((url2, opts) => {
    if (headerValue(opts.headers, 'if-none-match') === '"v1"') {
      return jsonResponse({ title: 'Platform Engineer', n: 2 }, { etag: '"v2"' });
    }
    return jsonResponse({ title: 'Platform Engineer', n: 1 }, { etag: '"v1"' });
  });

  await withBoardResponseCache({ ttlMs: 1_000, now: () => now }, async () => {
    const first = await fetchJson(fetchImpl, url);
    assert.deepEqual(first, { title: 'Platform Engineer', n: 1 });

    now += 5_000;
    const changed = await fetchJson(fetchImpl, url);
    assert.deepEqual(changed, { title: 'Platform Engineer', n: 2 }, 'a 200 to the recheck replaces the body');
    assert.equal(fetchImpl.hits[1].inm, '"v1"');

    // The replaced entry is now served fresh, carrying the NEW etag.
    await fetchJson(fetchImpl, url);
    assert.equal(fetchImpl.hits.length, 2);
    now += 5_000;
    const later = await fetchJson(fetchImpl, url);
    // The recheck follows the REPLACED etag ("v2", not the original "v1") —
    // the stub answers that request with its unchanged-board body, proving
    // the refetched body (not the stale saved one) is what the caller gets.
    assert.equal(fetchImpl.hits[2].inm, '"v2"', 'the recheck follows the replaced etag');
    assert.deepEqual(later, { title: 'Platform Engineer', n: 1 });
  });
});

test('a stored time in the future is not treated as fresh', async () => {
  let now = 10_000;
  const fetchImpl = v1ThenRevalidateFetch();
  const url = 'https://boards.example.test/v1/boards/clock/jobs';

  await withBoardResponseCache({ ttlMs: 1_000, now: () => now }, async () => {
    await fetchJson(fetchImpl, url);
    now -= 5_000; // the stored stamp now sits in the future
    await fetchJson(fetchImpl, url);
    assert.equal(fetchImpl.hits.length, 2, 'a future storedAt rechecks');
    assert.equal(fetchImpl.hits[1].inm, '"v1"');
  });
});

// ───────────────────────── cache isolation ─────────────────────────

test('a different endpoint is a different entry', async () => {
  const fetchImpl = v1ThenRevalidateFetch();
  await withBoardResponseCache({ ttlMs: DEFAULT_TTL_MS }, async () => {
    await fetchJson(fetchImpl, 'https://boards.example.test/v1/boards/northwind/jobs');
    await fetchJson(fetchImpl, 'https://boards.example.test/v1/boards/southwind/jobs');
  });
  assert.equal(fetchImpl.hits.length, 2, 'two boards are two requests');
});

test('two API keys for one URL are two saved responses', async () => {
  const fetchImpl = countingFetch(() => jsonResponse({ ok: true }));
  const url = 'https://search.example.test/postings';
  await withBoardResponseCache({ ttlMs: DEFAULT_TTL_MS }, async () => {
    const read = (apiKey) => fetchText(fetchImpl, url, {
      method: 'POST',
      body: '{"offset":0}',
      headers: { 'content-type': 'application/json', 'x-algolia-api-key': apiKey },
    });
    await read('key-a');
    await read('key-b');
    await read('key-a');
  });
  assert.equal(fetchImpl.hits.length, 2, `API keys shared a cache entry (${fetchImpl.hits.length} requests)`);
});

test('two POST bodies are two requests, the same body twice is one', async () => {
  const fetchImpl = countingFetch(() => jsonResponse({ ok: true }));
  const url = 'https://boards.example.test/postings/northwind';
  await withBoardResponseCache({ ttlMs: DEFAULT_TTL_MS }, async () => {
    const post = (body) => fetchJson(fetchImpl, url, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json' },
    });
    await post('{"offset":0}');
    await post('{"offset":20}');
    await post('{"offset":0}');
  });
  assert.equal(fetchImpl.hits.length, 2, `POST bodies made ${fetchImpl.hits.length} requests`);
});

test('a non-GET/POST method and a non-serializable body bypass the cache', async () => {
  const fetchImpl = countingFetch(() => jsonResponse({ ok: true }));
  const url = 'https://boards.example.test/v1/boards/x/jobs';
  await withBoardResponseCache({ ttlMs: DEFAULT_TTL_MS }, async () => {
    await fetchJson(fetchImpl, url, { method: 'DELETE' });
    await fetchJson(fetchImpl, url, { method: 'DELETE' });
    await fetchJson(fetchImpl, url, { body: { notAString: true } }); // object body
    await fetchJson(fetchImpl, url, { body: { notAString: true } });
  });
  assert.equal(fetchImpl.hits.length, 4, 'uncacheable requests always go to the network');
});

// ───────────────────────── what is never saved ─────────────────────────

test('a failed board is not saved, so the next read tries again', async () => {
  const fetchImpl = countingFetch(() => new Response('nope', { status: 500 }));
  const url = 'https://boards.example.test/v1/boards/dead/jobs';
  await withBoardResponseCache({ ttlMs: DEFAULT_TTL_MS }, async () => {
    await assert.rejects(() => fetchJson(fetchImpl, url), /500/);
    await assert.rejects(() => fetchJson(fetchImpl, url), /500/);
  });
  assert.equal(fetchImpl.hits.length, 2, 'an error was saved or not retried');
});

test('a non-JSON 2xx is never cached', async () => {
  const fetchImpl = countingFetch(() => new Response('<html>maintenance</html>', {
    status: 200,
    headers: { 'content-type': 'text/html' },
  }));
  const url = 'https://boards.example.test/v1/boards/html/jobs';
  await withBoardResponseCache({ ttlMs: DEFAULT_TTL_MS }, async () => {
    await assert.rejects(() => fetchJson(fetchImpl, url), /non-JSON 2xx/);
    await assert.rejects(() => fetchJson(fetchImpl, url), /non-JSON 2xx/);
  });
  assert.equal(fetchImpl.hits.length, 2);
});

test('a no-store board is fetched again on the next read', async () => {
  const fetchImpl = countingFetch(() => jsonResponse({ ok: true }, { headers: { 'cache-control': 'no-store' } }));
  const url = 'https://boards.example.test/v1/boards/nostore/jobs';
  await withBoardResponseCache({ ttlMs: DEFAULT_TTL_MS }, async () => {
    await fetchJson(fetchImpl, url);
    await fetchJson(fetchImpl, url);
  });
  assert.equal(fetchImpl.hits.length, 2, 'no-store must not be saved');
});

// ───────────────────────── scope behaviour ─────────────────────────

test('without a cache scope the helpers fetch every time', async () => {
  const fetchImpl = v1ThenRevalidateFetch();
  const url = 'https://boards.example.test/v1/boards/plain/jobs';
  await fetchJson(fetchImpl, url);
  await fetchJson(fetchImpl, url);
  assert.equal(fetchImpl.hits.length, 2, 'the cache must be inert outside withBoardResponseCache');
});

test('a disabled cache behaves like no scope', async () => {
  const fetchImpl = v1ThenRevalidateFetch();
  const url = 'https://boards.example.test/v1/boards/off/jobs';
  await withBoardResponseCache({ ttlMs: DEFAULT_TTL_MS, disabled: true }, async () => {
    await fetchJson(fetchImpl, url);
    await fetchJson(fetchImpl, url);
  });
  assert.equal(fetchImpl.hits.length, 2);
});

test('a ttl of 0 is usable and means never fresh — every GET rechecks', async () => {
  let now = 10_000;
  const fetchImpl = v1ThenRevalidateFetch();
  const url = 'https://boards.example.test/v1/boards/ttl0/jobs';
  await withBoardResponseCache({ ttlMs: 0, now: () => now }, async () => {
    await fetchJson(fetchImpl, url);
    await fetchJson(fetchImpl, url);
  });
  assert.equal(fetchImpl.hits.length, 2);
  assert.equal(fetchImpl.hits[1].inm, '"v1"');
});

// ───────────────────────── ttl helpers ─────────────────────────

test('resolveBoardCacheTtlMs parses env values defensively', () => {
  assert.equal(resolveBoardCacheTtlMs(undefined), DEFAULT_TTL_MS);
  assert.equal(resolveBoardCacheTtlMs(null), DEFAULT_TTL_MS);
  assert.equal(resolveBoardCacheTtlMs('   '), DEFAULT_TTL_MS);
  assert.equal(resolveBoardCacheTtlMs('abc'), DEFAULT_TTL_MS);
  assert.equal(resolveBoardCacheTtlMs('-1'), DEFAULT_TTL_MS);
  assert.equal(resolveBoardCacheTtlMs('99999999999999'), DEFAULT_TTL_MS, 'above the timer ceiling falls back');
  assert.equal(resolveBoardCacheTtlMs('0'), 0, '0 is usable and means never fresh');
  assert.equal(resolveBoardCacheTtlMs('60000'), 60_000);
  assert.equal(resolveBoardCacheTtlMs('5000', 1_000), 5_000);
});

test('formatBoardCacheWindow renders the window for the scan log', () => {
  assert.equal(formatBoardCacheWindow(DEFAULT_TTL_MS), '15 minutes');
  assert.equal(formatBoardCacheWindow(60_000), '1 minute');
  assert.equal(formatBoardCacheWindow(1_000), '1 second');
  assert.equal(formatBoardCacheWindow(30_000), '30 seconds');
  assert.equal(formatBoardCacheWindow(1_234), '1234 ms');
});

// ───────────────────────── cachedBoardText contract ─────────────────────────

test('cachedBoardText is inert without a store (direct contract)', async () => {
  const loadCalls = [];
  const body = await cachedBoardText('https://x.example.test/a', {}, async (url, opts, conditional) => {
    loadCalls.push({ url, conditional });
    return { body: 'text', etag: '"e"' };
  });
  assert.equal(body, 'text');
  assert.deepEqual(loadCalls[0].conditional, { ifNoneMatch: null });
});
