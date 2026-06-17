/**
 * GET /api/help/:lang — long-form user guide for the SPA's Help page.
 * Reads docs/help/{lang}.md from web-ui's own root (NOT the parent
 * project root, since the docs ship with web-ui itself). Falls back
 * to English when the requested locale is missing.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server, baseUrl;

before(async () => {
  // Help docs live next to web-ui itself, so the test only needs a
  // minimal CAREER_OPS_ROOT (createApp won't crash without it).
  const dir = mkdtempSync(resolve(tmpdir(), 'help-test-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'oferta\n');
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

async function get(path) {
  const res = await fetch(baseUrl + path);
  return { status: res.status, body: res.status < 400 ? await res.json() : null };
}

const SUPPORTED = ['en', 'es', 'pt-BR', 'ko-KR', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr', 'pl', 'uk', 'ar'];

for (const lang of SUPPORTED) {
  test(`GET /api/help/${lang} returns markdown`, async () => {
    const r = await get('/api/help/' + lang);
    assert.equal(r.status, 200);
    assert.equal(r.body.lang, lang);
    assert.ok(r.body.markdown.length > 500, `expected substantive content for ${lang}, got ${r.body.markdown.length} chars`);
    assert.match(r.body.markdown, /^# /m, 'should start with a heading');
  });
}

test('GET /api/help/en covers every page section', async () => {
  // Spot-check that the EN docs mention every page slug — keeps us
  // honest when adding new pages without updating the help.
  const { body } = await get('/api/help/en');
  for (const slug of [
    'CV', 'Profile', 'Scan', 'Pipeline', 'Evaluate', 'Deep research',
    'Apply checklist', 'Tracker', 'Reports', 'Activity', 'Health',
    'Project', 'Training', 'Follow-up', 'Batch', 'Outreach',
    'Interview prep', 'Patterns',
  ]) {
    assert.ok(body.markdown.includes(slug), `EN help missing section/page: "${slug}"`);
  }
});

test('GET /api/help/unknown-lang falls back to EN', async () => {
  const r = await get('/api/help/martian');
  assert.equal(r.status, 200);
  assert.equal(r.body.lang, 'en');
  assert.ok(r.body.markdown.length > 500);
});

test('GET /api/help/:lang strips path traversal', async () => {
  // ../../../etc/passwd → regex sanitizer leaves only word chars,
  // so this becomes "etcpasswd" → no such .md file → fallback to EN.
  const r = await get('/api/help/' + encodeURIComponent('../../../etc/passwd'));
  assert.equal(r.status, 200);
  assert.equal(r.body.lang, 'en');
});

test('All 8 help files mention `cv.md`, `profile.yml`, and `.env`', async () => {
  // Sanity: the core files users have to edit must be referenced in
  // every locale, otherwise users won't know where to start.
  for (const lang of SUPPORTED) {
    const { body } = await get('/api/help/' + lang);
    assert.match(body.markdown, /cv\.md/, `${lang}: missing cv.md`);
    assert.match(body.markdown, /profile\.yml/, `${lang}: missing profile.yml`);
    assert.match(body.markdown, /\.env/, `${lang}: missing .env`);
  }
});
