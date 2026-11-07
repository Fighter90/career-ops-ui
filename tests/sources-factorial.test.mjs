/**
 * Factorial source (upstream #6394 port) — CI-isolated suite.
 * A Factorial ATS tenant board (`<tenant>.factorialhr.com`, `<tenant>.factorial.com`
 * and the other Factorial domains) server-renders the whole inventory in one
 * page, grouped by office (`data-target='job-filters.officeGroup'` +
 * `li.job-offer-item` cards). The parser keeps a card whose posting URL names
 * the same tenant on ANY Factorial domain (a board links to its home domain),
 * folds a posting listed under two offices into one row, and fails CLOSED
 * when the page links to postings but none could be parsed. No network —
 * parseFactorialBoard is pure; fetchFactorial runs on a fake fetchImpl.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  resolveFactorialOrigin,
  assertFactorialUrl,
  parseFactorialBoard,
  fetchFactorial,
} from '../server/lib/sources/factorial.mjs';
import { factorialAdapter } from '../server/lib/portals/adapters/factorial.mjs';

// ── fixtures ─────────────────────────────────────────────────────────────────

function card(url, { title = 'Account Executive', remote = 'false', locationKey = '' } = {}) {
  const attrs = [`data-job-postings-url='${url}'`, `data-is-remote='${remote}'`];
  if (locationKey) attrs.push(`data-location-key='city:${locationKey}'`);
  return `<li class='job-offer-item css-x' ${attrs.join(' ')}>`
    + `<div class="factorial__headingFontFamily">${title}</div></li>`;
}

function group(heading, cardsHtml) {
  return `<div data-target='job-filters.officeGroup'><h3>${heading}</h3><ul>${cardsHtml}</ul></div>`;
}

const ORIGIN = 'https://acme.factorial.com';

// ── registry + adapter contract ──────────────────────────────────────────────

test('factorial: meta — value, label, region en', () => {
  assert.deepEqual(meta, { value: 'factorial', label: 'Factorial', region: 'en' });
  assert.equal(factorialAdapter.id, 'factorial');
  assert.equal(factorialAdapter.label, 'Factorial');
});

test('factorial: adapter matches Factorial tenant hosts only; endpoint is the origin string', () => {
  assert.equal(factorialAdapter.matches({ name: 'Acme', careers_url: 'https://acme.factorialhr.com' }), true);
  assert.equal(factorialAdapter.matches({ name: 'Acme', api: 'https://acme.factorialhr.pt' }), true);
  assert.equal(factorialAdapter.matches({ name: 'Acme', provider: 'factorial', careers_url: 'https://example.com' }), true, 'explicit provider wins');
  assert.equal(factorialAdapter.matches({ name: 'X', careers_url: 'https://acme.factorialhr.com.evil.example' }), false, 'suffix-spoofed host');
  assert.equal(factorialAdapter.matches({ name: 'X', careers_url: 'https://evil-factorial.com' }), false, 'look-alike host');
  assert.equal(factorialAdapter.matches({ name: 'X', careers_url: 'http://acme.factorial.com' }), false, 'non-https');
  assert.equal(factorialAdapter.matches({ name: 'X', careers_url: 'https://www.factorial.com' }), false, 'the product www host is not a board');
  assert.equal(factorialAdapter.matches({ name: 'X', careers_url: 'https://app.factorial.com' }), false, 'the product app host is not a board');
  assert.equal(factorialAdapter.matches(null), false);
  assert.equal(factorialAdapter.matches('factorial.com'), false);
  const endpoint = factorialAdapter.buildEndpoint({ name: 'Acme', careers_url: 'https://acme.factorialhr.com' });
  assert.equal(typeof endpoint, 'string');
  assert.equal(endpoint, 'https://acme.factorial.com', '.factorialhr.com is read at <tenant>.factorial.com');
  assert.equal(factorialAdapter.buildEndpoint({ name: 'X', careers_url: 'https://example.com/x' }), null, 'off-host entry → no endpoint (fail-soft)');
});

// ── host resolution / pin ────────────────────────────────────────────────────

test('factorial: resolveFactorialOrigin accepts every Factorial domain family', () => {
  assert.equal(resolveFactorialOrigin('https://acme.factorialhr.pt/board'), 'https://acme.factorialhr.pt');
  assert.equal(resolveFactorialOrigin('https://acme.factorial.com'), 'https://acme.factorial.com');
  assert.equal(resolveFactorialOrigin('https://acme.factorialhr.co.uk/jobs'), 'https://acme.factorialhr.co.uk');
  assert.equal(resolveFactorialOrigin('  https://acme.factorial.mx  '), 'https://acme.factorial.mx', 'whitespace trimmed');
});

test('factorial: resolveFactorialOrigin rewrites .factorialhr.com to .factorial.com (it redirects)', () => {
  assert.equal(resolveFactorialOrigin('https://acme.factorialhr.com'), 'https://acme.factorial.com');
});

test('factorial: resolveFactorialOrigin rejects spoofed, product, non-HTTPS and malformed hosts', () => {
  const rejects = [
    ['suffix-spoofed', 'https://acme.factorialhr.com.evil.example'],
    ['look-alike', 'https://evil-factorial.com'],
    ['bare domain', 'https://factorial.com'],
    ['product www', 'https://www.factorial.com'],
    ['product api', 'https://api.factorialhr.com'],
    ['multi-label tenant', 'https://a.b.factorialhr.com'],
    ['http', 'http://acme.factorial.com'],
    ['malformed', 'not a url'],
  ];
  for (const [name, u] of rejects) {
    assert.equal(resolveFactorialOrigin(u), null, `${name} must be rejected`);
  }
  assert.equal(resolveFactorialOrigin(null), null);
  assert.equal(resolveFactorialOrigin(7), null);
  assert.equal(resolveFactorialOrigin(''), null);
});

test('factorial: resolveFactorialOrigin is case-insensitive and normalizes the origin to lowercase', () => {
  assert.equal(resolveFactorialOrigin('https://ACME.FactorialHR.com/'), 'https://acme.factorial.com');
});

test('factorial: assertFactorialUrl — https on a tenant host, default port only', () => {
  assert.equal(assertFactorialUrl('https://acme.factorial.com'), 'https://acme.factorial.com');
  assert.throws(() => assertFactorialUrl('http://acme.factorial.com'), /HTTPS/);
  assert.throws(() => assertFactorialUrl('https://evil.example'), /untrusted hostname/);
  assert.throws(() => assertFactorialUrl('https://acme.factorial.com:8443'), /port/);
  assert.throws(() => assertFactorialUrl('not a url'), /invalid URL/);
});

// ── parseFactorialBoard ──────────────────────────────────────────────────────

test('factorial: parse maps cards across office groups — titles, offices, remote flag, externalId', () => {
  const html = `<html><body>`
    + group('Barcelona', card('https://acme.factorial.com/job_posting/ae-barcelona-101'))
    + group('Madrid', card('https://acme.factorial.com/job_posting/eng-madrid-202', { title: 'Engineer', remote: 'true' }))
    + `</body></html>`;
  const jobs = parseFactorialBoard(html, ORIGIN, 'Acme');
  assert.equal(jobs.length, 2);
  assert.deepEqual(
    { title: jobs[0].title, url: jobs[0].url, company: jobs[0].company, location: jobs[0].location, externalId: jobs[0].externalId },
    { title: 'Account Executive', url: 'https://acme.factorial.com/job_posting/ae-barcelona-101', company: 'Acme', location: 'Barcelona', externalId: '101' },
  );
  assert.equal(jobs[0].remote, false);
  assert.equal(jobs[1].title, 'Engineer');
  assert.equal(jobs[1].location, 'Madrid · Remote', 'the remote flag is rendered into the location');
  assert.equal(jobs[1].remote, true);
});

test('factorial: a posting listed under two offices is one row with both places', () => {
  const same = 'https://acme.factorial.com/job_posting/sales-303';
  const html = `<html><body>`
    + group('Barcelona', card(same))
    + group('Madrid', card(same, { remote: 'true' }))
    + `</body></html>`;
  const jobs = parseFactorialBoard(html, ORIGIN, 'Acme');
  assert.equal(jobs.length, 1, 'the same posting URL folds into one row');
  assert.equal(jobs[0].location, 'Barcelona / Madrid · Remote');
  assert.equal(jobs[0].remote, true, 'remote is an OR across the listings');
});

test('factorial: a posting linked to the tenant on another Factorial domain is kept', () => {
  const html = `<html><body>`
    + group('Lisbon', card('https://acme.factorialhr.pt/job_posting/ops-404'))
    + `</body></html>`;
  const jobs = parseFactorialBoard(html, ORIGIN, 'Acme');
  assert.equal(jobs.length, 1, 'the home domain link is the same tenant');
  assert.equal(jobs[0].url, 'https://acme.factorialhr.pt/job_posting/ops-404');
});

test('factorial: cards with no title, a foreign-tenant URL, or a broken URL are dropped', () => {
  const html = `<html><body>`
    + group('HQ', [
      card('https://acme.factorial.com/job_posting/ok-505'),
      card('https://acme.factorial.com/job_posting/no-title-606', { title: '   ' }),
      card('https://other.factorial.com/job_posting/foreign-707', { title: 'Foreign' }),
      card('https://evil.example/job_posting/spoof-808', { title: 'Spoof' }),
      card('::::not-a-url::::'),
    ].join(''))
    + `</body></html>`;
  const jobs = parseFactorialBoard(html, ORIGIN, 'Acme');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].externalId, '505');
});

test('factorial: HTML entities in titles are decoded', () => {
  const html = `<html><body>`
    + group('Zürich', card('https://acme.factorial.com/job_posting/dev-909', { title: 'R&amp;D &amp; Quality Engineer &lt;III&gt;' }))
    + `</body></html>`;
  const [job] = parseFactorialBoard(html, ORIGIN, 'Acme');
  assert.equal(job.title, 'R&D & Quality Engineer <III>');
  assert.equal(job.location, 'Zürich');
});

test('factorial: a page with no posting links is a real empty board', () => {
  assert.deepEqual(parseFactorialBoard('<html><body><h1>No open roles</h1></body></html>', ORIGIN, 'Acme'), []);
});

test('factorial: a page that links to postings but parses none fails CLOSED', () => {
  assert.throws(
    () => parseFactorialBoard('<html><body><a href="https://acme.factorial.com/job_posting/ghost-1">x</a></body></html>', ORIGIN, 'Acme'),
    /links to job postings but none could be parsed/,
    'markup change → named error, never a silent empty board',
  );
  assert.throws(() => parseFactorialBoard('', ORIGIN, 'Acme'), /empty response/);
  assert.throws(() => parseFactorialBoard(undefined, ORIGIN, 'Acme'), /empty response/);
});

// ── fetchFactorial — the web-ui fetch contract ───────────────────────────────

test('factorial: fetch issues exactly one request to origin/ with redirect:"error" and normalizes rows', async () => {
  const html = `<html><body>`
    + group('Berlin', card('https://acme.factorial.com/job_posting/dev-111', { title: 'Backend Engineer', remote: 'true' }))
    + `</body></html>`;
  const seen = [];
  const jobs = await fetchFactorial('https://acme.factorial.com', {
    fetchImpl: async (url, opts) => { seen.push({ url, opts }); return { ok: true, status: 200, text: async () => html }; },
    company: { name: 'Acme', careers_url: 'https://acme.factorialhr.com' },
  });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, 'https://acme.factorial.com/', 'the fetch goes to the rebuilt origin root');
  assert.equal(seen[0].opts.redirect, 'error');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'factorial-https://acme.factorial.com/job_posting/dev-111');
  assert.equal(jobs[0].source, 'factorial');
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].salary, '');
  assert.equal(jobs[0].date, '', 'the board list carries no dates');
  assert.equal(jobs[0].snippet, '');
  assert.equal(jobs[0].isRemote, true);
});

test('factorial: fetch refuses an off-host endpoint before any network call', async () => {
  let touched = 0;
  await assert.rejects(
    () => fetchFactorial('https://evil.example', { fetchImpl: async () => { touched += 1; return { ok: true, text: async () => '' }; } }),
    /not a Factorial tenant board/,
  );
  assert.equal(touched, 0, 'the endpoint is validated before the fetch');
});

test('factorial: fetch fails loud when the signal is already aborted, and propagates HTTP errors', async () => {
  const controller = new AbortController();
  controller.abort();
  let touched = 0;
  await assert.rejects(
    () => fetchFactorial('https://acme.factorial.com', { fetchImpl: async () => { touched += 1; return { ok: true, text: async () => '' }; }, signal: controller.signal }),
    /abort/i,
  );
  assert.equal(touched, 0);
  await assert.rejects(
    () => fetchFactorial('https://acme.factorial.com', { fetchImpl: async () => ({ ok: false, status: 404, headers: { get: () => null }, text: async () => '' }) }),
    /HTTP 404/,
    'a mistyped tenant (404, no board) is a loud error',
  );
});

test('factorial: fetch wraps a 200 whose body parses to nothing — never an empty board', async () => {
  // A page carrying posting links the parser cannot read must throw, so a
  // markup change never reads as "0 openings".
  const html = '<html><body><a href="https://acme.factorial.com/job_posting/ghost-1">x</a></body></html>';
  await assert.rejects(
    () => fetchFactorial('https://acme.factorial.com', { fetchImpl: async () => ({ ok: true, status: 200, text: async () => html }) }),
    /none could be parsed/,
  );
});
