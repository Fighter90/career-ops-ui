/**
 * Keka source (upstream #6199 port) — CI-isolated suite.
 *
 * `<tenant>.keka.com/careers` is a shell page whose script fetches a static
 * fragment from `/ats/documents/<uuid>/careerportal/<hash>.html`; the same
 * UUID keys the zero-auth embedjobs JSON feed. Two requests, no pagination.
 * The parser must fail CLOSED on a feed that is not a top-level array (a
 * silent zero would look like an empty board) while a present-and-empty
 * array is []. Ported cases: tenant-host resolution (https + anchored
 * host + reserved vendor labels), identifier extraction (case-insensitive,
 * lower-cased), the row mapping (title/id/location/publishedOn/description,
 * malformed rows dropped, lone-surrogate id drops one posting), the
 * fail-closed parse gates, and the fetch contract (shell under
 * redirect:'manual' with the unknown-tenant 302 reported by name, feed under
 * redirect:'error', a shell without the identifier throws before the feed).
 * No network — fetchKeka runs on a fake fetchImpl.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  KEKA_HOST_RE,
  assertKekaUrl,
  resolveOrigin,
  extractIdentifier,
  jobLocation,
  parseKekaResponse,
  fetchKeka,
} from '../server/lib/sources/keka.mjs';
import { kekaAdapter } from '../server/lib/portals/adapters/keka.mjs';

const UUID = '0a1b2c3d-1111-4222-8333-444455556666';
const ORIGIN = 'https://acme.keka.com';
const SHELL = `<html><script>fetch('/ats/documents/${UUID}/careerportal/9f8e7d6c5b4a.html')</script></html>`;
const FEED = `${ORIGIN}/careers/api/embedjobs/default/active/${UUID}`;

/** A realistic embedjobs row. */
function row(id, extra = {}) {
  return {
    id,
    title: `Engineer ${id}`,
    description: '<div>Build <strong>things</strong> &amp; ship</div>',
    publishedOn: '2026-10-02T08:30:00.000Z',
    jobLocations: [{ id: 1, name: 'Acme HQ - Tower 2', city: 'Pune', state: 'MH', countryCode: 'IN', countryName: 'India' }],
    ...extra,
  };
}

// ── registry meta + adapter contract ─────────────────────────────────────────

test('keka: meta — value, label, region en; adapter id/label match', () => {
  assert.deepEqual(meta, { value: 'keka', label: 'Keka', region: 'en' });
  assert.equal(kekaAdapter.id, 'keka');
  assert.equal(kekaAdapter.label, 'Keka');
  assert.equal(typeof kekaAdapter.matches, 'function');
  assert.equal(typeof kekaAdapter.buildEndpoint, 'function');
  assert.equal(typeof kekaAdapter.fetch, 'function');
});

test('keka: adapter matches a <tenant>.keka.com URL in any spelling and rebuilds the careers endpoint', () => {
  for (const entry of [
    { name: 'Acme', careers_url: 'https://acme.keka.com/careers' },
    { name: 'Acme', careers_url: 'https://acme.keka.com' },
    { name: 'Acme', careers_url: 'https://ACME.keka.com/careers/jobdetails/12' },
    { name: 'Acme', careers_url: 'https://acme.keka.com:8443/careers' },
    { name: 'Acme', api: 'https://acme.keka.com/careers/api/embedjobs/default/active/x' },
    { name: 'Acme', provider: 'keka', careers_url: 'https://elsewhere.example/jobs' },
  ]) {
    assert.equal(kekaAdapter.matches(entry), true, JSON.stringify(entry.careers_url || entry.api));
  }
  assert.equal(kekaAdapter.buildEndpoint({ careers_url: 'https://acme.keka.com:8443/careers' }), `${ORIGIN}/careers`, 'the input port and path are discarded — the endpoint is the canonical careers URL');
  assert.equal(kekaAdapter.buildEndpoint({ careers_url: 'https://example.com/jobs' }), null, 'off-host entry → no endpoint (fail-soft)');
  assert.equal(kekaAdapter.matches(null), false);
  assert.equal(kekaAdapter.matches('acme.keka.com'), false);
});

test('keka: adapter rejects hijacks, vendor subdomains, non-https and junk', () => {
  const rejects = [
    ['non-https', { careers_url: 'http://acme.keka.com/careers' }],
    ['suffix-spoofed host', { careers_url: 'https://acme.keka.com.evil.example/careers' }],
    ['suffix look-alike host', { careers_url: 'https://evilkeka.com/careers' }],
    ['hyphen look-alike host', { careers_url: 'https://acme-keka.com/careers' }],
    ['two tenant labels', { careers_url: 'https://a.b.keka.com/careers' }],
    ['label starting with a hyphen', { careers_url: 'https://-acme.keka.com/careers' }],
    ['the vendor marketing host', { careers_url: 'https://www.keka.com/careers' }],
    ['a vendor-owned subdomain', { careers_url: 'https://app.keka.com/' }],
    ['branded careers page', { careers_url: 'https://careers.example.com/jobs' }],
    ['malformed URL', { careers_url: 'not a url' }],
    ['null careers_url', { careers_url: null }],
    ['non-string careers_url', { careers_url: 42 }],
    ['missing careers_url', {}],
  ];
  for (const [name, entry] of rejects) {
    assert.equal(kekaAdapter.matches(entry), false, `${name} must be rejected`);
    assert.equal(kekaAdapter.buildEndpoint(entry), null, `${name} must yield no endpoint`);
  }
  assert.equal(kekaAdapter.matches(null), false);
});

test('keka: resolveOrigin falls through to careers_url when api: is not a tenant', () => {
  assert.equal(resolveOrigin({ api: 'https://www.keka.com', careers_url: 'https://acme.keka.com/careers' }), ORIGIN);
  assert.equal(resolveOrigin({ careers_url: 'https://acme.keka.com' }), ORIGIN);
  assert.equal(resolveOrigin({}), null);
  assert.equal(resolveOrigin(null), null);
});

test('keka: KEKA_HOST_RE is the anchored wildcard-tenant shape', () => {
  assert.ok(KEKA_HOST_RE.test('acme.keka.com'));
  assert.ok(KEKA_HOST_RE.test('acme-corp.keka.com'));
  assert.ok(!KEKA_HOST_RE.test('a.b.keka.com'));
  assert.ok(!KEKA_HOST_RE.test('evilkeka.com'));
  assert.ok(!KEKA_HOST_RE.test('acme.keka.com.evil.example'));
  assert.ok(!KEKA_HOST_RE.test('-acme.keka.com'));
});

test('keka: assertKekaUrl — https on exactly a tenant host, default port only', () => {
  assert.equal(assertKekaUrl(`${ORIGIN}/careers`), `${ORIGIN}/careers`);
  assert.throws(() => assertKekaUrl('http://acme.keka.com/careers'), /HTTPS/);
  assert.throws(() => assertKekaUrl('https://evil.example/careers'), /untrusted hostname/);
  assert.throws(() => assertKekaUrl('https://www.keka.com/careers'), /untrusted hostname/);
  assert.throws(() => assertKekaUrl('https://acme.keka.com:8443/careers'), /port/);
  assert.throws(() => assertKekaUrl('not a url'), /invalid URL/);
});

// ── extractIdentifier ────────────────────────────────────────────────────────

test('keka: extractIdentifier reads the UUID out of the fragment path (case-insensitive, lower-cased)', () => {
  assert.equal(extractIdentifier(SHELL), UUID);
  const upper = SHELL.toUpperCase().replace('/ATS/DOCUMENTS/', '/ats/documents/').replace('/CAREERPORTAL/', '/careerportal/');
  assert.equal(extractIdentifier(upper), UUID);
});

test('keka: extractIdentifier returns null for shells without a UUID', () => {
  for (const body of ['<html></html>', '', null, undefined, 42, '/ats/documents/not-a-uuid/careerportal/x.html']) {
    assert.equal(extractIdentifier(body), null, JSON.stringify(body));
  }
});

// ── parseKekaResponse ────────────────────────────────────────────────────────

test('keka: parseKekaResponse maps title/id/url/company/location/publishedOn/description', () => {
  const [j1] = parseKekaResponse([row(101)], 'Acme', ORIGIN);
  assert.equal(j1.title, 'Engineer 101');
  assert.equal(j1.url, `${ORIGIN}/careers/jobdetails/101`);
  assert.equal(j1.company, 'Acme');
  assert.equal(j1.location, 'Pune, India');
  assert.equal(j1.postedAt, Date.parse('2026-10-02T08:30:00.000Z'));
  assert.equal(j1.description, 'Build things & ship');
});

test('keka: parseKekaResponse drops rows without a title or an id, and non-object rows', () => {
  const parsed = parseKekaResponse([
    row(101),
    row(103, { title: '   ' }),   // blank title → dropped
    row(null),                    // no id → dropped
    row('', {}),                  // empty id → dropped
    null,                         // junk row → dropped
    'junk',                       // junk row → dropped
  ], 'Acme', ORIGIN);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].url, `${ORIGIN}/careers/jobdetails/101`);
});

test('keka: parseKekaResponse leaves postedAt and description unset when absent or unparseable', () => {
  const [j2] = parseKekaResponse([row(102, { publishedOn: 'soon', description: '', jobLocations: [] })], 'Acme', ORIGIN);
  assert.equal(j2.location, '');
  assert.ok(!('postedAt' in j2), 'an unparseable date leaves postedAt off');
  assert.ok(!('description' in j2), 'an empty description leaves the key off');
});

test('keka: parseKekaResponse collapses whitespace in a title', () => {
  const [j4] = parseKekaResponse([row(104, { title: '  Data   Engineer  ' })], 'Acme', ORIGIN);
  assert.equal(j4.title, 'Data Engineer');
});

test('keka: jobLocation joins distinct places with "; ", falls back to the office name, tolerates junk', () => {
  assert.equal(
    jobLocation({ jobLocations: [{ city: 'Pune', countryName: 'India' }, { city: 'Pune', countryName: 'India' }, { city: 'Dubai', countryName: 'UAE' }] }),
    'Pune, India; Dubai, UAE',
    'duplicate places collapse',
  );
  assert.equal(jobLocation({ jobLocations: [{ name: 'Remote Hub' }] }), 'Remote Hub', 'the office name is the fallback');
  assert.equal(jobLocation({ jobLocations: [null, 'x', {}] }), '');
  assert.equal(jobLocation({}), '');
});

test('keka: a lone-surrogate id drops that posting only, not the board', () => {
  const out = parseKekaResponse([row('\uD800bad'), row(7)], 'Acme', ORIGIN);
  assert.equal(out.length, 1);
  assert.equal(out[0].url, `${ORIGIN}/careers/jobdetails/7`);
});

test('keka: a present-and-empty array is [] (a real empty board)', () => {
  assert.deepEqual(parseKekaResponse([], 'Acme', ORIGIN), []);
});

test('keka: parseKekaResponse fails CLOSED on a feed that is not a top-level array', () => {
  for (const [label, body] of [
    ['an empty object', {}],
    ['an object wrapping the array', { jobs: [] }],
    ['null', null],
    ['an empty body', ''],
    ['a number', 42],
    ['an HTML body', '<html>'],
  ]) {
    assert.throws(
      () => parseKekaResponse(body, 'Acme', ORIGIN),
      /keka: unexpected response — expected a jobs array/,
      `${label} must throw`,
    );
  }
});

test('keka: the unexpected-response error names the keys it got', () => {
  assert.throws(
    () => parseKekaResponse({ error: 'x', jobs: [] }, 'Acme', ORIGIN),
    /\[error, jobs\]/,
  );
});

// ── fetchKeka — the web-ui fetch contract ────────────────────────────────────

const ENTRY = { name: 'Acme', careers_url: `${ORIGIN}/careers` };

test('keka: fetchKeka refuses an off-host endpoint before any network call', async () => {
  let touched = 0;
  await assert.rejects(
    () => fetchKeka('https://evil.example/careers', { fetchImpl: async () => { touched += 1; return { ok: true, text: async () => '' }; } }),
    /untrusted hostname/,
  );
  assert.equal(touched, 0, 'the endpoint is validated before the fetch');
});

test('keka: fetchKeka issues two requests — the careers shell then the feed — with per-request redirect policy', async () => {
  const calls = [];
  const jobs = await fetchKeka(`${ORIGIN}/careers`, {
    fetchImpl: async (url) => {
      calls.push(url);
      if (url === `${ORIGIN}/careers`) {
        return { ok: true, status: 200, text: async () => SHELL };
      }
      return { ok: true, status: 200, json: async () => [row(1), row(2)] };
    },
    company: ENTRY,
  });
  assert.deepEqual(calls, [`${ORIGIN}/careers`, FEED], 'the shell is read first, then the embedjobs feed');
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].id, `keka-${ORIGIN}/careers/jobdetails/1`);
  assert.equal(jobs[0].source, 'keka');
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].title, 'Engineer 1');
  assert.equal(jobs[0].url, `${ORIGIN}/careers/jobdetails/1`);
  assert.equal(jobs[0].salary, '');
  assert.equal(jobs[0].location, 'Pune, India');
  assert.equal(jobs[0].date, new Date(Date.parse('2026-10-02T08:30:00.000Z')).toISOString());
  assert.equal(jobs[0].snippet, 'Build things & ship');
  assert.equal(jobs[0].workplaceType, '');
  assert.equal(jobs[0].relocates, false);
});

test('keka: fetchKeka passes redirect:manual on the shell and redirect:error on the feed', async () => {
  const opts = [];
  await fetchKeka(`${ORIGIN}/careers`, {
    fetchImpl: async (url, o) => {
      opts.push(o);
      if (url === `${ORIGIN}/careers`) return { ok: true, status: 200, text: async () => SHELL };
      return { ok: true, status: 200, json: async () => [] };
    },
    company: ENTRY,
  });
  assert.equal(opts[0]?.redirect, 'manual', 'the shell redirect is surfaced, never followed');
  assert.equal(opts[1]?.redirect, 'error', 'the feed refuses redirects');
});

test('keka: a 302 from the careers page (unknown tenant) is a named missing tenant, and the feed is not requested', async () => {
  let feedCalls = 0;
  let err = null;
  try {
    await fetchKeka('https://nosuch.keka.com/careers', {
      fetchImpl: async () => {
        feedCalls += 1;
        return {
          ok: false,
          status: 302,
          headers: { get: (n) => (String(n).toLowerCase() === 'location' ? '/careers/Content/TenantNotFound.html' : null) },
          text: async () => '',
        };
      },
      company: { name: 'Acme', careers_url: 'https://nosuch.keka.com/careers' },
    });
  } catch (e) { err = e; }
  assert.ok(err, 'the fetch must throw');
  assert.match(err.message, /no such tenant/);
  assert.match(err.message, /TenantNotFound/);
  assert.equal(err.status, 404, 'the named error carries status 404');
  assert.equal(feedCalls, 1, 'only the shell request was made');
});

test('keka: a shell without the identifier is a scraper break, thrown before the feed', async () => {
  let feedCalls = 0;
  await assert.rejects(
    () => fetchKeka(`${ORIGIN}/careers`, {
      fetchImpl: async (url) => {
        if (url !== `${ORIGIN}/careers`) { feedCalls += 1; return { ok: true, status: 200, json: async () => [] }; }
        return { ok: true, status: 200, text: async () => '<html><body>Careers</body></html>' };
      },
      company: ENTRY,
    }),
    /missing the embedjobs identifier/,
  );
  assert.equal(feedCalls, 0, 'the feed must not be requested without an identifier');
});

test('keka: an empty feed is [] and a broken envelope throws (never a silent empty board)', async () => {
  const impl = (body) => async (url) => {
    if (url === `${ORIGIN}/careers`) return { ok: true, status: 200, text: async () => SHELL };
    return { ok: true, status: 200, json: async () => body };
  };
  const empty = await fetchKeka(`${ORIGIN}/careers`, { fetchImpl: impl([]), company: ENTRY });
  assert.deepEqual(empty, []);
  await assert.rejects(
    () => fetchKeka(`${ORIGIN}/careers`, { fetchImpl: impl({ message: 'maintenance' }), company: ENTRY }),
    /unexpected response/,
  );
});

test('keka: a transient 503 on the feed is retried through the shared helper', async () => {
  let n = 0;
  const jobs = await fetchKeka(`${ORIGIN}/careers`, {
    fetchImpl: async (url) => {
      if (url === `${ORIGIN}/careers`) return { ok: true, status: 200, text: async () => SHELL };
      n += 1;
      if (n === 1) return { ok: false, status: 503, headers: { get: () => null }, text: async () => '' };
      return { ok: true, status: 200, json: async () => [row(1)] };
    },
    company: ENTRY,
  });
  assert.equal(n, 2, 'one retry');
  assert.equal(jobs.length, 1);
});

test('keka: fetchKeka fails loud when the signal is already aborted (no empty board)', async () => {
  const controller = new AbortController();
  controller.abort();
  let touched = 0;
  await assert.rejects(
    () => fetchKeka(`${ORIGIN}/careers`, { fetchImpl: async () => { touched += 1; return { ok: true, text: async () => '' }; }, signal: controller.signal, company: ENTRY }),
    /abort/i,
  );
  assert.equal(touched, 0);
});

test('keka: fetchKeka propagates a non-redirect transport failure unwrapped', async () => {
  class FakeSentinel extends Error {}
  await assert.rejects(
    () => fetchKeka(`${ORIGIN}/careers`, { fetchImpl: async () => { throw new FakeSentinel('boom'); }, company: ENTRY }),
    FakeSentinel,
  );
});
