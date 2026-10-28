#!/usr/bin/env node
/**
 * scripts/capture-car140-screenshots.mjs
 *
 * CAR-140 phase A — fresh captures of the four DATA views:
 * #/scan, #/pipeline, #/tracker, #/reports (en + ru) into web-ui/images/.
 * The ru variants land in images/ru/ (NOT the images/ root) so the landing
 * phase picks them up deliberately — sync-assets only walks images/*.png.
 *
 * Unlike capture-dashboard-screenshots.mjs this script does not need a
 * server the operator started: it seeds a throw-away CAREER_OPS_ROOT fixture
 * (a believable tracker/pipeline/reports/scan corpus, like the CI drift-gate
 * scaffold in .github/workflows/dashboard-screenshots.yml, but fuller) and
 * boots the web-ui server itself on an ephemeral loopback port.
 *
 * The #/map geocode cache (web-ui/.cache/geocode.json, gitignored) is seeded
 * with the fixture's cities + company/place pairs so capture-map-screenshots
 * can run offline-deterministically against the same server — no Nominatim
 * traffic, the status line completes instantly.
 *
 * Usage:
 *   node scripts/capture-car140-screenshots.mjs
 *       seed fixture → boot server → capture ×8 → exit. (default)
 *
 *   CAREER_OPS_UI_URL=http://127.0.0.1:4317 node scripts/capture-car140-screenshots.mjs
 *       capture against an ALREADY-RUNNING server (no fixture, no boot) —
 *       same escape hatch the dashboard/map capture scripts use.
 *
 *   CAR140_SKIP_CAPTURES=1 CAR140_SERVE=1 node scripts/capture-car140-screenshots.mjs
 *       seed + boot + hold until SIGINT/SIGTERM (serve-only: print the URL,
 *       capture nothing) — lets capture-dashboard / capture-map run against
 *       the same fixture.
 *
 *   CAR140_FIXTURE_DIR=/abs/dir — reuse an existing fixture dir instead of
 *       a fresh mkdtemp (both scripts then see identical data).
 *
 * Output:
 *   images/scan-en.png  images/pipeline-en.png  images/tracker-en.png  images/reports-en.png
 *   images/ru/scan-ru.png  images/ru/pipeline-ru.png  images/ru/tracker-ru.png  images/ru/reports-ru.png
 */
import { chromium } from 'playwright';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_UI_ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(WEB_UI_ROOT, 'images');
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 900;

// The serve-only mode runs until signalled; SIGINT/SIGTERM tear the server
// down cleanly (flush geocode debounce included — the file is seeded, the
// debounce has nothing pending).
const SERVE = process.env.CAR140_SERVE === '1' || process.env.CAR140_SKIP_CAPTURES === '1';
const SKIP_CAPTURES = process.env.CAR140_SKIP_CAPTURES === '1';
const BASE_URL = process.env.CAREER_OPS_UI_URL || '';
const FIXTURE_DIR = process.env.CAR140_FIXTURE_DIR || '';

// ── fixture corpus ───────────────────────────────────────────────────────────
// Cities are shared by scan rows, pipeline rows, tracker rows AND the geocode
// cache, so every #/map point resolves from cache (8 cities, all Europe+RU —
// the auto-fit frames the whole cluster, no outlier leaves the viewport).
const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

const CITIES = [
  ['Berlin, Germany', 52.52, 13.405],
  ['London, UK', 51.5074, -0.1278],
  ['Amsterdam, Netherlands', 52.3676, 4.9041],
  ['Warsaw, Poland', 52.2297, 21.0122],
  ['Madrid, Spain', 40.4168, -3.7038],
  ['Paris, France', 48.8566, 2.3522],
  ['Москва, Россия', 55.7558, 37.6174],
  ['Санкт-Петербург, Россия', 59.9311, 30.3609],
];

const SCAN_ROWS_EN = [
  { company: 'Acme Robotics', title: 'Senior Backend Engineer', location: 'Berlin, Germany', source: 'greenhouse', isRemote: false, workplaceType: 'Onsite', relocates: false, date: iso(0), salary: '90000 EUR', url: 'https://jobs.example.com/acme/senior-backend' },
  { company: 'Acme Robotics', title: 'Staff Platform Engineer', location: 'Berlin, Germany', source: 'greenhouse', isRemote: false, workplaceType: 'Hybrid', relocates: false, date: iso(1), salary: '', url: 'https://jobs.example.com/acme/staff-platform' },
  { company: 'Acme Robotics', title: 'Data Engineer', location: 'Berlin, Germany', source: 'lever', isRemote: false, workplaceType: 'Onsite', relocates: false, date: iso(2), salary: '', url: 'https://jobs.example.com/acme/data-engineer' },
  { company: 'Globex', title: 'Senior Data Engineer', location: 'Amsterdam, Netherlands', source: 'lever', isRemote: false, workplaceType: 'Onsite', relocates: false, date: iso(0), salary: '85000 EUR', url: 'https://jobs.example.com/globex/senior-data-engineer' },
  { company: 'Globex', title: 'Engineering Manager', location: 'Amsterdam, Netherlands', source: 'lever', isRemote: false, workplaceType: 'Hybrid', relocates: false, date: iso(3), salary: '', url: 'https://jobs.example.com/globex/eng-manager' },
  { company: 'Initech', title: 'Backend Developer (m/f/d)', location: 'London, UK', source: 'ashby', isRemote: false, workplaceType: 'Onsite', relocates: false, date: iso(1), salary: '£75,000', url: 'https://jobs.example.com/initech/backend-dev' },
  { company: 'Initech', title: 'Site Reliability Engineer', location: 'London, UK', source: 'ashby', isRemote: false, workplaceType: 'Hybrid', relocates: false, date: iso(5), salary: '', url: 'https://jobs.example.com/initech/sre' },
  { company: 'Stark Industries', title: 'Senior Go Engineer', location: 'Warsaw, Poland', source: 'workable', isRemote: false, workplaceType: 'Onsite', relocates: true, date: iso(0), salary: '32000 PLN', url: 'https://jobs.example.com/stark/senior-go' },
  { company: 'Stark Industries', title: 'Platform Engineer II', location: 'Warsaw, Poland', source: 'workable', isRemote: false, workplaceType: 'Onsite', relocates: false, date: iso(7), salary: '', url: 'https://jobs.example.com/stark/platform-2' },
  { company: 'Wayne Enterprises', title: 'Data Platform Lead', location: 'Paris, France', source: 'smartrecruiters', isRemote: false, workplaceType: 'Hybrid', relocates: false, date: iso(2), salary: '95000 EUR', url: 'https://jobs.example.com/wayne/data-platform-lead' },
  { company: 'Wayne Enterprises', title: 'Senior Backend Engineer', location: 'Paris, France', source: 'smartrecruiters', isRemote: false, workplaceType: 'Onsite', relocates: false, date: iso(4), salary: '', url: 'https://jobs.example.com/wayne/senior-backend' },
  { company: 'Nordwind Labs', title: 'Platform Engineer', location: 'Berlin, Germany', source: 'lever', isRemote: true, workplaceType: 'Remote', relocates: false, date: iso(0), salary: '', url: 'https://jobs.example.com/nordwind/platform-engineer' },
  { company: 'Hooli', title: 'Senior Cloud Engineer', location: 'Amsterdam, Netherlands', source: 'greenhouse', isRemote: false, workplaceType: 'Onsite', relocates: false, date: iso(1), salary: '88000 EUR', url: 'https://jobs.example.com/hooli/senior-cloud' },
  { company: 'Hooli', title: 'Data Engineer', location: 'Berlin, Germany', source: 'greenhouse', isRemote: false, workplaceType: 'Hybrid', relocates: false, date: iso(6), salary: '', url: 'https://jobs.example.com/hooli/data-engineer' },
  { company: 'Vanderlay Industries', title: 'Backend Engineer', location: 'Madrid, Spain', source: 'ashby', isRemote: false, workplaceType: 'Onsite', relocates: false, date: iso(3), salary: '62000 EUR', url: 'https://jobs.example.com/vanderlay/backend' },
  { company: 'Soylent', title: 'Full-Stack Engineer', location: 'Madrid, Spain', source: 'remoteok', isRemote: true, workplaceType: 'Remote', relocates: false, date: iso(2), salary: '', url: 'https://jobs.example.com/soylent/fullstack' },
  { company: 'Cyberdyne Systems', title: 'ML Platform Engineer', location: 'Berlin, Germany', source: 'workable', isRemote: false, workplaceType: 'Onsite', relocates: false, date: iso(1), salary: '92000 EUR', url: 'https://jobs.example.com/cyberdyne/ml-platform' },
  { company: 'Tyrell Corp', title: 'Senior Data Scientist', location: 'Paris, France', source: 'lever', isRemote: false, workplaceType: 'Hybrid', relocates: false, date: iso(8), salary: '', url: 'https://jobs.example.com/tyrell/senior-ds' },
  { company: 'Wonka Industries', title: 'DevOps Engineer', location: 'Warsaw, Poland', source: 'greenhouse', isRemote: false, workplaceType: 'Onsite', relocates: false, date: iso(4), salary: '28000 PLN', url: 'https://jobs.example.com/wonka/devops' },
  { company: 'Gekko & Co', title: 'Quant Developer', location: 'London, UK', source: 'ashby', isRemote: false, workplaceType: 'Onsite', relocates: false, date: iso(2), salary: '£110,000', url: 'https://jobs.example.com/gekko/quant-dev' },
];

const SCAN_ROWS_RU = [
  { company: 'Яндекс', title: 'Старший разработчик бэкенда', location: 'Москва, Россия', source: 'hh', isRemote: false, workplaceType: 'Onsite', relocates: false, date: iso(1), salary: 'от 350 000 ₽', url: 'https://jobs.example.com/yandex/senior-backend' },
  { company: 'Авито', title: 'Backend-разработчик', location: 'Москва, Россия', source: 'habr', isRemote: false, workplaceType: 'Hybrid', relocates: false, date: iso(0), salary: '', url: 'https://jobs.example.com/avito/backend' },
  { company: 'Ozon Tech', title: 'Go-разработчик', location: 'Санкт-Петербург, Россия', source: 'hh', isRemote: false, workplaceType: 'Onsite', relocates: false, date: iso(2), salary: 'от 300 000 ₽', url: 'https://jobs.example.com/ozon/go-dev' },
  { company: 'Т-Банк', title: 'Senior Java Developer', location: 'Москва, Россия', source: 'habr', isRemote: true, workplaceType: 'Remote', relocates: false, date: iso(3), salary: '', url: 'https://jobs.example.com/tbank/senior-java' },
  { company: 'СберМаркет', title: 'Инженер данных', location: 'Санкт-Петербург, Россия', source: 'hh', isRemote: false, workplaceType: 'Onsite', relocates: false, date: iso(5), salary: '', url: 'https://jobs.example.com/sbermarket/data-engineer' },
];

// One row per canonical tracker status (+ a second Applied and a second
// Evaluated — the two statuses a live tracker almost always has more of).
const TRACKER_ROWS = [
  ['1', iso(26), 'Acme Robotics', 'Senior Backend Engineer', 'Berlin, Germany', '4.6/5', 'Offer', 'High Confidence', 'Hans Weber', '✅', '[042](reports/042-acme-senior-backend-engineer-2026-10-20.md)', 'Team-fit call Friday; comp window confirmed', 'https://jobs.example.com/acme/senior-backend'],
  ['2', iso(22), 'Globex', 'Senior Data Engineer', 'Amsterdam, Netherlands', '4.2/5', 'Interview', 'High Confidence', '', '✅', '[043](reports/043-globex-senior-data-engineer-2026-10-18.md)', 'Tech round 2 — system design + take-home review', 'https://jobs.example.com/globex/senior-data-engineer'],
  ['3', iso(20), 'Initech', 'Backend Developer (m/f/d)', 'London, UK', '3.8/5', 'Responded', 'Medium', '', '✅', '[044](reports/044-initech-backend-developer-2026-10-16.md)', 'Recruiter screen booked', 'https://jobs.example.com/initech/backend-dev'],
  ['4', iso(18), 'Stark Industries', 'Senior Go Engineer', 'Warsaw, Poland', '4.1/5', 'Assessment', 'High Confidence', '', '✅', '[045](reports/045-stark-senior-go-engineer-2026-10-14.md)', 'Online assessment due Sunday', 'https://jobs.example.com/stark/senior-go'],
  ['5', iso(16), 'Wayne Enterprises', 'Data Platform Lead', 'Paris, France', '3.9/5', 'Applied', 'Medium', '', '❌', '[046](reports/046-wayne-data-platform-lead-2026-10-12.md)', 'Applied via careers page', 'https://jobs.example.com/wayne/data-platform-lead'],
  ['6', iso(14), 'Nordwind Labs', 'Platform Engineer', 'Berlin, Germany', '4.4/5', 'Evaluated', 'High Confidence', '', '✅', '[047](reports/047-nordwind-platform-engineer-2026-10-10.md)', 'Strong fit — remote-first', 'https://jobs.example.com/nordwind/platform-engineer'],
  ['7', iso(12), 'Hooli', 'Senior Cloud Engineer', 'Amsterdam, Netherlands', '3.6/5', 'Evaluated', 'Medium', '', '❌', '[048](reports/048-hooli-senior-cloud-engineer-2026-10-08.md)', 'Relocation required — research first', 'https://jobs.example.com/hooli/senior-cloud'],
  ['8', iso(10), 'Cyberdyne Systems', 'ML Platform Engineer', 'Berlin, Germany', '2.4/5', 'Rejected', 'Low', '', '❌', '[049](reports/049-cyberdyne-ml-platform-engineer-2026-10-06.md)', 'Rejected after screen', 'https://jobs.example.com/cyberdyne/ml-platform'],
  ['9', iso(9), 'Tyrell Corp', 'Senior Data Scientist', 'Paris, France', '3.2/5', 'Discarded', 'Low', '', '❌', '[050](reports/050-tyrell-senior-data-scientist-2026-10-05.md)', 'Closed by candidate — scope drift', 'https://jobs.example.com/tyrell/senior-ds'],
  ['10', iso(8), 'Wonka Industries', 'DevOps Engineer', 'Warsaw, Poland', '1.8/5', 'SKIP', 'Low', '', '❌', '[051](reports/051-wonka-devops-engineer-2026-10-04.md)', 'Below tier — do not apply', 'https://jobs.example.com/wonka/devops'],
  ['11', iso(40), 'Vanderlay Industries', 'Backend Engineer', 'Madrid, Spain', '4.7/5', 'Hired', 'High Confidence', '', '✅', '[052](reports/052-vanderlay-backend-engineer-2026-09-18.md)', 'Signed 🎉', 'https://jobs.example.com/vanderlay/backend'],
  ['12', iso(6), 'Gekko & Co', 'Quant Developer', 'London, UK', '4.0/5', 'Applied', 'High Confidence', 'Hays', '✅', '[053](reports/053-gekko-quant-developer-2026-10-02.md)', 'Via recruiter', 'https://jobs.example.com/gekko/quant-dev'],
];

const PIPELINE_ROWS = [
  ['https://jobs.example.com/soylent/fullstack', 'Soylent', 'Full-Stack Engineer', 'Madrid, Spain'],
  ['https://jobs.example.com/hooli/data-engineer', 'Hooli', 'Data Engineer', 'Berlin, Germany'],
  ['https://jobs.example.com/wayne/senior-backend', 'Wayne Enterprises', 'Senior Backend Engineer', 'Paris, France'],
  ['https://jobs.example.com/ozon/go-dev-2', 'Ozon Tech', 'Go-разработчик (платформа)', 'Санкт-Петербург, Россия'],
];

const REPORTS = [
  {
    slug: '042-acme-senior-backend-engineer-2026-10-20',
    company: 'Acme Robotics', role: 'Senior Backend Engineer', date: '2026-10-20',
    score: '4.6 / 5', url: 'https://jobs.example.com/acme/senior-backend',
    legitimacy: 'High Confidence', archetype: 'Senior Backend Engineer',
    body: 'Strong match. The platform team owns ingestion + serving for a 40-node robot fleet; the stack is Go + Postgres + Kafka, the exact profile of the last three years. Interview loop is four rounds, no take-home. Comp range confirmed at €85–105k plus equity.',
  },
  {
    slug: '047-nordwind-platform-engineer-2026-10-10',
    company: 'Nordwind Labs', role: 'Platform Engineer', date: '2026-10-10',
    score: '4.4 / 5', url: 'https://jobs.example.com/nordwind/platform-engineer',
    legitimacy: 'High Confidence', archetype: 'Platform Engineer',
    body: 'Remote-first platform team of nine, Europe-wide. Terraform + Kubernetes day-to-day with a strong on-call maturity story. The posting names observability ownership explicitly — a proven strength to lead with.',
  },
  {
    slug: '048-hooli-senior-cloud-engineer-2026-10-08',
    company: 'Hooli', role: 'Senior Cloud Engineer', date: '2026-10-08',
    score: '3.6 / 5', url: 'https://jobs.example.com/hooli/senior-cloud',
    legitimacy: 'Medium', archetype: 'Platform Engineer',
    body: 'Solid role but relocation to Amsterdam is required within six months. Comp is competitive and the cloud-migration scope is real. Research the relocation package before applying.',
  },
  {
    slug: '049-cyberdyne-ml-platform-engineer-2026-10-06',
    company: 'Cyberdyne Systems', role: 'ML Platform Engineer', date: '2026-10-06',
    score: '2.4 / 5', url: 'https://jobs.example.com/cyberdyne/ml-platform',
    legitimacy: 'Low', archetype: 'ML Platform Engineer',
    body: 'Rejected after the recruiter screen: the role is 70% GPU cluster ops, 30% platform — the opposite weighting of the target profile. Worth revisiting if the team opens an MLOps-serving position.',
  },
];

function reportMarkdown(r) {
  return [
    `# Evaluation: ${r.company} — ${r.role}`,
    '',
    `**Date:** ${r.date}`,
    `**Archetype:** ${r.archetype}`,
    `**Score:** ${r.score}`,
    `**URL:** ${r.url}`,
    `**Legitimacy:** ${r.legitimacy}`,
    `**PDF:** ✅ output/cv-alex-rivera-${r.slug.slice(0, 3)}.pdf`,
    '',
    '## Verdict',
    '',
    r.body,
    '',
    '## Job Description (archived verbatim)',
    '',
    `Senior engineer for the ${r.company} platform group. You will design and operate`,
    'services end to end, partner with product on roadmap trade-offs, and grow the',
    'team through mentoring. Hybrid working, equity, learning budget.',
    '',
  ].join('\n');
}

function trackerMarkdown() {
  const head = ['# Applications Tracker', '', '| # | Date | Company | Role | Location | Score | Status | Legitimacy | Via | PDF | Report | Notes | URL |', '|---|------|---------|------|----------|-------|--------|------------|-----|-----|--------|-------|-----|'];
  const rows = TRACKER_ROWS.map((r) => {
    const [num, date, company, role, loc, score, status, legit, via, pdf, report, notes, url] = r;
    return `| ${num} | ${date} | ${company} | ${role} | ${loc} | ${score} | ${status} | ${legit} | ${via || '—'} | ${pdf} | ${report} | ${notes} | [careers.example.com](${url}) |`;
  });
  return [...head, ...rows, ''].join('\n');
}

function pipelineMarkdown() {
  const rows = PIPELINE_ROWS.map(([url, company, title, loc]) => `- [ ] ${url} | ${company} | ${title} | ${loc}`);
  return ['# Pipeline — Pending URLs', '', 'Drop job URLs (one per line) here.', '', '## Pending', '', ...rows, ''].join('\n');
}

function profileYaml() {
  return [
    'candidate:',
    '  full_name: Alex Rivera',
    '  email: alex.rivera@example.com',
    '  location: Berlin, Germany',
    '  timezone: Europe/Berlin',
    'target_roles:',
    '  primary:',
    '    - Senior Backend Engineer',
    '    - Platform Engineer',
    '    - Data Engineer',
    'compensation:',
    '  target_range: "€80,000 - €110,000"',
    '  currency: EUR',
    '',
  ].join('\n');
}

const CV_MD = [
  '# Alex Rivera — Senior Backend Engineer',
  '',
  '## Summary',
  '',
  'Backend engineer with nine years across platform and data infrastructure.',
  'Go, Kotlin and Python; Postgres, Kafka and Kubernetes in production.',
  '',
  '## Experience',
  '',
  '### Meridian Systems — Berlin, Germany',
  '**Senior Backend Engineer**',
  '2021-03 — present',
  '',
  '- Owned the ingestion platform: 1.2B events/day on Kafka + Flink.',
  '- Cut p99 write latency 38% by re-partitioning the event store.',
  '',
  '### Helio Labs — Remote',
  '**Backend Engineer**',
  '2017-06 — 2021-02',
  '',
  '- Built the billing service (Kotlin, Postgres) serving 40k tenants.',
  '',
  '## Skills',
  '',
  'Go, Kotlin, Python, Postgres, Kafka, Kubernetes, Terraform, AWS',
  '',
].join('\n');

/**
 * Seed web-ui/.cache/geocode.json (gitignored) with the fixture's cities and
 * every company×place pair the #/map view will ask the geocoder for — the
 * company lookup key uses the route's own cleanCompany(), imported here so
 * the keys can never drift from what the server computes.
 */
async function seedGeocodeCache(cities, companies) {
  const { cleanCompany, normalizeLocation } = await import(path.join(WEB_UI_ROOT, 'server', 'lib', 'routes', 'geocode.mjs'));
  const cache = {};
  for (const [name, lat, lon] of cities) {
    const key = normalizeLocation(name);
    if (key) cache[key] = { lat, lon, rank: 15, at: 'city' };
  }
  for (const company of companies) {
    const name = cleanCompany(company);
    if (!name) continue;
    for (const [place] of cities) {
      const key = normalizeLocation(place);
      // A company miss ({lat:null}) keeps the place-centre fallback — the
      // marker lands on the city, no live employer lookup needed.
      if (key) cache[`co:${name.toLowerCase()}|${key}`] = { lat: null, lon: null };
    }
  }
  const dir = path.join(WEB_UI_ROOT, '.cache');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'geocode.json'), JSON.stringify(cache, null, 1));
  return Object.keys(cache).length;
}

function seedFixture(dir) {
  for (const sub of ['data', 'config', 'modes', 'reports', 'jds']) {
    mkdirSync(path.join(dir, sub), { recursive: true });
  }
  writeFileSync(path.join(dir, 'cv.md'), CV_MD);
  writeFileSync(path.join(dir, 'config', 'profile.yml'), profileYaml());
  writeFileSync(path.join(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(path.join(dir, 'modes', 'oferta.md'), '# Оценка предложения\n\nEvaluate the offer against the archetypes in modes/_profile.md.\n');
  writeFileSync(path.join(dir, 'modes', '_profile.md'), '# Career framing\n\nTarget: senior backend / platform engineering roles in the EU.\n');
  writeFileSync(path.join(dir, 'data', 'applications.md'), trackerMarkdown());
  writeFileSync(path.join(dir, 'data', 'pipeline.md'), pipelineMarkdown());
  writeFileSync(path.join(dir, 'data', 'follow-ups.md'), '# Follow-ups\n\n| # | Date | Company | Action | Due | Done |\n|---|------|---------|--------|-----|------|\n| 1 | ' + iso(26) + ' | Acme Robotics | Thank-you note | ' + iso(24) + ' | ✅ |\n');
  writeFileSync(
    path.join(dir, 'data', 'scan-history.tsv'),
    ['date\tcompany\trole\turl\tsource\tlocation\tstatus',
      ...[...SCAN_ROWS_EN, ...SCAN_ROWS_RU].map((r) => [r.date, r.company, r.title, r.url, r.source, r.location, 'new'].join('\t')),
    ].join('\n') + '\n',
  );
  const snapshot = {
    en: { kind: 'en', when: new Date().toISOString(), fresh: SCAN_ROWS_EN, filtered: SCAN_ROWS_EN },
    ru: { kind: 'ru', when: new Date().toISOString(), fresh: SCAN_ROWS_RU, filtered: SCAN_ROWS_RU },
  };
  writeFileSync(path.join(dir, 'data', 'last-scan.json'), JSON.stringify(snapshot));
  for (const r of REPORTS) writeFileSync(path.join(dir, 'reports', `${r.slug}.md`), reportMarkdown(r));
}

// ── capture ──────────────────────────────────────────────────────────────────
// View-mount markers: the wait is "skeleton gone AND the view's own rows are
// in the DOM", so a shot can never catch the loading state. `scrollTo` frames
// the DATA region for the long views (scan/tracker): the sticky banner+topbar
// stay at the top, the table rows fill the viewport. The sticky chrome is
// ~120px tall — the offset clears it plus a breath of context.
const SHOTS = [
  { route: 'scan', file: 'scan', ready: '#scan-results table tbody tr', scrollTo: '#scan-results', scrollOffset: 130 },
  { route: 'pipeline', file: 'pipeline', ready: '#pipeline-groups .v2-group, #pipeline-list .pipeline-row' },
  { route: 'tracker', file: 'tracker', ready: '#content table.tbl tbody tr', scrollTo: '.tracker-tabs', scrollOffset: 130 },
  { route: 'reports', file: 'reports', ready: '#content .reports-tbl tbody tr.report-row, #content .report-card' },
];
const LANGS = [
  { lang: 'en', outDir: IMAGES_DIR, suffix: 'en' },
  { lang: 'ru', outDir: path.join(IMAGES_DIR, 'ru'), suffix: 'ru' },
];

async function captureAll(baseUrl) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
    for (const { lang, outDir, suffix } of LANGS) {
      mkdirSync(outDir, { recursive: true });
      for (const shot of SHOTS) {
        process.stdout.write(`[${lang} #/${shot.route}] `);
        const page = await context.newPage();
        await page.addInitScript((l) => {
          try {
            localStorage.setItem('career-ops-ui:lang', l);
            localStorage.setItem('theme', 'light');
          } catch {}
        }, lang);
        await page.goto(`${baseUrl}/#/${shot.route}`, { waitUntil: 'load' });
        await page.waitForFunction(
          () => !document.querySelector('.skeleton-row'),
          null,
          { timeout: 30000, polling: 120 },
        );
        await page.waitForSelector(shot.ready, { timeout: 30000 });
        if (shot.scrollTo) {
          await page.evaluate(({ sel, offset }) => {
            const el = document.querySelector(sel);
            if (el) window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset));
          }, { sel: shot.scrollTo, offset: shot.scrollOffset ?? 130 });
          await page.waitForTimeout(200);
        }
        await page.waitForTimeout(SETTLE_MS);
        const out = path.join(outDir, `${shot.file}-${suffix}.png`);
        await page.screenshot({ path: out, fullPage: false });
        console.log('saved', path.relative(WEB_UI_ROOT, out));
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
let server = null;
let fixture = FIXTURE_DIR ? path.resolve(FIXTURE_DIR) : null;

async function shutdown(code = 0) {
  if (server) {
    try { server.closeAllConnections?.(); } catch {}
    await new Promise((r) => server.close(r));
    server = null;
  }
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

try {
  let baseUrl;
  if (BASE_URL) {
    baseUrl = BASE_URL.replace(/\/+$/, '');
    console.log(`server: ${baseUrl} (external — CAREER_OPS_UI_URL)`);
  } else {
    if (!fixture) fixture = mkdtempSync(path.join(tmpdir(), 'car140-capture-'));
    // PATHS resolves ONCE per process at the first server/* import —
    // CAREER_OPS_ROOT must be in place BEFORE seedGeocodeCache() pulls
    // geocode.mjs (whose import chain caches paths.mjs).
    process.env.CAREER_OPS_ROOT = fixture;
    seedFixture(fixture);
    const companies = [...new Set([
      ...SCAN_ROWS_EN.map((r) => r.company),
      ...SCAN_ROWS_RU.map((r) => r.company),
      ...TRACKER_ROWS.map((r) => r[2]),
      ...PIPELINE_ROWS.map((r) => r[1]),
    ])];
    const n = await seedGeocodeCache(CITIES, companies);
    console.log(`fixture: ${fixture}`);
    console.log(`geocode cache seeded: ${n} keys (${CITIES.length} places × ${companies.length} employers)`);

    const { createApp } = await import(path.join(WEB_UI_ROOT, 'server', 'index.mjs'));
    const app = createApp();
    server = await new Promise((resolveListen) => {
      const s = app.listen(0, '127.0.0.1', () => resolveListen(s));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    console.log(`server: ${baseUrl}  (CAREER_OPS_ROOT=${fixture})`);
  }

  if (!SKIP_CAPTURES) {
    await captureAll(baseUrl);
  }

  if (SERVE) {
    console.log('');
    console.log(`CAR140_READY ${baseUrl}`);
    console.log('Holding server — Ctrl-C to stop. Run capture-dashboard / capture-map against this URL.');
    setInterval(() => {}, 60_000); // keep the loop alive; SIGINT tears down
  } else {
    await shutdown(0);
  }
} catch (err) {
  console.error(err);
  await shutdown(1);
}
