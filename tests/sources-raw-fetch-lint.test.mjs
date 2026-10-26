/**
 * FULL-R2 gate — no source may call `fetchImpl` directly.
 *
 * The scanner transport's DNS-rebinding guard (`guardResolvedHost` in
 * server/lib/http-json.mjs) runs ONLY inside the shared helpers
 * (`fetchJson` / `fetchText` / `fetchResponse`). A source that calls its
 * injected `fetchImpl` directly bypasses the guard: on a real scan the
 * request reaches whatever host the URL names — including
 * `http://169.254.169.254/…` from a config-supplied mirror — with no
 * resolve-time private-address check.
 *
 * This gate reads every `server/lib/sources/*.mjs` and FAILS on any
 * `await fetchImpl(` call, listing each file:line. New sources must go
 * through `fetchJson` / `fetchText` / `fetchResponse` (or another helper
 * in `server/lib/http-json.mjs`, which is the one place allowed to touch
 * the transport — it lives outside `sources/`, so the glob below already
 * exempts it).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const SOURCES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'lib', 'sources');

test('no source calls fetchImpl directly (FULL-R2 lint)', () => {
  const offenders = [];
  for (const name of readdirSync(SOURCES_DIR).sort()) {
    if (!name.endsWith('.mjs')) continue;
    const path = join(SOURCES_DIR, name);
    const lines = readFileSync(path, 'utf8').split('\n');
    lines.forEach((line, i) => {
      // A direct transport bypass: the injected fetch invoked by hand. The
      // shared helpers all spell it `fetchImpl,` as their first argument —
      // an await on the identifier itself is always the raw call.
      if (/\bawait\s+fetchImpl\s*\(/.test(line)) {
        offenders.push(`server/lib/sources/${name}:${i + 1}: ${line.trim()}`);
      }
    });
  }
  assert.equal(
    offenders.length,
    0,
    `raw fetchImpl() bypasses the guarded transport — port these to fetchJson/fetchText/fetchResponse `
      + `(see server/lib/http-json.mjs):\n${offenders.join('\n')}`,
  );
});
