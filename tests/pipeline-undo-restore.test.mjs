/**
 * CAR-151 — lossless pipeline undo (client contract, review round 2).
 *
 * The view cannot capture a raw line before delete: GET /api/pipeline
 * answers only `urls`. The fix rides the DELETE response — the server now
 * answers with an opaque restoreToken whose RAW line(s) live server-side —
 * and the view keeps the TOKEN for the undo: undoLast() replays tokens
 * through POST /api/pipeline/restore and falls back to the bare
 * POST /api/pipeline re-add for URLs with no token, for unknown tokens,
 * or when the restore call itself fails (never a silent loss).
 *
 * Browser-only view → asserted statically, the pipeline-v2-car116 style.
 * CI-isolated: reads source text, no fs writes, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const PIPE = readFileSync(R('public', 'js', 'views', 'pipeline.js'), 'utf8');

test('the remover captures the DELETE restoreToken into the session map', () => {
  const at = PIPE.indexOf('async function removeFromPipeline');
  const body = PIPE.slice(at, PIPE.indexOf('function urlRow', at));
  assert.match(body, /r\.restoreToken/, 'the DELETE response token is read');
  assert.doesNotMatch(body, /r\.lines/, 'no client-side content carriage (review r2)');
  // CAR-150 — the comp column rides the capture too, for the undo's bare
  // re-add fallback when the token goes unknown (restart / eviction).
  assert.match(body, /deletedLines\.set\(url, \{ token, comp \}\)/, 'kept for the undo');
  assert.match(body, /deletedLines\.delete\(url\)/,
    'a token-less removal clears stale captures');
});

test('undo replays tokens through the restore endpoint', () => {
  const at = PIPE.indexOf('async function undoLast');
  const body = PIPE.slice(at, PIPE.indexOf('function shortHost', at));
  assert.match(body, /API\.post\('\/api\/pipeline\/restore', \{ tokens \}\)/,
    'the captured tokens go to POST /api/pipeline/restore');
  assert.match(body, /restored \+= \(r && r\.restored\) \|\| 0/,
    'the server count is what is celebrated, not an assumption');
  assert.match(body, /API\.post\('\/api\/pipeline', body\)/,
    'URLs with no captured token fall back to the bare add path (CAR-150 — the comp column rides in body when the DELETE handed it over)');
});

test('an unknown token or a failed restore never loses the URL silently (finding 5)', () => {
  const at = PIPE.indexOf('async function undoLast');
  const body = PIPE.slice(at, PIPE.indexOf('function shortHost', at));
  // unknown tokens (restart / eviction) → bare fallback
  assert.match(body, /Array\.isArray\(r\.unknown\)[\s\S]*?bare\.push/, 'unknown tokens fall back');
  // restore POST exception → the toast AND the bare fallback (CAR-150 —
  // the fallback re-add carries the captured comp, never a silent loss)
  assert.match(body, /catch \(err\)[\s\S]*?UI\.toast[\s\S]*?bare\.push\(\{ url: u, comp:/,
    'a failed restore toasts AND falls back to the bare re-add');
});

test('undo prunes the consumed map entries (finding 7)', () => {
  const at = PIPE.indexOf('async function undoLast');
  const body = PIPE.slice(at, PIPE.indexOf('function shortHost', at));
  assert.match(body, /for \(const u of batch\) deletedLines\.delete\(u\)/,
    'tokens are consumed by the undo — the map never grows without bound');
});

test('the remover result is only ever checked by truthiness (finding 6)', () => {
  // every call site (row button, preview pane, bulk loop) must treat the
  // return (token | true | null) as a plain success flag
  assert.doesNotMatch(PIPE, /removeFromPipeline\([^)]*\)\s*===\s*(true|false)/,
    'no === true/false comparisons');
  assert.doesNotMatch(PIPE, /===\s*(true|false)\s*===?\s*[^;]*removeFromPipeline/, 'no reversed equality either');
  const sites = [...PIPE.matchAll(/removeFromPipeline\(/g)].map((m) => m.index);
  assert.ok(sites.length >= 4, `helper + ≥3 call sites, found ${sites.length}`);
  for (const at of sites) {
    const handler = PIPE.slice(Math.max(0, at - 160), PIPE.indexOf(';', at) + 1);
    assert.doesNotMatch(handler, /===\s*(true|false)/, 'truthiness only, near ' + at);
  }
});

test('the undo queue is still the bounded session queue (lib unchanged)', () => {
  assert.match(PIPE, /undoQueue = PV \? PV\.createUndoQueue\(5\) : null/);
});

test('every delete path still funnels through the ONE shared remover', () => {
  const delSites = PIPE.match(/API\.del\('\/api\/pipeline/g) || [];
  assert.equal(delSites.length, 1, 'one API.del site (views-client-fixes-car21 contract)');
  const consumers = PIPE.match(/removeFromPipeline\(/g) || [];
  assert.ok(consumers.length >= 4, `helper + ≥3 call sites, found ${consumers.length}`);
});
