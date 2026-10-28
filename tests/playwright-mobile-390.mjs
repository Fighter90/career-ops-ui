/**
 * Playwright acceptance — mobile 390 px layout integrity, EVERY SPA route
 * (Linear CAR: «[QA] Мобильная вёрстка 390 px × 38 экранов — не проверено
 * в регрессе»).
 *
 * The existing narrow-viewport suite (v1.227.2) sweeps only 7 form-bearing
 * routes at 320 px, and prod regressions sweep real DATA at a few routes —
 * no gate has ever walked every route at the iPhone-14 width with a seeded
 * corpus behind it. This file does exactly that:
 *
 *   1. a fixture server (mkdtemp CAREER_OPS_ROOT — same isolation contract
 *      as playwright-scan-filters.mjs) seeded with a realistic corpus:
 *      applications ×12, reports ×4, pipeline ×4, last-scan ×25, portals,
 *      usage, activity, assessments, two-pager, memory, career-plan…
 *   2. every registered SPA route (31 canonical + 8 mode pages = 39 hashes)
 *      rendered at 390×844, DPR 3;
 *   3. per route: horizontal-overflow check (scrollWidth vs clientWidth,
 *      1 px tolerance) naming the widest offender;
 *   4. per route: every visible primary CTA inside `main` whose centre sits
 *      in the initial viewport must be the elementFromPoint hit (or contain
 *      it) — i.e. NOT covered by a sticky bar / drawer / docs FAB.
 *
 * All non-localhost requests are aborted by a context-level interceptor, so
 * the run makes no network calls even where a view lazily fetches remote
 * assets (Leaflet tiles, Google Fonts).
 *
 * Opt-in (needs a browser binary; Playwright is the parent's dep):
 *   node tests/playwright-mobile-390.mjs        (or via npm run test:e2e:browser)
 * Graceful skip with a hint when Playwright is missing — same contract as
 * the other playwright-* suites.
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

const WIDTH = 390;   // iPhone 14 logical width
const HEIGHT = 844;  // iPhone 14 logical height
const DPR = 3;       // iPhone 14 device pixel ratio
const TOLERANCE_PX = 1; // sub-pixel rounding slack on scrollWidth

// Every registered SPA route (Router.register call-sites) plus the 8 mode
// pages mode-page.js registers (project/training/followup/batch-prompt/
// contacto/cover/interview-prep/patterns). `#/settings` is an alias of
// `#/profile` and `#/market` is a tab of `#/stats`, so neither is swept
// separately. Order follows the sidebar so a RED list reads top-down.
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

let server, baseUrl, browser;

// ── fixture corpus ──────────────────────────────────────────────────────────

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
    'mobile layout sweep — long enough to wrap across several lines at 390 px.',
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
  const dir = mkdtempSync(resolve(tmpdir(), 'pw-mobile390-'));
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
    '  - name: Initech',
    '    careers_url: https://jobs.ashbyhq.com/initech',
    '    api: https://api.ashbyhq.com/posting-api/job-board/initech',
    '    scan_method: ashby',
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
 * A 390×844 DPR-3 context with every non-localhost request aborted: CI-safe
 * (no network) and deterministic (Leaflet tiles / fonts fail fast instead of
 * racing the layout measurement).
 */
async function newPhoneContext() {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: DPR,
  });
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
  await page.waitForSelector('main', { timeout: 10000 });
  await page.waitForTimeout(400); // let async view fetches/render settle
  await page.evaluate(() => document.fonts.ready);
}

const fmtOffender = (o) => o ? `${o.tag}${o.id ? '#' + o.id : ''}${o.cls ? '.' + o.cls : ''}` : '?';

test('mobile 390: no route overflows horizontally (scrollWidth ≤ viewport + 1px)',
  { skip: SKIP }, async () => {
    const context = await newPhoneContext();
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !BENIGN_CONSOLE.test(m.text())) errors.push(`${m.text()}`); });
    const findings = [];
    try {
      for (const route of ROUTES) {
        try {
          await openRoute(page, route);
        } catch (e) {
          findings.push({ route, kind: 'render', offender: '', overflowPx: 0, note: `navigation/render failed: ${String(e.message).slice(0, 140)}` });
          continue;
        }
        const m = await page.evaluate(() => {
          const out = [];
          for (const el of document.querySelectorAll('main *')) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            out.push({
              right: Math.round(r.right),
              tag: el.tagName.toLowerCase(),
              id: el.id || '',
              cls: String(el.className || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.'),
            });
          }
          out.sort((a, b) => b.right - a.right);
          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            widest: out.slice(0, 3),
          };
        });
        const overflow = m.scrollWidth - m.clientWidth;
        if (overflow > TOLERANCE_PX) {
          findings.push({
            route,
            kind: 'overflow',
            offender: fmtOffender(m.widest[0]),
            overflowPx: overflow,
            note: `scrollWidth ${m.scrollWidth} vs clientWidth ${m.clientWidth}`,
          });
        }
      }
    } finally {
      try { await page.evaluate(() => window.stop()); } catch { /* gone */ }
      await page.close();
      await context.close();
    }
    if (findings.length) {
      console.log('\nRED list — mobile 390 overflow:\nroute | offender | overflow px');
      for (const f of findings) {
        console.log(`${f.route} | ${f.offender || '-'} | ${f.overflowPx}${f.note ? ' — ' + f.note : ''}`);
      }
      if (errors.length) console.log('console errors:', errors.slice(0, 8).join(' | '));
    }
    assert.deepEqual(findings, [], `${findings.length} route(s) overflow at ${WIDTH}px — see RED list above`);
  });

test('mobile 390: visible primary CTAs are not covered by sticky bars / FABs',
  { skip: SKIP }, async () => {
    const context = await newPhoneContext();
    const page = await context.newPage();
    const findings = [];
    try {
      for (const route of ROUTES) {
        try {
          await openRoute(page, route);
        } catch { continue; /* overflow test already reports render failures */ }
        // One atomic in-page pass: candidates AND their elementFromPoint hit
        // come from the same DOM snapshot, so a re-render between samples
        // cannot manufacture a false "covered" (and can't hide a real one).
        // Documented exception: controls inside a visually-hidden (sr-only)
        // ancestor — the standard `clip: rect(0,0,0,0)` + 1px fingerprint —
        // are deliberately out of the visual layer, not "covered by a sticky
        // bar". The map page's whole header (title, status and the
        // «Without a location: N» click-through) is sr-only below 900px so
        // the map can run full-bleed (v1.249); the button stays
        // keyboard/screen-reader reachable, so it is not a tap-target defect.
        const covered = await page.evaluate(() => {
          const vw = window.innerWidth, vh = window.innerHeight;
          const out = [];
          const srOnly = (el) => {
            for (let a = el.parentElement; a; a = a.parentElement) {
              const cs = getComputedStyle(a);
              if (cs.position === 'absolute' && cs.clip.startsWith('rect(0')) return true;
            }
            return false;
          };
          const els = [...document.querySelectorAll('main button, main a.btn, main [role="button"]')];
          for (const el of els) {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue;
            if (el.closest('details') && !el.closest('details').open) continue;
            if (srOnly(el)) continue; // deliberately hidden region — see above
            const r = el.getBoundingClientRect();
            if (r.width < 24 || r.height < 24) continue;
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            if (cx < 0 || cx > vw || cy < 0 || cy > vh) continue;
            const hit = document.elementFromPoint(cx, cy);
            // The button is tappable when the hit IS the button, inside it,
            // or wraps it (an ancestor also receives the click).
            const owns = !!hit && (el === hit || el.contains(hit) || hit.contains(el));
            if (owns) continue;
            const name = (s) => `${s.tagName.toLowerCase()}${s.id ? '#' + s.id : ''}` +
              String(s.className && s.className.baseVal === undefined ? s.className : '').trim()
                .split(/\s+/).filter(Boolean).slice(0, 2).map((c) => '.' + c).join('');
            let label = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ');
            if (label.length > 40) label = label.slice(0, 37) + '…';
            out.push({ cta: label || '(unlabelled)', coveredBy: hit ? name(hit) : 'null (off-viewport)' });
          }
          return out.slice(0, 12); // bounded per route
        });
        for (const c of covered) findings.push({ route, ...c });
      }
    } finally {
      try { await page.evaluate(() => window.stop()); } catch { /* gone */ }
      await page.close();
      await context.close();
    }
    if (findings.length) {
      console.log('\nRED list — covered CTAs:\nroute | cta | covered by');
      for (const f of findings) console.log(`${f.route} | ${f.cta} | ${f.coveredBy}`);
    }
    assert.deepEqual(findings, [], `${findings.length} CTA(s) covered at ${WIDTH}px — see RED list above`);
  });
