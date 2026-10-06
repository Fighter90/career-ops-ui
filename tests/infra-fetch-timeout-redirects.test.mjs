/**
 * v1.241.0 review hardening — the scanner transport (`makeTimeoutFetch`).
 *
 *  - Redirects: many sources call `fetchImpl(url)` with no `redirect`, so undici
 *    followed a 302 to wherever it pointed — a blind SSRF to a private address.
 *    The wrapper now follows redirects itself: https only, at most 5 hops, every
 *    hop re-checked (IP literal + DNS answer). A caller's explicit
 *    `redirect: 'error' | 'manual'` is passed through untouched.
 *  - Deadline: the timer used to be cleared as soon as the headers arrived, so a
 *    body that stalled mid-read hung the scan (and SCAN_BUSY) forever.
 *  - DNS: the guard checked only the first lookup answer; now every answer.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns';

let makeTimeoutFetch;
before(async () => {
  ({ makeTimeoutFetch } = await import('../server/lib/fetch-timeout.mjs'));
});

const redirect = (location, status = 302) =>
  new Response(null, { status, headers: { location } });

/** Base-fetch stub that answers from a queue and records every call. */
function scripted(...answers) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url: String(url), opts });
    const next = answers.shift();
    return typeof next === 'function' ? next(url, opts) : next;
  };
  return { fn, calls };
}

test('a 302 to a private IP literal is refused, not followed', async () => {
  const { fn, calls } = scripted(redirect('https://127.0.0.1/admin'), new Response('secret'));
  await assert.rejects(
    makeTimeoutFetch(fn)('https://board.example/jobs'),
    (e) => e.code === 'ECAREEROPS_BLOCKED_REDIRECT',
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].opts.redirect, 'manual');
});

test('a redirect to plain http is refused (https only)', async () => {
  const { fn, calls } = scripted(redirect('http://board.example/next'));
  await assert.rejects(makeTimeoutFetch(fn)('https://board.example/jobs'), (e) => e.code === 'ECAREEROPS_BLOCKED_REDIRECT');
  assert.equal(calls.length, 1);
});

test('a trailing-dot loopback name (`localhost.`) is refused as a hop', async () => {
  const { fn } = scripted(redirect('https://localhost./x'));
  await assert.rejects(makeTimeoutFetch(fn)('https://board.example/jobs'), (e) => e.code === 'ECAREEROPS_BLOCKED_REDIRECT');
});

test('a public https redirect is followed (relative Location resolved) and the final response returned', async () => {
  const { fn, calls } = scripted(redirect('/v2/jobs?p=1', 301), new Response('{"ok":1}'));
  const res = await makeTimeoutFetch(fn)('https://board.example/jobs');
  assert.equal(await res.text(), '{"ok":1}');
  assert.deepEqual(calls.map((c) => c.url), ['https://board.example/jobs', 'https://board.example/v2/jobs?p=1']);
  assert.ok(calls.every((c) => c.opts.redirect === 'manual'));
});

test('more than 5 redirects is an error', async () => {
  const hops = Array.from({ length: 6 }, (_, i) => redirect(`https://board.example/${i + 1}`));
  const { fn, calls } = scripted(...hops, new Response('never'));
  await assert.rejects(makeTimeoutFetch(fn)('https://board.example/0'), /redirects/);
  assert.equal(calls.length, 6);
});

test('a 3xx with no Location is returned as-is', async () => {
  const { fn } = scripted(new Response(null, { status: 304 }));
  const res = await makeTimeoutFetch(fn)('https://board.example/jobs');
  assert.equal(res.status, 304);
});

test('a caller-chosen redirect mode is passed through untouched (single call)', async () => {
  for (const mode of ['error', 'manual']) {
    const { fn, calls } = scripted(redirect('https://127.0.0.1/'));
    const res = await makeTimeoutFetch(fn)('https://board.example/jobs', { redirect: mode });
    assert.equal(res.status, 302);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].opts.redirect, mode);
  }
});

test('303 on POST becomes a body-less GET; a cross-origin hop drops credentials', async () => {
  const { fn, calls } = scripted(redirect('https://other.example/result', 303), new Response('done'));
  await makeTimeoutFetch(fn)('https://board.example/search', {
    method: 'POST', body: '{"q":1}',
    headers: { Authorization: 'Bearer t', Cookie: 'a=b', 'Content-Type': 'application/json', 'X-Keep': '1' },
  });
  const hop = calls[1].opts;
  assert.equal(hop.method, 'GET');
  assert.equal(hop.body, undefined);
  const names = Object.keys(hop.headers).map((k) => k.toLowerCase());
  assert.ok(!names.includes('authorization') && !names.includes('cookie') && !names.includes('content-type'));
  assert.ok(names.includes('x-keep'));
});

test('307 keeps method and body on a same-origin hop', async () => {
  const { fn, calls } = scripted(redirect('/again', 307), new Response('ok'));
  await makeTimeoutFetch(fn)('https://board.example/search', { method: 'POST', body: 'x', headers: { Authorization: 'k' } });
  assert.equal(calls[1].opts.method, 'POST');
  assert.equal(calls[1].opts.body, 'x');
  assert.equal(calls[1].opts.headers.Authorization, 'k');
});

test('a Request-object input is passed through unchanged (no redirect handling)', async () => {
  const { fn, calls } = scripted(new Response('ok'));
  await makeTimeoutFetch(fn)(new Request('https://board.example/x'));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].opts.redirect, undefined);
});

// ── DNS answers on the real-fetch path ───────────────────────────────────────
// guardResolvedHost runs only when the transport IS globalThis.fetch, so these
// swap the global for a stub and patch dns.promises.lookup — no network.
let realFetch;
let realLookup;
const ANSWERS = {
  'public.example': [{ address: '93.184.216.34', family: 4 }],
  'internal.example': [{ address: '10.0.0.5', family: 4 }],
  'multi.example': [{ address: '93.184.216.34', family: 4 }, { address: '192.168.1.9', family: 4 }],
};
before(() => {
  realFetch = globalThis.fetch;
  realLookup = dns.promises.lookup;
  dns.promises.lookup = async (host, opts) => {
    const all = ANSWERS[host];
    if (!all) throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
    return opts && opts.all ? all : all[0];
  };
});
after(() => {
  globalThis.fetch = realFetch;
  dns.promises.lookup = realLookup;
});

test('a hop whose NAME resolves to a private address is refused (per-hop DNS guard)', async () => {
  const { fn, calls } = scripted(redirect('https://internal.example/meta'), new Response('secret'));
  globalThis.fetch = fn;
  try {
    await assert.rejects(makeTimeoutFetch()('https://public.example/jobs'), (e) => e.code === 'ECAREEROPS_BLOCKED_ADDRESS');
    assert.equal(calls.length, 1);
  } finally { globalThis.fetch = realFetch; }
});

test('every DNS answer is checked, not just the first', async () => {
  const { fn, calls } = scripted(new Response('x'));
  globalThis.fetch = fn;
  try {
    await assert.rejects(makeTimeoutFetch()('https://multi.example/jobs'), (e) => e.address === '192.168.1.9');
    assert.equal(calls.length, 0);
  } finally { globalThis.fetch = realFetch; }
});

// ── deadline covers the body read ────────────────────────────────────────────
function stallingBody(signal) {
  return new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode('partial'));
      signal.addEventListener('abort', () => c.error(signal.reason), { once: true });
    },
    pull() { return new Promise(() => {}); }, // never delivers the rest
  });
}

test('a body that stalls after the headers is cut off by the same deadline', async () => {
  const base = async (_u, opts) => new Response(stallingBody(opts.signal));
  const res = await makeTimeoutFetch(base, 40)('https://board.example/jobs');
  const outcome = await Promise.race([
    res.text().then(() => 'resolved', (e) => e.name),
    new Promise((r) => setTimeout(() => r('hung'), 1000)),
  ]);
  assert.equal(outcome, 'TimeoutError');
});

test('once the body is read the timer is released (no late abort)', async () => {
  let seen;
  const base = async (_u, opts) => { seen = opts.signal; return new Response('done'); };
  const res = await makeTimeoutFetch(base, 30)('https://board.example/jobs');
  assert.equal(await res.json().catch(() => 'not-json'), 'not-json');
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(seen.aborted, false);
});

test('a fetch that rejects clears the timer and rethrows', async () => {
  let seen;
  const base = async (_u, opts) => { seen = opts.signal; throw new TypeError('fetch failed'); };
  await assert.rejects(makeTimeoutFetch(base, 30)('https://board.example/jobs'), /fetch failed/);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(seen.aborted, false);
});

test('an unparseable Location is refused', async () => {
  const { fn } = scripted(redirect('https://[bad'));
  await assert.rejects(makeTimeoutFetch(fn)('https://board.example/jobs'), (e) => e.code === 'ECAREEROPS_BLOCKED_REDIRECT' && /invalid/.test(e.message));
});

test('http-json: fetchText surfaces a manual 3xx Location; fetchResponse throws on non-2xx', async () => {
  const { fetchText, fetchResponse } = await import('../server/lib/http-json.mjs');
  await assert.rejects(
    fetchText(async () => redirect('https://board.example/NoJobs.htm'), 'https://board.example/feed', { redirect: 'manual' }),
    (e) => e.status === 302 && e.location === 'https://board.example/NoJobs.htm',
  );
  await assert.rejects(fetchResponse(async () => new Response('no', { status: 401 }), 'https://board.example/x'), (e) => e.status === 401);
  const ok = await fetchResponse(async () => new Response(null, { status: 204 }), 'https://board.example/x');
  assert.equal(await ok.text(), '');
});
