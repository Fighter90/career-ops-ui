/**
 * v1.10.2 — /api/stream/pdf must invoke generate-pdf.mjs with the
 * documented positional args <input.html> <output.pdf>, NOT no-args.
 *
 * Prior to v1.10.2 the route called the script with `[]`. The script
 * printed its `Usage:` line and exited with code 1 — silently no-op'ing
 * the SPA's Generate PDF button. This test asserts:
 *
 *   1. The SSE `start` event carries an args array with absolute paths
 *      to a temp input.html (under output/) and an output.pdf.
 *   2. The input.html exists on disk after `start` and contains the
 *      rendered cv.md.
 *   3. The route passes the format flag only when asked (`?format=letter`);
 *      by default the profile's page_format decides (v1.241.0).
 *   4. The route reports a friendly error when cv.md is missing.
 *
 * We don't run the actual script (would require chromium). We parse
 * the SSE stream up to the `start` event and then abort.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let dir;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'pdf-args-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  mkdirSync(resolve(dir, 'output'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'),
    '# Alex Test\n\nSenior Backend Engineer\n\n## About\nFixture body.\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Alex\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'oferta\n');
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

/**
 * Read an SSE stream until the first `event: start` payload, then abort
 * the request so we don't have to wait for chromium.
 */
async function readUntilStart(path) {
  const ctrl = new AbortController();
  const res = await fetch(baseUrl + path, { signal: ctrl.signal });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let startPayload = null;
  try {
    while (!startPayload) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // SSE frames terminate with a blank line. Parse frame by frame.
      const frames = buf.split('\n\n');
      buf = frames.pop();
      for (const frame of frames) {
        const lines = frame.split('\n');
        let ev = null;
        let data = null;
        for (const l of lines) {
          if (l.startsWith('event: ')) ev = l.slice(7).trim();
          if (l.startsWith('data: ')) data = l.slice(6);
        }
        if (ev === 'start' && data) {
          startPayload = JSON.parse(data);
          break;
        }
        if (ev === 'error' && data) {
          // Treat error frames as a special "early termination" so the
          // missing-cv.md test below can read them too.
          startPayload = { _error: JSON.parse(data) };
          break;
        }
      }
    }
  } finally {
    ctrl.abort();
  }
  return startPayload;
}

test('PDF stream: start event carries positional <input.html> <output.pdf> and no default --format', async () => {
  const start = await readUntilStart('/api/stream/pdf');
  assert.ok(start, 'expected a start event');
  assert.ok(!start._error, `unexpected error frame: ${JSON.stringify(start._error)}`);
  assert.equal(start.script, 'generate-pdf.mjs');
  assert.ok(Array.isArray(start.args), 'args must be an array');
  assert.equal(start.args.length, 2);
  const [input, output] = start.args;
  assert.match(input,  /\/output\/cv-input-[\dT]+-[0-9a-f]{6}\.html$/);
  assert.match(output, /\/output\/cv-[\dT]+\.pdf$/);
  // Input HTML is on disk and contains the cv.md content.
  assert.ok(existsSync(input), `expected ${input} to exist`);
  const html = readFileSync(input, 'utf8');
  assert.match(html, /<h1>Alex Test<\/h1>/);
  assert.match(html, /Senior Backend Engineer/);
});

test('PDF stream: ?format=letter switches the format flag', async () => {
  const start = await readUntilStart('/api/stream/pdf?format=letter');
  assert.equal(start.args[2], '--format=letter');
});

test('PDF stream: missing cv.md emits an error event, not a usage failure', async () => {
  // Temporarily remove cv.md to test the early-error branch.
  const cv = resolve(dir, 'cv.md');
  const backup = readFileSync(cv, 'utf8');
  rmSync(cv);
  try {
    const frame = await readUntilStart('/api/stream/pdf');
    assert.ok(frame._error, 'expected an error frame');
    assert.match(frame._error.message, /cv\.md not found/i);
  } finally {
    writeFileSync(cv, backup);
  }
});
