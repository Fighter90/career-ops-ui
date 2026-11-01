// tests/sources-bulldogjob.test.mjs — Bulldogjob source contract (parent #6253).
// CI-isolated: no network — the page fetch is injected via fetchImpl; sleep via
// the opts.sleep seam.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchBulldogjob,
  parseListingUrl,
  buildSearchPath,
  pageUrl,
  extractNextData,
  parseBulldogjobPage,
  resolveMaxPages,
  meta,
} from '../server/lib/sources/bulldogjob.mjs';
import { bulldogjobAdapter } from '../server/lib/portals/adapters/bulldogjob.mjs';

const LIST = 'https://bulldogjob.pl/companies/jobs/s/role,devops';
/** Wrap a row list in the __NEXT_DATA__ listing-page shape. */
const page = (jobs, totalCount = jobs?.length ?? 0) => {
  const data = { props: { pageProps: { jobs, totalCount } } };
  return `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></html>`;
};
const bjob = (id, position, extra = {}) => ({
  id: String(id),
  position,
  city: 'Kraków',
  remote: false,
  company: { name: 'BigCo' },
  ...extra,
});
const NO_SLEEP = async () => {};
const ok = (html) => ({ ok: true, status: 200, text: async () => html });
const httpErr = (status) => ({ ok: false, status, text: async () => '' });

test('meta + adapter: bulldogjob / Bulldogjob / en; listing URLs on the pinned hosts detect', () => {
  assert.deepEqual(meta, { value: 'bulldogjob', label: 'Bulldogjob', region: 'en' });
  assert.equal(bulldogjobAdapter.matches({ provider: 'bulldogjob' }), true);
  assert.equal(bulldogjobAdapter.matches({ careers_url: `${LIST}/city,Remote` }), true);
  assert.equal(bulldogjobAdapter.matches({ api: 'https://www.bulldogjob.pl/companies/jobs' }), true);
  assert.equal(bulldogjobAdapter.matches({ careers_url: 'https://bulldogjob.pl/auth/login' }), false);
  assert.equal(bulldogjobAdapter.matches({ careers_url: 'http://bulldogjob.pl/companies/jobs' }), false);
  assert.equal(bulldogjobAdapter.matches({ careers_url: 'https://evil.example/companies/jobs' }), false);
  assert.equal(bulldogjobAdapter.matches({}), false);
  assert.equal(bulldogjobAdapter.buildEndpoint({ careers_url: `${LIST}/city,Remote` }), `${LIST}/city,Remote`);
  assert.equal(bulldogjobAdapter.buildEndpoint({ careers_url: 'https://bulldogjob.pl/auth' }), null);
});

test('parseListingUrl / buildSearchPath / pageUrl: https + hosts + path, page segment dropped, path rebuilt', () => {
  assert.ok(parseListingUrl(`${LIST}/page,3`)); // parses; the page segment is dropped by buildSearchPath
  const parsed = parseListingUrl(`${LIST}/page,3`);
  assert.deepEqual(buildSearchPath(parsed), '/companies/jobs/s/role,devops');
  assert.equal(pageUrl('/companies/jobs/s/role,devops', 2), 'https://bulldogjob.pl/companies/jobs/s/role,devops/page,2');
  assert.equal(buildSearchPath(parseListingUrl('https://bulldogjob.pl/companies/jobs')), '/companies/jobs/s');
  assert.equal(parseListingUrl('https://evil.pl/companies/jobs/s/x'), null);
  assert.equal(parseListingUrl('not a url'), null);
  assert.equal(parseListingUrl(''), null);
});

test('parseBulldogjobPage: keeps well-formed rows, drops malformed ones, reports raw count and total', () => {
  const html = page([
    bjob(1, 'DevOps Engineer', { remote: true, city: '', redirectTo: 'https://careers.exampleco.example/jobs/42' }),
    bjob(259689, 'Platform Engineer', { city: 'Kraków', remote: false, redirectTo: 'http://insecure.example/x' }),
    { id: 'n', position: '' }, // no title
    { id: '', position: 'No Id' }, // no id
    'garbage',
  ], 7);
  const parsed = parseBulldogjobPage(html);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rawCount, 5);
  assert.equal(parsed.total, 7);
  const [r1, r2] = parsed.rows;
  assert.equal(r1.id, 'bulldogjob-1');
  assert.equal(r1.url, 'https://careers.exampleco.example/jobs/42'); // https employer link wins
  assert.equal(r1.location, 'Remote');
  assert.equal(r1.isRemote, true);
  assert.equal(r2.url, 'https://bulldogjob.pl/companies/jobs/259689'); // id encoded on the pinned host
  assert.equal(r2.location, 'Kraków');
  assert.equal(r2.company, 'BigCo');
  assert.equal(r1.date, ''); // the listing carries no date
  assert.equal(r1.source, 'bulldogjob');
});

test('parseBulldogjobPage: a well-formed page with no postings is []; a broken shape throws', () => {
  const empty = parseBulldogjobPage(page([], 0));
  assert.deepEqual(empty.rows, []);
  assert.equal(empty.rawCount, 0);
  assert.throws(() => parseBulldogjobPage('<html><body>challenge wall</body></html>'), /__NEXT_DATA__/);
  assert.throws(() => parseBulldogjobPage(page(undefined)), /props\.pageProps\.jobs/);
  assert.equal(extractNextData('no block'), null);
});

test('fetchBulldogjob: walks every page of a multi-page board; /page,N on the configured path; redirect:error', async () => {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, opts });
    const n = Number(url.match(/page,(\d+)/)[1]);
    const count = Math.min(50, 120 - (n - 1) * 50); // a 120-posting board: 50/50/20
    return ok(page(Array.from({ length: count }, (_, i) => bjob((n - 1) * 50 + i, `Role ${n}-${i}`)), 120));
  };
  const jobs = await fetchBulldogjob(`${LIST}/page,9`, { fetchImpl: impl, company: { name: 'Bulldogjob' }, sleep: NO_SLEEP });
  assert.equal(jobs.length, 120);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((c) => /\/page,[123]$/.test(c.url)), calls.map((c) => c.url).join(' ')); // copied page segment dropped
  assert.ok(calls.every((c) => c.opts.redirect === 'error'));
  assert.equal(jobs.bulldogjobTruncated, undefined); // a complete board is not tagged
  assert.ok(jobs[0].url !== jobs[1].url); // dedup by url keeps all 120
});

test('fetchBulldogjob: stops when the reported total is reached, and on a short page', async () => {
  // total reached: 60 of 50 → one page suffices
  const a = [];
  const implA = async (url) => { a.push(url); return ok(page(Array.from({ length: 50 }, (_, i) => bjob(i, `R${i}`)), 50)); };
  const jobsA = await fetchBulldogjob(LIST, { fetchImpl: implA, company: {}, sleep: NO_SLEEP });
  assert.equal(jobsA.length, 50);
  assert.equal(a.length, 1);

  // short page: 60 over two pages, no truncation tag
  let call = 0;
  const implB = async () => {
    call += 1;
    return ok(page(Array.from({ length: call === 1 ? 50 : 10 }, (_, i) => bjob(`${call}-${i}`, `R${call}-${i}`)), 60));
  };
  const jobsB = await fetchBulldogjob(LIST, { fetchImpl: implB, company: {}, sleep: NO_SLEEP });
  assert.equal(jobsB.length, 60);
  assert.equal(jobsB.bulldogjobTruncated, undefined);
});

test('fetchBulldogjob: the page ceiling truncates a full board — warns and tags it; resolveMaxPages caps', async () => {
  const lines = [];
  const orig = console.error;
  console.error = (...a) => { lines.push(a.join(' ')); };
  try {
  const impl = async (url) => {
    const n = Number(url.match(/page,(\d+)/)[1]);
    return ok(page(Array.from({ length: 50 }, (_, i) => bjob((n - 1) * 50 + i, `R${n}-${i}`)), 100000));
  };
  const jobs = await fetchBulldogjob(LIST, { fetchImpl: impl, company: { name: 'Bulldogjob', max_pages: 2 }, sleep: NO_SLEEP });
    assert.equal(jobs.length, 100);
    assert.equal(jobs.bulldogjobTruncated, true);
    assert.ok(lines.some((l) => l.includes('raise max_pages')), lines.join('\n'));
  } finally { console.error = orig; }
  assert.equal(resolveMaxPages({}), 25);
  assert.equal(resolveMaxPages({ max_pages: 3 }), 3);
  assert.equal(resolveMaxPages({ max_pages: 9999 }), 100);
  assert.equal(resolveMaxPages({ max_pages: -1 }), 25);
});

test('fetchBulldogjob: a failed first page throws; a failed later page keeps page 1 and tags the board', async () => {
  await assert.rejects(() => fetchBulldogjob(LIST, { fetchImpl: async () => httpErr(404), company: {} }), /HTTP 404/);

  const lines = [];
  const orig = console.error;
  console.error = (...a) => { lines.push(a.join(' ')); };
  try {
    let calls = 0;
    const impl = async (url) => {
      calls += 1;
      if (url.includes('/page,2')) return httpErr(500); // every attempt of page 2 fails
      return ok(page(Array.from({ length: 50 }, (_, i) => bjob(i, `R${i}`)), 100000));
    };
    const jobs = await fetchBulldogjob(LIST, { fetchImpl: impl, company: { name: 'Bulldogjob' }, sleep: NO_SLEEP });
    assert.equal(jobs.length, 50);
    assert.equal(jobs.bulldogjobTruncated, true);
    assert.ok(lines.some((l) => l.includes('stopped at page 2')), lines.join('\n'));
  } finally { console.error = orig; }
});

test('fetchBulldogjob: rejects a non-listing endpoint before any request', async () => {
  let fetched = false;
  await assert.rejects(
    () => fetchBulldogjob('https://bulldogjob.pl/auth/login', { fetchImpl: async () => { fetched = true; return ok(page([])); } }),
    /careers_url must be/,
  );
  assert.equal(fetched, false);
});
