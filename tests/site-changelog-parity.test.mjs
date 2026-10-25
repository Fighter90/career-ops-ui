/**
 * CAR-131 — cvstart.org changelog mirrors carry every release per locale.
 *
 * The audit found de at 248 releases, ta at 24, vi at 4 against 461 in EN
 * (counts moved since; the shape is the same), plus da carrying a 199-entry
 * run of entries still in English. Root cause: the ROOT CHANGELOG.<locale>.md
 * files were seeded mid-history and the release train prepends one entry per
 * release — nothing ever backfilled the tail, and the old parity gate only
 * compared the NEWEST heading. sync-assets copies the root files verbatim, so
 * the site faithfully published the incompleteness.
 *
 * Locked here, at both layers:
 *   - root:  every CHANGELOG.<locale>.md carries exactly the EN release count
 *            (the same gate scripts/check-changelog-parity.mjs enforces in
 *            test:ci — fixture-proven below to fail on the historical shape);
 *   - site:  every committed mirror under site/src/content/changelog/ matches
 *            its root source, and sync-assets.mjs FAILS the build when a
 *            locale changelog is missing releases (the CAR-131 gate) and only
 *            WARNS on English-original runs (translation is out of scope for
 *            the build).
 *
 * CI-isolated: fixture runs use a mkdtemp site-shaped skeleton; the only
 * network access is sync-assets' best-effort GitHub stats, which it
 * try/catches. The complete-tree fixture is built and run once (shared
 * `before`) to bound that cost; the failing fixtures exit before reaching it.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SYNC = join(ROOT, 'site', 'scripts', 'sync-assets.mjs');
const CHECK_PARITY = join(ROOT, 'scripts', 'check-changelog-parity.mjs');

let countReleases, splitChangelog, auditCoverage, englishRuns, LOCALES, completeRun;

before(async () => {
  ({ countReleases, splitChangelog, auditCoverage, englishRuns, LOCALES } = await import(
    join(ROOT, 'scripts', 'changelog-parity.mjs')
  ));
  // The complete-tree fixture run is shared: one process, one network window
  // (sync-assets' best-effort GitHub stats); assertions split across tests.
  // de carries all 5 entries with its oldest bodies EN-identical on purpose.
  completeRun = run(join(fixtureRoot(), 'site', 'scripts', 'sync-assets.mjs'));
});

const rootCount = () => countReleases(readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8'));
const localeCount = (lang) => countReleases(readFileSync(join(ROOT, `CHANGELOG.${lang}.md`), 'utf8'));

test('CAR-131 root: every CHANGELOG.<locale>.md carries exactly the EN release count', () => {
  const en = rootCount();
  const bad = LOCALES.filter((lang) => localeCount(lang) !== en).map(
    (lang) => `${lang}: ${localeCount(lang)}/${en}`,
  );
  assert.deepEqual(bad, [], `locales missing releases: ${bad.join(', ')}`);
});

test('CAR-131 root: no locale has versions unknown to EN, and shared order matches EN', () => {
  const { entries: enEntries } = splitChangelog(readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8'));
  for (const lang of LOCALES) {
    const { entries: loc } = splitChangelog(readFileSync(join(ROOT, `CHANGELOG.${lang}.md`), 'utf8'));
    const cov = auditCoverage(enEntries, loc);
    assert.deepEqual(cov.unknown, [], `${lang} carries versions EN does not have`);
    assert.equal(cov.ordered, true, `${lang} entries drift out of EN order`);
  }
});

test('CAR-131 site: every committed mirror carries the release count of its root source', () => {
  const mirrors = join(ROOT, 'site', 'src', 'content', 'changelog');
  const bad = [];
  for (const lang of ['en', ...LOCALES]) {
    const src = join(ROOT, lang === 'en' ? 'CHANGELOG.md' : `CHANGELOG.${lang}.md`);
    const mirror = join(mirrors, `${lang}.md`);
    const nSrc = countReleases(readFileSync(src, 'utf8'));
    const nMir = countReleases(readFileSync(mirror, 'utf8'));
    if (nMir !== nSrc) bad.push(`${lang}.md: mirror ${nMir} vs root ${nSrc}`);
  }
  assert.deepEqual(bad, [], `mirrors out of sync with root: ${bad.join(', ')}`);
});

test('englishRuns: finds maximal byte-identical-to-EN runs (fixture)', () => {
  const mk = (v, body, date = '2026-01-01') => ({
    version: v,
    date,
    text: `## [${v}] — ${date}\n\n${body}\n\n`,
  });
  const en = [
    mk('1.2.0', 'Two translated'),
    mk('1.1.0', 'Original English'),
    mk('1.0.9', 'Also English'),
    mk('1.0.8', 'Translated again'),
  ];
  const loc = [
    mk('1.2.0', 'Zwei übersetzt'),
    mk('1.1.0', 'Original English'),
    mk('1.0.9', 'Also English'),
    mk('1.0.8', 'Traduit encore'),
  ];
  const { identical, runs } = englishRuns(en, loc);
  assert.equal(identical, 2);
  assert.deepEqual(runs, [{ from: '1.1.0', to: '1.0.9', count: 2 }]);
});

// --- fixture machinery (site-shaped skeleton; mirrors tests/site-scripts.test.mjs) ---

// Newest-first, like every real CHANGELOG: EN_ENTRIES[0] is the newest release.
const EN_ENTRIES = Array.from(
  { length: 5 },
  (_, i) => `## [1.${4 - i}.0] — 2026-01-0${i + 1}\n\nEntry ${4 - i} body from the English original.\n\n`,
);

/**
 * A root tree with everything sync-assets reads. Every locale file defaults to
 * carrying all EN entries verbatim; `overrides` maps a locale to the number of
 * NEWEST entries it keeps — the historical seeding shape: recent entries
 * present, the older tail absent.
 */
function fixtureRoot(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'car131-'));
  // sync-assets derives SITE from its own path (…/site/scripts) and ROOT as
  // its parent — so the copy must live at <fixture>/site/scripts/ for ROOT to
  // be the fixture root. The scripts it executes stay one level up, matching
  // the real repo's ROOT/scripts layout.
  mkdirSync(join(dir, 'site', 'scripts'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  copyFileSync(SYNC, join(dir, 'site', 'scripts', 'sync-assets.mjs'));
  copyFileSync(join(ROOT, 'scripts', 'changelog-parity.mjs'), join(dir, 'scripts', 'changelog-parity.mjs'));
  copyFileSync(CHECK_PARITY, join(dir, 'scripts', 'check-changelog-parity.mjs'));

  mkdirSync(join(dir, 'images'), { recursive: true });
  writeFileSync(join(dir, 'images', 'dashboard-en.png'), 'png');
  mkdirSync(join(dir, 'public'), { recursive: true });
  for (const f of ['favicon-16.png', 'favicon-32.png', 'favicon.ico', 'apple-touch-icon.png']) {
    writeFileSync(join(dir, 'public', f), 'x');
  }
  mkdirSync(join(dir, 'docs', 'help'), { recursive: true });
  for (let i = 0; i < 18; i++) writeFileSync(join(dir, 'docs', 'help', `h${i}.md`), `# help ${i}\n`);
  writeFileSync(join(dir, 'LICENSE'), 'MIT');
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '1.4.0' }));
  writeFileSync(join(dir, 'README.md'), '![tests](https://img.shields.io/badge/tests-1%20passed-brightgreen)');
  mkdirSync(join(dir, 'server', 'lib', 'sources'), { recursive: true });
  // 67 adapter files so sync-assets' registry-enumeration cross-check (the
  // v1.212.0 jobbankca guard) sees a consistent stub registry.
  for (let i = 0; i < 67; i++) {
    writeFileSync(
      join(dir, 'server', 'lib', 'sources', `s${i}.mjs`),
      `export const meta = { value: 's${i}', label: 'S${i}', region: 'en' };\n`,
    );
  }
  writeFileSync(
    join(dir, 'server', 'lib', 'sources', 'registry.mjs'),
    `export const SOURCES = ${JSON.stringify(
      Array.from({ length: 67 }, (_, i) => ({ value: `s${i}`, label: `S${i}`, region: 'en' })),
    )};\n`,
  );
  writeFileSync(join(dir, 'server', 'lib', 'env-config.mjs'), `export const AUTO_ORDER = ['anthropic', 'gemini'];\n`);

  writeFileSync(join(dir, 'CHANGELOG.md'), `# Changelog\n\n${EN_ENTRIES.join('')}`);
  const locales = Object.fromEntries(LOCALES.map((l) => [l, EN_ENTRIES.length]));
  Object.assign(locales, overrides);
  for (const [lang, keep] of Object.entries(locales)) {
    writeFileSync(join(dir, `CHANGELOG.${lang}.md`), `# Changelog (${lang})\n\n${EN_ENTRIES.slice(0, keep).join('')}`);
  }
  return dir;
}

function run(scriptPath) {
  // spawnSync, not execFileSync: execFileSync only surfaces stderr on failure,
  // and the WARN-only assertion needs to read a successful run's stderr.
  const r = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8' });
  return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

test('CAR-131 gate: sync-assets FAILS when a locale changelog is missing releases', () => {
  const dir = fixtureRoot({ de: 3, ta: 1 }); // newest-only seeds — the historical shape
  const r = run(join(dir, 'site', 'scripts', 'sync-assets.mjs'));
  assert.notEqual(r.status, 0, 'sync-assets must fail on an incomplete locale changelog');
  assert.match(r.stderr, /CHANGELOG\.de\.md/);
  assert.match(r.stderr, /3 of 5/);
  // The count gate — not the newest-version check — must be what trips: the
  // truncated file's newest entry still matches EN, exactly like the real
  // files that passed the old gate for months.
  assert.match(r.stderr, /backfill-changelog-locales/);
});

test('CAR-131 gate: check-changelog-parity FAILS on a count gap whose newest version matches', () => {
  const dir = fixtureRoot({ de: 3 });
  const r = run(join(dir, 'scripts', 'check-changelog-parity.mjs'));
  assert.notEqual(r.status, 0, 'the test:ci gate must fail on the count gap');
  assert.match(r.stderr, /CHANGELOG\.de\.md/);
  assert.match(r.stderr, /3 of 5/);
});

test('CAR-131 gate: complete tree builds clean (exit 0)', () => {
  assert.equal(completeRun.status, 0, `sync-assets failed: ${completeRun.stderr}`);
});

test('CAR-131 gate: English-identical runs produce a WARN, never a failure', () => {
  assert.equal(completeRun.status, 0);
  assert.match(completeRun.stderr, /WARN/);
  assert.match(completeRun.stderr, /CHANGELOG\.de\.md/);
});
