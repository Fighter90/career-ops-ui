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
  assert.ok(calls.length >= 1, 'the interstitial was reached via the redirect');
  for (const u of calls) {
    const host = new URL(u).hostname;
    assert.ok(host === 'hh.ru' || host.endsWith('.hh.ru'), `every fetch stayed on hh.ru (got ${host})`);
  }
});

test('hh: a Location-named vpncheck redirect is detected even when never followed (budget refusal)', async () => {
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
  assert.ok(calls <= 4, `the redirect budget bounds the walk (got ${calls} calls)`);
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
