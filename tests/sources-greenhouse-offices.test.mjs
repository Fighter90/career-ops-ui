/**
 * Greenhouse office-city enrichment (parent career-ops #2104, ported v1.127.0).
 *
 * Some boards put the work model ("Hybrid") in location.name and keep the real
 * city only in the separate /offices endpoint. These tests cover the three
 * pure helpers + the fetch path that pays for /offices only when a board
 * actually hides its cities there. CI-isolated: a fake fetchImpl, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchGreenhouse,
  isWorkModelOnly,
  officesUrlFor,
  buildOfficeMap,
  contentToText,
  withContent,
  assertGreenhouseUrl,
  OFFICES_MAX_BYTES,
  OFFICES_TIMEOUT_MS,
} from '../server/lib/sources/greenhouse.mjs';

test('withContent: appends content=true, preserving any existing query', () => {
  assert.equal(
    withContent('https://boards-api.greenhouse.io/v1/boards/acme/jobs'),
    'https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true',
  );
  assert.equal(
    withContent('https://boards-api.greenhouse.io/v1/boards/acme/jobs?foo=1'),
    'https://boards-api.greenhouse.io/v1/boards/acme/jobs?foo=1&content=true',
  );
});

test('contentToText: decodes double-encoded HTML to plain text, strips script/style, caps', () => {
  // Greenhouse embeds the body as entity-escaped markup: &lt;p&gt;… .
  const body = '&lt;p&gt;Build &amp; ship backend services.&lt;/p&gt;&lt;script&gt;evil()&lt;/script&gt;';
  const text = contentToText(body);
  assert.equal(text, 'Build & ship backend services.');
  assert.equal(contentToText(''), '');
  assert.equal(contentToText(null), '');
  assert.equal(contentToText('&lt;p&gt;' + 'x'.repeat(5000) + '&lt;/p&gt;').length, 4000); // DESCRIPTION_CAP
});

test('fetchGreenhouse: requests content=true and populates description', async () => {
  let requested = '';
  const fetchImpl = async (url) => {
    requested = String(url);
    return { ok: true, json: async () => ({ jobs: [{ id: 1, title: 'Backend Engineer', absolute_url: 'https://boards.greenhouse.io/acme/jobs/1', location: { name: 'Berlin' }, content: '&lt;p&gt;Work with &amp; on Go.&lt;/p&gt;' }] }) };
  };
  const out = await fetchGreenhouse('https://boards-api.greenhouse.io/v1/boards/acme/jobs', { fetchImpl });
  assert.ok(requested.includes('content=true'), 'request must carry content=true');
  assert.equal(out[0].description, 'Work with & on Go.');
});

test('isWorkModelOnly: bare work models are enrichable, geographies are not', () => {
  assert.equal(isWorkModelOnly('Hybrid'), true);
  assert.equal(isWorkModelOnly('Distributed; Hybrid'), true);
  assert.equal(isWorkModelOnly('In-Office'), true);
  assert.equal(isWorkModelOnly('Hybrid - London'), false); // has a place
  assert.equal(isWorkModelOnly('Remote (Canada)'), false);
  assert.equal(isWorkModelOnly('San Francisco'), false);
  assert.equal(isWorkModelOnly(''), false);
  assert.equal(isWorkModelOnly(null), false);
});

test('officesUrlFor: /jobs → /offices on the same host only', () => {
  assert.equal(
    officesUrlFor('https://boards-api.greenhouse.io/v1/boards/acme/jobs'),
    'https://boards-api.greenhouse.io/v1/boards/acme/offices',
  );
  assert.equal(
    officesUrlFor('https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true'),
    'https://boards-api.greenhouse.io/v1/boards/acme/offices',
  );
  // A single-job URL (no /jobs list shape) disables enrichment.
  assert.equal(officesUrlFor('https://boards-api.greenhouse.io/v1/boards/acme/jobs/123'), null);
  assert.equal(officesUrlFor('https://example.com/x'), null);
});

test('buildOfficeMap: walks offices → departments → jobs, collects all cities', () => {
  const json = {
    offices: [
      {
        name: 'London',
        departments: [{ jobs: [{ id: 1 }, { id: 2 }] }],
        children: [{ name: 'Shoreditch', departments: [{ jobs: [{ id: 1 }] }] }],
      },
      { name: 'Berlin', departments: [{ jobs: [{ id: 2 }] }] },
    ],
  };
  const map = buildOfficeMap(json);
  assert.deepEqual([...map.get(1)].sort(), ['London', 'Shoreditch']);
  assert.deepEqual([...map.get(2)].sort(), ['Berlin', 'London']);
});

const okRes = (body) => ({ ok: true, json: async () => body });

test('fetchGreenhouse: enriches a work-model-only location from /offices', async () => {
  const jobsBody = {
    jobs: [
      { id: 10, title: 'Backend Engineer', absolute_url: 'https://x/10', location: { name: 'Hybrid' } },
    ],
  };
  const officesBody = {
    offices: [{ name: 'Amsterdam', departments: [{ jobs: [{ id: 10 }] }] }],
  };
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return url.endsWith('/offices') ? okRes(officesBody) : okRes(jobsBody);
  };
  const out = await fetchGreenhouse('https://boards-api.greenhouse.io/v1/boards/acme/jobs', { fetchImpl });
  assert.equal(calls.length, 2, 'should fetch /jobs then /offices');
  assert.match(out[0].location, /Amsterdam/);
});

test('fetchGreenhouse: skips /offices when locations already carry a city', async () => {
  const jobsBody = {
    jobs: [{ id: 11, title: 'Data Eng', absolute_url: 'https://x/11', location: { name: 'Berlin' } }],
  };
  const calls = [];
  const fetchImpl = async (url) => { calls.push(url); return okRes(jobsBody); };
  const out = await fetchGreenhouse('https://boards-api.greenhouse.io/v1/boards/acme/jobs', { fetchImpl });
  assert.equal(calls.length, 1, 'no secondary /offices request when a city is present');
  assert.equal(out[0].location, 'Berlin');
});

test('fetchGreenhouse: /offices failure is fail-soft (keeps work-model location)', async () => {
  const jobsBody = {
    jobs: [{ id: 12, title: 'SRE', absolute_url: 'https://x/12', location: { name: 'Hybrid' } }],
  };
  const fetchImpl = async (url) => (url.endsWith('/offices') ? { ok: false, status: 404 } : okRes(jobsBody));
  const out = await fetchGreenhouse('https://boards-api.greenhouse.io/v1/boards/acme/jobs', { fetchImpl });
  assert.equal(out.length, 1);
  assert.equal(out[0].location, 'Hybrid'); // unchanged, no throw
});

// /offices outgrows the shared 10 MB body cap (Stripe's: 29.2 MB — parent
// #6937), so the call must carry its own larger ceiling and a time deadline,
// or every run aborts it and each role stays a bare "Hybrid". Web-ui's
// transport carries the deadline on the request (a combined abort signal),
// where the parent's carries an explicit timeoutMs option.
test('fetchGreenhouse: /offices gets its own body and time ceiling (parent #6937)', async () => {
  const jobsBody = {
    jobs: [{ id: 14, title: 'Strategy & Operations', absolute_url: 'https://x/14', location: { name: 'Hybrid' } }],
  };
  const officesBody = {
    offices: [{ name: 'Amsterdam', departments: [{ jobs: [{ id: 14 }] }] }],
  };
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return url.endsWith('/offices') ? okRes(officesBody) : okRes(jobsBody);
  };
  const out = await fetchGreenhouse('https://boards-api.greenhouse.io/v1/boards/stripe/jobs', { fetchImpl });
  assert.equal(calls.length, 2, '/jobs + /offices');

  // The ceiling constants themselves (the parent test pins
  // opts.maxBytes >= 32 MB && opts.timeoutMs >= 30 s on its transport).
  assert.ok(OFFICES_MAX_BYTES >= 32 * 1024 * 1024, 'body ceiling leaves headroom on a 29 MB /offices');
  assert.ok(OFFICES_TIMEOUT_MS >= 30_000, 'time ceiling ≥ 30 s');
  assert.ok(OFFICES_MAX_BYTES > 10 * 1024 * 1024, 'above the shared 10 MB board cap');

  // The deadline rides the /offices request as a live (not yet aborted)
  // AbortSignal; the plain /jobs request carries none of ours.
  const officesCall = calls.find((c) => c.url.endsWith('/offices'));
  const jobsCall = calls.find((c) => !c.url.endsWith('/offices'));
  assert.ok(officesCall.init.signal instanceof AbortSignal, '/offices request carries the 60 s deadline');
  assert.equal(officesCall.init.signal.aborted, false);
  assert.equal(jobsCall.init.signal, undefined, '/jobs request carries no source-injected deadline');

  // Enrichment still worked (Amsterdam folded into the location).
  assert.match(out[0].location, /Amsterdam/);
});

// ── v1.242.0 Phase-2 correctness ─────────────────────────────────────────────

test('assertGreenhouseUrl: parent allowlist — https + exact Greenhouse hosts only', () => {
  for (const host of [
    'boards-api.greenhouse.io',
    'boards.greenhouse.io',
    'job-boards.greenhouse.io',
    'job-boards.eu.greenhouse.io',
  ]) {
    const url = `https://${host}/v1/boards/acme/jobs`;
    assert.equal(assertGreenhouseUrl(url), url);
  }
  assert.throws(() => assertGreenhouseUrl('https://evil.com/v1/boards/acme/jobs'), /untrusted hostname/);
  // a suffix spoof is not the host
  assert.throws(
    () => assertGreenhouseUrl('https://boards-api.greenhouse.io.evil.test/v1/boards/acme/jobs'),
    /untrusted hostname/,
  );
  assert.throws(() => assertGreenhouseUrl('http://boards-api.greenhouse.io/v1/boards/acme/jobs'), /must use HTTPS/);
  assert.throws(() => assertGreenhouseUrl('not-a-url'), /invalid URL/);
});

test('fetchGreenhouse: rejects an off-host endpoint before any request (SSRF pin)', async () => {
  let calls = 0;
  await assert.rejects(
    () => fetchGreenhouse('https://evil.example/v1/boards/acme/jobs', {
      fetchImpl: async () => { calls += 1; return okRes({ jobs: [] }); },
    }),
    /untrusted hostname/,
  );
  assert.equal(calls, 0, 'no request may leave for a non-Greenhouse host');
});

test('fetchGreenhouse: every request carries redirect:"error"', async () => {
  const inits = [];
  const fetchImpl = async (url, init) => {
    inits.push(init);
    return url.endsWith('/offices')
      ? okRes({ offices: [{ name: 'Berlin', departments: [{ jobs: [{ id: 1 }] }] }] })
      : okRes({ jobs: [{ id: 1, title: 'Eng', absolute_url: 'https://x/1', location: { name: 'Hybrid' } }] });
  };
  await fetchGreenhouse('https://boards-api.greenhouse.io/v1/boards/acme/jobs', { fetchImpl });
  assert.equal(inits.length, 2, '/jobs + /offices both sent');
  assert.ok(inits.every((i) => i.redirect === 'error'), 'a 3xx must never be followed');
});

test('fetchGreenhouse: a malformed 200 without the jobs container THROWS (not [])', async () => {
  for (const body of [null, {}, { oops: 1 }, { jobs: 'not-an-array' }]) {
    await assert.rejects(
      () => fetchGreenhouse('https://boards-api.greenhouse.io/v1/boards/acme/jobs', {
        fetchImpl: async () => okRes(body),
      }),
      /Greenhouse/,
      `body=${JSON.stringify(body)} must not read as an empty board`,
    );
  }
});

test('fetchGreenhouse: drops rows whose absolute_url is not https (scheme unchecked before)', async () => {
  const fetchImpl = async () => okRes({
    jobs: [
      { id: 1, title: 'Good', absolute_url: 'https://boards.greenhouse.io/acme/jobs/1', location: { name: 'Berlin' } },
      { id: 2, title: 'Http', absolute_url: 'http://boards.greenhouse.io/acme/jobs/2', location: { name: 'Berlin' } },
      { id: 3, title: 'Js', absolute_url: 'javascript:alert(1)', location: { name: 'Berlin' } },
      { id: 4, title: 'NoUrl', location: { name: 'Berlin' } },
    ],
  });
  const out = await fetchGreenhouse('https://boards-api.greenhouse.io/v1/boards/acme/jobs', { fetchImpl });
  assert.deepEqual(out.map((j) => j.id), ['gh-1'], 'a non-https absolute_url has no safe dedup key — row dropped');
});

// ── CAR-264 (parent #6673) — oversized board ────────────────────────────────
// content=true overflows the body cap → the plain list; with the entry's
// `greenhouse: { fetchDetails: true, detailLimit: N }` opt-in, bodies are then
// fetched one posting at a time for just the title-kept postings (titleWanted),
// capped at detailLimit, paced, retried on transient failures only, never
// during a health probe (maxPages), never off-host, never following a redirect.

const tooLarge = () => Object.assign(new Error('HTTP body exceeded maxBytes of 10485760'), { code: 'response_too_large' });

const GH_OVERSIZE_LISTING = () => ({
  jobs: [
    { id: 1, title: 'Strategy Manager', absolute_url: 'https://job-boards.greenhouse.io/big/jobs/1', location: { name: 'Costa Mesa' } },
    { id: 2, title: 'Welder', absolute_url: 'https://job-boards.greenhouse.io/big/jobs/2', location: { name: 'Costa Mesa' } },
    { id: 3, title: 'Strategy Lead', absolute_url: 'https://job-boards.greenhouse.io/big/jobs/3', location: { name: 'Costa Mesa' } },
  ],
});

/** Fake transport: content=true throws the coded size refusal; details + plain list served. */
function ghOversizeFake(extra = {}) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url: String(url), opts });
    if (String(url).includes('content=true')) throw tooLarge();
    if (/\/jobs\/\d+$/.test(String(url))) {
      if (extra.detail) return extra.detail(url);
      return okRes({ id: 1, content: '&lt;p&gt;Lead strategy.&lt;/p&gt;' });
    }
    // A fresh copy per call: the source writes bodies onto the jobs it was
    // given, and one run must never see another run's bodies.
    return okRes(GH_OVERSIZE_LISTING());
  };
  impl.calls = calls;
  impl.sleeps = [];
  return impl;
}

const GH_OPT_IN = { name: 'Big', careers_url: 'https://job-boards.greenhouse.io/big', greenhouse: { fetchDetails: true } };

async function ghOversizeRun(company, extra = {}) {
  const impl = ghOversizeFake(extra);
  const ow = console.warn;
  const oe = console.error;
  console.warn = () => {};
  console.error = () => {};
  try {
    const rows = await fetchGreenhouse(extra.api || 'https://boards-api.greenhouse.io/v1/boards/big/jobs', {
      fetchImpl: impl,
      company,
      titleWanted: (t) => /strategy/i.test(t),
      sleep: async (ms) => { impl.sleeps.push(ms); },
      ...(extra.opts || {}),
    });
    return { rows, calls: impl.calls, sleeps: impl.sleeps };
  } finally {
    console.warn = ow;
    console.error = oe;
  }
}

const detailCalls = (calls) => calls.filter((c) => /\/jobs\/\d+$/.test(c.url));

test('fetchGreenhouse: an oversized board reads the plain list and, with fetchDetails, fetches bodies for title-matched postings only', async () => {
  const on = await ghOversizeRun(GH_OPT_IN);
  const strat = on.rows.find((r) => r.title === 'Strategy Manager');
  const welder = on.rows.find((r) => r.title === 'Welder');
  assert.equal(on.rows.length, 3);
  assert.equal(strat.description, 'Lead strategy.');
  assert.equal(welder.description, '', 'a non-matching title keeps no body');
  assert.equal(detailCalls(on.calls).length, 2, 'detail requests only for the title-kept postings');
  assert.ok(!detailCalls(on.calls).some((c) => c.url.endsWith('/jobs/2')), 'the welder posting is never fetched');
  assert.ok(
    on.calls.some((c) => c.url === 'https://boards-api.greenhouse.io/v1/boards/big/jobs'),
    'the fallback re-reads the SAME board without content=true',
  );
  assert.ok(on.calls.every((c) => c.opts?.redirect === 'error'), 'list, plain-list fallback and details all refuse redirects');
});

test('fetchGreenhouse: keeps a percent-encoded board slug encoded once in detail URLs', async () => {
  const run = await ghOversizeRun(
    { name: 'Big', greenhouse: { fetchDetails: true } },
    { api: 'https://boards-api.greenhouse.io/v1/boards/%62ig/jobs' },
  );
  const urls = detailCalls(run.calls).map((c) => c.url);
  assert.equal(urls.length, 2);
  assert.ok(
    urls.every((u) => u.startsWith('https://boards-api.greenhouse.io/v1/boards/%62ig/jobs/')),
    `double-encoded slug: ${JSON.stringify(urls)}`,
  );
});

test('fetchGreenhouse: fetches no detail without the fetchDetails opt-in (warn instead)', async () => {
  const off = await ghOversizeRun({ name: 'Big', careers_url: 'https://job-boards.greenhouse.io/big' });
  assert.equal(off.rows.length, 3);
  assert.equal(detailCalls(off.calls).length, 0);
  const warns = [];
  const ow = console.warn;
  console.warn = (m) => warns.push(String(m));
  try {
    await fetchGreenhouse('https://boards-api.greenhouse.io/v1/boards/big/jobs', {
      fetchImpl: ghOversizeFake(),
      company: { name: 'Big' },
      titleWanted: (t) => true,
    });
  } finally {
    console.warn = ow;
  }
  assert.ok(
    warns.some((w) => w.includes('board too large for content=true') && w.includes('greenhouse.fetchDetails')),
    `warn must name the opt-in: ${JSON.stringify(warns)}`,
  );
});

test('fetchGreenhouse: fetches no detail during a health probe (maxPages)', async () => {
  const probe = await ghOversizeRun(GH_OPT_IN, { opts: { maxPages: 1 } });
  assert.equal(probe.rows.length, 3);
  assert.equal(detailCalls(probe.calls).length, 0);
});

test('fetchGreenhouse: caps detail requests at detailLimit', async () => {
  const capped = await ghOversizeRun({ ...GH_OPT_IN, greenhouse: { fetchDetails: true, detailLimit: 1 } });
  assert.equal(detailCalls(capped.calls).length, 1);
});

test('fetchGreenhouse: retries a transient detail failure before giving up the body', async () => {
  const perUrl = new Map();
  const run = await ghOversizeRun(GH_OPT_IN, {
    detail: (url) => {
      const n = (perUrl.get(url) || 0) + 1;
      perUrl.set(url, n);
      if (url.endsWith('/jobs/1') && n === 1) throw Object.assign(new Error('HTTP 503'), { status: 503 });
      return okRes({ content: 'ok' });
    },
  });
  assert.equal(run.rows.find((r) => r.title === 'Strategy Manager')?.description, 'ok');
  assert.equal(perUrl.get('https://boards-api.greenhouse.io/v1/boards/big/jobs/1'), 2, 'a 503 is retried once');
  assert.equal(perUrl.get('https://boards-api.greenhouse.io/v1/boards/big/jobs/3'), 1, 'the sibling candidate is fetched once');
});

test('fetchGreenhouse: keeps postings whose detail fetch failed (404 not retried), paced between attempts', async () => {
  let notFound = 0;
  const run = await ghOversizeRun(GH_OPT_IN, {
    detail: () => {
      notFound += 1;
      throw Object.assign(new Error('HTTP 404'), { status: 404 });
    },
  });
  assert.equal(run.rows.length, 3);
  assert.equal(notFound, 2, 'a 404 is deterministic — one attempt per candidate, no retry');
  assert.ok(run.sleeps.includes(200), `pacing sleep between attempts: ${JSON.stringify(run.sleeps)}`);
  const bodies = run.rows.filter((r) => /strategy/i.test(r.title)).map((r) => r.description);
  assert.ok(bodies.length === 2 && bodies.every((d) => d === ''), 'failed enrichments keep empty descriptions');
});

test('fetchGreenhouse: still throws a non-size list error (only an oversized body changes the plan)', async () => {
  await assert.rejects(
    () => fetchGreenhouse('https://boards-api.greenhouse.io/v1/boards/big/jobs', {
      fetchImpl: async () => { throw Object.assign(new Error('HTTP 404'), { status: 404 }); },
    }),
    /404/,
  );
});
