/**
 * Generic RSS source — Phase-2 (v1.242.0) correctness.
 *
 * Covers what rss-adapter.test.mjs does not: the shape contract (a 200 that is
 * not an RSS document THROWS instead of parsing as an empty board) and the
 * <link> extractors (CDATA-wrapped links, entity decoding, https pinning).
 * CI-isolated: pure parsing + fake fetchImpl, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRss, fetchRss } from '../server/lib/sources/rss.mjs';

const item = (id, overrides = {}) => {
  const { link = `https://jobs.example.com/${id}`, ...rest } = overrides;
  const fields = Object.entries(rest).map(([k, v]) => `<${k}>${v}</${k}>`).join('');
  return `<item><title>Role ${id}</title><link>${link}</link>${fields}</item>`;
};
const feed = (...items) => `<?xml version="1.0"?><rss version="2.0"><channel>${items.join('')}</channel></rss>`;

// ── Shape contract ────────────────────────────────────────────────────

test('parseRss: a 200 body that is not an RSS document THROWS (never reads as an empty board)', () => {
  for (const garbage of [
    '<html><body>Just a moment...</body></html>',
    '',
    'plain text',
    '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>',
    '<items><item>x</item></items>',
  ]) {
    assert.throws(() => parseRss(garbage, 'example.com'), /not an RSS feed|<rss|<channel/i, JSON.stringify(garbage));
  }
  // Non-string input is the same failure class.
  assert.throws(() => parseRss(null, 'x'), /RSS/);
  assert.throws(() => parseRss(undefined, 'x'), /RSS/);
});

test('parseRss: an <rss> or <channel> document with zero items is a healthy empty board', () => {
  assert.deepEqual(parseRss(feed(), 'example.com'), []);
  assert.deepEqual(parseRss('<?xml version="1.0"?><channel><title>x</title></channel>', 'example.com'), []);
});

// ── <link> extraction ────────────────────────────────────────────────

test('parseRss: CDATA-wrapped <link> is unwrapped, not read as empty', () => {
  const [job] = parseRss(feed(item('1', { link: '<![CDATA[https://jobs.example.com/cdata]]>' })), 'example.com');
  assert.equal(job.url, 'https://jobs.example.com/cdata');
});

test('parseRss: entity-encoded <link> is decoded (&amp; → &)', () => {
  const [job] = parseRss(feed(item('2', { link: 'https://jobs.example.com/2?gh_jid=42&amp;utm_source=feed' })), 'example.com');
  assert.equal(job.url, 'https://jobs.example.com/2?gh_jid=42&utm_source=feed');
});

test('parseRss: CDATA + entities decode together', () => {
  const [job] = parseRss(feed(item('3', { link: '<![CDATA[https://jobs.example.com/3?a=1&amp;b=2]]>' })), 'example.com');
  assert.equal(job.url, 'https://jobs.example.com/3?a=1&b=2');
});

test('parseRss: link scheme is pinned to https — http and junk yield an empty url', () => {
  const [insecure] = parseRss(feed(item('4', { link: 'http://jobs.example.com/4' })), 'example.com');
  assert.equal(insecure.url, '', 'an http:// job URL must not pass');
  const [junk] = parseRss(feed(item('5', { link: 'javascript:alert(1)' })), 'example.com');
  assert.equal(junk.url, '');
});

test('parseRss: Atom-style href is decoded and https-pinned too', () => {
  const [ok] = parseRss(feed(`<item><title>A</title><link rel="alternate" href="https://jobs.example.com/atom"/></item>`), 'x');
  assert.equal(ok.url, 'https://jobs.example.com/atom');
  const [bad] = parseRss(feed(`<item><title>B</title><link rel="alternate" href="http://jobs.example.com/atom"/></item>`), 'x');
  assert.equal(bad.url, '');
  const [mixed] = parseRss(feed(`<item><title>C</title><link href="https://jobs.example.com/6?x=1&amp;y=2">text</link></item>`), 'x');
  assert.equal(mixed.url, 'https://jobs.example.com/6?x=1&y=2');
});

// ── fetchRss transport ───────────────────────────────────────────────

test('fetchRss: requests with redirect:error; a non-RSS 200 propagates the parse throw', async () => {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, text: async () => '<html>challenge page</html>' };
  };
  await assert.rejects(() => fetchRss('https://example.com/feed', { fetchImpl: impl }), /RSS/);
  assert.equal(calls[0].init.redirect, 'error');
});
