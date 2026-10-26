/**
 * CAR-151 — lossless pipeline undo (client contract).
 *
 * The view cannot capture a raw line before delete: GET /api/pipeline
 * answers only `urls`. The fix rides the DELETE response — the server
 * answers with the removed RAW line(s) — and the view keeps them for the
 * undo: undoLast() replays them through POST /api/pipeline/restore
 * (byte-faithful, checklist cells included) and falls back to the bare
 * POST /api/pipeline re-add only for URLs with no captured line.
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

test('the remover captures the DELETE response lines into the session map', () => {
  const at = PIPE.indexOf('async function removeFromPipeline');
  const body = PIPE.slice(at, PIPE.indexOf('function urlRow', at));
  assert.match(body, /r\.lines/, 'the DELETE response lines are read');
  assert.match(body, /deletedLines\.set\(url, lines\)/, 'kept for the undo');
  assert.match(body, /deletedLines\.delete\(url\)/,
    'a line-less removal (nothing to restore losslessly) clears stale captures');
});

test('undo replays captured lines through the restore endpoint', () => {
  const at = PIPE.indexOf('async function undoLast');
  const body = PIPE.slice(at, PIPE.indexOf('function shortHost', at));
  assert.match(body, /API\.post\('\/api\/pipeline\/restore', \{ lines \}\)/,
    'the captured RAW lines go to POST /api/pipeline/restore');
  assert.match(body, /restored \+= \(r && r\.restored\) \|\| 0/,
    'the server count is what is celebrated, not an assumption');
  assert.match(body, /API\.post\('\/api\/pipeline', \{ url: u \}\)/,
    'URLs with no captured line fall back to the existing bare add path');
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
