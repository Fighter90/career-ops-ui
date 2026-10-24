/**
 * Google source (v1.253.0 parent parity) — CI-isolated suite.
 * Ported from the parent's google provider behavior: the card parse (anchor
 * ids/slugs, h3 → aria-label → slug title fallbacks, employer | locations
 * line with "+N more" dropped), html-entity decoding through the shared
 * helper, the query/location config defaults, the URLSearchParams query URL
 * (sort_by=date), the id-dedup across queries with the card employer winning
 * over the entry name, recall-first per-query failure (one failed query is
 * skipped, only an all-queries failure throws), and the host assert. No
 * network — parseResultsPage is pure; fetchGoogle runs on a fake fetchImpl.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseResultsPage,
  parseGoogleConfig,
  buildQueryUrl,
  assertGoogleUrl,
  fetchGoogle,
  BASE,
  DEFAULT_QUERIES,
  DEFAULT_LOCATION,
  ALLOWED_HOST,
} from '../server/lib/sources/google.mjs';
import { googleAdapter } from '../server/lib/portals/adapters/google.mjs';

/** One results card: markup (h3 + employer line) followed by its closing anchor. */
const card = ({ id, slug, title, aria, employerLine }) => {
  const href = `jobs/results/${id}-${slug}`;
  const ariaAttr = aria === undefined ? ` aria-label="Learn more about ${title}"` : aria ? ` aria-label="Learn more about ${aria}"` : '';
  return `${employerLine ? `<p class="l103df">${employerLine}</p>` : ''}${
    title ? `<h3>${title}</h3>` : ''
  }<a href="${href}"${ariaAttr}>View</a>`;
};
const page = (cards, extra = '') => `<!doctype html><html><body>${cards.join('')}${extra}</body></html>`;

test('google: parseResultsPage — h3 title, employer line, "+N more" is not a place', () => {
  const cards = parseResultsPage(page([
    card({
      id: '1234567', slug: 'business-strategy-google',
      title: 'Business Strategy Intern, Summer 2026',
      employerLine: 'Google | Mountain View, CA, USA; +2 more',
    }),
  ]));
  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, '1234567');
  assert.equal(cards[0].slug, 'business-strategy-google');
  assert.equal(cards[0].title, 'Business Strategy Intern, Summer 2026');
  assert.equal(cards[0].employer, 'Google');
  assert.deepEqual(cards[0].locations, ['Mountain View, CA, USA']);
});

test('google: parseResultsPage — title falls back to aria-label, then the slug', () => {
  const [ariaOnly] = parseResultsPage(page([
    card({ id: '1', slug: 'data-ops', title: '', aria: 'Data Ops Manager', employerLine: '' }),
  ]));
  assert.equal(ariaOnly.title, 'Data Ops Manager');
  const [slugOnly] = parseResultsPage(page([
    card({ id: '2', slug: 'youtube-partners-strategy', title: '', aria: '', employerLine: '' }),
  ]));
  assert.equal(slugOnly.title, 'Youtube Partners Strategy');
});

test('google: parseResultsPage — a card without the employer line keeps the entry as company', () => {
  const [noLine] = parseResultsPage(page([
    card({ id: '3', slug: 'some-role', title: 'Some Role' }),
  ]));
  assert.equal(noLine.employer, '');
  assert.deepEqual(noLine.locations, []);
});

test('google: parseResultsPage — card text decodes through the shared html-to-text helper', () => {
  const [decoded] = parseResultsPage(page([
    card({
      id: '4', slug: 'comms', title: 'Comms &amp; Public Affairs',
      employerLine: 'YouTube &amp; Creators | London, UK; Manchester, UK',
    }),
  ]));
  assert.equal(decoded.title, 'Comms & Public Affairs');
  assert.equal(decoded.employer, 'YouTube & Creators');
  assert.deepEqual(decoded.locations, ['London, UK', 'Manchester, UK']);
});

test('google: parseResultsPage — an empty page parses to no cards', () => {
  assert.deepEqual(parseResultsPage('<html><body>nothing here</body></html>'), []);
});

test('google: parseGoogleConfig — defaults when the block is missing, junk queries dropped', () => {
  assert.deepEqual(parseGoogleConfig({}), { queries: [...DEFAULT_QUERIES], location: DEFAULT_LOCATION });
  assert.deepEqual(parseGoogleConfig(null), { queries: [...DEFAULT_QUERIES], location: DEFAULT_LOCATION });
  assert.deepEqual(
    parseGoogleConfig({ google: { queries: ['  tax law ', '', 42, 'policy'], location: ' India ' } }),
    { queries: ['tax law', 'policy'], location: 'India' },
  );
  assert.deepEqual(
    parseGoogleConfig({ google: { queries: [] } }),
    { queries: [...DEFAULT_QUERIES], location: DEFAULT_LOCATION },
    'an empty query list falls back to the defaults');
});

test('google: buildQueryUrl — URLSearchParams encoding, sort_by=date, fixed BASE', () => {
  assert.equal(
    buildQueryUrl('business strategy', 'United States'),
    `${BASE}?q=business+strategy&location=United+States&sort_by=date`);
  // URLSearchParams never throws on a malformed string.
  assert.ok(buildQueryUrl('a&b=c?d', 'X%Y').startsWith(`${BASE}?`));
});

test('google: assertGoogleUrl — HTTPS on the results host only, default port only', () => {
  assert.equal(assertGoogleUrl(BASE), BASE);
  assert.throws(() => assertGoogleUrl('http://www.google.com/about/careers'), /must use HTTPS/);
  assert.throws(() => assertGoogleUrl('https://www.google.com:8443/about/careers'), /non-default port/);
  assert.throws(() => assertGoogleUrl('https://evil.example/jobs/results/'), /untrusted hostname/);
  assert.throws(() => assertGoogleUrl('not a url'), /invalid URL/);
  assert.equal(ALLOWED_HOST, 'www.google.com');
});

test('google: fetchGoogle — dedupes by id across queries; the card employer wins over the entry', async () => {
  const shared = card({
    id: '42', slug: 'shared-role', title: 'Shared Role',
    employerLine: 'DeepMind | London, UK',
  });
  const googleOnly = card({ id: '7', slug: 'g-role', title: 'Google Only Role', employerLine: '' });
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return {
      ok: true, status: 200,
      text: async () => (calls.length === 1 ? page([shared, googleOnly]) : page([shared])),
    };
  };
  const jobs = await fetchGoogle(BASE, {
    fetchImpl,
    company: { name: 'Google', provider: 'google', google: { queries: ['strategy', 'ops'] } },
  });
  assert.equal(calls.length, 2, 'one request per query');
  assert.ok(calls[0].includes('q=strategy'));
  assert.ok(calls[1].includes('q=ops'));
  assert.equal(jobs.length, 2, 'the shared posting appears once');
  assert.equal(jobs[0].company, 'DeepMind', 'the card employer is the real company');
  assert.equal(jobs[1].company, 'Google', 'no employer line falls back to the entry name');
  assert.equal(jobs[0].url, `${BASE}42-shared-role`);
  assert.equal(jobs[0].source, 'google');
  assert.equal(jobs[0].date, '', 'the results page carries no posting date');
});

test('google: fetchGoogle — one failed query is tolerated (recall-first), all failing throws', async () => {
  let calls = 0;
  const mixed = async () => {
    calls += 1;
    if (calls === 1) throw new Error('HTTP 503');
    return { ok: true, status: 200, text: async () => page([card({ id: '9', slug: 'ok', title: 'Kept' })]) };
  };
  const kept = await fetchGoogle(BASE, {
    fetchImpl: mixed,
    company: { name: 'Google', google: { queries: ['bad', 'good'] } },
  });
  assert.equal(kept.length, 1, 'the surviving query still contributes');

  const always = async () => ({ ok: false, status: 500, text: async () => '' });
  await assert.rejects(
    () => fetchGoogle(BASE, { fetchImpl: always, company: { name: 'Google', google: { queries: ['a', 'b'] } } }),
    /all 2 query request\(s\) failed/);
});

test('google: fetchGoogle — every query answering 200 with zero cards throws (markup change)', async () => {
  const fetchImpl = async () => ({
    ok: true, status: 200,
    text: async () => '<html><body><div>consent wall</div></body></html>',
  });
  await assert.rejects(
    () => fetchGoogle(BASE, { fetchImpl, company: { name: 'Google', google: { queries: ['a', 'b'] } } }),
    /answered 200 but parsed 0 postings/,
    'a silent empty board on every query is a markup change, not an outage-free board');
});

test('google: fetchGoogle — an explicit no-results marker keeps the quiet empty board', async () => {
  const fetchImpl = async () => ({
    ok: true, status: 200,
    text: async () => '<html><body><p>0 results</p></body></html>',
  });
  const jobs = await fetchGoogle(BASE, { fetchImpl, company: { name: 'Google', google: { queries: ['a'] } } });
  assert.deepEqual(jobs, [], 'a page that says it has no results is a healthy empty board');
});

test('google: fetchGoogle — a pre-aborted signal throws before any request, never returns []', async () => {
  const fetchImpl = async () => { throw new Error('must not be called'); };
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(
    () => fetchGoogle(BASE, { fetchImpl, signal: ac.signal, company: { name: 'Google' } }),
    (err) => err?.name === 'AbortError');
});

test('google: fetchGoogle — an off-host endpoint rejects before any request', async () => {
  const fetchImpl = async () => { throw new Error('must not be called'); };
  await assert.rejects(
    () => fetchGoogle('https://evil.example/jobs/results/', { fetchImpl, company: { name: 'Google' } }),
    /untrusted hostname/);
});

test('google: fetchGoogle — normalized rows carry the web-ui shape (remote title flags)', async () => {
  const fetchImpl = async () => ({
    ok: true, status: 200,
    text: async () => page([card({
      id: '5', slug: 'remote-analyst', title: 'Remote Financial Analyst',
      employerLine: 'Google | Remote, USA',
    })]),
  });
  const [job] = await fetchGoogle(BASE, { fetchImpl, company: { name: 'Google', provider: 'google' } });
  assert.equal(job.id, 'google-5');
  assert.equal(job.isRemote, true);
  assert.equal(job.location, 'Remote, USA');
  assert.equal(job.salary, '');
  assert.equal(job.workplaceType, '');
});

test('google adapter: provider- or `google:`-selected; endpoint is the first query URL', () => {
  assert.equal(googleAdapter.matches({ provider: 'google' }), true);
  assert.equal(googleAdapter.matches({ google: { queries: ['x'] } }), true);
  assert.equal(googleAdapter.matches({}), false);
  assert.equal(googleAdapter.matches({ provider: 'kalibrr' }), false);
  const endpoint = googleAdapter.buildEndpoint({ google: { queries: ['tax law'], location: 'India' } });
  assert.equal(endpoint, `${BASE}?q=tax+law&location=India&sort_by=date`);
  assert.equal(googleAdapter.buildEndpoint({}), `${BASE}?q=${encodeURIComponent(DEFAULT_QUERIES[0]).replace(/%20/g, '+')}&location=${DEFAULT_LOCATION.replace(/ /g, '+')}&sort_by=date`);
  assert.equal(googleAdapter.id, 'google');
  assert.ok(ALLOWED_HOST === 'www.google.com');
});
