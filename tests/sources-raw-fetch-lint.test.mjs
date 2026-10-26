/**
 * FULL-R2 gate — no source may call the transport directly.
 *
 * The scanner transport's DNS-rebinding guard (`guardResolvedHost` in
 * server/lib/http-json.mjs) runs ONLY inside the shared helpers
 * (`fetchJson` / `fetchText` / `fetchResponse` / `fetchRawResponse` / …). A
 * source that invokes its injected `fetchImpl` — or the bare global `fetch` —
 * bypasses the guard: on a real scan the request reaches whatever host the
 * URL names, including `http://169.254.169.254/…` from a config-supplied
 * mirror, with no resolve-time private-address check.
 *
 * FULL-R2 review widened the net beyond a bare `await fetchImpl(`: ANY
 * invocation of the identifier (`return fetchImpl(…)`, `fetchImpl(…).then(…)`,
 * `opts.fetchImpl(…)`, a call split across lines) and any bare `fetch(…)` call
 * are both offences. Comments and JSDoc are stripped first so prose like
 * "mirrors the parent's fetch()" does not false-positive, and the
 * `fetchImpl = fetch` default-parameter idiom is naturally exempt (no
 * parenthesis follows the identifier there).
 *
 * New sources must go through a helper in `server/lib/http-json.mjs` — the
 * one place allowed to touch the transport (it lives outside `sources/`, so
 * the glob below already exempts it).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const SOURCES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'lib', 'sources');

// ANY direct invocation of the injected transport identifier.
const RAW_FETCH_IMPL = /\bfetchImpl\s*\(/;
// A bare global-fetch call (`fetch(…)`) — not `.fetch(…)`, not `prefetch(…)`,
// not `fetchJson(…)` (the lookbehind + the require of `(` right after).
const BARE_FETCH = /(?<![.\w])fetch\s*\(/;

/** The code part of a line: JSDoc/block-comment lines and trailing `//` comments stripped. */
function codeOf(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('//')) return '';
  // Keep `https://` scheme slashes; drop a real trailing line comment.
  return line.replace(/(^|[^:])\/\/.*$/, '$1');
}

test('no source calls the transport directly (FULL-R2 lint)', () => {
  const offenders = [];
  for (const name of readdirSync(SOURCES_DIR).sort()) {
    if (!name.endsWith('.mjs')) continue;
    const path = join(SOURCES_DIR, name);
    const lines = readFileSync(path, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const code = codeOf(line);
      if (RAW_FETCH_IMPL.test(code) || BARE_FETCH.test(code)) {
        offenders.push(`server/lib/sources/${name}:${i + 1}: ${line.trim()}`);
      }
    });
  }
  assert.equal(
    offenders.length,
    0,
    `a direct transport call bypasses the DNS-rebinding guard — port these to `
      + `fetchJson/fetchText/fetchResponse/fetchRawResponse (see server/lib/http-json.mjs):\n`
      + `${offenders.join('\n')}`,
  );
});
