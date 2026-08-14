/**
 * server/lib/url-key.mjs — canonical posting-URL key for dedup.
 *
 * The whole point is that two spellings of the SAME posting collapse to one key
 * while two genuinely different postings never do. CI-isolated (pure function).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl } from '../server/lib/url-key.mjs';

test('forces https, lowercases host, drops fragment + a single trailing slash', () => {
  assert.equal(normalizeUrl('http://Example.COM/jobs/42'), 'https://example.com/jobs/42');
  assert.equal(normalizeUrl('https://example.com/jobs/42/'), 'https://example.com/jobs/42');
  assert.equal(normalizeUrl('https://example.com/jobs/42#apply'), 'https://example.com/jobs/42');
  // root slash is preserved (it is the path, not a trailing decoration)
  assert.equal(normalizeUrl('https://example.com/'), 'https://example.com/');
});

test('strips tracking params, keeps functional ones, sorts the rest', () => {
  assert.equal(
    normalizeUrl('https://example.com/j?utm_source=nl&utm_campaign=x&gclid=1&fbclid=2'),
    'https://example.com/j',
  );
  // gh_jid (a real posting id on some boards) is kept; query is order-independent.
  assert.equal(
    normalizeUrl('https://boards.greenhouse.io/x?b=2&gh_jid=99&a=1'),
    'https://boards.greenhouse.io/x?a=1&b=2&gh_jid=99',
  );
  // gh_src IS tracking (campaign), so it goes; gh_jid stays.
  assert.equal(
    normalizeUrl('https://boards.greenhouse.io/x?gh_jid=99&gh_src=abc'),
    'https://boards.greenhouse.io/x?gh_jid=99',
  );
});

test('same posting, many spellings → ONE key', () => {
  const key = 'https://example.com/jobs/42';
  for (const variant of [
    'http://example.com/jobs/42',
    'https://example.com/jobs/42/',
    'https://example.com/jobs/42#apply',
    'https://EXAMPLE.com/jobs/42?utm_source=twitter',
    'https://example.com/jobs/42?fbclid=xyz',
  ]) {
    assert.equal(normalizeUrl(variant), key, `${variant} should key to ${key}`);
  }
});

test('different postings → different keys (never over-merges)', () => {
  assert.notEqual(normalizeUrl('https://example.com/jobs/42'), normalizeUrl('https://example.com/jobs/43'));
  // a KEPT functional param distinguishes two postings on the same path
  assert.notEqual(normalizeUrl('https://example.com/j?ref=partner'), normalizeUrl('https://example.com/j'));
  assert.notEqual(normalizeUrl('https://a.example.com/j'), normalizeUrl('https://b.example.com/j'));
});

test('NO KEY IS NOT A KEY — non-http / placeholder / junk → ""', () => {
  for (const junk of ['', '  ', 'N/A', 'TBD', '—', 'not a url', 'mailto:x@y.com', 'ftp://h/f', 'local:jds/foo.md', 'javascript:alert(1)']) {
    assert.equal(normalizeUrl(junk), '', `${JSON.stringify(junk)} must yield no key`);
  }
  assert.equal(normalizeUrl(null), '');
  assert.equal(normalizeUrl(undefined), '');
  assert.equal(normalizeUrl(42), '');
});
