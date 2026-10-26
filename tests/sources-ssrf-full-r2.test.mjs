/**
 * FULL-R2 behavioural guards, on top of the raw-fetch lint gate:
 *
 *   1. rss.mjs — the feed URL is fully config-controlled, so it must be
 *      https on a public host and fetched through the guarded transport.
 *   2. remoteok/remotive — the `api:`/mirror override must stay on the
 *      pinned board host, never on an arbitrary https host.
 *   3. workday — the CXS endpoint is host-pinned and a tenant-supplied
 *      `externalPath` can only ever produce a relative or same-origin URL.
 *   4. hh — the VPN-check interstitial is detected from the redirect
 *      `Location` header under `redirect:'manual'` (no cross-host follow),
 *      while *.hh.ru regional redirects still resolve.
 *
 * CI-isolated: injected fetchImpl, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const rss = await import('../server/lib/sources/rss.mjs');
const remoteok = await import('../server/lib/sources/remoteok.mjs');
const remotive = await import('../server/lib/sources/remotive.mjs');
const workday = await import('../server/lib/sources/workday.mjs');
const hh = await import('../server/lib/sources/hh.mjs');
const consider = await import('../server/lib/sources/consider.mjs');
const httpJson = await import('../server/lib/http-json.mjs');

const RSS_XML = `<?xml version="1.0"?>
<rss version="2.0"><channel>
<title>Board</title>
<item><title>Acme — Rust Engineer</title><link>https://acme.example/jobs/1</link>
<description><![CDATA[Build things]]></description><guid>r1</guid></item>
</channel></rss>`;

// ── 1. rss: SSRF guard on the config-supplied feed URL ─────────────────

test('rss: assertRssFeedUrl accepts a public https feed', () => {
  assert.equal(rss.assertRssFeedUrl('https://example.com/feed.xml'), 'https://example.com/feed.xml');
});

test('rss: plain HTTP feeds are accepted (FULL-R2 review: the scheme is not the threat — the private host is)', () => {
  assert.equal(rss.assertRssFeedUrl('http://example.com/feed.xml'), 'http://example.com/feed.xml');
  assert.equal(rss.assertRssFeedUrl('http://feeds.example.org/jobs.rss'), 'http://feeds.example.org/jobs.rss');
});

test('rss: an http feed is fetched through the guarded transport', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, init });
    return { ok: true, status: 200, text: async () => RSS_XML };
  };
  const jobs = await rss.fetchRss('http://example.com/feed.xml', { fetchImpl });
  assert.equal(jobs.length, 1);
  assert.equal(seen[0].init.redirect, 'error');
});

test('rss: private / loopback / link-local feed hosts are refused (http or https)', () => {
  for (const url of [
    'https://127.0.0.1:4317/api/health',
    'https://169.254.169.254/latest/meta-data/',
    'https://10.0.0.5/feed.xml',
    'https://192.168.1.10/feed.xml',
    'https://localhost/feed.xml',
    'https://[::1]/feed.xml',
    'https://[fd00::1]/feed.xml',
    'https://[::ffff:127.0.0.1]/feed.xml',
    'https://[fe80::1]/feed.xml',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.9.8.7/feed.xml',
  ]) {
    assert.throws(() => rss.assertRssFeedUrl(url), /private|loopback|non-public/i, url);
  }
});

test('rss: the guard fires before any request is made', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: true, text: async () => RSS_XML }; };
  await assert.rejects(
    () => rss.fetchRss('http://169.254.169.254/latest/meta-data/', { fetchImpl }),
    /private|loopback/i,
  );
  assert.equal(calls, 0, 'no request may leave for a guarded URL');
});

test('rss: a valid https feed is fetched and parsed (guarded transport)', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, init });
    return { ok: true, status: 200, text: async () => RSS_XML };
  };
  const jobs = await rss.fetchRss('https://example.com/feed.xml', { fetchImpl });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Acme — Rust Engineer');
  assert.equal(seen[0].init.redirect, 'error', 'a 3xx must never be followed');
});

// ── 2. remoteok / remotive: the mirror override is host-pinned ─────────

test('remoteok: an off-host https mirror is refused before any fetch', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: true, json: async () => [] }; };
  await assert.rejects(
    () => remoteok.fetchRemoteOk('https://internal.corp/api', { fetchImpl }),
    /untrusted hostname|remoteok\.com/i,
  );
  assert.equal(calls, 0);
});

test('remoteok: a subdomain mirror of the board itself is accepted (REMOTEOK_HOST_RE)', async () => {
  const fetchImpl = async (url) => ({ ok: true, status: 200, json: async () => [
    { id: 7, position: 'Dev', url: 'https://remoteok.com/remote-jobs/7', company: 'A', location: 'Worldwide', date: 'x' },
  ] });
  const jobs = await remoteok.fetchRemoteOk('https://api.remoteok.com/api', { fetchImpl });
  assert.equal(jobs.length, 1, 'api.remoteok.com is a legitimate subdomain mirror');
});

test('remoteok: a lookalike mirror host is refused', () => {
  assert.throws(() => remoteok.assertRemoteOkUrl('https://remoteok.com.evil.com/api'), /untrusted hostname/);
  assert.throws(() => remoteok.assertRemoteOkUrl('https://evilremoteok.com/api'), /untrusted hostname/);
});

test('remoteok: the pinned board host still works', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => [
    { legal: [] },
    { id: 1, position: 'Dev', url: 'https://remoteok.com/remote-jobs/1', company: 'A', location: 'Worldwide', date: 'x' },
  ] });
  const jobs = await remoteok.fetchRemoteOk('https://remoteok.com/api', { fetchImpl });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].source, 'remoteok');
});

test('remotive: an off-host https mirror is refused before any fetch', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: true, json: async () => ({ jobs: [] }) }; };
  await assert.rejects(
    () => remotive.fetchRemotive('https://169.254.169.254/api/remote-jobs', { fetchImpl }),
    /untrusted hostname|remotive\.com|non-public/i,
  );
  assert.equal(calls, 0);
});

// ── 3. workday: endpoint pin + externalPath containment ────────────────

const WD_API = 'https://tenant.wd1.myworkdayjobs.com/wday/cxs/tenant/site/jobs';

function wdResponse(rows) {
  return { ok: true, status: 200, json: async () => ({ total: rows.length, jobPostings: rows }) };
}

test('workday: assertWorkdayUrl pins the two Workday hosts over https', () => {
  assert.equal(workday.assertWorkdayUrl(WD_API), WD_API);
  assert.equal(
    workday.assertWorkdayUrl('https://inst.myworkdaysite.com/wday/cxs/t/s/jobs'),
    'https://inst.myworkdaysite.com/wday/cxs/t/s/jobs',
  );
  assert.throws(() => workday.assertWorkdayUrl('http://tenant.wd1.myworkdayjobs.com/wday/cxs/t/s/jobs'), /HTTPS/);
  assert.throws(() => workday.assertWorkdayUrl('https://evil.com/wday/cxs/t/s/jobs'), /untrusted|myworkday/i);
});

test('workday: an off-host endpoint is refused before any fetch', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return wdResponse([]); };
  await assert.rejects(() => workday.fetchWorkday('https://evil.com/wday/cxs/t/s/jobs', { fetchImpl, strict: true }), /untrusted|myworkday/i);
  assert.equal(calls, 0);
});

test('workday: a tenant-supplied off-origin externalPath never becomes the job URL', async () => {
  const fetchImpl = async () => wdResponse([
    { title: 'Relative', externalPath: '/job/sf/rel_1' },
    { title: 'OffHostHttps', externalPath: 'https://evil.example/job/x_2' },
    { title: 'PlainTextHttp', externalPath: 'http://tenant.wd1.myworkdayjobs.com/job/y_3' },
    { title: 'SameOriginAbsolute', externalPath: 'https://tenant.wd1.myworkdayjobs.com/job/z_4' },
  ]);
  const jobs = await workday.fetchWorkday(WD_API, { fetchImpl });
  const byTitle = Object.fromEntries(jobs.map((j) => [j.title, j.url]));
  // jobBaseFromApi strips /wday/cxs/... from the myworkdayjobs URL, so a
  // relative externalPath lands on the tenant origin.
  assert.equal(byTitle.Relative, 'https://tenant.wd1.myworkdayjobs.com/job/sf/rel_1');
  assert.equal(byTitle.OffHostHttps, '', 'an off-host absolute externalPath is dropped');
  assert.equal(byTitle.PlainTextHttp, '', 'a plain-http externalPath is dropped');
  assert.equal(byTitle.SameOriginAbsolute, 'https://tenant.wd1.myworkdayjobs.com/job/z_4');
});

// ── 4. hh: vpncheck detected from the manual-redirect Location ─────────

function hhStubs() {
  const cards = `<html><body>
    <div data-qa="vacancy-serp__vacancy">
      <a data-qa="serp-item__title" href="https://spb.hh.ru/vacancy/111">
        <span>Rust Developer</span></a>
    </div>
  </body></html>`;
  return cards;
}

test('hh: a 302 to the vpncheck interstitial fails page 0 with geoBlocked (followed within hh.ru, never off it)', async () => {
  const calls = [];
  const fetchImpl = async (u) => {
    calls.push(String(u));
    if (!/vpnche/.test(String(u))) {
      return {
        ok: false, status: 302, url: String(u),
        headers: { get: (k) => (String(k).toLowerCase() === 'location'
          ? 'https://hh.ru/vpncheeck?backUrl=%2Fsearch%2Fvacancy' : null) },
        text: async () => '',
      };
    }
    return { ok: true, status: 200, url: String(u), headers: { get: () => null }, text: async () => '<html>VPN мешает работе сайта</html>' };
  };
  await assert.rejects(
    () => hh.searchHH('PHP', { fetchImpl, maxPages: 1 }),
    (err) => err.geoBlocked === true && /vpn/i.test(err.message),
  );
  // Exactly the two designed hops: the search URL, then the interstitial the
  // same-host redirect resolved to (the geo-block fires on its final URL).
  assert.equal(calls.length, 2, `expected search hop + interstitial hop, got: ${calls.join(' → ')}`);
  assert.ok(/\/vpnche{1,2}ck/.test(calls[1]), `the second hop is the interstitial (got ${calls[1]})`);
  for (const u of calls) {
    const host = new URL(u).hostname;
    assert.ok(host === 'hh.ru' || host.endsWith('.hh.ru'), `every fetch stayed on hh.ru (got ${host})`);
  }
});

test('hh: an over-budget vpncheck redirect is refused, and the refused Location still triggers the geo-block', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return {
      ok: false, status: 302, url: 'https://hh.ru/search/vacancy?text=PHP',
      headers: { get: (k) => (String(k).toLowerCase() === 'location'
        ? 'https://hh.ru/vpncheeck?backUrl=%2Fsearch%2Fvacancy' : null) },
      text: async () => '',
    };
  };
  await assert.rejects(
    () => hh.searchHH('PHP', { fetchImpl, maxPages: 1 }),
    (err) => err.geoBlocked === true && /vpn/i.test(err.message),
  );
  // maxRedirects=2: hop 0 and hop 1 follow, hop 2 exhausts the budget and the
  // LAST Location (naming the interstitial) is detected WITHOUT a fourth fetch.
  assert.equal(calls, 3, `the redirect budget bounds the walk exactly (got ${calls} calls)`);
});

test('hh: a regional *.hh.ru redirect resolves to the regional page', async () => {
  let url = '';
  const fetchImpl = async (u, init) => {
    if (String(u).includes('page=0') && !url) {
      url = u;
      return {
        ok: false, status: 302, url: u,
        headers: { get: (k) => (String(k).toLowerCase() === 'location'
          ? 'https://sochi.hh.ru/search/vacancy?text=PHP' : null) },
        text: async () => '',
      };
    }
    return { ok: true, status: 200, url: u, headers: { get: () => null }, text: async () => hhStubs() };
  };
  const jobs = await hh.searchHH('PHP', { fetchImpl, maxPages: 2 });
  assert.equal(jobs.length, 1, 'the regional page is parsed');
  assert.equal(jobs[0].id, 'hh-111');
});

test('hh: a redirect OFF hh.ru is refused, not followed', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return {
      ok: false, status: 302, url: 'https://hh.ru/search/vacancy?text=PHP',
      headers: { get: (k) => (String(k).toLowerCase() === 'location'
        ? 'https://evil.example/search/vacancy' : null) },
      text: async () => '',
    };
  };
  await assert.rejects(() => hh.searchHH('PHP', { fetchImpl, maxPages: 1 }), (err) => {
    assert.equal(err.status, 302);
    assert.notEqual(err.geoBlocked, true, 'an off-host redirect is not the geo-block');
    return true;
  });
  assert.equal(calls, 1, 'the off-host target is never fetched');
});

// ── 5. consider: a failed handshake degrades to the cookieless shape ───

test('consider: a 503 handshake degrades to the cookieless shape, never throws', async () => {
  let postCalls = 0;
  const fetchImpl = async (url, init = {}) => {
    if (String(url).endsWith('/jobs')) {
      return { ok: false, status: 503, headers: { get: () => null }, text: async () => '' };
    }
    postCalls += 1; // the search POST still goes out (412 is a cleaner signal than a silent skip)
    return { ok: false, status: 412, headers: { get: () => null }, json: async () => ({}) };
  };
  // A throw here would abort the whole scan for one dead handshake — the
  // contract is: no cookie → still attempt the POST.
  await assert.rejects(
    () => consider.fetchConsider(null, { fetchImpl, company: { careers_url: 'https://jobs.example.com/jobs', consider_board: 'wingman' } }),
    /HTTP (412|503)/,
    'the POST attempt itself may fail loudly, but the handshake must not throw first',
  );
  assert.equal(postCalls, 1, 'the search POST was still attempted without a cookie');
});

// ── 6. fetchResponse: the DNS-rebinding guard runs inside the helper ───

test('fetchResponse refuses a private host before any request (guard inside the helper)', async () => {
  let calls = 0;
  const real = globalThis.fetch;
  // The guard runs only when the REAL global fetch is the transport; swap in
  // a counting wrapper so the guard's identity check passes while any actual
  // request stays observable (and must never happen).
  globalThis.fetch = async (...a) => { calls += 1; return real(...a); };
  try {
    await assert.rejects(
      () => httpJson.fetchResponse(globalThis.fetch, 'https://127.0.0.1:9/private'),
      (e) => e.code === 'ECAREEROPS_BLOCKED_ADDRESS',
    );
  } finally {
    globalThis.fetch = real;
  }
  assert.equal(calls, 0, 'the guard must fire before the request leaves');
});

// ── 7. fetchTextFollowSameHost: redirect target must keep the port ─────

test('hh: a same-host redirect to a NON-default port is refused, not followed', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return {
      ok: false, status: 302, url: 'https://hh.ru/search/vacancy?text=PHP',
      headers: { get: (k) => (String(k).toLowerCase() === 'location'
        ? 'https://hh.ru:8443/search/vacancy?text=PHP' : null) },
      text: async () => '',
    };
  };
  await assert.rejects(
    () => hh.searchHH('PHP', { fetchImpl, maxPages: 1 }),
    (err) => err.status === 302 && err.location === 'https://hh.ru:8443/search/vacancy?text=PHP',
  );
  assert.equal(calls, 1, 'the odd-port target is never fetched');
});

// ── 8. 3xx/non-ok response bodies are released (undici socket pin) ─────

function bodyWithCancel() {
  const calls = { cancel: 0 };
  return {
    calls,
    body: { cancel: async () => { calls.cancel += 1; } },
  };
}

test('fetchTextFollowSameHost cancels the body of a followed 3xx hop', async () => {
  const first = bodyWithCancel();
  const fetchImpl = async (u) => {
    if (String(u).includes('page=0')) {
      return {
        ok: false, status: 302, url: String(u), body: first.body,
        headers: { get: (k) => (String(k).toLowerCase() === 'location'
          ? 'https://hh.ru/search/vacancy?text=PHP&page=1' : null) },
        text: async () => '',
      };
    }
    return { ok: true, status: 200, url: String(u), headers: { get: () => null }, text: async () => '<html></html>' };
  };
  const jobs = await hh.searchHH('PHP', { fetchImpl, maxPages: 2 });
  assert.equal(jobs.length, 0, 'page 2 has no cards — but the redirect resolved');
  assert.equal(first.calls.cancel, 1, 'the 302 hop body was cancelled, not left to GC');
});

test('fetchTextFollowSameHost cancels the body when a 3xx is REFUSED', async () => {
  const refused = bodyWithCancel();
  const fetchImpl = async () => ({
    ok: false, status: 302, url: 'https://hh.ru/search/vacancy?text=PHP', body: refused.body,
    headers: { get: (k) => (String(k).toLowerCase() === 'location'
      ? 'https://evil.example/search/vacancy' : null) },
    text: async () => '',
  });
  await assert.rejects(() => hh.searchHH('PHP', { fetchImpl, maxPages: 1 }), (e) => e.status === 302);
  assert.equal(refused.calls.cancel, 1, 'the refused redirect body was cancelled');
});

// ── 9. guard refusals are tagged and never retried ─────────────────────

test('guardResolvedHost tags its refusal (ssrfRefused)', async () => {
  await assert.rejects(
    () => httpJson.guardResolvedHost(globalThis.fetch, 'https://127.0.0.1:9/private'),
    (e) => e.code === 'ECAREEROPS_BLOCKED_ADDRESS' && e.ssrfRefused === true,
  );
});

test('fetchJsonWithRetry does NOT retry a guard refusal (deterministic SSRF)', async () => {
  let calls = 0;
  const refusal = Object.assign(new Error('Refusing to fetch x: literal non-public address'), {
    code: 'ECAREEROPS_BLOCKED_ADDRESS', ssrfRefused: true,
  });
  const fetchImpl = async () => { calls += 1; throw refusal; };
  await assert.rejects(
    () => httpJson.fetchJsonWithRetry(fetchImpl, 'https://board.example/x', { retries: 3, retryDelayMs: 0 }),
    (e) => e.ssrfRefused === true,
  );
  assert.equal(calls, 1, `a refusal is deterministic — 1 attempt, got ${calls}`);
});

test('fetchTextWithRetry does NOT retry a guard refusal, but DOES retry a 503', async () => {
  let refusalCalls = 0;
  const refusal = Object.assign(new Error('Refusing to fetch x: literal non-public address'), {
    code: 'ECAREEROPS_BLOCKED_ADDRESS', ssrfRefused: true,
  });
  const refusingImpl = async () => { refusalCalls += 1; throw refusal; };
  await assert.rejects(
    () => httpJson.fetchTextWithRetry(refusingImpl, 'https://board.example/x', { retries: 3, retryDelayMs: 0 }),
    (e) => e.ssrfRefused === true,
  );
  assert.equal(refusalCalls, 1, `no retries for a refusal — got ${refusalCalls}`);

  let transientCalls = 0;
  const transientImpl = async () => {
    transientCalls += 1;
    if (transientCalls < 3) { const e = new Error('HTTP 503 (x)'); e.status = 503; throw e; }
    return { ok: true, status: 200, text: async () => 'ok' };
  };
  const text = await httpJson.fetchTextWithRetry(transientImpl, 'https://board.example/x', { retries: 3, retryDelayMs: 0 });
  assert.equal(text, 'ok');
  assert.equal(transientCalls, 3, 'a transient 503 is still retried');
});

// ── 10. workday: the non-JSON-200 CAPTCHA diagnostic is preserved ──────

test('workday: a 200 CAPTCHA HTML page sets the non-JSON fallback reason (not "network:")', async () => {
  // fetchJson wraps a non-JSON 200 (CAPTCHA HTML) as "non-JSON 2xx response
  // from …" with no .status — the diagnostic must not be lost into the
  // generic network branch.
  const htmlFetch = async () => {
    throw new Error('non-JSON 2xx response from https://x: Unexpected token <');
  };
  await workday.fetchWorkday('https://tenant.wd1.myworkdayjobs.com/wday/cxs/tenant/site/jobs', { fetchImpl: htmlFetch });
  const fb = workday.getLastWorkdayFallback();
  assert.ok(fb, 'a fallback was recorded');
  assert.equal(fb.reason, 'non-JSON response (likely CAPTCHA HTML)');
});

// ── 11. pageup: an HTTP error stop is not a cap truncation (old contract) ──

const pageup = await import('../server/lib/sources/pageup.mjs');

test('pageup: a later-page HTTP failure at the page cap does NOT set pageupTruncated', async () => {
  // The real listing shape: a #search-results-content tbody + a .job-link row.
  const good = '<html><body><table><tbody id="search-results-content">'
    + '<tr><td><a class="job-link" href="/932/cw/en/job/100/senior-engineer">Senior Engineer</a></td></tr>'
    + '</tbody></table><a class="more-link" href="/932/cw/en/listing/?page=2">More Jobs</a></body></html>';
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return { ok: true, status: 200, text: async () => good };
    return { ok: false, status: 503, text: async () => '' };
  };
  const jobs = await pageup.fetchPageup('https://careers.pageuppeople.com/932/cw/en/listing/', {
    fetchImpl, delayMs: 0, company: { name: 'Acme', max_pages: 2 },
  });
  assert.equal(calls, 2);
  assert.equal(jobs.length, 1, 'page-1 jobs kept');
  assert.equal(jobs.pageupTruncated, undefined, 'an HTTP error stop is not a cap truncation');
});
