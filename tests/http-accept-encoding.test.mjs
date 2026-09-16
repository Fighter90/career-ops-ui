/**
 * Every outgoing source request pins accept-encoding to the codecs undici
 * decodes correctly (parent parity, career-ops @ 68e6b94).
 *
 * Left unset, Node negotiates whatever its undici build offers. On Node ≥ 23
 * that includes **zstd**, and amazon.jobs' zstd response arrives TRUNCATED AT
 * 1024 BYTES with a 200 status — so the failure surfaces as "Unterminated
 * string in JSON at position 1024", which reads like a malformed API rather
 * than a transport bug. Node 18/20/22 (our CI matrix and the server) send
 * `gzip, deflate`, so this is preventive on today's runtimes; pinning also adds
 * `br`, which those versions do not offer by default but do decode.
 *
 * The default is applied **case-insensitively**: a caller passing
 * `Accept-Encoding` must REPLACE it, not sit beside a lowercase twin — fetch
 * joins same-name headers into one comma-separated value, which would put
 * `zstd`-free intent and the caller's intent in the same string.
 *
 * Headers stay a plain object at the `fetchImpl` boundary: every source's test
 * double reads `opts.headers['User-Agent']`, and web-ui injects no default
 * user-agent of its own (each source sets the one its board requires).
 *
 * CI-isolated: fake fetchImpl, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchJson, fetchText, fetchResponse, fetchJsonWithRetry, PINNED_ACCEPT_ENCODING,
} from '../server/lib/http-json.mjs';
import { makeTimeoutFetch } from '../server/lib/fetch-timeout.mjs';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'lib', 'sources');

/** Records the init of each call and answers with a minimal JSON 200. */
function recorder(body = '{"ok":true}') {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true, status: 200,
      headers: { get: () => null },
      json: async () => JSON.parse(body),
      text: async () => body,
    };
  };
  return { impl, calls };
}

/** Case-insensitive header lookup over the plain object we hand to fetchImpl. */
const header = (headers, name) => {
  const hit = Object.keys(headers ?? {}).find((k) => k.toLowerCase() === name.toLowerCase());
  return hit === undefined ? undefined : headers[hit];
};

test('the pinned value is exactly the set undici decodes — and never offers zstd', () => {
  // Not merely "non-empty and zstd-free": narrowing to `gzip` alone would also
  // avoid zstd while silently dropping brotli and deflate.
  assert.equal(PINNED_ACCEPT_ENCODING, 'gzip, deflate, br');
  assert.ok(!/zstd/i.test(PINNED_ACCEPT_ENCODING));
});

for (const [name, fn] of [
  ['fetchJson', fetchJson],
  ['fetchText', fetchText],
  ['fetchResponse', fetchResponse],
  ['fetchJsonWithRetry', fetchJsonWithRetry],
]) {
  test(`${name} pins accept-encoding by default`, async () => {
    const { impl, calls } = recorder();
    await fn(impl, 'https://example.com/jobs.json');
    assert.equal(header(calls[0].init.headers, 'accept-encoding'), PINNED_ACCEPT_ENCODING);
  });

  test(`${name}: a caller's accept-encoding wins, whatever its capitalization`, async () => {
    for (const spelling of ['accept-encoding', 'Accept-Encoding', 'ACCEPT-ENCODING']) {
      const { impl, calls } = recorder();
      await fn(impl, 'https://example.com/jobs.json', { headers: { [spelling]: 'identity' } });
      const sent = calls[0].init.headers;
      const present = Object.keys(sent).filter((k) => k.toLowerCase() === 'accept-encoding');
      assert.equal(present.length, 1, `${spelling} left two accept-encoding keys: ${present.join(', ')}`);
      assert.equal(sent[present[0]], 'identity');
    }
  });
}

test('the caller\'s own headers are passed through untouched', async () => {
  const { impl, calls } = recorder();
  await fetchJson(impl, 'https://example.com/jobs.json', {
    headers: { 'User-Agent': 'Mozilla/5.0 (test)', Accept: 'application/json', 'x-csrf-token': 'tok' },
  });
  const sent = calls[0].init.headers;
  // Exact spelling preserved — source suites read opts.headers['User-Agent'].
  assert.equal(sent['User-Agent'], 'Mozilla/5.0 (test)');
  assert.equal(sent.Accept, 'application/json');
  assert.equal(sent['x-csrf-token'], 'tok');
  assert.equal(header(sent, 'accept-encoding'), PINNED_ACCEPT_ENCODING);
});

test('web-ui injects no default user-agent — each source sets the one its board needs', async () => {
  const { impl, calls } = recorder();
  await fetchJson(impl, 'https://example.com/jobs.json');
  assert.equal(header(calls[0].init.headers, 'user-agent'), undefined);
});

test('the caller\'s headers object is not mutated', async () => {
  const { impl } = recorder();
  const mine = { 'User-Agent': 'x' };
  await fetchJson(impl, 'https://example.com/jobs.json', { headers: mine });
  assert.deepEqual(mine, { 'User-Agent': 'x' }, 'the shared header object gained a key');
});

// ── The transport chokepoint ─────────────────────────────────────────────────
//
// The helpers above are not the whole story: 25 of the 92 sources call the
// injected `fetchImpl` DIRECTLY and never pass through them. Both scanners
// inject `makeTimeoutFetch()`, so that wrapper — not `fetchJson` — is the one
// point every source shares, and the pin has to live there too. (The parent
// gets this for free: `providers/_http.mjs` is its only transport.)

test('makeTimeoutFetch pins the encoding for sources that call fetchImpl directly', async () => {
  let seen;
  const transport = makeTimeoutFetch(async (_url, init) => { seen = init; return { ok: true, status: 200 }; });
  await transport('https://example.com/jobs.json', { headers: { 'User-Agent': 'x' } });
  assert.equal(seen.headers['accept-encoding'], PINNED_ACCEPT_ENCODING);
  assert.equal(seen.headers['User-Agent'], 'x', "the caller's own headers survive the wrap");
});

test('makeTimeoutFetch pins it even when the source passes no headers at all', async () => {
  let seen;
  const transport = makeTimeoutFetch(async (_url, init) => { seen = init; return { ok: true, status: 200 }; });
  await transport('https://example.com/jobs.json');
  assert.equal(seen.headers['accept-encoding'], PINNED_ACCEPT_ENCODING);
});

test("makeTimeoutFetch lets a caller's own accept-encoding win, whatever its case", async () => {
  for (const spelling of ['accept-encoding', 'Accept-Encoding']) {
    let seen;
    const transport = makeTimeoutFetch(async (_url, init) => { seen = init; return { ok: true, status: 200 }; });
    await transport('https://example.com/x', { headers: { [spelling]: 'identity' } });
    const keys = Object.keys(seen.headers).filter((k) => k.toLowerCase() === 'accept-encoding');
    assert.deepEqual(keys, [spelling]);
    assert.equal(seen.headers[spelling], 'identity');
  }
});

test('a real source that calls fetchImpl directly sends the pinned encoding', async () => {
  // greenhouse is one of the 25. Driven through the transport the scanner
  // actually injects, its request must carry the pin — this is the case the
  // helper-level tests above cannot see.
  const { fetchGreenhouse } = await import('../server/lib/sources/greenhouse.mjs');
  const seen = [];
  const base = async (_url, init) => {
    seen.push(init);
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ jobs: [] }), text: async () => '{"jobs":[]}' };
  };
  try {
    await fetchGreenhouse({ name: 'Acme', greenhouse: { board: 'acme' } }, { fetchImpl: makeTimeoutFetch(base) });
  } catch { /* the source's own shape handling is not what this asserts */ }
  assert.ok(seen.length > 0, 'the source made no request');
  for (const init of seen) {
    const enc = Object.entries(init.headers ?? {}).find(([k]) => k.toLowerCase() === 'accept-encoding');
    assert.ok(enc, `a greenhouse request went out with no accept-encoding: ${JSON.stringify(init.headers)}`);
    assert.equal(enc[1], PINNED_ACCEPT_ENCODING);
  }
});

test('every source reaches the network through a pinned path — none rolls its own fetch', () => {
  // The guard: a new source must take its transport from the caller
  // (`fetchImpl`, which the scanners pin) or from the http-json helpers. A bare
  // `fetch(` / `globalThis.fetch` in a source escapes both.
  const offenders = [];
  for (const f of readdirSync(SRC).filter((x) => x.endsWith('.mjs') && !x.startsWith('_') && x !== 'registry.mjs')) {
    readFileSync(resolve(SRC, f), 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line)) return;                       // comment
      if (/\bfetchImpl\s*=\s*fetch\b/.test(line)) return;            // the standard injectable default
      if (/\b(globalThis|window)\.fetch\b/.test(line)) offenders.push(`${f}:${i + 1}`);
      else if (/(?<![.\w])fetch\s*\(/.test(line) && !/fetchImpl|fetchJson|fetchText|fetchResponse|fetchJsonWithRetry/.test(line)) {
        offenders.push(`${f}:${i + 1}`);
      }
    });
  }
  assert.deepEqual(offenders, [],
    'these sources call fetch directly, bypassing the pinned transport — take the transport from opts.fetchImpl instead:\n  ' + offenders.join('\n  '));
});
