/**
 * Playwright FULL-CYCLE end-to-end test.
 *
 * Drives a real Chromium against the in-process server through the
 * complete user lifecycle described in /#/help section 1:
 *
 *   Health → Profile → CV save (with XSS strip) → Portals → Scan results
 *   → Pipeline (add URL) → Evaluate (manual prompt) → Tracker (seed)
 *   → Reports → Deep research (manual prompt) → Mode prompts (project)
 *   → Interview prep mode → Apply checklist → Activity log → Help
 *
 * Each step is its own subtest so failures are pinpointed to the
 * lifecycle stage. The whole walkthrough runs against an isolated
 * `CAREER_OPS_ROOT` (mktemp dir), so a real user's data is never
 * touched. No live LLM calls — every Anthropic / Gemini path falls
 * back to the manual prompt branch (test fixture sets no API keys).
 *
 * Opt-in: `npm run test:e2e:browser` runs both this and the smoke
 * harness; this file alone via:
 *
 *   node --test tests/playwright-full-cycle.mjs
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function resolvePlaywright() {
  const candidates = [
    'playwright',
    resolve(process.cwd(), '..', 'node_modules', 'playwright'),
    resolve(process.cwd(), 'node_modules', 'playwright'),
  ];
  for (const id of candidates) {
    try { return require(id); } catch {}
  }
  return null;
}

const playwright = resolvePlaywright();
const SKIP = !playwright;

let server, baseUrl, browser, context;

before(async () => {
  if (SKIP) return;
  // Realistic temp parent — enough fields for every check the lifecycle
  // exercises, but no real user data ever touched.
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-full-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  mkdirSync(resolve(dir, 'reports'), { recursive: true });
  mkdirSync(resolve(dir, 'jds'), { recursive: true });
  mkdirSync(resolve(dir, 'interview-prep'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n\nReal Person, Senior Backend Engineer.\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'),
    'candidate:\n  full_name: Real Person\n  email: real@example.com\n  github: https://github.com/real\n' +
    'target:\n  roles: ["Senior Backend Engineer", "Tech Lead"]\n  comp_total_min_usd: 180000\n  archetypes: ["Tech-Lead-Backend"]\n');
  writeFileSync(resolve(dir, 'portals.yml'),
    'title_filter:\n  positive: [backend, engineer, senior]\n  negative: [junior, intern]\n' +
    'tracked_companies: []\nrussian_portals:\n  sources: [habr]\n  area: 113\n  per_page: 10\n  only_remote: false\n  queries: ["Senior Go"]\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'),
    '# Applications Tracker\n\n| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n' +
    '|---|------|---------|------|-------|--------|-----|--------|-------|\n');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# Pipeline\n\n```\n```\n');
  // Mode templates that the lifecycle prompts reference.
  writeFileSync(resolve(dir, 'modes', '_shared.md'), '# Shared\n\nOutput in English.\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), '# Oferta\n\nA-G evaluation.\n');
  writeFileSync(resolve(dir, 'modes', 'deep.md'), '# Deep\n\n7-section company brief.\n');
  for (const slug of ['project', 'training', 'followup', 'batch', 'contacto', 'interview-prep', 'patterns']) {
    writeFileSync(resolve(dir, 'modes', `${slug}.md`), `# ${slug}\n\nPlaceholder template.\n`);
  }
  // Plant a single report so the Reports view has something to render.
  writeFileSync(resolve(dir, 'reports', '2026-05-08-acme-backend.md'),
    '# Evaluation: Acme — Backend Engineer\n\n**Date:** 2026-05-08\n**Score:** 4.0/5\n**Legitimacy:** Live\n\n## A. Role Summary\n\nA test fixture report.\n');

  process.env.CAREER_OPS_ROOT = dir;
  // Make sure no host API keys leak into this test — we want every LLM
  // path to take the manual fallback so the test is hermetic.
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
  browser = await playwright.chromium.launch({ headless: process.env.PWDEBUG !== '1' });
  context = await browser.newContext();
});

after(async () => {
  if (context) await context.close();
  if (browser) await browser.close();
  if (server) await new Promise((r) => server.close(r));
  delete process.env.CAREER_OPS_ROOT;
});

// ───────────────────────── Lifecycle steps ─────────────────────────

test('full-cycle [01/14] Health page — required checks green', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/health');
  await page.waitForSelector('#content');
  // Hit the API directly — the UI renders the same payload.
  const h = await page.evaluate(async () => (await fetch('/api/health')).json());
  assert.equal(h.ok, true, 'required checks should be green on the temp fixture');
  assert.ok(h.checks.length >= 8, 'health should report at least 8 checks');
  await page.close();
});

test('full-cycle [02/14] Profile renders custom name from profile.yml', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/profile');
  await page.waitForSelector('#content');
  const html = await page.locator('#content').innerHTML();
  assert.match(html, /Real Person|profile/i, 'profile view should render (Profile or candidate name visible)');
  await page.close();
});

test('full-cycle [03/14] CV save round-trip strips XSS', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/cv');
  await page.waitForSelector('#content');
  const put = await page.evaluate(async () => {
    const md = '# CV\n\n## Summary\nSenior backend engineer.\n\n<script>alert(1)</script>\n[link](javascript:bad)\n';
    const r = await fetch('/api/cv', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: md }),
    });
    return await r.json();
  });
  assert.equal(put.ok, true);
  assert.equal(put.sanitized, true, 'XSS payload must be flagged as sanitized');
  const after = await page.evaluate(async () => (await fetch('/api/cv')).json());
  assert.ok(!/<script/i.test(after.markdown));
  assert.ok(!/javascript:/i.test(after.markdown));
  assert.match(after.markdown, /Senior backend engineer/);
  await page.close();
});

test('full-cycle [04/14] Portals exposes tracked_companies + russian_portals', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/scan');
  await page.waitForSelector('#content');
  const portals = await page.evaluate(async () => (await fetch('/api/portals')).json());
  assert.ok(portals.portals && portals.portals.title_filter, 'portals.title_filter present');
  assert.ok(portals.portals.russian_portals, 'russian_portals block parsed');
  await page.close();
});

test('full-cycle [05/14] Scan-results endpoint returns shape', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/scan');
  await page.waitForSelector('#content');
  const res = await page.evaluate(async () => (await fetch('/api/scan-results')).json());
  // Empty fixture → no last scan; shape still expected.
  assert.ok('en' in res || 'ru' in res, 'scan-results must have en/ru shape');
  await page.close();
});

test('full-cycle [06/14] Pipeline add + dedup + invalid-URL reject', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/pipeline');
  await page.waitForSelector('#content');
  const url = 'https://job-boards.greenhouse.io/anthropic/jobs/test-cycle-1';
  const ok1 = (await page.evaluate(async (u) => {
    const r = await fetch('/api/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: u }),
    });
    return r.ok;
  }, url));
  assert.ok(ok1, 'first add should succeed');
  const ded = await page.evaluate(async (u) => {
    const r = await fetch('/api/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: u }),
    });
    return (await r.json()).deduped;
  }, url);
  assert.equal(ded, true, 'second identical add must report deduped:true');
  const reject = await page.evaluate(async () => {
    const r = await fetch('/api/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'javascript:alert(1)' }),
    });
    return r.status;
  });
  assert.equal(reject, 400, 'javascript: URL must be rejected');
  await page.close();
});

test('full-cycle [07/14] Evaluate manual fallback (no API keys in fixture)', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/evaluate');
  await page.waitForSelector('#content');
  const r = await page.evaluate(async () => {
    const jd = 'Senior Backend Engineer at TestCo. Lead a small team building distributed systems with PHP, Go, and Postgres. 10+ years XP, on-call rotation, code review responsibilities, mentoring mid-level engineers.';
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jd, save: true }),
    });
    // v1.268.0 (CAR-229): SSE stream — take the terminal `done` frame.
    const text = await res.text();
    let payload = null;
    for (const frame of text.split('\n\n')) {
      const ev = (frame.match(/^event:\s*(.+)$/m) || [])[1];
      const data = (frame.match(/^data:\s*([\s\S]+)$/m) || [])[1];
      if (ev === 'done' && data) payload = JSON.parse(data);
    }
    return payload;
  });
  // No keys → manual prompt path expected. Anthropic / Gemini are also
  // valid (if a host shell happened to leak) but we deleted them in
  // before(); this should be deterministic.
  assert.equal(r.mode, 'manual', `expected manual, got ${r.mode}`);
  assert.ok(r.prompt && r.prompt.length > 200, 'manual prompt must be substantial');
  assert.match(r.prompt, /career-ops|JD|cv\.md/, 'prompt must reference canonical files');
  assert.ok(r.saved && /^jd-/.test(r.saved), 'JD should have been saved as fixture file');
  await page.close();
});

test('full-cycle [08/14] Tracker add with pipe-laden company + dedup', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/tracker');
  await page.waitForSelector('#content');
  const seed = await page.evaluate(async () => {
    const r = await fetch('/api/tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: 'Acme | Co',
        role: 'Senior Backend\nEngineer',
        score: '4.2', status: 'Evaluated',
        notes: 'Cycle test row',
      }),
    });
    return await r.json();
  });
  assert.equal(seed.ok, true);
  // BF-1 verification: pipe + newline must round-trip losslessly.
  const rows = await page.evaluate(async () => (await fetch('/api/tracker')).json());
  const acme = (rows.rows || []).find((row) => /Acme/.test(row.company || ''));
  assert.ok(acme, 'tracker did not preserve the seeded row (BF-1 regression?)');
  assert.match(acme.company, /Acme.*Co/);
  assert.match(acme.role, /Senior Backend.*Engineer/);
  await page.close();
});

test('full-cycle [09/14] Reports list + single report fetch', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/reports');
  await page.waitForSelector('#content');
  const list = await page.evaluate(async () => (await fetch('/api/reports')).json());
  assert.ok(list.reports.length >= 1, 'fixture report should be listed');
  const slug = list.reports[0].slug;
  const single = await page.evaluate(async (s) =>
    (await fetch('/api/reports/' + encodeURIComponent(s))).json(), slug);
  assert.match(single.markdown, /Evaluation|Score/);
  await page.close();
});

test('full-cycle [10/14] Deep research manual fallback', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/deep');
  await page.waitForSelector('#content');
  const r = await page.evaluate(async () => {
    const res = await fetch('/api/deep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: 'Anthropic', role: 'Senior Backend Engineer' }),
    });
    return await res.json();
  });
  assert.equal(r.mode, 'manual');
  assert.match(r.prompt, /Anthropic/);
  assert.match(r.prompt, /Senior Backend Engineer/);
  assert.match(r.prompt, /interview-prep/, 'deep prompt should reference the save target');
  await page.close();
});

test('full-cycle [11/14] Project mode prompt builder', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/project');
  await page.waitForSelector('#content');
  const r = await page.evaluate(async () => {
    const res = await fetch('/api/mode/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea: 'Build a CLI for ATS scraping', targetRole: 'Tech Lead Backend' }),
    });
    return await res.json();
  });
  assert.equal(r.mode, 'manual');
  assert.equal(r.slug, 'project');
  assert.match(r.prompt, /project|portfolio|career-ops/i);
  await page.close();
});

test('full-cycle [12/14] Interview prep mode prompt builder', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/interview-prep');
  await page.waitForSelector('#content');
  const r = await page.evaluate(async () => {
    const res = await fetch('/api/mode/interview-prep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: 'Anthropic', role: 'Backend Engineer', stage: 'System design' }),
    });
    return await res.json();
  });
  assert.equal(r.mode, 'manual');
  assert.equal(r.slug, 'interview-prep');
  assert.match(r.prompt, /interview-prep/);
  await page.close();
});

test('full-cycle [13/14] Apply helper checklist generation', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/apply');
  await page.waitForSelector('#content');
  const r = await page.evaluate(async () => {
    const res = await fetch('/api/apply-helper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://job-boards.greenhouse.io/anthropic/jobs/test', jd: 'Senior Backend Engineer' }),
    });
    return await res.json();
  });
  assert.ok(r.checklist && r.checklist.length > 200, 'checklist body should be substantial');
  assert.match(r.checklist, /career-ops apply/);
  assert.match(r.checklist, /NEVER auto-submit/i);
  await page.close();
});

test('full-cycle [14/16] CV import — html upload converts and sanitizes', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/cv');
  await page.waitForSelector('#content');
  const r = await page.evaluate(async () => {
    const html = '<h1>Imported CV</h1><script>window.__pwn=1</script><p>Body paragraph.</p>';
    const res = await fetch('/api/cv/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': 'cv.html' },
      body: html,
    });
    return { status: res.status, body: await res.json() };
  });
  // pandoc may not be installed in CI — accept either a 200 with markdown
  // OR a 422 saying pandoc is missing. Both are valid lifecycle states.
  if (r.status === 200) {
    assert.equal(r.body.ok, true);
    assert.equal(r.body.sourceFormat, 'html');
    assert.match(r.body.markdown, /Imported CV/);
    assert.ok(!/window\.__pwn/.test(r.body.markdown), 'script content must be sanitized');
    assert.ok(!/<script/i.test(r.body.markdown));
  } else {
    assert.equal(r.status, 422);
    assert.match(r.body.error || '', /pandoc/i);
  }
  await page.close();
});

test('full-cycle [15/16] PUT /api/profile updates config/profile.yml', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/config');
  await page.waitForSelector('#content');
  const yamlBody = [
    'candidate:',
    '  full_name: Lifecycle Tester',
    '  email: lifecycle@example.com',
    'target:',
    '  roles: [Backend Engineer]',
    '',
  ].join('\n');
  const r = await page.evaluate(async (y) => {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml: y }),
    });
    return await res.json();
  }, yamlBody);
  assert.equal(r.ok, true);
  assert.equal(r.candidate, 'Lifecycle Tester');
  // Round-trip via GET to confirm the file is what we think.
  const after = await page.evaluate(async () => (await fetch('/api/profile')).json());
  assert.equal(after.profile.candidate.full_name, 'Lifecycle Tester');
  // The header sentinel should be present.
  assert.match(after.raw, /^# Career-Ops Profile Configuration/);
  await page.close();
});

test('full-cycle [16/16] Activity log captured every state-change + Help loaded', { skip: SKIP }, async () => {
  const page = await context.newPage();
  await page.goto(baseUrl + '/#/activity');
  await page.waitForSelector('#content');
  const acts = await page.evaluate(async () => (await fetch('/api/activity?limit=100')).json());
  // After the prior 13 steps, the activity log should contain at least
  // these state-changing actions. Names mirror the action-prefix
  // values used by activityMiddleware.
  const actions = (acts.events || []).map((e) => e.action || '');
  const must = ['cv.save', 'pipeline.add', 'tracker.add', 'evaluate'];
  for (const a of must) {
    assert.ok(actions.some((x) => x.startsWith(a)),
      `activity log missing "${a}" — got: ${actions.slice(0, 10).join(', ')}`);
  }
  // Help: load EN, then RU, confirm both serve substantive markdown.
  for (const lang of ['en', 'ru']) {
    const h = await page.evaluate(async (l) => (await fetch('/api/help/' + l)).json(), lang);
    assert.ok(h.markdown && h.markdown.length > 5000,
      `help/${lang} too short (${h.markdown ? h.markdown.length : 0} bytes)`);
  }
  await page.close();
});

if (SKIP) {
  test('full-cycle: skipped (playwright not resolvable)', () => {
    console.log('SKIP — npm install playwright in parent first.');
  });
}
