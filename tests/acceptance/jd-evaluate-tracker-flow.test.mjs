/**
 * v1.26.0 — Tier 3 (acceptance): end-to-end user journey at the API
 * layer. Threads multiple endpoints in the order the SPA invokes them.
 *
 * Journey: **JD ingestion → evaluation → tracker** (the most-used path
 * for users who copy a JD from a job board into Evaluate).
 *
 *   1. POST /api/jds { text, slug }           — save raw JD body
 *   2. GET  /api/jds                          — confirm it appears in the list
 *   3. GET  /api/jds/:name                    — re-read the body verbatim
 *   4. POST /api/evaluate { jd, save: false } — manual-prompt fallback (no API key)
 *   5. POST /api/tracker { company, role, score, status }
 *                                             — add the row with the result
 *   6. GET  /api/tracker                      — confirm the row is in the table
 *   7. GET  /api/activity?type=tracker        — the write was audit-logged
 *
 * Each step asserts the visible state from the SPA's POV. If one
 * endpoint's contract drifts (e.g., POST /api/jds returns a different
 * `name` shape), the downstream steps fail with a clear error.
 *
 * Tier 3 stays in-process (`createApp()` + `fetch`). No browser.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let projectRoot;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'acceptance-jd-eval-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  mkdirSync(resolve(dir, 'jds'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n\nSenior Backend Engineer.\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'),
    'candidate:\n  full_name: Alex Doe\n  email: alex@example.com\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), '# Oferta evaluation\n');
  // Force manual-prompt fallback (no API keys).
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  process.env.CAREER_OPS_ROOT = dir;
  projectRoot = dir;
  const { createApp } = await import('../../server/index.mjs');
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

test('full journey: jd ingest → evaluate (manual) → tracker → activity audit', async () => {
  const slug = 'anthropic-senior-be-' + Date.now();
  const jdBody = 'Senior Backend Engineer at TestCo. Lead a small team building '
    + 'distributed systems with PHP, Go, and Postgres. 10+ years XP, on-call '
    + 'rotation, code review responsibilities, mentoring mid-level engineers. Remote EU.';

  // 1. Save JD
  let r = await fetch(baseUrl + '/api/jds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: jdBody, slug }),
  });
  assert.equal(r.status, 200);
  const jdResult = await r.json();
  assert.equal(jdResult.ok, true);
  assert.equal(jdResult.name, `${slug}.txt`);

  // 2. List shows the new JD
  r = await fetch(baseUrl + '/api/jds');
  const list = (await r.json()).jds;
  assert.ok(list.some((j) => j.name === `${slug}.txt`),
    `expected ${slug}.txt in /api/jds list`);

  // 3. Read JD body back verbatim
  r = await fetch(baseUrl + `/api/jds/${slug}.txt`);
  assert.equal(r.status, 200);
  assert.equal(await r.text(), jdBody);

  // 4. Evaluate — manual fallback (no API key set) returns a prompt
  // v1.268.0 — every /api/evaluate path answers as an SSE stream; the manual
  // fallback is the terminal `done` frame and the prompt echo lives in the
  // frame payload.
  r = await fetch(baseUrl + '/api/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jd: jdBody, save: false }),
  });
  assert.equal(r.status, 200);
  const evalText = await r.text();
  const evalFrames = [];
  for (const block of evalText.split('\n\n')) {
    const ev = (block.match(/^event:\s*(.+)$/m) || [])[1];
    const data = (block.match(/^data:\s*([\s\S]+)$/m) || [])[1];
    if (ev) evalFrames.push({ ev, data: data ? JSON.parse(data) : {} });
  }
  const evalDone = evalFrames.find((f) => f.ev === 'done');
  assert.ok(evalDone, `expected a done frame on the evaluate stream, got: ${evalText.slice(0, 200)}`);
  // Manual fallback returns { mode: 'manual', prompt } on the done frame.
  assert.ok(evalDone.data.prompt && evalDone.data.prompt.length > 100,
    `expected non-empty manual prompt, got: ${JSON.stringify(evalDone.data).slice(0, 200)}`);

  // 5. Add row to tracker (user manually entered after running the prompt)
  r = await fetch(baseUrl + '/api/tracker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company: 'TestCo',
      role: 'Senior Backend Engineer',
      score: '4.3',
      status: 'Evaluated',
      notes: `JD saved as ${slug}.txt`,
    }),
  });
  assert.equal(r.status, 200);
  const trackerResult = await r.json();
  assert.ok(trackerResult.ok);
  assert.match(trackerResult.num, /^\d{3}$/, `expected nnn format, got ${trackerResult.num}`);

  // 6. Tracker rows include the new entry
  r = await fetch(baseUrl + '/api/tracker');
  const rows = (await r.json()).rows;
  const found = rows.find((row) => row.company === 'TestCo' && row.role === 'Senior Backend Engineer');
  assert.ok(found, `expected TestCo row in /api/tracker; got ${rows.length} rows`);
  assert.match(found.score, /^4\.3/);

  // 7. Activity log captured the tracker write
  r = await fetch(baseUrl + '/api/activity?limit=20');
  const activity = await r.json();
  assert.ok(Array.isArray(activity.events) || Array.isArray(activity),
    'expected activity array');
  const events = Array.isArray(activity) ? activity : activity.events;
  const trackerWrite = events.find((e) => /tracker|applications/i.test(e.action || e.type || ''));
  assert.ok(trackerWrite, `expected a tracker-write event in activity log; got ${events.length} events`);

  // Sanity: data/applications.md on disk has the row
  const md = readFileSync(resolve(projectRoot, 'data', 'applications.md'), 'utf8');
  assert.match(md, /TestCo/);
  assert.match(md, /Senior Backend Engineer/);

  // Sanity: jd file on disk
  assert.ok(existsSync(resolve(projectRoot, 'jds', `${slug}.txt`)));
});

test('pipeline → preview → tracker workflow (no LLM, all in-process)', async () => {
  // 1. Add URL to pipeline
  const url = 'https://job-boards.greenhouse.io/anthropic/jobs/test-' + Date.now();
  let r = await fetch(baseUrl + '/api/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  assert.equal(r.status, 200);

  // 2. Pipeline list reflects the URL
  r = await fetch(baseUrl + '/api/pipeline');
  const pipeline = await r.json();
  assert.ok(pipeline.urls.includes(url), `expected ${url} in pipeline`);

  // 3. Manually add tracker row (skip evaluate to keep journey LLM-free)
  r = await fetch(baseUrl + '/api/tracker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company: 'PipelineCo-' + Date.now(),
      role: 'Senior Engineer',
      score: '3.8',
      status: 'Evaluated',
      url,
    }),
  });
  assert.equal(r.status, 200);

  // 4. Delete URL from pipeline
  r = await fetch(baseUrl + '/api/pipeline?url=' + encodeURIComponent(url), {
    method: 'DELETE',
  });
  assert.equal(r.status, 200);

  // 5. Pipeline no longer has the URL
  r = await fetch(baseUrl + '/api/pipeline');
  const after = await r.json();
  assert.ok(!after.urls.includes(url), `expected ${url} removed from pipeline`);
});
