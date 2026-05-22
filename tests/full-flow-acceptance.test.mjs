/**
 * Full-funnel acceptance test — walks the user journey end to end and
 * loops it 3 times to catch state leakage between runs.
 *
 *   Step  1  Health check is green
 *   Step  2  Help loads in all 8 locales
 *   Step  3  Upload CV via /api/cv/import (markdown passthrough)
 *   Step  4  Read CV back via /api/cv (round-trip)
 *   Step  5  Replace CV via /api/cv with sanitization
 *   Step  6  Save profile YAML (PUT /api/profile)
 *   Step  7  Read profile back (GET /api/profile)
 *   Step  8  Get list of supported modes (GET /api/modes)
 *   Step  9  Generate prompts for every mode in MANUAL mode (no LLM call)
 *   Step 10  /api/evaluate manual mode in 3 different locales (en/ru/ja)
 *   Step 11  /api/deep manual mode (no LLM call)
 *   Step 12  /api/apply-helper produces the expected checklist
 *   Step 13  Add 3 URLs to the pipeline (rejects the bad ones)
 *   Step 14  List the pipeline (GET /api/pipeline)
 *   Step 15  Delete via body, delete via query, 404 on miss
 *   Step 16  Add a tracker row including a piped name (BF-1 round-trip)
 *   Step 17  Read tracker back
 *   Step 18  Activity log audit shows ONLY successful events (not 4xx)
 *   Step 19  Loop integrity: run all the above 3 times in succession
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let dir;

async function api(method, path, body, headers = {}) {
  const opts = {
    method,
    headers: { Accept: 'application/json', ...headers },
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(baseUrl + path, opts);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { status: res.status, data };
}

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'flow-accept-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  // Minimal but realistic parent-project layout.
  writeFileSync(resolve(dir, 'cv.md'), '# Initial CV\n\n## About\nBackground placeholder.\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'),
    '# Career-Ops Profile Configuration\n' +
    'candidate:\n  full_name: Initial User\n  email: initial@example.com\n  current_role: SWE\n');
  writeFileSync(resolve(dir, 'portals.yml'),
    'tracked_companies: []\nrussian_portals:\n  enabled: false\n  sources: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'),
    '| Date | Company | Role | Score | Status | Source | Notes |\n' +
    '|------|---------|------|-------|--------|--------|-------|\n');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n\n');
  // All mode templates referenced by the LLM allowlist.
  for (const slug of ['oferta', 'deep', '_shared', 'batch', 'contacto', 'followup', 'interview-prep', 'patterns', 'project', 'training', 'apply']) {
    writeFileSync(resolve(dir, 'modes', `${slug}.md`),
      `# ${slug} mode\n\nTemplate body for ${slug} mode.\n`);
  }
  process.env.CAREER_OPS_ROOT = dir;
  // Make extra sure no key is set so /api/evaluate naturally returns manual.
  delete process.env.ANTHROPIC_API_KEY;
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

const FLOW_LOCALES = ['en', 'ru', 'ja'];
const ALL_LOCALES = ['en', 'es', 'pt-BR', 'ko', 'ja', 'ru', 'zh-CN', 'zh-TW', 'fr'];

async function runFullFunnel(iteration) {
  // Step 1 — health green
  const health = await api('GET', '/api/health');
  assert.equal(health.status, 200, `iter ${iteration}: health endpoint must be 200`);
  assert.equal(health.data.ok, true, `iter ${iteration}: health.ok must be true`);

  // Step 2 — every locale serves a non-empty bundle
  for (const lang of ALL_LOCALES) {
    const r = await api('GET', `/api/help/${encodeURIComponent(lang)}`);
    assert.equal(r.status, 200);
    assert.ok(r.data.markdown && r.data.markdown.length > 500,
      `iter ${iteration}: /api/help/${lang} must return a real bundle`);
    if (lang === 'ko') {
      assert.equal(r.data.lang, 'ko-KR', `iter ${iteration}: ko alias must serve ko-KR`);
    }
  }

  // Step 3 — save CV (PUT /api/cv)
  const newCv = `# Iteration ${iteration} CV\n\n## About\nFull-funnel acceptance run #${iteration}. Senior backend engineer with Python/Go/PostgreSQL.\n\n## Experience\n- Lead engineer at Acme (2022-2026)\n- Senior at Beta (2018-2022)\n`;
  const importResp = await api('PUT', '/api/cv', { markdown: newCv });
  assert.equal(importResp.status, 200, `iter ${iteration}: CV save must succeed`);

  // Step 4 — read it back
  const readBack = await api('GET', '/api/cv');
  assert.equal(readBack.status, 200);
  assert.match(readBack.data.markdown, new RegExp(`Iteration ${iteration} CV`));

  // Step 5 — write CV with a script tag, server must sanitize
  const dirty = `# Iteration ${iteration} CV\n\n<script>alert('xss')</script>\n\nBody.`;
  const cvSan = await api('PUT', '/api/cv', { markdown: dirty });
  assert.equal(cvSan.status, 200);
  const post = await api('GET', '/api/cv');
  assert.ok(!/script/i.test(post.data.markdown), `iter ${iteration}: <script> must be stripped`);

  // Step 6 — profile YAML save
  const yaml = `# Career-Ops Profile Configuration\ncandidate:\n  full_name: Iteration ${iteration} User\n  email: iter${iteration}@example.com\n  current_role: Senior Engineer\n`;
  const profileSave = await api('PUT', '/api/profile', { yaml });
  assert.equal(profileSave.status, 200, `iter ${iteration}: profile save must succeed`);

  // Step 7 — read profile back
  const profileRead = await api('GET', '/api/profile');
  assert.equal(profileRead.status, 200);
  assert.equal(profileRead.data.profile.candidate.full_name, `Iteration ${iteration} User`);

  // Step 8 — list of modes
  const modes = await api('GET', '/api/modes');
  assert.equal(modes.status, 200);
  assert.ok(Array.isArray(modes.data.modes));
  assert.ok(modes.data.modes.length >= 7, `iter ${iteration}: should expose at least 7 modes`);

  // Step 9 — every allowlisted mode generates a non-empty manual prompt
  const ALLOWLIST = ['batch', 'contacto', 'followup', 'interview-prep', 'patterns', 'project', 'training'];
  for (const slug of ALLOWLIST) {
    const modeResp = await api('POST', `/api/mode/${slug}`, { lang: 'ru', company: 'Acme', role: 'Engineer' });
    assert.equal(modeResp.status, 200, `iter ${iteration}: /api/mode/${slug} must succeed`);
    assert.equal(modeResp.data.mode, 'manual');
    assert.ok(modeResp.data.prompt && modeResp.data.prompt.length > 100,
      `iter ${iteration}: prompt for ${slug} must be non-empty`);
    assert.match(modeResp.data.prompt, /Respond in Russian/);
  }

  // Step 10 — /api/evaluate in 3 locales
  const longJd = 'Senior Backend Engineer with Go + PostgreSQL ownership, microservices, code review, on-call rotation, full-stack flexibility for greenfield work. ';
  for (const lang of FLOW_LOCALES) {
    const ev = await api('POST', '/api/evaluate', { jd: longJd.repeat(2), mode: 'manual', lang });
    assert.equal(ev.status, 200, `iter ${iteration}: evaluate ${lang} status`);
    assert.equal(ev.data.mode, 'manual');
    if (lang !== 'en') {
      assert.match(ev.data.prompt, /Respond in/, `iter ${iteration}: ${lang} should embed locale directive`);
    }
  }

  // Step 11 — /api/deep manual mode
  const deep = await api('POST', '/api/deep', { company: `IterCo${iteration}`, role: 'SWE' });
  assert.equal(deep.status, 200);
  assert.equal(deep.data.mode, 'manual');
  assert.match(deep.data.prompt, new RegExp(`IterCo${iteration}`));

  // Step 12 — apply-helper checklist
  const apply = await api('POST', '/api/apply-helper', { url: 'https://jobs.example.com/posting/123', jd: longJd });
  assert.equal(apply.status, 200);
  assert.match(apply.data.checklist, /career-ops apply/);
  assert.match(apply.data.checklist, /NEVER auto-submit/);

  // Step 13 — pipeline accepts good URLs and rejects bad ones
  const goodUrl = `https://valid-iter${iteration}.example.com/job/${Date.now()}`;
  const goodAdd = await api('POST', '/api/pipeline', { url: goodUrl });
  assert.equal(goodAdd.status, 200);
  // Reject patterns: private IP, IMDS, javascript:, malformed.
  for (const bad of ['http://10.0.0.1/x', 'http://169.254.169.254/', 'javascript:alert(1)', 'not-a-url']) {
    const r = await api('POST', '/api/pipeline', { url: bad });
    assert.equal(r.status, 400, `iter ${iteration}: ${bad} must be rejected`);
  }

  // Step 14 — list pipeline includes the good URL
  const list = await api('GET', '/api/pipeline');
  assert.equal(list.status, 200);
  assert.ok(list.data.urls.includes(goodUrl), `iter ${iteration}: pipeline must contain ${goodUrl}`);

  // Step 15 — DELETE via body, then via query, then 404 on miss
  const delByBody = await api('DELETE', '/api/pipeline', { url: goodUrl });
  assert.equal(delByBody.status, 200);
  assert.equal(delByBody.data.removed, 1);

  const queryUrl = `https://valid-q-iter${iteration}.example.com/${Date.now()}`;
  await api('POST', '/api/pipeline', { url: queryUrl });
  const delByQuery = await api('DELETE', `/api/pipeline?url=${encodeURIComponent(queryUrl)}`);
  assert.equal(delByQuery.status, 200);
  assert.equal(delByQuery.data.removed, 1);

  const delMiss = await api('DELETE', `/api/pipeline?url=${encodeURIComponent('https://never.example.com/x')}`);
  assert.equal(delMiss.status, 404);

  // Step 16 — tracker round-trip with piped name (BF-1 regression)
  const tr = await api('POST', '/api/tracker', {
    company: `Acme | Co iter${iteration}`,
    role: 'Backend Engineer',
    score: '4.5',
    status: 'Applied',
    source: 'greenhouse',
    notes: `iter ${iteration} run`,
  });
  assert.equal(tr.status, 200, `iter ${iteration}: tracker.add must succeed`);

  // Step 17 — read tracker back, ensure pipe name survives
  const trList = await api('GET', '/api/tracker');
  assert.equal(trList.status, 200);
  const found = trList.data.rows.find((r) => r.company.includes(`Acme | Co iter${iteration}`));
  assert.ok(found, `iter ${iteration}: piped tracker name must round-trip lossless`);

  // Step 18 — activity log: only successful state changes recorded
  await new Promise((r) => setTimeout(r, 80));
  const activity = await api('GET', '/api/activity?limit=200');
  assert.equal(activity.status, 200);
  // Every recorded event must be ok:true (PR-5 / F-005 contract).
  const failed = activity.data.events.filter((e) => e.ok === false);
  assert.equal(failed.length, 0, `iter ${iteration}: activity must contain zero ok:false events`);
  // The successful actions we just performed must show up.
  const present = (action) => activity.data.events.some((e) => e.action === action);
  for (const action of ['cv.save', 'profile.save', 'pipeline.add', 'pipeline.remove', 'tracker.add', 'evaluate', 'deep.research']) {
    assert.ok(present(action), `iter ${iteration}: missing ${action} in activity feed`);
  }
}

test('Full funnel: CV → profile → modes → evaluate → pipeline → tracker → activity (loop x3)', { timeout: 120_000 }, async () => {
  for (let i = 1; i <= 3; i++) {
    await runFullFunnel(i);
  }
});
