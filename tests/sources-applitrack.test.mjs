/**
 * AppliTrack source + adapter — CI-isolated tests (fake fetchImpl, no network,
 * no parent-project dependency, no port binding, nothing reads CAREER_OPS_ROOT).
 *
 * Parity with parent career-ops `tests/providers/applitrack.test.mjs`. The
 * fixture is built in the real Output.asp shape (HTML inside JS string
 * literals, so quotes arrive backslash-escaped).
 *
 * URL assertions use strict equality, never `String.includes` or an unanchored
 * regex over a URL.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  resolveApplitrackSlug,
  buildBaseUrl,
  buildOutputUrl,
  assertApplitrackUrl,
  parseApplitrackDate,
  parseApplitrackOutput,
  fetchApplitrack,
} from '../server/lib/sources/applitrack.mjs';
import { applitrackAdapter } from '../server/lib/portals/adapters/applitrack.mjs';
import { BROWSER_LIKE_USER_AGENT } from '../server/lib/http-json.mjs';

const OUT = 'https://www.applitrack.com/exampledistrict/onlineapp/jobpostings/Output.asp?all=1';
const BASE = 'https://www.applitrack.com/exampledistrict/onlineapp';

const posting = (id, title, type, posted, site) =>
  `<table class=\\'title\\' style=\\'padding: 0px;\\'><tr><td id=\\'wrapword\\' style=\\'width: 950px;\\'>${title}</td>`
  + `<td><span class=\\'title2\\'> JobID: ${id} <input type=\\'button\\' value=\\' Apply \\' /></span></td></tr></table>`
  + `<div><li><span class=\\'label\\'>Position Type:</span><br/>&nbsp;&nbsp;<span class=\\'normal\\'>${type}</span><br/><br/></li>`
  + `<li><span class="label" >Date Posted:</span><br/>&nbsp;&nbsp;<span class="normal">${posted}</span><br/><br/></li>`
  + `<li><span class="label" >Location:</span><br/>&nbsp;&nbsp;<span class="normal">${site}</span><br/><br/></li></div>`;
const PRELUDE = 'function applyFor(posJobCode){ return true }\nvar VacanciesAreOnThisPage = true\n';
const BODY = PRELUDE
  + posting(101, 'Math Teacher', 'Certificated', '9/8/2026', 'Example High School, Exampleville, WA')
  + posting(102, 'Custodian &amp; Grounds', 'Classified', '7/2/2026', 'District')
  + posting(103, 'Coach � Head Baseball', 'Athletics', '13/45/2026', 'Example High School')
  + posting(104, '', 'Classified', '1/1/2026', 'District') // no title → dropped
  + posting(101, 'Math Teacher (duplicate id)', 'Certificated', '9/8/2026', 'District'); // repeated id → dropped

function res(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => body, headers: { get: () => null } };
}

/** Fake transport that records every call. */
function router(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init, calls.length);
  };
  return { impl, calls };
}

const noSleep = { sleep: async () => {}, retryDelayMs: 0 };
const ENTRY = {
  name: 'Acme',
  careers_url: 'https://www.applitrack.com/exampledistrict/onlineapp/default.aspx',
  default_location: 'Exampleville, WA',
};

// ── meta + adapter shape ──────────────────────────────────────────────

test('meta is the EN applitrack source', () => {
  assert.deepEqual(meta, { value: 'applitrack', label: 'AppliTrack', region: 'en' });
});

test('adapter shape: id, label, fetch', () => {
  assert.equal(applitrackAdapter.id, 'applitrack');
  assert.equal(applitrackAdapter.label, 'AppliTrack');
  assert.equal(applitrackAdapter.fetch, fetchApplitrack);
});

// ── adapter recognition (parent detect()) ────────────────────────────

for (const careers_url of [
  'https://www.applitrack.com/exampledistrict/onlineapp/default.aspx?all=1',
  'https://www.applitrack.com/ExampleDistrict/onlineapp/jobpostings/view.asp',
  'https://applitrack.com/exampledistrict/onlineapp/',
]) {
  test(`adapter resolves ${careers_url} → Output.asp`, () => {
    const entry = { name: 'Acme', careers_url };
    assert.equal(applitrackAdapter.matches(entry), true);
    assert.equal(applitrackAdapter.buildEndpoint(entry), OUT);
  });
}

const NEGATIVES = {
  'a non-applitrack host': { careers_url: 'https://example.com/exampledistrict/onlineapp/' },
  'a path-spoofed URL': { careers_url: 'https://evil.example/www.applitrack.com/exampledistrict/' },
  'a query-spoofed URL': { careers_url: 'https://evil.com/?x=applitrack.com' },
  'a lookalike host': { careers_url: 'https://www.applitrack.com.evil.example/exampledistrict/' },
  'a suffix lookalike host': { careers_url: 'https://applitrack.com.evil.com/exampledistrict/' },
  'a prefix lookalike host': { careers_url: 'https://evilapplitrack.com/exampledistrict/' },
  'a subdomain other than www': { careers_url: 'https://evil.applitrack.com/exampledistrict/' },
  'http': { careers_url: 'http://www.applitrack.com/exampledistrict/onlineapp/' },
  'no slug': { careers_url: 'https://www.applitrack.com/' },
  'a slug with illegal characters': { careers_url: 'https://www.applitrack.com/a%20b/onlineapp/' },
  'a malformed URL': { careers_url: 'not a url' },
  'null careers_url': { careers_url: null },
  'a non-string careers_url': { careers_url: 7 },
  'no careers_url': {},
};
for (const [label, extra] of Object.entries(NEGATIVES)) {
  test(`adapter refuses ${label}`, () => {
    const entry = { name: 'X', ...extra };
    assert.equal(resolveApplitrackSlug(entry.careers_url), null);
    assert.equal(applitrackAdapter.matches(entry), false);
    assert.equal(applitrackAdapter.buildEndpoint(entry), null);
  });
}

test('explicit provider matches but the endpoint stays host-pinned', () => {
  const bad = { name: 'X', provider: 'applitrack', careers_url: 'https://evil.example/exampledistrict/' };
  assert.equal(applitrackAdapter.matches(bad), true);
  assert.equal(applitrackAdapter.buildEndpoint(bad), null);
  assert.equal(applitrackAdapter.matches(null), false);
  assert.equal(applitrackAdapter.matches(undefined), false);
  assert.equal(applitrackAdapter.buildEndpoint(null), null);
  assert.equal(applitrackAdapter.matches({ name: 'Other', provider: 'eploy', careers_url: 'https://example.com' }), false);
});

test('URL builders are fixed to www.applitrack.com', () => {
  assert.equal(buildBaseUrl('exampledistrict'), BASE);
  assert.equal(buildOutputUrl('exampledistrict'), OUT);
});

test('assertApplitrackUrl accepts only the exact Output.asp endpoint', () => {
  assert.equal(assertApplitrackUrl(OUT), 'exampledistrict');
  for (const bad of [
    'not a url',
    'http://www.applitrack.com/exampledistrict/onlineapp/jobpostings/Output.asp?all=1',
    'https://applitrack.com.evil.com/exampledistrict/onlineapp/jobpostings/Output.asp?all=1',
    'https://evil.com/exampledistrict/onlineapp/jobpostings/Output.asp?all=1&x=www.applitrack.com',
    'https://user:pw@www.applitrack.com/exampledistrict/onlineapp/jobpostings/Output.asp?all=1',
    'https://www.applitrack.com:8443/exampledistrict/onlineapp/jobpostings/Output.asp?all=1',
    'https://www.applitrack.com/exampledistrict/onlineapp/default.aspx',
    'https://www.applitrack.com/a%2Fb/onlineapp/jobpostings/Output.asp?all=1',
    'https://www.applitrack.com/exampledistrict/onlineapp/jobpostings/Output.asp?all=1&x=1',
  ]) {
    assert.throws(() => assertApplitrackUrl(bad), /applitrack:/, bad);
  }
});

// ── parser ────────────────────────────────────────────────────────────

test('parser keeps rows with an id + title, drops blank-title and repeated-id rows', () => {
  const jobs = parseApplitrackOutput(BODY, 'Acme', BASE, 'Exampleville, WA');
  assert.equal(jobs.length, 3);
  assert.deepEqual(jobs.map((j) => j.id), [
    'applitrack-exampledistrict-101',
    'applitrack-exampledistrict-102',
    'applitrack-exampledistrict-103',
  ]);
});

test('parser emits the 12-field web-ui job object with the detail URL and company', () => {
  const [job] = parseApplitrackOutput(BODY, 'Acme', BASE, 'Exampleville, WA');
  assert.deepEqual(job, {
    id: 'applitrack-exampledistrict-101',
    title: 'Math Teacher',
    company: 'Acme',
    url: `${BASE}/default.aspx?AppliTrackJobId=101&AppliTrackLayoutMode=detail&AppliTrackViewPosting=1`,
    salary: '',
    location: 'Example High School, Exampleville, WA',
    isRemote: false,
    workplaceType: '',
    relocates: false,
    date: '2026-09-08',
    snippet: 'Certificated',
    source: 'applitrack',
  });
});

test('parser decodes entities in the title (&amp; → &)', () => {
  const jobs = parseApplitrackOutput(BODY, 'Acme', BASE, 'Exampleville, WA');
  assert.equal(jobs[1].title, 'Custodian & Grounds');
});

test('parser strips U+FFFD (a Windows-1252 byte decoded as UTF-8)', () => {
  const jobs = parseApplitrackOutput(BODY, 'Acme', BASE, 'Exampleville, WA');
  assert.equal(jobs[2].title, 'Coach Head Baseball');
});

test('default_location: kept as-is when the site names the city, appended otherwise', () => {
  const jobs = parseApplitrackOutput(BODY, 'Acme', BASE, 'Exampleville, WA');
  assert.equal(jobs[0].location, 'Example High School, Exampleville, WA');
  assert.equal(jobs[1].location, 'District - Exampleville, WA');
  const noDefault = parseApplitrackOutput(BODY, 'Acme', BASE);
  assert.equal(noDefault[1].location, 'District');
});

test('Date Posted m/d/yyyy → YYYY-MM-DD; an impossible date → empty (NaN-safe)', () => {
  const jobs = parseApplitrackOutput(BODY, 'Acme', BASE, 'Exampleville, WA');
  assert.equal(jobs[0].date, '2026-09-08');
  assert.equal(jobs[1].date, '2026-07-02');
  assert.equal(jobs[2].date, '');
  assert.equal(parseApplitrackDate('9/8/2026'), Date.UTC(2026, 8, 8));
  assert.equal(parseApplitrackDate('2/30/2026'), undefined);
  assert.equal(parseApplitrackDate('13/45/2026'), undefined);
  assert.equal(parseApplitrackDate('2026-09-08'), undefined);
  assert.equal(parseApplitrackDate(undefined), undefined);
});

test('a remote site marks the row remote', () => {
  const body = PRELUDE + posting(7, 'Online Tutor', 'Certificated', '1/2/2026', 'Remote - Virtual Academy');
  const [job] = parseApplitrackOutput(body, 'Acme', BASE);
  assert.equal(job.isRemote, true);
  assert.equal(job.workplaceType, 'Remote');
});

test('parser also accepts unescaped quotes', () => {
  const plain = parseApplitrackOutput(BODY.replace(/\\'/g, "'"), 'Acme', BASE, 'Exampleville, WA');
  assert.equal(plain.length, 3);
});

for (const empty of ['', '   \n', null, undefined]) {
  test(`parser ${JSON.stringify(empty)} → []`, () => {
    assert.deepEqual(parseApplitrackOutput(empty, 'X', BASE), []);
  });
}

test('valid script with no postings → [] (an empty board)', () => {
  assert.deepEqual(parseApplitrackOutput(PRELUDE, 'X', BASE), []);
});

test('a body that is not an Output.asp script throws a descriptive error', () => {
  assert.throws(
    () => parseApplitrackOutput('<html><body>Sign in to continue</body></html>', 'X', BASE),
    /not an AppliTrack/i,
  );
});

// ── fetch ─────────────────────────────────────────────────────────────

test('fetch makes one Output.asp request with redirect:error and returns the parsed jobs', async () => {
  const { impl, calls } = router(() => res(BODY));
  const endpoint = applitrackAdapter.buildEndpoint(ENTRY);
  const jobs = await fetchApplitrack(endpoint, { fetchImpl: impl, company: ENTRY, ...noSleep });
  assert.equal(jobs.length, 3);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, OUT);
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.headers['User-Agent'], BROWSER_LIKE_USER_AGENT);
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[1].location, 'District - Exampleville, WA');
});

test('fetch refuses an unsafe endpoint before any request', async () => {
  for (const bad of [
    'https://evil.example/exampledistrict/onlineapp/jobpostings/Output.asp?all=1',
    'https://www.applitrack.com.evil.com/exampledistrict/onlineapp/jobpostings/Output.asp?all=1',
    'http://www.applitrack.com/exampledistrict/onlineapp/jobpostings/Output.asp?all=1',
  ]) {
    const { impl, calls } = router(() => res(BODY));
    await assert.rejects(fetchApplitrack(bad, { fetchImpl: impl, ...noSleep }), /applitrack:/);
    assert.equal(calls.length, 0, bad);
  }
});

test('fetch retries a 503 and recovers', async () => {
  const { impl, calls } = router((_url, _init, n) => (n < 2 ? res('busy', 503) : res(BODY)));
  const jobs = await fetchApplitrack(OUT, { fetchImpl: impl, company: ENTRY, ...noSleep });
  assert.equal(jobs.length, 3);
  assert.equal(calls.length, 2);
});

test('fetch does not retry a 404 and propagates it', async () => {
  const { impl, calls } = router(() => res('gone', 404));
  await assert.rejects(fetchApplitrack(OUT, { fetchImpl: impl, company: ENTRY, ...noSleep }), (err) => err.status === 404);
  assert.equal(calls.length, 1);
});

test('fetch gives up after the retry budget on a persistent 5xx', async () => {
  const { impl, calls } = router(() => res('down', 500));
  await assert.rejects(fetchApplitrack(OUT, { fetchImpl: impl, ...noSleep }), (err) => err.status === 500);
  assert.equal(calls.length, 3);
});

test('fetch does not retry a refused redirect', async () => {
  const { impl, calls } = router(() => {
    throw new TypeError('fetch failed', { cause: new Error('unexpected redirect') });
  });
  await assert.rejects(fetchApplitrack(OUT, { fetchImpl: impl, ...noSleep }), TypeError);
  assert.equal(calls.length, 1);
});

test('fetch propagates a non-Output.asp 200 body as an error', async () => {
  const { impl } = router(() => res('<html>login</html>'));
  await assert.rejects(fetchApplitrack(OUT, { fetchImpl: impl, ...noSleep }), /not an AppliTrack/);
});
