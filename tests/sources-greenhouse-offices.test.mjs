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
