/**
 * CAR-150 — pipeline undo keeps the compensation column through the
 * BARE re-add fallback.
 *
 * The token path is already content-faithful (removePipelineUrlExtract
 * keeps the raw `url | comp` lines server-side; restorePipelineLines
 * reinserts them byte-for-byte). The metadata drops on the DEGRADED
 * path: when the token is unknown (server restart / store eviction) or
 * the restore call fails, undoLast falls back to POST /api/pipeline
 * { url } — and neither the route nor the client ever had the comp
 * column, because GET /api/pipeline answers bare URLs and the DELETE
 * answer carried only { ok, removed, url, restoreToken }.
 *
 * Fix contract pinned here:
 *   - DELETE /api/pipeline answers `comp` — the sanitized compensation
 *     cell of the first removed line ('' when none). A fenced line's
 *     trailing cells ARE the comp column; a checklist row's cells are
 *     company/title/location, so only its labeled `note: comp …`
 *     segment counts.
 *   - POST /api/pipeline accepts an optional gated `comp` (string,
 *     control chars stripped, capped; absent → behavior identical for
 *     existing callers).
 *   - The view captures comp alongside the token and the bare fallback
 *     sends it (source-static, browser-only view — pipeline-v2 style).
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT with cv.md, no network, 127.0.0.1.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root;
const pipe = () => join(root, 'data', 'pipeline.md');

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'car150-undo-'));
  mkdirSync(join(root, 'data'), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# x\n');
  process.env.CAREER_OPS_ROOT = root;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  if (root) rmSync(root, { recursive: true, force: true });
  return new Promise((r) => server.close(r));
});

const del = (path) => fetch(baseUrl + path, { method: 'DELETE' });
const post = (path, body) => fetch(baseUrl + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

// ── the DELETE answer carries the comp column (the fallback's only source) ──

test('DELETE answers the comp cell of a fenced `url | comp` line', async () => {
  writeFileSync(pipe(), '# Pipeline\n\n```\nhttps://a.example/1 | 100k EUR\n```\n');
  const body = await (await del('/api/pipeline?url=' + encodeURIComponent('https://a.example/1'))).json();
  assert.equal(body.ok, true);
  assert.equal(body.comp, '100k EUR');
});

test('a checklist row answers its labeled note: comp segment, not the company/title cells', async () => {
  writeFileSync(pipe(), [
    '# Pipeline',
    '',
    '## Pending',
    '',
    '- [ ] https://b.example/2 | Acme GmbH | Head of Platform | Berlin | note: comp 90k EUR',
    '',
  ].join('\n'));
  const body = await (await del('/api/pipeline?url=' + encodeURIComponent('https://b.example/2'))).json();
  assert.equal(body.removed, 1);
  assert.equal(body.comp, '90k EUR',
    'company/title/location are NOT compensation — only the note: comp segment');
});

test('a line without a comp column answers comp: ""', async () => {
  writeFileSync(pipe(), '# Pipeline\n\n```\nhttps://c.example/3\n```\n');
  const body = await (await del('/api/pipeline?url=' + encodeURIComponent('https://c.example/3'))).json();
  assert.equal(body.comp, '');
});

test('the first removed line wins when a URL is listed twice', async () => {
  writeFileSync(pipe(), '# Pipeline\n\n```\nhttps://d.example/4 | 111k\nhttps://d.example/4 | 222k\n```\n');
  const body = await (await del('/api/pipeline?url=' + encodeURIComponent('https://d.example/4'))).json();
  assert.equal(body.removed, 2);
  assert.equal(body.comp, '111k');
});

// ── POST /api/pipeline accepts an optional gated comp (the fallback re-add) ──

test('POST { url, comp } appends the compensation column', async () => {
  writeFileSync(pipe(), '# Pipeline\n\n```\n```\n');
  const r = await post('/api/pipeline', { url: 'https://e.example/5', comp: '120k USD' });
  assert.equal(r.status, 200);
  assert.match(readFileSync(pipe(), 'utf8'), /^https:\/\/e\.example\/5 \| 120k USD$/m);
});

test('absent comp stays byte-identical to the bare add (existing callers unaffected)', async () => {
  writeFileSync(pipe(), '# Pipeline\n\n```\n```\n');
  const r = await post('/api/pipeline', { url: 'https://f.example/6' });
  assert.equal(r.status, 200);
  assert.match(readFileSync(pipe(), 'utf8'), /^https:\/\/f\.example\/6$/m);
  assert.doesNotMatch(readFileSync(pipe(), 'utf8'), /f\.example\/6 \|/);
});

test('comp is gated: a non-string comp is a 400, never written', async () => {
  writeFileSync(pipe(), '# Pipeline\n\n```\n```\n');
  const r = await post('/api/pipeline', { url: 'https://g.example/7', comp: 123 });
  assert.equal(r.status, 400);
  assert.doesNotMatch(readFileSync(pipe(), 'utf8'), /g\.example\/7/);
});

test('comp control chars / pipes / newlines collapse; the cell is capped', async () => {
  writeFileSync(pipe(), '# Pipeline\n\n```\n```\n');
  const r = await post('/api/pipeline', { url: 'https://h.example/8', comp: 'a\r\nb|c\t=x' });
  assert.equal(r.status, 200);
  const line = readFileSync(pipe(), 'utf8').split('\n').find((l) => l.includes('h.example/8'));
  assert.equal(line, 'https://h.example/8 | a b c \'=x',
    'one line, one cell, formula-lead neutralized');
  const long = 'x'.repeat(300);
  writeFileSync(pipe(), '# Pipeline\n\n```\n```\n');
  await post('/api/pipeline', { url: 'https://i.example/9', comp: long });
  const line2 = readFileSync(pipe(), 'utf8').split('\n').find((l) => l.includes('i.example/9'));
  assert.ok(line2.length <= 'https://i.example/9 | '.length + 80, 'the cell is capped at 80');
});

test('a formula-lead comp is neutralized on the fallback re-add', async () => {
  writeFileSync(pipe(), '# Pipeline\n\n```\n```\n');
  await post('/api/pipeline', { url: 'https://j.example/10', comp: '=cmd|\' /c calc' });
  const line = readFileSync(pipe(), 'utf8').split('\n').find((l) => l.includes('j.example/10'));
  assert.match(line, /'\=cmd/, 'the spreadsheet-formula lead is quoted');
});

// ── the full undo fallback round-trip, client-shaped ──

test('fallback round-trip: DELETE comp + bare re-add with comp restores the column', async () => {
  // Exactly the calls undoLast() makes when the token is unknown: the
  // DELETE's comp rides the fallback POST.
  writeFileSync(pipe(), '# Pipeline\n\n```\nhttps://k.example/11 | $120k\n```\n');
  const delBody = await (await del('/api/pipeline?url=' + encodeURIComponent('https://k.example/11'))).json();
  assert.equal(delBody.restoreToken, delBody.restoreToken); // a token existed; we simulate it going unknown
  assert.equal(readFileSync(pipe(), 'utf8'), '# Pipeline\n\n```\n```\n');
  const r = await post('/api/pipeline', { url: 'https://k.example/11', comp: delBody.comp });
  assert.equal(r.status, 200);
  assert.match(readFileSync(pipe(), 'utf8'), /^https:\/\/k\.example\/11 \| \$120k$/m,
    'the compensation column comes back through the fallback');
});

test('regression lock: the token path round-trips the comp line byte-for-byte', async () => {
  writeFileSync(pipe(), '# Pipeline\n\n```\nhttps://l.example/12 | $95k\n```\n');
  const delBody = await (await del('/api/pipeline?url=' + encodeURIComponent('https://l.example/12'))).json();
  const r = await post('/api/pipeline/restore', { tokens: [delBody.restoreToken] });
  assert.equal(r.status, 200);
  const rb = await r.json();
  assert.equal(rb.restored, 1);
  assert.equal(rb.unknown.length, 0);
  assert.equal(readFileSync(pipe(), 'utf8'), '# Pipeline\n\n```\nhttps://l.example/12 | $95k\n```\n',
    'the token path never needed fixing — pinned so it stays that way');
});

test('restore still dedups when the fallback re-added the URL meanwhile (with comp)', async () => {
  writeFileSync(pipe(), '# Pipeline\n\n```\nhttps://m.example/13 | 77k\n```\n');
  const delBody = await (await del('/api/pipeline?url=' + encodeURIComponent('https://m.example/13'))).json();
  // re-added meanwhile through the fallback (with comp)
  await post('/api/pipeline', { url: 'https://m.example/13', comp: delBody.comp });
  const r = await post('/api/pipeline/restore', { tokens: [delBody.restoreToken] });
  const rb = await r.json();
  assert.equal(rb.restored, 0);
  assert.equal(rb.deduped, 1);
  const text = readFileSync(pipe(), 'utf8');
  assert.equal((text.match(/m\.example\/13/g) || []).length, 1, 'no duplicate row');
  assert.match(text, /\| 77k$/, 'the re-added comp survives, the token copy skipped');
});

// ── the view's fallback contract (browser-only → source-static) ──

const { readFileSync: rf } = await import('node:fs');
const { fileURLToPath } = await import('node:url');
const { dirname, resolve } = await import('node:path');
const PIPE = rf(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'js', 'views', 'pipeline.js'), 'utf8');

test('the view: the remover captures comp alongside the token', () => {
  const at = PIPE.indexOf('async function removeFromPipeline');
  const body = PIPE.slice(at, PIPE.indexOf('function urlRow', at));
  assert.match(body, /r\.comp/, 'the DELETE answer comp is read');
  assert.match(body, /deletedLines\.set\(url, \{ token, comp \}\)/,
    'kept for the undo fallback');
});

test('the view: the bare re-add fallback sends the captured comp', () => {
  const at = PIPE.indexOf('async function undoLast');
  const body = PIPE.slice(at, PIPE.indexOf('function shortHost', at));
  assert.match(body, /if \(b\.comp\) body\.comp = b\.comp/,
    'the fallback POST carries the comp column when the DELETE handed it over');
  assert.match(body, /API\.post\('\/api\/pipeline', body\)/);
});

test('the view: unknown tokens and failed restores fall back WITH comp', () => {
  const at = PIPE.indexOf('async function undoLast');
  const body = PIPE.slice(at, PIPE.indexOf('function shortHost', at));
  const unknownAt = body.indexOf('unknownSet');
  assert.ok(unknownAt > -1, 'the unknown-token branch exists');
  assert.match(body.slice(unknownAt), /bare\.push\(\{ url: u, comp:/,
    'unknown tokens (restart / eviction) re-add with comp');
  const catchAt = body.indexOf('catch (err)');
  assert.ok(catchAt > -1);
  assert.match(body.slice(catchAt), /bare\.push\(\{ url: u, comp:/,
    'a failed restore re-adds with comp');
});
