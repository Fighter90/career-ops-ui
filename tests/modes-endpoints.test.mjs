/**
 * FIX-C8 — POST /api/mode/:slug. Generic prompt builder backing the
 * 7 new sidebar pages: project, training, followup, batch, contacto,
 * interview-prep, patterns.
 *
 * Covers:
 *   - allowlist (404 on unknown slug)
 *   - 404 when modes/{slug}.md is missing on disk
 *   - prompt assembly: includes mode template + JSON context
 *   - { run: true } without GEMINI_API_KEY falls back to manual mode
 *   - secret-leak guard: req.body.run is NOT echoed into the prompt
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'modes-ep-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'oferta\n');
  // 7 mode templates with distinctive marker strings
  for (const slug of ['project', 'training', 'followup', 'batch', 'contacto', 'interview-prep', 'patterns', 'cover']) {
    writeFileSync(resolve(dir, 'modes', `${slug}.md`), `# ${slug}\nMARKER-${slug.toUpperCase()}\nReads cv.md\n`);
  }
  process.env.CAREER_OPS_ROOT = dir;
  delete process.env.GEMINI_API_KEY;
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

async function postMode(slug, body = {}) {
  const res = await fetch(baseUrl + '/api/mode/' + slug, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

// v1.70.0 — `cover` (cover-letter mode) ported from the parent; the
// parametrized loop below asserts it is allowlisted and assembles like the rest.
const ALL_SLUGS = ['project', 'training', 'followup', 'batch', 'contacto', 'interview-prep', 'patterns', 'cover'];

for (const slug of ALL_SLUGS) {
  test(`POST /api/mode/${slug} returns prompt with mode template content`, async () => {
    const r = await postMode(slug, { company: 'Stripe', role: 'SBE' });
    assert.equal(r.status, 200);
    assert.equal(r.body.mode, 'manual');
    assert.equal(r.body.slug, slug);
    assert.ok(r.body.prompt.includes(`MARKER-${slug.toUpperCase()}`),
      `expected MARKER-${slug.toUpperCase()} in prompt`);
    // JSON context block must be present
    assert.match(r.body.prompt, /User-supplied context:/);
    assert.match(r.body.prompt, /"company": "Stripe"/);
    assert.match(r.body.prompt, /"role": "SBE"/);
  });
}

test('POST /api/mode/:slug rejects unknown slug with 404', async () => {
  const r = await postMode('totally-not-a-mode');
  assert.equal(r.status, 404);
  assert.match(r.body.error, /unknown mode/);
});

test('POST /api/mode/:slug rejects allowlist slugs whose template is absent', async () => {
  // Allowlist has all 7, but if modes/contacto.md disappeared at runtime
  // the response should be 404, not 500.
  const fs = await import('node:fs');
  const tmp = process.env.CAREER_OPS_ROOT;
  fs.unlinkSync(resolve(tmp, 'modes', 'contacto.md'));
  try {
    const r = await postMode('contacto', { company: 'X', recipient: 'Y' });
    assert.equal(r.status, 404);
    assert.match(r.body.error, /not found/);
  } finally {
    // Restore so other tests still see it
    fs.writeFileSync(resolve(tmp, 'modes', 'contacto.md'), '# contacto\nMARKER-CONTACTO\n');
  }
});

test('POST /api/mode/:slug { run: true } without GEMINI_API_KEY → still manual', async () => {
  const r = await postMode('project', { idea: 'A CLI for X', run: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.mode, 'manual');
});

test('POST /api/mode/:slug strips run flag from the JSON context block', async () => {
  // The user's `run: true` is a control flag for the server, not data
  // for the LLM. It must not appear in the rendered prompt.
  const r = await postMode('project', { idea: 'noted', run: true });
  assert.equal(r.status, 200);
  // The JSON block must NOT contain the run flag.
  const ctx = r.body.prompt.match(/```json\n([\s\S]*?)\n```/)[1];
  const parsed = JSON.parse(ctx);
  assert.equal('run' in parsed, false, 'run flag leaked into prompt context');
  assert.equal(parsed.idea, 'noted');
});

test('POST /api/mode/:slug includes references to cv.md / profile.yml / _shared.md', async () => {
  const r = await postMode('project', { idea: 'X' });
  assert.equal(r.status, 200);
  assert.match(r.body.prompt, /cv\.md/);
  assert.match(r.body.prompt, /config\/profile\.yml/);
  assert.match(r.body.prompt, /_shared\.md/);
});
