/**
 * F-015 — three new SSE endpoints generate PDFs on surfaces beyond #/cv:
 *   GET  /api/stream/pdf/report?slug=<slug>
 *   GET  /api/stream/pdf/deep?name=<name>
 *   POST /api/stream/pdf/inline { markdown, title?, slug? }
 *
 * We don't run Chromium here; we read each SSE stream up to the `start`
 * event and assert the script gets the right positional args.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let dir;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'pdf-extra-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  mkdirSync(resolve(dir, 'output'), { recursive: true });
  mkdirSync(resolve(dir, 'reports'), { recursive: true });
  mkdirSync(resolve(dir, 'interview-prep'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'oferta\n');
  writeFileSync(resolve(dir, 'reports', 'q3-anthropic.md'),
    '# Q3 Anthropic report\n\nBody content for testing.\n');
  writeFileSync(resolve(dir, 'interview-prep', 'anthropic-swe.md'),
    '# Anthropic SWE\n\nDeep research body.\n');
  // A slow fake renderer keeps the stream (and its temp input HTML, removed on
  // close) alive while a test reads the start frame and the HTML.
  writeFileSync(resolve(dir, 'generate-pdf.mjs'), 'setTimeout(() => {}, 10000);\n');
  process.env.CAREER_OPS_ROOT = dir;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  return new Promise((r) => server.close(r));
});

async function readUntilStart(path, opts = {}) {
  const ctrl = new AbortController();
  const init = { signal: ctrl.signal };
  if (opts.method) init.method = opts.method;
  if (opts.headers) init.headers = opts.headers;
  if (opts.body) init.body = opts.body;
  const res = await fetch(baseUrl + path, init);
  if (res.status >= 400) {
    ctrl.abort();
    return { _httpStatus: res.status, _body: await res.json().catch(() => null) };
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let start = null;
  try {
    while (!start) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const frames = buf.split('\n\n');
      buf = frames.pop();
      for (const frame of frames) {
        let ev = null, data = null;
        for (const l of frame.split('\n')) {
          if (l.startsWith('event: ')) ev = l.slice(7).trim();
          if (l.startsWith('data: ')) data = l.slice(6);
        }
        if (ev === 'start' && data) { start = JSON.parse(data); break; }
        if (ev === 'error' && data) { start = { _error: JSON.parse(data) }; break; }
      }
    }
  } finally { ctrl.abort(); }
  return start;
}

test('F-015: /api/stream/pdf/report?slug=<slug> spawns generate-pdf.mjs with positional args + --skip-fact-check', async () => {
  const s = await readUntilStart('/api/stream/pdf/report?slug=q3-anthropic');
  assert.equal(s.script, 'generate-pdf.mjs');
  // No --format unless requested (profile page_format stays the default);
  // a report is not the CV, so the parent's CV fact check is skipped.
  assert.deepEqual(s.args.slice(2), ['--skip-fact-check']);
  assert.match(s.args[0], /\/output\/report-q3-anthropic-input-[\dT]+-[0-9a-f]{6}\.html$/);
  assert.match(s.args[1], /\/output\/report-q3-anthropic-[\dT]+\.pdf$/);
  assert.ok(existsSync(s.args[0]), 'input HTML must exist on disk');
  const html = readFileSync(s.args[0], 'utf8');
  assert.match(html, /Q3 Anthropic report/);
});

test('F-015: /api/stream/pdf/report?slug=<missing> returns 404 JSON', async () => {
  const r = await readUntilStart('/api/stream/pdf/report?slug=does-not-exist');
  assert.equal(r._httpStatus, 404);
});

test('F-015: /api/stream/pdf/deep?name=<name> spawns generate-pdf.mjs', async () => {
  const s = await readUntilStart('/api/stream/pdf/deep?name=anthropic-swe.md');
  assert.equal(s.script, 'generate-pdf.mjs');
  assert.match(s.args[0], /\/output\/deep-anthropic-swe-input-[\dT]+-[0-9a-f]{6}\.html$/);
});

test('F-015: /api/stream/pdf/inline POST with markdown body spawns generate-pdf.mjs', async () => {
  const body = JSON.stringify({
    markdown: '# Inline doc\n\nBody.\n',
    title: 'Inline test',
    slug: 'inline-test',
  });
  const s = await readUntilStart('/api/stream/pdf/inline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  assert.equal(s.script, 'generate-pdf.mjs');
  assert.match(s.args[0], /\/output\/inline-test-input-[\dT]+-[0-9a-f]{6}\.html$/);
  const html = readFileSync(s.args[0], 'utf8');
  assert.match(html, /Inline doc/);
});

test('F-015: /api/stream/pdf/inline POST with empty markdown emits error frame', async () => {
  const s = await readUntilStart('/api/stream/pdf/inline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown: '' }),
  });
  // empty markdown is rejected at the route guard with 400 JSON, NOT a
  // start frame and NOT an SSE error envelope.
  assert.equal(s._httpStatus, 400);
});
