/**
 * Helper for tests/scan-redesign-layout.test.mjs — the v1.244.0 #/scan
 * redesign RED tests + before-captures (docs/sdd/specs/2026-10-06-scan-page-redesign.md,
 * §Implementation contract (Phase 4 step 2)).
 *
 * Three jobs, all CI-isolated (no network, throw-away CAREER_OPS_ROOT):
 *   1. loadScanRedesignFixture() — the committed corpus
 *      (tests/fixtures/scan-redesign-fixture.json: the Grafana complaint row,
 *      a 282-char title, ru rows, a multi-source showcase, and a filler spec).
 *   2. buildRows()/buildSnapshot() — deterministic expansion into the exact
 *      `{en,ru}.{fresh,filtered}` shape GET /api/scan-results serves
 *      (same shape tests/playwright-scan-filters.mjs seeds by hand).
 *   3. seedScanRedesignRoot(dir) — write the user-layer files the render path
 *      reads: cv.md, config/profile.yml (target_roles → «сильное совпадение»
 *      band on the Grafana row), config/two-pager.yml (loves: remote work /
 *      databases / analytics → FitScore 50+15 = the «◎ 65» badge), portals.yml,
 *      data/last-scan.json.
 *
 * SCAN_CONTRACT is the single source of truth for the selectors, i18n keys and
 * budgets the implementation must build to; the test file asserts it and the
 * spec quotes it verbatim.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(__dirname, '..', 'fixtures', 'scan-redesign-fixture.json');

/** The DOM / i18n / budget contract the implementation PR must satisfy. */
export const SCAN_CONTRACT = {
  // Row + posting-column anatomy (spec Scope 1).
  row: 'tr.scan-row',
  postingCell: '#scan-results td.scan-cell-posting',
  postingTitle: '.scan-posting-title',
  postingMeta: '.scan-posting-meta',
  // Icons with accessible names (spec AC2). role="img" + aria-label + title tooltip.
  icons: {
    boost: '.scan-icon--boost',
    fit: '.scan-icon--fit',
    score: '.scan-icon--score',
  },
  // Pagination (spec AC3): selectable page size + paged render.
  pageSizeControl: '#scan-page-size',
  pagerSummary: '#scan-results .paginator .pg-summary',
  // New i18n keys (spec AC2, R-08 parity ×17 — parity itself is gated by
  // tests/i18n-coverage.test.mjs the moment the keys land).
  keys: {
    fitIcon: 'scan.fitIcon',
    boostIcon: 'scan.boostIcon',
    scoreIcon: 'scan.scoreIcon',
    postedMeta: 'scan.postedMeta',
  },
  maxLines: 2,          // posting column never exceeds two text lines (AC1)
  nodeBudget: 4000,     // #scan-results node count for the 700-row corpus (AC3)
  corpusRows: 700,      // fixture corpus size the budget is stated against
  defaultPageSize: 50,  // first-paint page size; 700 rows → 14 pages
  widths: [1440, 390],  // AC1 viewports (desktop + phone, per spec AC1)
};

export function loadScanRedesignFixture() {
  return JSON.parse(readFileSync(FIXTURE, 'utf8'));
}

const isoDaysBefore = (baseIso, days) =>
  new Date(Date.parse(baseIso) - days * 86400000).toISOString().slice(0, 10);

/**
 * Deterministic EN corpus: grafana row, long-title row, showcase rows, then
 * `pagerFiller.count` generated rows. Order matters — the view sorts
 * `_boosted` rows first (stable), so the Grafana row lands on page 1 line 1.
 */
export function buildEnRows(fixture) {
  const f = fixture.pagerFiller;
  const rows = [fixture.grafana, fixture.longTitle, ...fixture.en];
  for (let i = 0; i < f.count; i++) {
    const loc = f.locations[i % f.locations.length];
    const isRemote = loc === 'Remote';
    rows.push({
      company: f.companies[i % f.companies.length],
      title: f.titles[i % f.titles.length],
      location: loc,
      source: f.sources[i % f.sources.length],
      isRemote,
      workplaceType: isRemote ? 'Remote' : (i % 2 ? 'Hybrid' : 'Onsite'),
      relocates: false,
      date: isoDaysBefore('2026-10-08', i % 46),
      salary: i % 7 === 0 ? '90000 EUR' : '',
      url: `https://example.com/fill/${700010 + i}`,
    });
  }
  return rows;
}

/** The exact `{en,ru}.{fresh,filtered}` snapshot GET /api/scan-results reads. */
export function buildSnapshot(fixture) {
  const enRows = buildEnRows(fixture);
  const ruRows = fixture.ru;
  const total = enRows.length + ruRows.length;
  if (total !== SCAN_CONTRACT.corpusRows) {
    throw new Error(`fixture corpus drifted: ${total} rows, contract expects ${SCAN_CONTRACT.corpusRows}`);
  }
  const when = '2026-10-08T08:00:00.000Z';
  return {
    en: { kind: 'en', when, fresh: enRows, filtered: enRows },
    ru: { kind: 'ru', when, fresh: ruRows, filtered: ruRows },
  };
}

/**
 * Seed a throw-away CAREER_OPS_ROOT with everything the #/scan render path
 * reads. Same file set the other Playwright suites write (playwright-scan-filters.mjs),
 * plus profile target_roles + a two-pager so the title-fit chip AND the
 * ◎-score badge both render — that combination IS the complaint.
 */
export function seedScanRedesignRoot(dir, fixture) {
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n\nTest candidate.\n');
  // target_roles drive the serve-time title-fit band (server/lib/title-fit.mjs).
  // "Senior Backend Engineer" vs the Grafana title = 2/2 tokens → strong.
  writeFileSync(
    resolve(dir, 'config', 'profile.yml'),
    'candidate:\n  full_name: Test Candidate\n' +
    'target_roles:\n  primary:\n    - Senior Backend Engineer\n    - Data Engineer\n    - Platform Engineer\n',
  );
  // Two-pager drives the ◎ fit-score badge (public/js/lib/fit-score.js).
  // The Grafana row (workplaceType Remote, no salary, no relocation) matches
  // exactly one positive ("remote work") and violates nothing → 50 + 15 = 65.
  writeFileSync(
    resolve(dir, 'config', 'two-pager.yml'),
    'who_i_am: Test candidate who wants remote data-platform work.\n' +
    'loves:\n  - remote work\n  - databases\n  - analytics\n' +
    'must_haves: []\nhates: []\ndeal_breakers: []\nnon_negotiables: []\n' +
    'target_environment: Distributed product company.\n',
  );
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'x\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'last-scan.json'), JSON.stringify(buildSnapshot(fixture)));
  return dir;
}
