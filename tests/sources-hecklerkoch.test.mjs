/**
 * Heckler & Koch source — v1.242.0 Phase-2 correctness. CI-isolated: fake
 * fetchImpl, no network. The SSR list carries no date/location by design;
 * what matters here is the malformed-200 contract (a non-page body THROWS
 * instead of reading as an empty board) and the parse surface the adapter
 * leans on.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseListing,
  fetchHecklerkoch,
  assertHecklerkochUrl,
  DEFAULT_LIST_URL,
  meta,
} from '../server/lib/sources/hecklerkoch.mjs';

const anchor = (id, title) =>
  `<a href="https://karriere.heckler-koch.com/jobposting/${id}">`
  + '<div class="text-secondary font-medium"><p>Vollzeit</p>'
  + `<h3>${title}</h3></div></a>`;

test('meta', () => {
  assert.equal(meta.value, 'hecklerkoch');
  assert.equal(meta.label, 'Heckler & Koch');
});

test('parseListing: extracts id/title/url from the jobposting anchors, entities decoded', () => {
  const rows = parseListing(
    `${anchor('abc123', 'Ingenieur &amp; Technik')} ${anchor('def456', 'Softwaresystems <b>Engineer</b>')}`,
  );
  assert.deepEqual(rows, [
    { id: 'abc123', title: 'Ingenieur & Technik', url: 'https://karriere.heckler-koch.com/jobposting/abc123' },
    { id: 'def456', title: 'Softwaresystems Engineer', url: 'https://karriere.heckler-koch.com/jobposting/def456' },
  ]);
});

test('parseListing: a valid page with no anchors is a legitimate empty board → []', () => {
  assert.deepEqual(parseListing('<html><body><p>Zurzeit keine Stellenangebote</p></body></html>'), []);
});

test('parseListing: a non-string body THROWS (malformed response, not an empty board)', () => {
  // Pre-v1.242.0 every one of these read as [] and the scan "succeeded"
  // with zero postings against a broken fetch.
  for (const bad of [null, undefined, 42, { html: true }]) {
    assert.throws(() => parseListing(bad), /not a string/, `input=${String(bad)} must throw`);
  }
});

test('fetchHecklerkoch: an empty 200 body throws; a page without postings is []', async () => {
  await assert.rejects(
    () => fetchHecklerkoch(DEFAULT_LIST_URL, {
      fetchImpl: async () => ({ ok: true, status: 200, text: async () => '   ' }),
    }),
    /malformed|empty/i,
    'a 200 with no body is a challenge/truncation, not an empty board',
  );
  const jobs = await fetchHecklerkoch(DEFAULT_LIST_URL, {
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => '<html><body>Liste leer</body></html>' }),
  });
  assert.deepEqual(jobs, []);
});

test('fetchHecklerkoch: normalizes rows and pins the host before fetching', async () => {
  let seenUrl = null;
  const fetchImpl = async (url) => {
    seenUrl = url;
    return { ok: true, status: 200, text: async () => `<html>${anchor('aa11', 'Werkzeugmechaniker')}</html>` };
  };
  const jobs = await fetchHecklerkoch(DEFAULT_LIST_URL, { fetchImpl, company: { name: 'H&K' } });
  assert.equal(seenUrl, DEFAULT_LIST_URL);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'H&K');
  assert.equal(jobs[0].source, 'hecklerkoch');
  assert.equal(jobs[0].url, 'https://karriere.heckler-koch.com/jobposting/aa11');

  let calls = 0;
  await assert.rejects(
    () => fetchHecklerkoch('https://evil.example/x', {
      fetchImpl: async () => { calls += 1; return { ok: true, status: 200, text: async () => '<html></html>' }; },
    }),
    /untrusted hostname/,
  );
  assert.equal(calls, 0, 'no request may leave for a foreign host');
});

test('assertHecklerkochUrl: https + heckler-koch.com hosts only', () => {
  assert.equal(assertHecklerkochUrl(DEFAULT_LIST_URL), DEFAULT_LIST_URL);
  assert.throws(() => assertHecklerkochUrl('http://www.heckler-koch.com/x'), /HTTPS/);
  assert.throws(() => assertHecklerkochUrl('https://evil.com/x'), /untrusted hostname/);
  assert.throws(() => assertHecklerkochUrl('not-a-url'), /invalid URL/);
});
