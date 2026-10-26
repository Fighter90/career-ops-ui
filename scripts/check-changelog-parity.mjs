/**
 * v1.25.0 (G-012) — CI gate against CHANGELOG locale drift.
 *
 * Pre-v1.25 the seven non-EN CHANGELOG files drifted behind the EN
 * canonical: RU was 1 release behind, the other 6 were 2 releases
 * behind. Releases v1.23 and v1.24 had landed in `CHANGELOG.md` but
 * never propagated to the locale files. No CI gate noticed.
 *
 * This script reads the newest `## [X.Y.Z] — YYYY-MM-DD` heading from each
 * CHANGELOG file and fails the build if any locale lags behind EN in either
 * the version or the date.
 *
 * Wired into `npm run test:ci` so the next release can't ship with
 * silent locale drift.
 *
 * CAR-131 — release-set parity. The newest-entry check above only ever sees
 * the TOP of each file: a locale seeded mid-history (de with a single entry
 * at v1.85.0, ta at v1.245.0, vi at v1.255.0) stays partial forever — every
 * release prepends one entry and nothing backfills the tail — while this gate
 * keeps passing. The cvstart.org changelog pages render whatever the locale
 * file holds, so de shipped with 252 of EN's 465 releases. Each locale is now
 * audited against the full EN release SET — missing versions, versions
 * unknown to EN (a typo'd heading), and order/duplicate drift all fail;
 * counts alone cannot see a same-count corruption. The file list itself is
 * checked against the registered LOCALES, so a new CHANGELOG.<locale>.md
 * cannot silently escape every check. Repair with
 * scripts/backfill-changelog-locales.mjs.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const { LOCALES, splitChangelog, auditCoverage } = await import(
  new URL('./changelog-parity.mjs', import.meta.url)
);

// The gate list must match the files on disk, or a new changelog file
// silently escapes every check below.
const onDisk = readdirSync(REPO)
  .filter((f) => /^CHANGELOG(\.[A-Za-z-]+)?\.md$/.test(f))
  .map((f) => (f === 'CHANGELOG.md' ? 'en' : f.replace(/^CHANGELOG\./, '').replace(/\.md$/, '')))
  .sort();
const registered = ['en', ...LOCALES].sort();
if (onDisk.join(',') !== registered.join(',')) {
  console.error('::error::CHANGELOG file list drift:');
  for (const f of onDisk.filter((x) => !registered.includes(x))) {
    console.error(`  CHANGELOG${f === 'en' ? '' : `.${f}`}.md — on disk but not in LOCALES (scripts/changelog-parity.mjs)`);
  }
  for (const f of registered.filter((x) => !onDisk.includes(x))) {
    console.error(`  CHANGELOG${f === 'en' ? '' : `.${f}`}.md — registered but no file on disk`);
  }
  process.exit(1);
}

let enEntries;
try {
  enEntries = splitChangelog(readFileSync(join(REPO, 'CHANGELOG.md'), 'utf8')).entries;
} catch (err) {
  console.error(`::error::CHANGELOG.md — cannot read the release list: ${err.message}`);
  process.exit(1);
}
if (!enEntries.length) {
  console.error('::error::CHANGELOG.md has no `## [X.Y.Z]` heading — schema regression');
  process.exit(1);
}
const en = { version: enEntries[0].version, date: enEntries[0].date };
const enCount = enEntries.length;

const lagging = [];
const problems = [];
for (const lang of LOCALES) {
  const path = join(REPO, `CHANGELOG.${lang}.md`);
  let entries;
  try {
    entries = splitChangelog(readFileSync(path, 'utf8')).entries;
  } catch (err) {
    problems.push(`CHANGELOG.${lang}.md — cannot read the release list: ${err.message}`);
    continue;
  }
  if (!entries.length) {
    lagging.push(`CHANGELOG.${lang}.md — no version heading found`);
    continue;
  }
  const entry = { version: entries[0].version, date: entries[0].date };
  if (entry.version !== en.version) {
    lagging.push(`CHANGELOG.${lang}.md — newest is ${entry.version}, EN is ${en.version}`);
    continue;
  }
  // Only compared once the versions agree: on a lagging locale the dates
  // SHOULD differ, and reporting that too would bury the real fault.
  if (en.date && entry.date !== en.date) {
    lagging.push(`CHANGELOG.${lang}.md — v${entry.version} dated ${entry.date ?? '(none)'}, EN dated ${en.date}`);
  }
  // CAR-131 — the release SET, not just the count: a typo'd version plus a
  // hole keeps the count identical.
  const cov = auditCoverage(enEntries, entries);
  if (cov.unknown.length) {
    problems.push(`CHANGELOG.${lang}.md — versions unknown to EN: ${cov.unknown.join(', ')}`);
  }
  if (cov.missing.length) {
    problems.push(
      `CHANGELOG.${lang}.md — ${entries.length} of ${enCount} releases ` +
        `(${cov.missing.length} missing, oldest v${cov.missing[cov.missing.length - 1]})`,
    );
  }
  if (!cov.ordered) {
    problems.push(`CHANGELOG.${lang}.md — shared entries out of EN order (duplicate or misplaced version)`);
  }
}

if (lagging.length) {
  console.error('::error::CHANGELOG locale parity drift (G-012 regression):');
  for (const l of lagging) console.error('  ' + l);
  console.error('');
  console.error('Backfill the missing entries in each lagging file. The EN');
  console.error('master is the source of truth.');
  process.exit(1);
}

if (problems.length) {
  console.error('::error::CHANGELOG locale release-count drift (CAR-131):');
  for (const l of problems) console.error('  ' + l);
  console.error('');
  console.error('Every locale must carry every release — the site renders');
  console.error('whatever the locale file holds. Repair with:');
  console.error('  node scripts/backfill-changelog-locales.mjs');
  process.exit(1);
}
console.log(`✓ CHANGELOG parity: all ${LOCALES.length} locales at v${en.version}${en.date ? ` (${en.date})` : ''}, ${enCount} releases each`);
