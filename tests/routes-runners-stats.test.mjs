/**
 * routes-3 hardening — runners.mjs + stats.mjs.
 *
 *   - /api/stats/company-history and /api/stream/scan-parent reject a company
 *     carrying control chars (a NUL made spawn throw inside the handler).
 *   - generate-pdf: report/deep/inline PDFs pass --skip-fact-check (the CV does
 *     not), --format only when requested, and the temp input HTML is removed
 *     once the stream closes.
 *   - /api/run/* relays stderr through sanitizeDetail (no absolute paths).
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT with FAKE parent scripts; dynamic import
 * after the env is set.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server, baseUrl, root;

// Echoes argv + the input HTML so a test can read both from the SSE log.
const FAKE_PDF = `
import { readFileSync, existsSync } from 'node:fs';
const [input] = process.argv.slice(2);
console.log(JSON.stringify({ argv: process.argv.slice(2), inputExists: existsSync(input), html: existsSync(input) ? readFileSync(input, 'utf8').slice(0, 2000) : '' }));
`;
const FAKE_ECHO = 'console.log(JSON.stringify({ argv: process.argv.slice(2) }));\n';

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'routes-runners-'));
  for (const d of ['config', 'data', 'reports', 'interview-prep', 'output']) mkdirSync(join(root, d), { recursive: true });
  writeFileSync(join(root, 'cv.md'), '# Alex Test\n\nSenior Engineer\n');
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate:\n  full_name: X\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(join(root, 'data', 'applications.md'), '');
  writeFileSync(join(root, 'reports', 'acme.md'), '# Acme report\n\nSalary 123k.\n');
  writeFileSync(join(root, 'interview-prep', 'acme-deep.md'), '# Acme deep\n');
  writeFileSync(join(root, 'generate-pdf.mjs'), FAKE_PDF);
  writeFileSync(join(root, 'scan.mjs'), FAKE_ECHO);
  writeFileSync(join(root, 'company-history.mjs'), FAKE_ECHO);
  // A crashing script: stderr carries the absolute project path in a frame.
  writeFileSync(join(root, 'doctor.mjs'),
    `process.stderr.write('Error: boom\\n    at main (' + process.cwd() + '/doctor.mjs:1:1)\\n'); process.exit(1);\n`);
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

/** Read an SSE stream to the end; return [{event, data}]. */
async function readSse(path, init = {}) {
  const res = await fetch(baseUrl + path, init);
  if (res.status >= 400) return { status: res.status, body: await res.json().catch(() => null) };
  const text = await res.text();
  const events = [];
  for (const frame of text.split('\n\n')) {
    let ev = 'message', data = null;
    for (const l of frame.split('\n')) {
      if (l.startsWith('event: ')) ev = l.slice(7).trim();
      if (l.startsWith('data: ')) data = JSON.parse(l.slice(6));
    }
    if (data !== null) events.push({ event: ev, data });
  }
  return { status: res.status, events };
}

/** The fake generate-pdf's JSON line from a finished PDF stream. */
function pdfRun(events) {
  const log = events.find((e) => e.event === 'log' && e.data.stream === 'stdout');
  assert.ok(log, `no stdout log in ${JSON.stringify(events)}`);
  return JSON.parse(log.data.line);
}

const waitFor = async (fn, ms = 2000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, 20)); }
  return fn();
};
const inputHtmlLeft = () => readdirSync(join(root, 'output')).filter((f) => /-input-.*\.html$/.test(f));

test('stats company-history: NUL / control char in company -> 400, no spawn', async () => {
  for (const bad of ['a%00b', 'a%0Ab', 'a%7Fb']) {
    const r = await fetch(`${baseUrl}/api/stats/company-history?company=${bad}`);
    assert.equal(r.status, 400, bad);
    assert.equal((await r.json()).error, 'invalid company');
  }
  const ok = await fetch(`${baseUrl}/api/stats/company-history?company=Acme`);
  assert.equal(ok.status, 200);
  assert.deepEqual((await ok.json()).argv, ['--company', 'Acme']);
});

test('scan-parent: NUL in company -> 400 JSON; a clean company is passed through', async () => {
  const r = await fetch(`${baseUrl}/api/stream/scan-parent?company=a%00b`);
  assert.equal(r.status, 400);
  const s = await readSse('/api/stream/scan-parent?company=Acme&dryRun=1');
  const start = s.events.find((e) => e.event === 'start');
  assert.deepEqual(start.data.args, ['--dry-run', '--company', 'Acme']);
});

test('report PDF passes --skip-fact-check, omits --format by default, cleans the input HTML', async () => {
  const s = await readSse('/api/stream/pdf/report?slug=acme');
  const run = pdfRun(s.events);
  assert.equal(run.inputExists, true);
  assert.match(run.html, /Acme report/);
  assert.ok(run.argv.includes('--skip-fact-check'));
  assert.ok(!run.argv.some((a) => a.startsWith('--format')), 'no --format unless requested');
  assert.match(run.argv[0], /report-acme-input-[\dT]+-[0-9a-f]{6}\.html$/);
  assert.ok(await waitFor(() => inputHtmlLeft().length === 0), `left behind: ${inputHtmlLeft()}`);
});

test('deep + inline PDFs pass --skip-fact-check; explicit format is honoured', async () => {
  const deep = pdfRun((await readSse('/api/stream/pdf/deep?name=acme-deep.md&format=letter')).events);
  assert.ok(deep.argv.includes('--skip-fact-check'));
  assert.ok(deep.argv.includes('--format=letter'));
  const inline = pdfRun((await readSse('/api/stream/pdf/inline', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown: '# Inline\n', slug: 'inl', format: 'a4' }),
  })).events);
  assert.ok(inline.argv.includes('--skip-fact-check'));
  assert.ok(inline.argv.includes('--format=a4'));
  // Unknown formats are dropped rather than forwarded.
  const weird = pdfRun((await readSse('/api/stream/pdf/report?slug=acme&format=tabloid')).events);
  assert.ok(!weird.argv.some((a) => a.startsWith('--format')));
});

test('CV PDF keeps the fact check and still renders the CV', async () => {
  const run = pdfRun((await readSse('/api/stream/pdf')).events);
  assert.ok(!run.argv.includes('--skip-fact-check'));
  assert.ok(!run.argv.some((a) => a.startsWith('--format')));
  assert.match(run.html, /<h1>Alex Test<\/h1>/);
  assert.ok(await waitFor(() => inputHtmlLeft().length === 0));
});

test('/api/run/*: stderr is sanitized (no absolute project path)', async () => {
  const r = await fetch(`${baseUrl}/api/run/doctor`, { method: 'POST' });
  const d = await r.json();
  assert.equal(d.code, 1);
  assert.match(d.stderr, /boom/);
  assert.ok(!d.stderr.includes(root), `leaks root: ${d.stderr}`);
});

test('/api/run/*: a missing script still answers (stderr may be empty or sanitized)', async () => {
  const r = await fetch(`${baseUrl}/api/run/verify`, { method: 'POST' });
  const d = await r.json();
  assert.notEqual(d.code, 0);
  assert.equal(typeof d.stderr, 'string');
  assert.ok(!d.stderr.includes(root));
  assert.ok(existsSync(root));
});
