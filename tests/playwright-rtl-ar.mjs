/**
 * Playwright acceptance — deep RTL (Arabic) layout sweep, EVERY SPA route
 * at desktop width (1280×800).
 *
 * The `[dir="rtl"]` mirror block in overlays.css mirrors the fixed chrome
 * (sidebar / drawer / FAB / usage HUD), but every release adds new CSS and
 * inline styles — physical `left`/`right`/`margin-left`/`text-align:left`
 * properties that never got mirrored. No gate has ever walked every route
 * in ar comparing against the same route in en. This file does exactly that
 * (fixture corpus + server identical to playwright-mobile-390.mjs):
 *
 *   1. every registered SPA route (31 canonical + 8 mode pages = 39 hashes)
 *      rendered TWICE — once LTR (en), once RTL (ar, `<html dir="rtl">` via
 *      the language switcher's localStorage boot);
 *   2. per route, four checks on the RTL render:
 *        a. X-mirror — key chrome elements (sidebar, main, topbar, docs FAB,
 *           usage HUD, toast probe) must sit at the horizontally mirrored
 *           position of their LTR counterpart (2 px tolerance);
 *        b. horizontal overflow (scrollWidth vs clientWidth, 1 px tolerance);
 *        c. text clipping — text-bearing elements whose content overflows a
 *           `hidden`/`clip` horizontal edge (scrollWidth > clientWidth + 2);
 *        d. tables — every th/td text-align must mirror (start ↔ end);
 *           a column aligned S (start) in LTR must read E (end) in RTL.
 *
 * All non-localhost requests are aborted by a context-level interceptor, so
 * the run makes no network calls (same CI-isolation contract as the other
 * playwright-* suites).
 *
 * Opt-in (needs a browser binary; Playwright is the parent's dep):
 *   node tests/playwright-rtl-ar.mjs
 * Graceful skip with a hint when Playwright is missing.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { BENIGN_CONSOLE } from './helpers/console-noise.mjs';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
function resolvePlaywright() {
  // CAREER_OPS_PLAYWRIGHT_PATH — same escape hatch the other Playwright
  // suites use (git worktrees have no ../node_modules to fall back to).
  const candidates = [];
  if (process.env.CAREER_OPS_PLAYWRIGHT_PATH) candidates.push(process.env.CAREER_OPS_PLAYWRIGHT_PATH);
  for (const id of ['playwright',
    resolve(process.cwd(), '..', 'node_modules', 'playwright'),
    resolve(process.cwd(), 'node_modules', 'playwright')]) {
    candidates.push(id);
  }
  for (const id of candidates) {
    try { return require(id); } catch { /* next */ }
  }
  return null;
}
const playwright = resolvePlaywright();
if (!playwright) {
  console.log('SKIP — install playwright in parent project: cd $CAREER_OPS_ROOT && npm i && npx playwright install chromium');
}
const SKIP = !playwright;

const WIDTH = 1280;
const HEIGHT = 800;
const MIRROR_TOLERANCE_PX = 2;  // chrome X-mirror slack (sub-pixel + borders)
const OVERFLOW_TOLERANCE_PX = 1; // sub-pixel rounding slack on scrollWidth
const CLIP_TOLERANCE_PX = 2;    // hidden-edge text overflow slack

// Every registered SPA route (Router.register call-sites) plus the 8 mode
// pages mode-page.js registers — same list as playwright-mobile-390.mjs.
const ROUTES = [
  'dashboard', 'scan', 'pipeline', 'tracker', 'reports', 'evaluate', 'cv',
  'cv-studio', 'config', 'portals', 'usage', 'activity', 'stats', 'two-pager',
  'career-plan', 'orientation', 'memory', 'networking', 'mock-interview',
  'interview-digest', 'funded', 'assessments', 'deep', 'batch', 'apply',
  'auto', 'health', 'help', 'docs-assistant', 'profile', 'map',
  // mode pages
  'project', 'training', 'followup', 'batch-prompt', 'contacto', 'cover',
  'interview-prep', 'patterns',
];

// Fixed / layout-defining chrome whose X position must mirror in RTL.
// `.toast` is measured through a probe (the real toast only exists after a
// user action); everything else must be present in the rendered route.
const KEY_SELECTORS = [
  '.sidebar', '.main', 'header.topbar', '.docs-fab', '.usage-hud',
];

let server, baseUrl, browser;

// ── fixture corpus (identical to playwright-mobile-390.mjs) ────────────────

function trackerTable() {
  const head = [
    '# Applications Tracker', '',
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|',
  ];
  const rows = [
    [1, '2026-10-20', 'Acme', 'Senior Backend Engineer', '4.5/5', 'Applied', '✅', '[001](reports/001-acme-senior-backend-2026-10-20.md)', 'Applied via careers page'],
    [2, '2026-10-18', 'Globex', 'Staff Platform Engineer', '4.8/5', 'Interview', '✅', '[002](reports/002-globex-staff-platform-2026-10-18.md)', 'Tech round Thursday'],
    [3, '2026-10-15', 'Initech', 'Backend Developer', '3.9/5', 'Evaluated', '❌', '[003](reports/003-initech-backend-developer-2026-10-15.md)', 'Waiting for decision'],
    [4, '2026-10-12', 'Umbrella', 'Data Engineer', '4.2/5', 'Offer', '✅', '[004](reports/004-umbrella-data-engineer-2026-10-12.md)', 'Offer received — negotiating'],
    [5, '2026-10-10', 'Stark Industries', 'Senior Data Scientist', '4.0/5', 'Responded', '❌', '—', 'Recruiter screen scheduled'],
    [6, '2026-10-08', 'Wayne Enterprises', 'Platform Engineer', '4.1/5', 'Applied', '❌', '—', ''],
    [7, '2026-10-06', 'Cyberdyne Systems', 'DevOps Engineer', '3.7/5', 'Evaluated', '❌', '—', ''],
    [8, '2026-10-04', 'Soylent Corp', 'Senior Java Developer', '3.2/5', 'Rejected', '❌', '—', 'Went with internal candidate'],
    [9, '2026-10-02', 'Tyrell Corporation', 'Staff Engineer', '4.6/5', 'Interview', '✅', '—', 'System design next week'],
    [10, '2026-09-28', 'Weyland-Yutani', 'Principal Engineer', '4.9/5', 'Applied', '✅', '—', 'Referral submitted'],
    [11, '2026-09-24', 'Oscorp', 'Backend Engineer Go', '3.8/5', 'Evaluated', '❌', '—', ''],
    [12, '2026-09-20', 'Wonka Industries', 'Senior Platform Engineer', '4.3/5', 'SKIP', '❌', '—', 'Onsite-only, ruled out'],
  ];
  return head.concat(rows.map((r) => `| ${r.join(' | ')} |`)).join('\n') + '\n';
}

function report(num, role, company, date, score) {
  return [
    `# Evaluation: ${role} — ${company}`,
    '',
    `**Date:** ${date}`,
    `**Score:** ${score}/5`,
    '**URL:** https://example.com/jobs/' + num,
    '**Legitimacy:** high',
    '',
    '## Verdict',
    '',
    'A strong match with the target profile. Seeded fixture body text for the',
    'layout sweep — long enough to wrap across several lines.',
    '',
    '## Job Description (archived verbatim)',
    '',
    'Seeded JD text. Responsibilities include designing distributed systems,',
    'mentoring engineers and driving the platform roadmap forward.',
    '',
  ].join('\n');
}

const SCAN_COMPANIES = [
  ['Acme', 'Senior Backend Engineer', 'Berlin, Germany', 'greenhouse', false, '90000 EUR'],
  ['Globex', 'Staff Platform Engineer', 'Remote', 'lever', true, ''],
  ['Initech', 'Junior Developer', 'London, UK', 'ashby', false, ''],
  ['Umbrella Corporation', 'Engineering Manager, Platform Infrastructure Group', 'Remote (EU)', 'remoteok', true, ''],
  ['Stark Industries', 'Data Scientist', 'New York, USA', 'greenhouse', false, '150000 USD'],
  ['Wayne Enterprises', 'Senior Data Engineer', 'Toronto, Canada', 'lever', false, ''],
  ['Cyberdyne Systems GmbH', 'DevOps Engineer (m/w/d)', 'München, Germany', 'hh', false, ''],
  ['Soylent Corp', 'Java Backend Developer', 'Frankfurt am Main, Hesse, Germany (Hybrid)', 'stepstone', false, ''],
  ['Tyrell Corporation', 'Staff Software Engineer, Developer Platform', 'Remote', 'ashby', true, '120000 GBP'],
  ['Weyland-Yutani Corp', 'Principal Engineer', 'San Francisco, CA', 'greenhouse', false, ''],
  ['Oscorp Industries', 'Backend Engineer Go', 'Amsterdam, Netherlands', 'lever', false, ''],
  ['Wonka Industries', 'Senior Platform Engineer', 'Remote', 'remotive', true, ''],
  ['Hooli', 'Full-Stack Developer', 'Palo Alto, CA', 'workable', false, ''],
  ['Pied Piper Inc', 'Compression Engineer', 'Remote (US only)', 'weworkremotely', true, ''],
  ['Vandelay Industries', 'Import / Export Developer', 'LatAm', 'remoteok', true, ''],
  ['Dunder Mifflin', 'Paper Sales Software Engineer', 'Scranton, PA', 'lever', false, ''],
  ['Aperture Science', 'Test Engineer', 'Upper Michigan', 'ashby', false, ''],
  ['Black Mesa Research', 'Research Software Engineer', 'New Mexico, USA', 'greenhouse', false, ''],
  ['Massive Dynamic', 'Fringe Science Developer', 'Remote', 'himalayas', true, ''],
  ['Gekko & Co', 'Ethical Developer', 'New York, NY', 'rss', false, ''],
  ['Bluth Company', 'Housing Developer', 'Newport Beach, CA', 'smartrecruiters', false, ''],
  ['Sterling Cooper', 'Ad Tech Engineer', 'Madison Avenue, NYC', 'lever', false, '95000 USD'],
  ['Nakatomi Trading', 'Platform Engineer', 'Los Angeles, CA', 'workday', false, ''],
  ['Oceanic Airlines', 'Systems Engineer', 'Sydney, Australia', 'jobstreet', false, ''],
  ['Dharma Initiative', 'Full Stack Developer', 'Remote', 'wttj', true, ''],
];

function scanSnapshot() {
  const iso = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  const fresh = SCAN_COMPANIES.map(([company, title, location, source, isRemote, salary], i) => ({
    company, title, location, source, isRemote,
    workplaceType: isRemote ? 'Remote' : (i % 3 === 0 ? 'Onsite' : 'Hybrid'),
    relocates: i % 7 === 0,
    date: iso(i % 12),
    salary,
    url: `https://example.com/j/${i + 1}`,
    score: i % 4 === 0 ? Math.round((3 + (i % 20) / 10) * 10) / 10 : null,
  }));
  return { en: { kind: 'en', when: new Date().toISOString(), fresh, filtered: fresh }, ru: null };
}

before(async () => {
  if (SKIP) return;
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-rtl-ar-'));
  for (const sub of ['config', 'data', 'modes', 'reports', 'interview-prep', 'networking', 'batch']) {
    mkdirSync(resolve(dir, sub), { recursive: true });
  }
  writeFileSync(resolve(dir, 'cv.md'), [
    '# Real Person', '',
    'Senior Engineer — distributed systems, platform tooling, Go/Python.', '',
    '## Experience', '',
    '### Acme Corp — Berlin, Germany', '',
    '**Senior Backend Engineer**', '',
    '2020-01 — present · Led the payments platform, 12 engineers.', '',
    '## Skills', '',
    'Go, Python, Kubernetes, PostgreSQL, Kafka.', '',
  ].join('\n'));
  writeFileSync(resolve(dir, 'config', 'profile.yml'), [
    'candidate:',
    '  full_name: Real Person',
    '  email: real@example.com',
    '  location: Berlin, Germany',
    'target_roles:',
    '  primary:',
    '    - Senior Backend Engineer',
    '    - Platform Engineer',
    'compensation:',
    '  target_range: "90000-125000"',
    '  currency: EUR',
    '',
  ].join('\n'));
  writeFileSync(resolve(dir, 'modes', '_profile.md'), '# Career framing\n\nTarget roles: Senior Backend / Platform Engineer.\n');
  writeFileSync(resolve(dir, 'modes', '_shared.md'), '# Shared mode rules\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), '# Oferta evaluation mode\n');
  writeFileSync(resolve(dir, 'portals.yml'), [
    'tracked_companies:',
    '  - name: Acme',
    '    careers_url: https://boards.greenhouse.io/acme',
    '    api: https://boards-api.greenhouse.io/v1/boards/acme/jobs',
    '    scan_method: greenhouse',
    '    enabled: true',
    '  - name: Globex',
    '    careers_url: https://jobs.lever.co/globex',
    '    api: https://api.lever.co/v0/postings/globex?mode=json',
    '    scan_method: lever',
    '    enabled: true',
    'title_filter:',
    '  positive:',
    '    - engineer',
    '    - developer',
    '',
  ].join('\n'));
  writeFileSync(resolve(dir, 'data', 'applications.md'), trackerTable());
  writeFileSync(resolve(dir, 'reports', '001-acme-senior-backend-2026-10-20.md'), report(1, 'Senior Backend Engineer', 'Acme', '2026-10-20', 4.5));
  writeFileSync(resolve(dir, 'reports', '002-globex-staff-platform-2026-10-18.md'), report(2, 'Staff Platform Engineer', 'Globex', '2026-10-18', 4.8));
  writeFileSync(resolve(dir, 'reports', '003-initech-backend-developer-2026-10-15.md'), report(3, 'Backend Developer', 'Initech', '2026-10-15', 3.9));
  writeFileSync(resolve(dir, 'reports', '004-umbrella-data-engineer-2026-10-12.md'), report(4, 'Data Engineer', 'Umbrella', '2026-10-12', 4.2));
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), [
    '# Pipeline', '',
    '## Pending', '',
    '- [ ] https://boards.greenhouse.io/acme/jobs/4101 | Acme | Platform Engineer | Berlin, Germany',
    '- [ ] https://jobs.lever.co/globex/staff-platform | Globex | Staff Platform Engineer | Remote',
    '- [ ] https://jobs.ashbyhq.com/initech/backend | Initech | Backend Engineer | London, UK',
    '- [ ] https://example.com/jobs/wayne-data-eng | Wayne Enterprises | Data Engineer | Toronto, Canada',
    '',
    '## Processed', '',
  ].join('\n'));
  writeFileSync(resolve(dir, 'data', 'last-scan.json'), JSON.stringify(scanSnapshot()));
  writeFileSync(resolve(dir, 'data', 'follow-ups.md'), [
    '# Follow-ups', '',
    '| # | Company | Role | Last contact | Next due | Note |',
    '|---|---------|------|--------------|----------|------|',
    '| 1 | Acme | Senior Backend Engineer | 2026-10-20 | 2026-11-03 | Applied, no reply yet |',
    '| 2 | Globex | Staff Platform Engineer | 2026-10-18 | 2026-11-01 | Interview scheduled |',
    '', ].join('\n'));
  writeFileSync(resolve(dir, 'data', 'assessments.tsv'), [
    'date\tplatform\tsubject\tthreshold\tscore\tnote',
    '2026-10-05\tHackerRank\tSQL (Advanced)\t60%\t85%\tPassed',
    '2026-09-15\tCodility\tGo Algorithms\t70%\t92%\tPassed',
    '',
  ].join('\n'));
  writeFileSync(resolve(dir, 'data', 'activity.jsonl'), [
    JSON.stringify({ ts: '2026-10-27T09:15:00.000Z', action: 'scan.start', target: null, ok: null, detail: 'manual' }),
    JSON.stringify({ ts: '2026-10-27T09:16:30.000Z', action: 'pipeline.add', target: 'https://example.com/j/1', ok: true, detail: null }),
    JSON.stringify({ ts: '2026-10-27T10:02:00.000Z', action: 'cv.save', target: 'cv.md', ok: true, detail: null }),
    '',
  ].join('\n'));
  writeFileSync(resolve(dir, 'data', 'llm-usage.jsonl'), [
    JSON.stringify({ ts: Date.now() - 3600e3, provider: 'anthropic', in: 37200, out: 2400 }),
    JSON.stringify({ ts: Date.now() - 7200e3, provider: 'openai', in: 12000, out: 800 }),
    JSON.stringify({ ts: Date.now() - 86400e3, provider: 'gemini', in: 22000, out: 1500 }),
    '',
  ].join('\n'));
  writeFileSync(resolve(dir, 'data', 'role-stats.jsonl'), [
    JSON.stringify({ ts: '2026-10-20T00:00:00.000Z', role: 'Senior Backend Engineer', country: 'Germany', vacancies: 42, median: 92000, currency: 'EUR' }),
    JSON.stringify({ ts: '2026-10-20T00:00:00.000Z', role: 'Platform Engineer', country: 'Germany', vacancies: 27, median: 88000, currency: 'EUR' }),
    '',
  ].join('\n'));
  writeFileSync(resolve(dir, 'config', 'two-pager.yml'), [
    'name: Real Person',
    'headline: Senior Engineer — platforms & distributed systems',
    'superpowers:',
    '  - Ships reliable platform tooling',
    '  - Turns ambiguous asks into roadmaps',
    '',
  ].join('\n'));
  writeFileSync(resolve(dir, 'config', 'memory.md'), '# About me\n\nPrefers concise, evidence-first answers.\n');
  writeFileSync(resolve(dir, 'config', 'career-plan.md'), '# Career plan\n\n1. Deepen platform expertise\n2. Grow mentoring footprint\n');
  writeFileSync(resolve(dir, 'interview-prep', 'story-bank.md'), '# Story bank\n\n## Migrated payments to event sourcing\n\n**Provenance:** source: cv.md\n\nSituation, task, action, result — seeded.\n');
  writeFileSync(resolve(dir, 'networking', 'net-acme.md'), '# Networking plan — Acme\n\n- Contact the platform lead\n');
  writeFileSync(resolve(dir, 'batch', 'batch-input.tsv'), 'url\tcompany\trole\nhttps://example.com/j/1\tAcme\tPlatform Engineer\n');
  process.env.CAREER_OPS_ROOT = dir;

  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); });
  });
  browser = await playwright.chromium.launch({ headless: process.env.PWDEBUG !== '1' });
});

after(async () => {
  if (browser) await browser.close();
  if (server) { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
  delete process.env.CAREER_OPS_ROOT;
});

/**
 * 1280×800 context with every non-localhost request aborted: CI-safe
 * (no network) and deterministic.
 */
async function newContext(lang) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
  });
  // Boot the SPA in the requested UI language: the language switcher stores
  // its choice in localStorage and i18n.js writes <html dir> from it at boot.
  await context.addInitScript((l) => {
    try { localStorage.setItem('career-ops-ui:lang', l); } catch { /* private mode */ }
  }, lang);
  await context.route('**/*', (route) => {
    let host = '';
    try { host = new URL(route.request().url()).hostname; } catch { /* abort */ }
    if (host === '127.0.0.1' || host === 'localhost') return route.continue();
    return route.abort();
  });
  return context;
}

/** Navigate to a route and wait until the view has settled. */
async function openRoute(page, route) {
  await page.goto(`${baseUrl}/#/${route}`);
  await page.waitForSelector('main', { timeout: 15000 });
  await page.waitForTimeout(400); // let async view fetches/render settle
  await page.evaluate(() => document.fonts.ready);
}

/**
 * In-page measurement pass. Everything is computed from one DOM snapshot.
 * Returns chrome X centers, overflow, hidden-edge text clipping, and a
 * per-table text-align signature ('S'=start/left, 'E'=end/right, 'C'=center).
 */
const MEASURE_FN = () => {
  const cx = (el) => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; };

  // (a) key chrome X centers
  const chrome = {};
  for (const sel of ['.sidebar', '.main', 'header.topbar', '.docs-fab', '.usage-hud']) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue; // display:none / detached
    chrome[sel] = Math.round(cx(el) * 10) / 10;
  }
  // toast probe: the real toast only exists after a user action; a styled
  // probe measures the same CSS. Animation disabled so the probe is at rest.
  const probe = document.createElement('div');
  probe.className = 'toast';
  probe.style.animation = 'none';
  probe.style.visibility = 'hidden';
  probe.textContent = 'probe';
  document.body.appendChild(probe);
  chrome['.toast'] = Math.round(cx(probe) * 10) / 10;
  probe.remove();

  // (b) horizontal overflow
  const overflowPx = Math.max(
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
    document.body.scrollWidth - document.body.clientWidth,
  );

  // (c) text clipping: text-bearing elements whose content overflows a
  // hidden/clip horizontal edge (scrollbars don't count — that's by design).
  // Documented exception: `.visually-hidden` elements (and descendants of
  // one) — the standard 1px + clip:rect(0,0,0,0) fingerprint. They are out
  // of the visual layer by design (same carve-out the mobile-390 sweep
  // documents), so their "overflow" is not a layout defect.
  const srOnly = (el) => {
    for (let a = el; a; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if ((cs.position === 'absolute' || cs.position === 'fixed') && cs.clip.startsWith('rect(0')) return true;
    }
    return false;
  };
  const clipped = [];
  for (const el of document.querySelectorAll('main *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.overflowX !== 'hidden' && cs.overflowX !== 'clip') continue;
    if (el.scrollWidth <= el.clientWidth + 2) continue;
    const hasText = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && n.textContent.trim().length > 0,
    );
    if (!hasText || srOnly(el)) continue;
    clipped.push({
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      cls: String(el.className || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.'),
      by: el.scrollWidth - el.clientWidth,
    });
    if (clipped.length >= 3) break;
  }

  // (d) per-table text-align signature over the header row (up to 12 cells).
  // Logical keywords ('start'/'end') resolve against the CELL's own
  // direction — Chromium keeps the keyword in computed style, so a cell
  // under [dir="rtl"] with `text-align: start` is end-side (E) physically.
  const alignSide = (v, dir) => {
    if (v === 'left' || v === 'start') return dir === 'rtl' ? 'E' : 'S';
    if (v === 'right' || v === 'end') return dir === 'rtl' ? 'S' : 'E';
    if (v === 'center' || v === 'justify') return 'C';
    return '?';
  };
  const tables = [];
  for (const t of Array.from(document.querySelectorAll('main table')).slice(0, 5)) {
    const cells = Array.from(t.querySelectorAll('th, td')).slice(0, 12);
    if (!cells.length) continue;
    tables.push(cells.map((c) => alignSide(getComputedStyle(c).textAlign, getComputedStyle(c).direction)).join(''));
  }

  return { chrome, overflowPx, clipped, tables, dir: document.documentElement.dir };
};

const mirror = (x) => Math.round((WIDTH - x) * 10) / 10;
const fmtEl = (e) => `${e.tag}${e.id ? '#' + e.id : ''}${e.cls ? '.' + e.cls : ''} (+${e.by}px)`;

test('RTL ar: every route mirrors LTR — chrome X, overflow, clipping, table alignment',
  { skip: SKIP }, async () => {
    const ctxL = await newContext('en');
    const ctxR = await newContext('ar');
    const pageL = await ctxL.newPage();
    const pageR = await ctxR.newPage();
    const errors = [];
    pageR.on('console', (m) => { if (m.type() === 'error' && !BENIGN_CONSOLE.test(m.text())) errors.push(`${m.text()}`); });
    const findings = [];
    try {
      for (const route of ROUTES) {
        let mL, mR;
        try {
          await openRoute(pageL, route);
          mL = await pageL.evaluate(MEASURE_FN);
        } catch (e) {
          findings.push({ route, kind: 'render', detail: `LTR render failed: ${String(e.message).slice(0, 120)}` });
          try { await openRoute(pageR, route); } catch { /* reported once */ }
          continue;
        }
        try {
          await openRoute(pageR, route);
          mR = await pageR.evaluate(MEASURE_FN);
        } catch (e) {
          findings.push({ route, kind: 'render', detail: `RTL render failed: ${String(e.message).slice(0, 120)}` });
          continue;
        }
        if (mR.dir !== 'rtl') {
          findings.push({ route, kind: 'dir', detail: `<html dir="${mR.dir}"> — expected rtl for ar` });
          continue;
        }

        // (a) chrome X-mirror
        for (const sel of Object.keys(mL.chrome)) {
          const l = mL.chrome[sel];
          const r = mR.chrome[sel];
          if (r === undefined) { findings.push({ route, kind: 'chrome', el: sel, detail: 'present in LTR, missing/hidden in RTL' }); continue; }
          const delta = Math.abs(mirror(l) - r);
          if (delta > MIRROR_TOLERANCE_PX) {
            findings.push({ route, kind: 'chrome', el: sel, detail: `LTR x=${l} → mirrored ${mirror(l)}, RTL x=${r} (Δ ${Math.round(delta)}px)` });
          }
        }

        // (b) horizontal overflow
        if (mR.overflowPx > OVERFLOW_TOLERANCE_PX) {
          findings.push({ route, kind: 'overflow', detail: `scrollWidth exceeds viewport by ${Math.round(mR.overflowPx)}px` });
        }

        // (c) hidden-edge text clipping
        for (const c of mR.clipped) {
          findings.push({ route, kind: 'clip', el: fmtEl(c), detail: '' });
        }

        // (d) table text-align must mirror (S↔E, C stays C)
        for (let i = 0; i < Math.min(mL.tables.length, mR.tables.length); i++) {
          const expected = mL.tables[i].replace(/[SE]/g, (ch) => (ch === 'S' ? 'E' : 'S'));
          if (mR.tables[i] !== expected) {
            findings.push({ route, kind: 'table', el: `table[${i}]`, detail: `LTR ${mL.tables[i]} → RTL ${mR.tables[i]} (expected ${expected})` });
          }
        }
      }
    } finally {
      for (const p of [pageL, pageR]) {
        try { await p.evaluate(() => window.stop()); } catch { /* gone */ }
        await p.close();
      }
      await ctxL.close();
      await ctxR.close();
    }
    if (findings.length) {
      console.log('\nRED list — RTL (ar) sweep:\nroute | kind | element | detail');
      for (const f of findings) {
        console.log(`${f.route} | ${f.kind} | ${f.el || '-'} | ${f.detail || ''}`);
      }
      if (errors.length) console.log('console errors:', errors.slice(0, 8).join(' | '));
    }
    assert.deepEqual(findings, [], `${findings.length} RTL (ar) finding(s) — see RED list above`);
  });
